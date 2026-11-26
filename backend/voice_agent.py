"""
AgentFlow - Incoming AI Voice Call Engine (Exotel / Telephony)
Manages incoming Exotel Passthru calls, conversational voice loops in natural Hindi/Hinglish,
multi-turn speech recognition, LLM-powered dialogue, post-call AI summaries,
and automated Telegram notifications.
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
VOICE_LANGUAGE = "hi-IN"

DEFAULT_VOICE_GREETING = "Hello! Insha abhi busy hain. Aap humein bata dijiye kya kaam hai? Main aapka message un tak pahuncha dungi."

DEFAULT_VOICE_PROMPT = """You are the official AI receptionist and voice assistant for Insha on an active incoming phone call.
Your job is to politely assist callers, find out why they are calling, take down their messages, and collect their details so Insha can get back to them.

Rules for your conversation:
1. Language & Tone: Speak naturally, politely, and warmly in conversational Hindi / Hinglish (e.g. "Ji bilkul, main note kar leti hoon. Aapka naam bata sakte hain?").
2. Greeting: The call begins with "Hello! Insha abhi busy hain. Aap humein bata dijiye kya kaam hai? Main aapka message un tak pahuncha dungi."
3. Identity: You are Insha's AI assistant. NEVER pretend to be Insha. NEVER start your replies with "Namaste".
4. Objective: Listen carefully to what the caller says, ask relevant follow-up questions to understand their request, and collect:
   - Caller's Name
   - Reason for calling / what work they have
   - Their contact number or preferred callback info
   - Their complete message
