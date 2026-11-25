"""
AgentFlow - Incoming AI Voice Call Engine (Twilio / Telephony)
Manages incoming call webhooks, conversational TwiML loops, multi-turn speech recognition,
LLM-powered phone dialogues, post-call AI summaries, and automated Telegram notifications.
"""

import os
import re
import json
import base64
import hmac
import hashlib
import urllib.parse
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
import requests

from backend.credentials import get_credential
from backend.llm_provider import is_llm_available, get_chat_llm
from backend.db import get_call_task_by_id, get_call_task_by_sid, save_call_task, update_call_task_status

VOICE_NAME = "Polly.Aditi"
VOICE_LANGUAGE = "en-IN"

DEFAULT_VOICE_PROMPT = """You are the official AgentFlow AI Voice Assistant on an active incoming phone call.
You assist callers politely, record messages accurately, provide helpful technical and scheduling information, and coordinate follow-ups.

Rules for your spoken answers:
1. Speak naturally, warmly, and concisely as if talking on a phone call.
2. Keep your answers short: 1 to 3 spoken sentences maximum.
3. NEVER use Markdown, asterisks, bullet points, emoji, code blocks, or URLs (they sound awkward when spoken by text-to-speech).
4. Truthfully represent capabilities without exaggerating experience or making unauthorized contractual commitments.
5. If the caller asks about jobs, partnerships, or meetings, express appreciation, capture their contact details and inquiry, and confirm that the team will review and respond promptly.
6. If the caller asks what you can do, explain you are an AI assistant that can take messages, note inquiry details, and route urgent requests.
7. If the caller seems ready to hang up or says goodbye, provide a polite closing.
"""

def get_voice_system_prompt() -> str:
    custom = get_credential("VOICE_INSTRUCTIONS")
    return custom.strip() if custom and custom.strip() else DEFAULT_VOICE_PROMPT

FAREWELL_PATTERNS = [
    r"\b(bye|goodbye|bye bye|see you|talk to you later|that is all|that's all|nothing else|no thanks|no thank you|alvida|tata)\b",
    r"\b(have a good day|have a nice day|thank you so much|thank you goodbye)\b",
    r"\b(hang up|all done|i am done|i'm done|nope that is it|nope that's it)\b"
]


def xml_escape(text: str) -> str:
    """Escapes special characters safely for TwiML XML."""
    if not text:
        return ""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def validate_twilio_signature(
    webhook_url: str,
    params: Dict[str, Any],
    signature: Optional[str] = None,
    auth_token: Optional[str] = None
) -> bool:
    """
    Validates Twilio X-Twilio-Signature header using HMAC-SHA1.
    - When TWILIO_AUTH_TOKEN is configured (production), strict signature verification is enforced.
    - Missing or invalid signatures are strictly rejected.
    - When TWILIO_AUTH_TOKEN is unset (local development/unit testing without Twilio), permits requests.
    """
    token = auth_token or get_credential("TWILIO_AUTH_TOKEN")
    
    # In production or when auth token is configured: signature is strictly mandatory
    if token:
        if not signature:
            return False
        try:
            # Twilio HMAC algorithm: full URL + sorted POST body parameters (key + value)
            s = webhook_url
            for key in sorted(params.keys()):
                s += str(key) + str(params[key])

            computed = base64.b64encode(
                hmac.new(token.encode("utf-8"), s.encode("utf-8"), hashlib.sha1).digest()
            ).decode("utf-8")

            return hmac.compare_digest(computed, signature)
        except Exception:
            return False

    # Development fallback only when no auth token is configured
    return True


def is_caller_farewell(text: str) -> bool:
    """Detects whether the caller indicated they want to end the call."""
    if not text:
        return False
    lower = text.lower().strip()
    return any(re.search(pat, lower) for pat in FAREWELL_PATTERNS)


def generate_greeting_twiml(turn_action_url: str, caller_name: Optional[str] = None) -> str:
    """Generates initial TwiML greeting with speech recognition gather."""
    name_phrase = f" {xml_escape(caller_name)}" if caller_name else ""
    configured_greeting = get_credential("VOICE_GREETING_MESSAGE", "Hello! Thank you for calling. I am your AgentFlow AI voice assistant. How may I assist you today?")
    greeting_text = xml_escape(f"Hello{name_phrase}! {configured_greeting}" if caller_name else configured_greeting)
    lang = get_credential("VOICE_LANGUAGE", VOICE_LANGUAGE)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="{VOICE_NAME}" language="{lang}">{greeting_text}</Say>
    <Gather input="speech" action="{turn_action_url}" method="POST" speechTimeout="auto" timeout="4" language="{lang}">
        <Pause length="1"/>
    </Gather>
    <Say voice="{VOICE_NAME}" language="{lang}">Are you still on the line? Please let me know how I can help you, or feel free to call back later.</Say>
    <Gather input="speech" action="{turn_action_url}" method="POST" speechTimeout="auto" timeout="3" language="{lang}"/>
    <Say voice="{VOICE_NAME}" language="{lang}">I did not receive a response. Thank you for calling AgentFlow. Have a wonderful day. Goodbye!</Say>
    <Hangup/>