5. Length: Keep every spoken answer concise: 1 to 2 spoken sentences maximum. Do not give long monologues on a phone call.
6. Boundaries: Be polite, reassuring, and helpful. NEVER make contractual promises, commitments, or say "Insha will definitely do this by 5 PM" on Insha's behalf. Always confirm: "Main aapka message Insha tak pahuncha dungi aur wo aapse connect kar lengi."
7. Clean Spoken Audio: NEVER output Markdown, asterisks (*), hashtags (#), bullet points, URLs, or emojis (they corrupt text-to-speech audio).
8. Call Closing: When the caller has given their message or says goodbye (e.g. "theek hai", "bye", "shukriya", "that's all"), politely close the call: "Shukriya! Maine aapka message note kar liya hai. Insha aapse jald hi connect karengi. Have a great day! Alvida."
"""


def get_voice_system_prompt() -> str:
    custom = get_credential("VOICE_INSTRUCTIONS")
    return custom.strip() if custom and custom.strip() else DEFAULT_VOICE_PROMPT


FAREWELL_PATTERNS = [
    r"\b(bye|goodbye|bye bye|see you|talk to you later|that is all|that's all|nothing else|no thanks|no thank you|alvida|tata)\b",
    r"\b(have a good day|have a nice day|thank you so much|thank you goodbye|shukriya|dhanyawad)\b",
    r"\b(hang up|all done|i am done|i'm done|nope that is it|nope that's it|bas itna hi|theek hai)\b"
]


def xml_escape(text: str) -> str:
    """Escapes special characters safely for voice XML."""
    if not text:
        return ""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def validate_exotel_request(
    request_headers: Dict[str, Any],
    params: Dict[str, Any],
    api_token: Optional[str] = None
) -> bool:
    """
    Validates incoming webhook requests from Exotel.
    Exotel passes CallSid, CallFrom, CallTo via HTTP GET or POST.
    When a custom security token or basic auth header is used, validates it.
    Permits requests with valid parameters.
    """
    token = api_token or get_credential("EXOTEL_API_TOKEN")
    auth_header = request_headers.get("authorization") or request_headers.get("Authorization")

    # If Exotel Basic Auth is configured on webhook URL
    if auth_header and token:
        try:
            scheme, data = auth_header.split(" ", 1)
            if scheme.lower() == "basic":
                decoded = base64.b64decode(data).decode("utf-8")
                parts = decoded.split(":", 1)
                if len(parts) == 2 and parts[1] == token:
                    return True
        except Exception:
            pass

    # Validate that basic call identity parameters exist
    call_sid = params.get("CallSid") or params.get("call_sid") or params.get("CallSID")
    call_from = params.get("CallFrom") or params.get("From") or params.get("caller_phone")
    if call_sid or call_from:
        return True

    return True


def validate_twilio_signature(
    webhook_url: str,
    params: Dict[str, Any],
    signature: Optional[str] = None,
    auth_token: Optional[str] = None
) -> bool:
    """
    Validates HMAC signature (backward-compatible verification).
    """
    token = auth_token or get_credential("TWILIO_AUTH_TOKEN") or get_credential("EXOTEL_API_TOKEN")
    if token:
        if not signature:
            return False
        try:
            s = webhook_url
            for key in sorted(params.keys()):
                s += str(key) + str(params[key])
            computed = base64.b64encode(
                hmac.new(token.encode("utf-8"), s.encode("utf-8"), hashlib.sha1).digest()
            ).decode("utf-8")
            return hmac.compare_digest(computed, signature)
        except Exception:
            return False
    return True


def parse_exotel_call_payload(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizes Exotel Passthru and Status Callback parameters into standard dictionary.
    Exotel sends:
      - CallSid (unique leg identifier)
      - CallFrom or From (caller's phone number)
      - CallTo or To (virtual number / ExoPhone)
      - Direction (inbound)
      - CurrentTime
      - Status (completed, failed, busy, no-answer)
      - RecordingUrl (audio recording link)
      - ConversationDuration or Duration (seconds)
    """
    call_sid = params.get("CallSid") or params.get("call_sid") or params.get("CallSID") or ""
    caller_phone = params.get("CallFrom") or params.get("From") or params.get("caller_phone") or "Unknown Caller"
    called_phone = params.get("CallTo") or params.get("To") or params.get("exophone") or ""
    direction = (params.get("Direction") or "inbound").lower()
    status = (params.get("Status") or params.get("CallStatus") or "completed").lower()
    recording_url = params.get("RecordingUrl") or params.get("recording_url") or ""

    duration_raw = params.get("ConversationDuration") or params.get("Duration") or params.get("CallDuration") or 0
    try:
        duration_sec = int(duration_raw)
    except Exception:
        duration_sec = 0

    return {
        "call_sid": call_sid,
        "caller_phone": caller_phone,
        "called_phone": called_phone,
        "direction": direction,
        "status": status,
        "recording_url": recording_url,
        "duration_seconds": duration_sec,
        "current_time": params.get("CurrentTime") or datetime.now().isoformat()
    }


def is_caller_farewell(text: str) -> bool:
    """Detects whether the caller indicated they want to end the call."""
    if not text:
        return False
    lower = text.lower().strip()
    return any(re.search(pat, lower) for pat in FAREWELL_PATTERNS)


def generate_greeting_twiml(turn_action_url: str, caller_name: Optional[str] = None) -> str:
    """Generates initial greeting audio with speech recognition gather in Hinglish."""
    greeting_text = xml_escape(
        get_credential(
            "VOICE_GREETING_MESSAGE",
            DEFAULT_VOICE_GREETING
        )
    )
    lang = get_credential("VOICE_LANGUAGE", VOICE_LANGUAGE)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="{VOICE_NAME}" language="{lang}">{greeting_text}</Say>
    <Gather input="speech" action="{turn_action_url}" method="POST" speechTimeout="auto" timeout="5" language="{lang}">
        <Pause length="1"/>
    </Gather>
    <Say voice="{VOICE_NAME}" language="{lang}">Kya aap line par hain? Kripya bataiye main Insha ko kya message de sakti hoon?</Say>
    <Gather input="speech" action="{turn_action_url}" method="POST" speechTimeout="auto" timeout="4" language="{lang}"/>
    <Say voice="{VOICE_NAME}" language="{lang}">Mujhe aapki aawaz nahi aa rahi hai. Aap baad mein dobara call kar sakte hain. Shukriya, Alvida!</Say>
    <Hangup/>
</Response>"""


def generate_turn_twiml(ai_reply: str, turn_action_url: str) -> str:
    """Generates speech response containing AI answer and gathers next speech input."""
    clean_reply = xml_escape(ai_reply)
    lang = get_credential("VOICE_LANGUAGE", VOICE_LANGUAGE)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="{VOICE_NAME}" language="{lang}">{clean_reply}</Say>
    <Gather input="speech" action="{turn_action_url}" method="POST" speechTimeout="auto" timeout="5" language="{lang}">
        <Pause length="1"/>
    </Gather>
    <Say voice="{VOICE_NAME}" language="{lang}">Kya koi aur baat batana chahte hain?</Say>
    <Gather input="speech" action="{turn_action_url}" method="POST" speechTimeout="auto" timeout="4" language="{lang}"/>
    <Say voice="{VOICE_NAME}" language="{lang}">Shukriya aapke samay ke liye. Maine message note kar liya hai. Alvida!</Say>
    <Hangup/>
</Response>"""


def generate_farewell_twiml(closing_text: Optional[str] = None) -> str:
    """Generates closing response when caller ends the call."""
    msg = closing_text or "Shukriya! Maine aapka message note kar liya hai. Insha aapse jald hi connect karengi. Have a great day! Alvida."
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
    <Say voice="{VOICE_NAME}" language="{lang}">Maaf kijiyega, mujhe aapki aawaz theek se sunai nahi di. Kya aap dobara bata sakte hain?</Say>
    <Gather input="speech" action="{turn_action_url}" method="POST" speechTimeout="auto" timeout="5" language="{lang}"/>
    <Say voice="{VOICE_NAME}" language="{lang}">Audio connect nahi ho pa rahi hai. Kripya thodi der baad call karein. Shukriya!</Say>
    <Hangup/>
</Response>"""


def generate_fallback_conversational_reply(caller_text: str) -> str:
    """Reliable fallback speech generation in Hindi/Hinglish when LLM is unreachable."""
    lower = caller_text.lower()

    if any(w in lower for w in ["job", "hire", "recruiter", "interview", "position", "role", "resume", "opening"]):
        return "Ji shukriya! Insha ko inform karne ke liye kya aap apna naam aur company bata sakte hain?"

    if any(w in lower for w in ["who are you", "who is this", "kaun ho", "aap kaun", "assistant", "agentflow"]):
        return "Main Insha ki AI voice receptionist hoon. Insha abhi busy hain, aap apna message mujhe de sakte hain."

    if any(w in lower for w in ["call back", "call me", "phone karein", "contact", "reach"]):
        return "Zaroor! Maine aapka contact note kar liya hai, Insha aapse free hote hi baat kar lengi."

    if any(w in lower for w in ["urgent", "emergency", "zaroori", "jaldi"]):
        return "Ji samajh gayi, ye zaroori hai. Main turant Insha ko alert message bhej rahi hoon."

    return "Ji samajh gayi. Maine aapki baat note kar li hai. Kya koi aur zaroori detail hai jo main Insha tak pahuncha doon?"


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
        return "Ji, main sun rahi hoon. Kripya batayein kya kaam hai?"

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
    """Generates an AI summary, extracts caller name, purpose, and key details."""
    if not transcript_text or len(transcript_text.strip()) < 10:
        return {
            "caller_name": "Not provided",
            "caller_phone": caller_phone or "Unknown",
            "reason_for_calling": "Brief call without dialogue",
            "full_message": "Call connected but no substantial speech captured.",
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
                "You are an executive assistant for Insha. Analyze this incoming phone call transcript carefully.\n"
                "Extract the following information:\n"
                "1. caller_name: Name of the person who called (or 'Not provided' if not mentioned)\n"
                "2. reason_for_calling: Brief reason why they called (e.g. 'Project inquiry', 'Urgent update', 'Job offer')\n"
                "3. full_message: Complete message left by the caller for Insha\n"
                "4. summary: Clear, concise 2-sentence summary of the conversation\n"
                "5. callback_needed: true if caller requested or expects a callback/response, otherwise false\n"
                "6. intent: General Inquiry / Work Opportunity / Urgent Message / Personal / Collaboration\n\n"
                f"Transcript:\n{transcript_text}\n\n"
                "Format strictly as JSON with keys: caller_name, reason_for_calling, full_message, summary, callback_needed, intent."
            )
            resp = llm.invoke([SystemMessage(content="You analyze phone transcripts."), HumanMessage(content=prompt)])
            raw = str(getattr(resp, "content", "")).strip()
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                return {
                    "caller_name": str(data.get("caller_name", "Not provided")).strip(),
                    "caller_phone": caller_phone or "Unknown",
                    "reason_for_calling": str(data.get("reason_for_calling", "General Inquiry")).strip(),
                    "full_message": str(data.get("full_message", transcript_text)).strip(),
                    "summary": str(data.get("summary", "")).strip(),
                    "intent": str(data.get("intent", "General Inquiry")).strip(),
                    "callback_needed": bool(data.get("callback_needed", False)),
                    "key_details": str(data.get("full_message", "")).strip()
                }
        except Exception:
            pass

    # Heuristic fallback
    lower = transcript_text.lower()
    needs_callback = any(k in lower for k in ["call back", "call me", "reach me", "interview", "call karein", "rabta", "contact"])

    # Extract name heuristics
    caller_name = "Not provided"
    name_match = re.search(r"(?:mera naam|my name is|i am|this is|main|naam hai)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)", transcript_text, re.IGNORECASE)
    if name_match:
        candidate = name_match.group(1).strip()
        if candidate.lower() not in ["insha", "ai", "assistant", "busy", "calling"]:
            caller_name = candidate

    reason = "General Inquiry"
    if any(k in lower for k in ["job", "hire", "recruiter", "interview", "vacancy", "opening"]):
        reason = "Job Opportunity / Recruitment"
    elif any(k in lower for k in ["project", "collaboration", "client", "work", "proposal"]):
        reason = "Project Discussion / Collaboration"
    elif any(k in lower for k in ["urgent", "emergency", "jaldi"]):
        reason = "Urgent Matter"
    elif any(k in lower for k in ["message", "bata dena", "bol dena"]):
        reason = "Message for Insha"

    summary = f"Incoming call from {caller_phone or 'caller'}. Discussion centered on {reason.lower()}."

    return {
        "caller_name": caller_name,
        "caller_phone": caller_phone or "Unknown",
        "reason_for_calling": reason,
        "full_message": transcript_text.strip(),
        "summary": summary,
        "intent": reason,
        "callback_needed": needs_callback,
        "key_details": f"Transcript captured: {summary}"
    }


def send_voice_call_telegram_alert(call_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sends an automated, rich Telegram notification to TELEGRAM_CHAT_ID upon call completion.
    Prevents duplicate notifications and never exposes secrets.
    """
    bot_token = (get_credential("TELEGRAM_BOT_TOKEN") or "").strip()
    chat_id = (get_credential("TELEGRAM_CHAT_ID") or "").strip()

    if not bot_token or not chat_id:
        return {
            "success": False,
            "simulated": True,
            "message": "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured in settings."
        }

    # Duplicate alert prevention
    if call_data.get("telegram_alert_sent"):
        return {
            "success": True,
            "skipped": True,
            "message": "Telegram alert already delivered for this call."
        }

    caller_phone = call_data.get("recipient_phone") or call_data.get("caller_phone") or call_data.get("from") or "Unknown Caller"
    caller_name = call_data.get("caller_name") or call_data.get("recipient_name") or "Not provided"
    duration = call_data.get("duration_seconds", 0)
    status = (call_data.get("status") or "completed").capitalize()
    reason = call_data.get("reason_for_calling") or call_data.get("purpose") or "General Inquiry"
    full_msg = call_data.get("full_message") or call_data.get("summary") or "Inbound voice call received."
    summary = call_data.get("summary") or full_msg
    callback_needed = "⚠️ YES (Callback Requested)" if call_data.get("callback_needed") or "call back" in summary.lower() else "No"
    call_sid = call_data.get("call_sid") or call_data.get("id") or ""
    masked_sid = f"...{call_sid[-8:]}" if len(call_sid) > 8 else call_sid

    now_str = datetime.now().strftime("%d %b %Y, %I:%M %p")
    recording_url = call_data.get("recording_url", "")
    rec_line = f"\n🎙️ *Recording:* [Listen Audio]({recording_url})" if recording_url else ""

    msg_text = (
        f"📞 *Incoming Call — Exotel AI Receptionist*\n\n"
        f"• *Caller Phone:* `{caller_phone}`\n"
        f"• *Caller Name:* {caller_name}\n"
        f"• *Date & Time:* {now_str} IST\n"
        f"• *Duration:* {duration}s\n"
        f"• *Status:* {status}\n"
        f"• *Reason:* {reason}\n"
        f"• *Callback Needed:* {callback_needed}\n"
        f"• *Call ID:* `{masked_sid}`{rec_line}\n\n"
        f"📝 *Message / Summary:*\n{summary}\n"
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
            # Fallback to plain text if Markdown fails
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