</Response>"""


def generate_turn_twiml(ai_reply: str, turn_action_url: str) -> str:
    """Generates TwiML response containing AI answer and gathers next speech input."""
    clean_reply = xml_escape(ai_reply)
    lang = get_credential("VOICE_LANGUAGE", VOICE_LANGUAGE)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="{VOICE_NAME}" language="{lang}">{clean_reply}</Say>
    <Gather input="speech" action="{turn_action_url}" method="POST" speechTimeout="auto" timeout="4" language="{lang}">
        <Pause length="1"/>
    </Gather>
    <Say voice="{VOICE_NAME}" language="{lang}">Are you still there? Please let me know if you need anything else.</Say>
    <Gather input="speech" action="{turn_action_url}" method="POST" speechTimeout="auto" timeout="3" language="{lang}"/>
    <Say voice="{VOICE_NAME}" language="{lang}">Thank you for your time. Have a wonderful day. Goodbye!</Say>
    <Hangup/>
</Response>"""


def generate_farewell_twiml(closing_text: Optional[str] = None) -> str:
    """Generates closing TwiML when caller ends the call."""
    msg = closing_text or "Thank you for calling. I have logged your message and our team will follow up if needed. Have a wonderful day. Goodbye!"
    clean_msg = xml_escape(msg)
    lang = get_credential("VOICE_LANGUAGE", VOICE_LANGUAGE)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="{VOICE_NAME}" language="{lang}">{clean_msg}</Say>
    <Hangup/>
</Response>"""


def generate_reprompt_twiml(turn_action_url: str) -> str:
    """Generates polite reprompt when speech was silence or unclear."""
    lang = get_credential("VOICE_LANGUAGE", VOICE_LANGUAGE)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="{VOICE_NAME}" language="{lang}">I am sorry, I could not hear you clearly. Could you please repeat that?</Say>
    <Gather input="speech" action="{turn_action_url}" method="POST" speechTimeout="auto" timeout="4" language="{lang}"/>
    <Say voice="{VOICE_NAME}" language="{lang}">It seems we may have audio issues. Please feel free to call back anytime. Goodbye!</Say>
    <Hangup/>
</Response>"""


def generate_fallback_conversational_reply(caller_text: str) -> str:
    """Reliable fallback speech generation when local or cloud LLM is unreachable."""
    lower = caller_text.lower()
    
    if any(w in lower for w in ["job", "hire", "recruiter", "interview", "position", "role"]):
        return "Thank you for reaching out regarding opportunities. Could you share your company name and role so I can alert the team right away?"
    
    if any(w in lower for w in ["who are you", "what can you do", "agentflow", "assistant"]):
        return "I am the AgentFlow autonomous AI Voice Assistant. I can take messages, provide project details, and route your requests."
    
    if any(w in lower for w in ["skills", "experience", "python", "tech stack", "background", "architecture"]):
        return "Our stack focuses on Python, FastAPI, React, LangGraph autonomous workflows, and local LLM integrations. Would you like to leave your details for a follow-up?"

    if any(w in lower for w in ["call back", "contact", "reach", "email", "phone", "number"]):
        return "Certainly! I have your caller number recorded and I will notify the team immediately after this call to connect with you."

    return "Thank you for sharing that. I have noted your message for the team. Is there anything else you would like me to pass along?"



def process_caller_speech_turn(
    caller_speech: str,
    transcript_history: List[Dict[str, str]],
    caller_phone: str = ""
) -> str:
    """
    Generates conversational AI response using configured LLM provider (Ollama, Groq, Gemini),
    with instant robust fallback if LLM is offline.
    """
    if not caller_speech or not caller_speech.strip():
        return "I'm listening. How can I help you today?"

    avail, _ = is_llm_available()
    if not avail:
        return generate_fallback_conversational_reply(caller_speech)

    try:
        from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
        llm = get_chat_llm(temperature=0.3, timeout=12.0)

        messages = [SystemMessage(content=get_voice_system_prompt())]
        for turn in transcript_history[-6:]:
            role = turn.get("role")
            text = turn.get("text", "")
            if role == "caller":
                messages.append(HumanMessage(content=text))
            elif role == "assistant":
                messages.append(AIMessage(content=text))

        messages.append(HumanMessage(content=f"Caller said: '{caller_speech}'"))
        response = llm.invoke(messages)
        content = getattr(response, "content", "")
        if isinstance(content, list):
            content = " ".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in content])
        
        reply = str(content).strip()
        # Clean formatting for clean TTS
        reply = re.sub(r"[\*\_#`]", "", reply)
        reply = re.sub(r"https?://\S+", "", reply)
        reply = re.sub(r"\s+", " ", reply).strip()

        if len(reply) < 3:
            return generate_fallback_conversational_reply(caller_speech)
        return reply

    except Exception:
        return generate_fallback_conversational_reply(caller_speech)


def summarize_voice_call(transcript_text: str, caller_phone: str = "") -> Dict[str, Any]:
    """Generates an AI summary, key details, and determines whether a callback is requested."""
    if not transcript_text or len(transcript_text.strip()) < 10:
        return {
            "summary": "Brief incoming call received with minimal or no caller dialogue.",
            "intent": "Inquiry",
            "callback_needed": False,
            "key_details": "No substantial speech captured."
        }

    avail, _ = is_llm_available()
    if avail:
        try:
            from langchain_core.messages import SystemMessage, HumanMessage
            llm = get_chat_llm(temperature=0.1, timeout=15.0)
            prompt = (
                "You are an executive assistant. Summarize this incoming phone call transcript in 2 sentences.\n"
                "Also indicate: Callback Needed (Yes or No), and Key Details.\n"
                "Format as JSON with keys: summary, callback_needed (boolean), key_details, intent.\n\n"
                f"Transcript:\n{transcript_text}"
            )
            resp = llm.invoke([SystemMessage(content="You analyze phone transcripts."), HumanMessage(content=prompt)])
            raw = str(getattr(resp, "content", "")).strip()
            # Extract JSON
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                return {
                    "summary": str(data.get("summary", "")).strip(),
                    "intent": str(data.get("intent", "General Inquiry")).strip(),
                    "callback_needed": bool(data.get("callback_needed", False)),
                    "key_details": str(data.get("key_details", "")).strip()
                }
        except Exception:
            pass

    # Fallback heuristic summary
    lower = transcript_text.lower()
    needs_callback = any(k in lower for k in ["call back", "call me", "reach me", "interview", "job", "hire", "meeting", "tomorrow"])
    
    intent = "General Inquiry"
    if any(k in lower for k in ["job", "hire", "recruiter", "interview", "role"]):
        intent = "Job Opportunity"
    elif any(k in lower for k in ["collaboration", "project", "contract", "client"]):
        intent = "Business Collaboration"
    elif any(k in lower for k in ["test", "demo", "checking"]):
        intent = "System Test"

    return {
        "summary": f"Inbound phone call from {caller_phone or 'caller'}. Discussion centered on {intent.lower()}.",
        "intent": intent,
        "callback_needed": needs_callback,
        "key_details": "Transcript captured and recorded in AgentFlow database."
    }


def send_voice_call_telegram_alert(call_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sends an automated, secure Telegram notification to TELEGRAM_CHAT_ID upon call completion.
    Never exposes API keys or tokens in message content.
    """
    bot_token = (get_credential("TELEGRAM_BOT_TOKEN") or "").strip()
    chat_id = (get_credential("TELEGRAM_CHAT_ID") or "").strip()

    if not bot_token or not chat_id:
        return {
            "success": False,
            "simulated": True,
            "message": "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured in settings."
        }

    caller = call_data.get("recipient_phone") or "Unknown Caller"
    duration = call_data.get("duration_seconds", 0)
    status = (call_data.get("status") or "completed").capitalize()
    summary = call_data.get("summary") or "Inbound voice call received."
    callback_needed = "⚠️ YES (Callback Requested)" if call_data.get("callback_needed") or "call back" in summary.lower() else "No"
    intent = call_data.get("intent") or "General Inquiry"
    call_sid = call_data.get("call_sid") or call_data.get("id") or ""
    masked_sid = f"...{call_sid[-8:]}" if len(call_sid) > 8 else call_sid

    msg_text = (
        f"📞 *Incoming AI Call Completed*\n\n"
        f"• *Caller:* `{caller}`\n"
        f"• *Duration:* {duration}s\n"
        f"• *Status:* {status}\n"
        f"• *Intent:* {intent}\n"
        f"• *Callback Needed:* {callback_needed}\n"
        f"• *Call ID:* `{masked_sid}`\n\n"
        f"📝 *Summary:*\n{summary}\n"
    )

    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        resp = requests.post(url, json={
            "chat_id": chat_id,
            "text": msg_text,
            "parse_mode": "Markdown",
            "disable_web_page_preview": True
        }, timeout=8)

        data = resp.json()
        if data.get("ok"):
            return {
                "success": True,
                "message_id": data.get("result", {}).get("message_id"),
                "status": "delivered"
            }
        else:
            # Fallback to plain text if Markdown parsing fails
            clean_plain = msg_text.replace("*", "").replace("`", "")
            retry_resp = requests.post(url, json={
                "chat_id": chat_id,
                "text": clean_plain,
                "disable_web_page_preview": True
            }, timeout=8)
            return {
                "success": retry_resp.json().get("ok", False),
                "status": "delivered_plain" if retry_resp.json().get("ok") else "failed",
                "error": data.get("description")
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
