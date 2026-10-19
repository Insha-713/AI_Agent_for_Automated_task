"""
AgentFlow - Prompt-to-Workflow Engine (Stage 1)
Translates natural language prompts (English, Hindi, Urdu) into validated, visual JSON step-graphs.
Executes step-by-step with:
- Strict registered tool validation (zero tool invention)
- Missing credential & integration checks
- Dry-run simulation mode
- Human-in-the-loop approval gating
- Step-by-step data passing ({{step_id.output}} and {{key}})
- Timeouts, bounded retries (max 2), cancellation support
- SQLite persistence surviving restarts
"""

import os
import re
import json
import time
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, AsyncGenerator
from dotenv import load_dotenv

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_ollama import ChatOllama

from backend.tools import (
    ALL_TOOLS,
    multi_search,
    get_latest_news,
    fetch_page,
    search_sources,
    get_datetime,
    web_search,
    save_file,
    read_file,
    list_files,
    send_email,
    send_telegram_message,
    analyze_tabular_data,
    check_website_health,
    get_weather,
    read_important_emails,
    WORKSPACE_PATH,
    _safe_workspace_path,
)
from backend.approvals import approval_manager
from backend.agent import detect_ollama_model
from backend.db import (
    save_workflow,
    update_workflow_status,
    create_workflow_run_record,
    update_workflow_run_record,
    get_workflow_by_id,
)

load_dotenv()

# Active in-memory cancellations
ACTIVE_CANCELLATIONS: set = set()

# ==========================================
# Registered Tools Specifications
# ==========================================

REGISTERED_TOOLS_META = {
    "get_datetime": {
        "display_name": "Get Current IST Time",
        "description": "Returns current date, day of week, and real-time IST time.",
        "params": {},
        "requires_approval": False,
        "required_credentials": [],
        "func": get_datetime.func if hasattr(get_datetime, "func") else get_datetime,
    },
    "get_latest_news": {
        "display_name": "Fetch Latest News (RSS)",
        "description": "Fetches verified latest headlines, publish dates, and links via Google News RSS.",
        "params": {"topic": "str", "days": "int"},
        "requires_approval": False,
        "required_credentials": [],
        "func": get_latest_news.func if hasattr(get_latest_news, "func") else get_latest_news,
    },
    "multi_search": {
        "display_name": "Multi-Search (Parallel DDG)",
        "description": "Searches DuckDuckGo across 3-5 query variants in parallel with deduplication.",
        "params": {"queries": "list[str]", "period": "str"},
        "requires_approval": False,
        "required_credentials": [],
        "func": multi_search.func if hasattr(multi_search, "func") else multi_search,
    },
    "fetch_page": {
        "display_name": "Fetch & Clean Webpage",
        "description": "Downloads and extracts full text content (~4000 chars) and publish date via Trafilatura.",
        "params": {"url": "str"},
        "requires_approval": False,
        "required_credentials": [],
        "func": fetch_page.func if hasattr(fetch_page, "func") else fetch_page,
    },
    "search_sources": {
        "display_name": "Specialized Sources Search",
        "description": "Targeted search on wikipedia, hackernews, reddit, arxiv, or youtube.",
        "params": {"topic": "str", "source": "str"},
        "requires_approval": False,
        "required_credentials": [],
        "func": search_sources.func if hasattr(search_sources, "func") else search_sources,
    },
    "web_search": {
        "display_name": "Web Search",
        "description": "Standard DuckDuckGo search with date filtering.",
        "params": {"query": "str", "period": "str"},
        "requires_approval": False,
        "required_credentials": [],
        "func": web_search.func if hasattr(web_search, "func") else web_search,
    },
    "save_file": {
        "display_name": "Save File to Workspace",
        "description": "Saves text, markdown, or data safely inside sandboxed workspace/.",
        "params": {"filename": "str", "content": "str", "overwrite": "bool"},
        "requires_approval": True,
        "required_credentials": [],
        "func": save_file.func if hasattr(save_file, "func") else save_file,
    },
    "read_file": {
        "display_name": "Read Workspace File",
        "description": "Reads text or extracts text from PDF files in workspace/.",
        "params": {"filename": "str"},
        "requires_approval": False,
        "required_credentials": [],
        "func": read_file.func if hasattr(read_file, "func") else read_file,
    },
    "list_files": {
        "display_name": "List Workspace Files",
        "description": "Lists all files, sizes, and timestamps in workspace/.",
        "params": {},
        "requires_approval": False,
        "required_credentials": [],
        "func": list_files.func if hasattr(list_files, "func") else list_files,
    },
    "send_email": {
        "display_name": "Send Email (Gmail SMTP)",
        "description": "Sends an email to a recipient. Requires Gmail credentials and explicit human approval.",
        "params": {"to_email": "str", "subject": "str", "body": "str"},
        "requires_approval": True,
        "required_credentials": ["EMAIL_USER", "EMAIL_PASS"],
        "func": send_email.func if hasattr(send_email, "func") else send_email,
    },
    "send_telegram_message": {
        "display_name": "Send Telegram Message",
        "description": "Sends an instant news report, alert, or digest to Telegram. Requires approval.",
        "params": {"message": "str", "chat_id": "str", "parse_mode": "str"},
        "requires_approval": True,
        "required_credentials": ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
        "func": send_telegram_message.func if hasattr(send_telegram_message, "func") else send_telegram_message,
    },
    "analyze_tabular_data": {
        "display_name": "Analyze CSV / Excel Data",
        "description": "Cleans tabular data, computes KPIs, and generates downloadable Excel and Markdown executive reports.",
        "params": {"filename": "str", "focus_metric": "str"},
        "requires_approval": False,
        "required_credentials": [],
        "func": analyze_tabular_data.func if hasattr(analyze_tabular_data, "func") else analyze_tabular_data,
    },
    "check_website_health": {
        "display_name": "Check Website Health & Latency",
        "description": "Checks uptime, HTTP status code, and latency in milliseconds for any website or API endpoint.",
        "params": {"url": "str", "expected_status": "int"},
        "requires_approval": False,
        "required_credentials": [],
        "func": check_website_health.func if hasattr(check_website_health, "func") else check_website_health,
    },
    "get_weather": {
        "display_name": "Get Weather & Forecast (Open-Meteo)",
        "description": "Fetches current temperature, weather conditions, humidity, and forecast using the free Open-Meteo API.",
        "params": {"city": "str", "days": "int"},
        "requires_approval": False,
        "required_credentials": [],
        "func": get_weather.func if hasattr(get_weather, "func") else get_weather,
    },
    "read_important_emails": {
        "display_name": "Read Important Inbox Emails (IMAP)",
        "description": "Reads unread inbox emails over IMAP with prompt-injection sanitization according to importance criteria.",
        "params": {"max_emails": "int", "criteria": "str"},
        "requires_approval": False,
        "required_credentials": ["EMAIL_USER", "EMAIL_PASS"],
        "func": read_important_emails.func if hasattr(read_important_emails, "func") else read_important_emails,
    },
}


# ==========================================
# Stage 1: Conversational Requirement Extraction Engine
# ==========================================

def parse_time_and_schedule(prompt: str) -> Dict[str, Any]:
    """
    Extracts frequency, scheduled time (IST), and cron details from natural language prompts.
    Supports English, Hindi, and Urdu.
    """
    p_lower = prompt.lower()
    time_24 = None
    time_display = None
    frequency = "daily"

    # Match time formats: "5 pm", "5:00 pm", "17:00", "8 am", "9 am", "subah 8 baje", "shaam 5 baje", etc.
    time_match = re.search(r"(\b\d{1,2})(?::(\d{2}))?\s*(am|pm|baje|subah|shaam|dopahar)?\b", p_lower)
    
    # Check for Hindi/Urdu contextual qualifiers
    is_evening = any(w in p_lower for w in ["shaam", "pm", "raat", "evening", "night"])
    is_morning = any(w in p_lower for w in ["subah", "am", "morning", "fajr"])

    # Specific common Indian time patterns
    if re.search(r"\b(5\s*pm|17:00|5:00\s*pm|shaam\s*5|5\s*baje\s*shaam)\b", p_lower):
        time_24 = "17:00"
        time_display = "5:00 PM IST"
    elif re.search(r"\b(8\s*am|08:00|8:00\s*am|subah\s*8|8\s*baje\s*subah)\b", p_lower):
        time_24 = "08:00"
        time_display = "8:00 AM IST"
    elif re.search(r"\b(9\s*am|09:00|9:00\s*am|subah\s*9|9\s*baje\s*subah)\b", p_lower):
        time_24 = "09:00"
        time_display = "9:00 AM IST"
    elif re.search(r"\b(6\s*pm|18:00|6:00\s*pm|shaam\s*6)\b", p_lower):
        time_24 = "18:00"
        time_display = "6:00 PM IST"
    elif time_match:
        hr = int(time_match.group(1))
        mn = int(time_match.group(2)) if time_match.group(2) else 0
        ampm = time_match.group(3) or ""
        
        if (ampm == "pm" or is_evening) and hr < 12:
            hr += 12
        elif (ampm == "am" or is_morning) and hr == 12:
            hr = 0
            
        if 0 <= hr <= 23 and 0 <= mn <= 59:
            time_24 = f"{hr:02d}:{mn:02d}"
            display_ampm = "PM" if hr >= 12 else "AM"
            display_hr = hr if 1 <= hr <= 12 else (hr - 12 if hr > 12 else 12)
            time_display = f"{display_hr}:{mn:02d} {display_ampm} IST"

    # Frequency detection
    if any(w in p_lower for w in ["hourly", "har ghante", "every hour"]):
        frequency = "hourly"
    elif any(w in p_lower for w in ["weekly", "har hafte", "every week"]):
        frequency = "weekly"
    else:
        frequency = "daily"

    return {
        "is_scheduled": any(w in p_lower for w in ["every", "daily", "roz", "har", "subah", "shaam", "pm", "am", "schedule", "cron", "morning"]),
        "frequency": frequency,
        "time": time_24,
        "time_display": time_display,
        "timezone": "Asia/Kolkata"
    }


def extract_known_entities(prompt: str) -> Dict[str, Any]:
    """
    Extracts known entities directly provided in the prompt to prevent redundant questions.
    """
    known = {}
    p_lower = prompt.lower()

    # 1. City extraction
    common_cities = [
        "lucknow", "delhi", "new delhi", "mumbai", "bengaluru", "bangalore",
        "kolkata", "chennai", "hyderabad", "pune", "ahmedabad", "jaipur",
        "kanpur", "varanasi", "noida", "gurugram", "gurgaon", "chandigarh",
        "bhopal", "patna", "indore", "london", "dubai", "new york", "singapore"
    ]
    for city in common_cities:
        if re.search(rf"\b{re.escape(city)}\b", p_lower):
            # Ensure it's not a placeholder
            if "{city}" not in p_lower:
                known["city"] = city.title()
                break

    # If city not found from list, try regex patterns like "weather of X", "weather in X", "X weather", "X ka mausam"
    if "city" not in known and "{city}" not in p_lower:
        m = re.search(r"\b(?:weather\s+(?:of|in|for)|mausam)\s+([a-zA-Z\s]{3,20}?)(?:\s+(?:daily|every|at|by|ko|ka|se|\b))", prompt, re.I)
        if m:
            cand = m.group(1).strip()
            if cand.lower() not in ["city", "{city}", "report", "forecast", "today", "tomorrow"] and not cand.startswith("{"):
                known["city"] = cand.title()

    # 2. Email extraction
    if "{email}" not in prompt and "{receiver_email}" not in prompt:
        email_m = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", prompt)
        if email_m:
            known["receiver_email"] = email_m.group(0).strip()

    # 3. Important email criteria extraction
    crit_keywords = []
    if any(w in p_lower for w in ["job", "interview", "careers"]):
        crit_keywords.append("job offers, interviews")
    if any(w in p_lower for w in ["bill", "electricity", "bank", "payment", "due"]):
        crit_keywords.append("bills, bank alerts")
    if any(w in p_lower for w in ["client", "freelance", "project"]):
        crit_keywords.append("client messages")
    if any(w in p_lower for w in ["urgent", "emergency", "important"]):
        crit_keywords.append("urgent matters")
    if crit_keywords:
        known["important_criteria"] = ", ".join(crit_keywords)

    return known


async def extract_workflow_requirements(prompt: str, user_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Analyzes user task in plain English/Hindi/Urdu.
    Extracts:
    1. Goal summary
    2. Trigger / Schedule (default Asia/Kolkata)
    3. Registered tools needed
    4. Known inputs (already supplied)
    5. Missing inputs formatted as ONE-at-a-time interactive questions.
    """
    clean_prompt = prompt.strip()
    if not clean_prompt:
        raise ValueError("Task prompt cannot be empty.")

    user_context = user_context or {}
    p_lower = clean_prompt.lower()

    # Step 1: Detect Schedule
    sched_info = parse_time_and_schedule(clean_prompt)

    # Step 2: Detect Registered Tools Needed
    tools_needed: List[str] = []

    # Weather detection
    if any(w in p_lower for w in ["weather", "temperature", "forecast", "mausam", "rain"]):
        tools_needed.append("get_weather")

    # Important emails detection
    if any(w in p_lower for w in ["unread email", "important email", "inbox", "read email", "email digest"]):
        tools_needed.append("read_important_emails")

    # Website health check detection
    if any(w in p_lower for w in ["website", "uptime", "latency", "health check", "is online", "responding"]):
        tools_needed.append("check_website_health")

    # Tabular / CSV data detection
    if any(w in p_lower for w in [".csv", ".xlsx", "dataset", "placement", "sales_data", "expenses", "revenue", "ctc"]):
        tools_needed.append("analyze_tabular_data")

    # AI News detection
    if any(w in p_lower for w in ["news", "khabar", "samachar", "headlines", "ai news", "tech news", "arxiv"]):
        tools_needed.append("get_latest_news")

    # Save file detection
    if any(w in p_lower for w in ["save", "save to", "workspace/", ".txt", ".md"]):
        if "save_file" not in tools_needed:
            tools_needed.append("save_file")

    # Telegram send detection
    if any(w in p_lower for w in ["telegram", "telegram bot", "telegram channel"]):
        tools_needed.append("send_telegram_message")

    # Email send detection
    if any(w in p_lower for w in ["email", "mail", "gmail", "bhejo"]) and "read_important_emails" not in tools_needed:
        tools_needed.append("send_email")
    elif any(w in p_lower for w in ["send", "forward", "bhejo"]) and any(w in p_lower for w in ["email", "gmail"]):
        if "send_email" not in tools_needed:
            tools_needed.append("send_email")

    # Fallback to general search or time if no domain tool identified
    if not tools_needed:
        if any(w in p_lower for w in ["search", "find", "research", "dhundo"]):
            tools_needed.append("multi_search")
        else:
            tools_needed.append("get_datetime")

    # Ensure datetime is recorded if schedule requires live timestamping
    if sched_info["is_scheduled"] and "get_datetime" not in tools_needed:
        tools_needed.insert(0, "get_datetime")

    # Step 3: Extract Known Inputs
    known_inputs = extract_known_entities(clean_prompt)
    if sched_info["time"]:
        known_inputs["schedule_time"] = sched_info["time"]
    known_inputs["timezone"] = sched_info["timezone"]

    # Incorporate user settings if available
    default_email = user_context.get("default_email", "").strip() or os.getenv("EMAIL_USER", "").strip()
    if default_email and "receiver_email" not in known_inputs and ("send_email" in tools_needed and "me" in p_lower):
        known_inputs["receiver_email"] = default_email

    # Check already configured environment credentials
    env_telegram_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    env_telegram_chat = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    env_gmail_user = os.getenv("EMAIL_USER", "").strip() or os.getenv("GMAIL_EMAIL", "").strip()
    env_gmail_pass = os.getenv("EMAIL_PASS", "").strip() or os.getenv("GMAIL_APP_PASSWORD", "").strip()

    # Step 4: Formulate Questions for Missing Inputs (Strictly only what is missing!)
    questions: List[Dict[str, Any]] = []

    # 1. Weather Question: City
    if "get_weather" in tools_needed and "city" not in known_inputs:
        questions.append({
            "id": "q_city",
            "field": "city",
            "question": "Which city's weather would you like to receive?",
            "placeholder": "e.g., Lucknow, Mumbai, Delhi, Bengaluru",
            "input_type": "text",
            "quick_replies": ["Lucknow", "Delhi", "Bengaluru", "Mumbai"],
            "is_secret": False,
            "help_text": "Enter any Indian or international city name for real-time weather and forecast."
        })

    # 2. Schedule Time Question: if scheduled but time was not specified
    if sched_info["is_scheduled"] and "schedule_time" not in known_inputs:
        questions.append({
            "id": "q_schedule_time",
            "field": "schedule_time",
            "question": "What time should this workflow run daily? (Timezone: Asia/Kolkata)",
            "placeholder": "e.g., 5:00 PM or 17:00",
            "input_type": "time",
            "quick_replies": ["8:00 AM", "9:00 AM", "5:00 PM", "9:00 PM"],
            "is_secret": False,
            "help_text": "Time when the background scheduler will trigger this autonomous workflow."
        })

    # 3. Important Email Criteria Question
    if "read_important_emails" in tools_needed and "important_criteria" not in known_inputs:
        questions.append({
            "id": "q_important_criteria",
            "field": "important_criteria",
            "question": "Which types of emails should count as 'important' for your digest?",
            "placeholder": "e.g., job interviews, bank alerts, client messages, electricity bills",
            "input_type": "text",
            "quick_replies": [
                "Job offers & Interviews",
                "Bank & Bill alerts",
                "Client & Project messages",
                "All unread inbox messages"
            ],
            "is_secret": False,
            "help_text": "AgentFlow sanitizes email content and only summarizes messages matching these criteria."
        })

    # 4. Email Receiver Question
    if "send_email" in tools_needed and "receiver_email" not in known_inputs:
        quick_em = [default_email] if default_email else []
        questions.append({
            "id": "q_receiver_email",
            "field": "receiver_email",
            "question": "Which email address should receive the automated report?",
            "placeholder": "e.g., your_email@gmail.com",
            "input_type": "email",
            "quick_replies": quick_em,
            "is_secret": False,
            "help_text": "The destination inbox where the summary report will be delivered."
        })

    # 5. Telegram Credentials (if needed and not in env)
    if "send_telegram_message" in tools_needed:
        if not env_telegram_token and "telegram_bot_token" not in known_inputs:
            questions.append({
                "id": "q_telegram_token",
                "field": "telegram_bot_token",
                "question": "What is your Telegram Bot Token? (from @BotFather)",
                "placeholder": "123456789:ABCdefGhIJKlmNoPQRstuVWXyz",
                "input_type": "password",
                "quick_replies": [],
                "is_secret": True,
                "help_text": "Open Telegram, search for @BotFather, send /newbot, and paste the API token here."
            })
        if not env_telegram_chat and "telegram_chat_id" not in known_inputs:
            questions.append({
                "id": "q_telegram_chat",
                "field": "telegram_chat_id",
                "question": "What is your Telegram Chat ID?",
                "placeholder": "e.g., 123456789",
                "input_type": "text",
                "quick_replies": ["Auto-detect via /start"],
                "is_secret": False,
                "help_text": "Message @userinfobot on Telegram to discover your numerical Chat ID."
            })

    # 6. Gmail Sender Credentials (if needed and not in env)
    if ("send_email" in tools_needed or "read_important_emails" in tools_needed) and (not env_gmail_user or not env_gmail_pass):
        if not env_gmail_user and "sender_email" not in known_inputs:
            questions.append({
                "id": "q_sender_email",
                "field": "sender_email",
                "question": "What is your sender Gmail address?",
                "placeholder": "e.g., your_account@gmail.com",
                "input_type": "email",
                "quick_replies": [default_email] if default_email else [],
                "is_secret": False,
                "help_text": "Your Gmail account used to send automated messages via SMTP / IMAP."
            })
        if not env_gmail_pass and "sender_app_password" not in known_inputs:
            questions.append({
                "id": "q_sender_password",
                "field": "sender_app_password",
                "question": "Enter your 16-character Google App Password:",
                "placeholder": "•••• •••• •••• ••••",
                "input_type": "password",
                "quick_replies": [],
                "is_secret": True,
                "help_text": "Generate at: https://myaccount.google.com/apppasswords (Requires 2-Step Verification enabled)."
            })

    # 7. Topic Question
    if ("{topic}" in clean_prompt or ("topic" in p_lower and "competitor" in p_lower)) and "topic" not in known_inputs:
        questions.append({
            "id": "q_topic",
            "field": "topic",
            "question": "Which topic or competitor would you like to track?",
            "placeholder": "e.g., OpenAI, Zomato, Semiconductor India, AI Startups",
            "input_type": "text",
            "quick_replies": ["Indian AI Startups", "OpenAI", "Zomato", "Electric Vehicles India"],
            "is_secret": False,
            "help_text": "Enter the topic, brand, or competitor name to monitor over the last 24 hours."
        })

    # 8. Website URL Question
    if ("{url}" in clean_prompt or "check_website_health" in tools_needed) and "url" not in known_inputs:
        questions.append({
            "id": "q_url",
            "field": "url",
            "question": "Which website URL would you like to monitor?",
            "placeholder": "e.g., https://www.npci.org.in or https://www.google.co.in",
            "input_type": "text",
            "quick_replies": ["https://www.npci.org.in", "https://www.google.co.in", "https://github.com"],
            "is_secret": False,
            "help_text": "Enter the complete web address including https:// to check its uptime and latency."
        })

    # 9. Spreadsheet / Data File Question
    if "{file}" in clean_prompt and "file" not in known_inputs:
        questions.append({
            "id": "q_file",
            "field": "file",
            "question": "Which spreadsheet file in workspace/ should be cleaned?",
            "placeholder": "e.g., samples/student_placement_data.csv",
            "input_type": "text",
            "quick_replies": ["samples/student_placement_data.csv", "samples/freelance_agency_expenses.csv"],
            "is_secret": False,
            "help_text": "Enter the relative path inside workspace/ of the CSV or spreadsheet to clean."
        })

    # High-level goal summary
    goal_summary = clean_prompt[:70] + ("..." if len(clean_prompt) > 70 else "")
    if "get_weather" in tools_needed and "city" in known_inputs:
        goal_summary = f"Send daily weather report of {known_inputs['city']}"
        if sched_info["time_display"]:
            goal_summary += f" at {sched_info['time_display']}"
    elif "read_important_emails" in tools_needed:
        goal_summary = "Send daily important email digest to Telegram"
        if sched_info["time_display"]:
            goal_summary += f" at {sched_info['time_display']}"

    return {
        "status": "ready" if len(questions) == 0 else "needs_input",
        "prompt": clean_prompt,
        "goal": goal_summary,
        "trigger": {
            "type": "schedule" if sched_info["is_scheduled"] else "manual",
            "frequency": sched_info["frequency"],
            "time": sched_info["time"],
            "time_display": sched_info["time_display"] or (f"{sched_info['time']} IST" if sched_info["time"] else "Manual Run"),
            "timezone": sched_info["timezone"]
        },
        "tools_needed": tools_needed,
        "known_inputs": known_inputs,
        "questions": questions,
        "current_question_index": 0,
        "total_questions": len(questions),
        "answered_count": 0,
        "current_question": questions[0] if questions else None,
        "is_complete": len(questions) == 0
    }


def process_question_answer(
    session_data: Dict[str, Any],
    field: str,
    answer: str
) -> Dict[str, Any]:
    """
    Records the user's answer to the active question, updates collected inputs,
    and advances to the next question in the queue.
    """
    clean_answer = str(answer).strip()
    questions = session_data.get("questions", [])
    curr_idx = session_data.get("current_question_index", 0)
    known = session_data.setdefault("known_inputs", {})

    # Record answer
    if field:
        # Normalize time inputs (e.g., "5 pm" -> "17:00")
        if field == "schedule_time":
            time_parsed = parse_time_and_schedule(clean_answer).get("time")
            known[field] = time_parsed or clean_answer
            session_data.setdefault("trigger", {})["time"] = known[field]
            session_data["trigger"]["time_display"] = f"{known[field]} IST"
        elif field == "city":
            known[field] = clean_answer.title()
        else:
            known[field] = clean_answer

    # Advance index
    new_idx = curr_idx + 1
    session_data["current_question_index"] = new_idx
    session_data["answered_count"] = min(len(questions), new_idx)
    session_data["current_question"] = questions[new_idx] if new_idx < len(questions) else None
    session_data["is_complete"] = new_idx >= len(questions)
    session_data["status"] = "ready" if session_data["is_complete"] else "needs_input"

    return session_data


def handle_chat_help_query(query: str, current_question: Optional[Dict[str, Any]] = None) -> str:
    """
    Answers conversational queries and integration help questions
    without disrupting the active question queue in the Questions panel.
    """
    q_lower = query.lower()

    if any(w in q_lower for w in ["app password", "google password", "gmail password"]):
        return (
            "🔑 **How to get a Gmail App Password:**\n"
            "1. Visit [Google App Passwords](https://myaccount.google.com/apppasswords).\n"
            "2. Ensure **2-Step Verification** is enabled on your Google Account.\n"
            "3. Under 'App name', type `AgentFlow` and click **Create**.\n"
            "4. Copy the generated 16-character code (e.g., `abcd efgh ijkl mnop`).\n"
            "5. Paste it in the Questions panel password box."
        )
    elif any(w in q_lower for w in ["telegram", "botfather", "bot token"]):
        return (
            "🤖 **How to get a Telegram Bot Token:**\n"
            "1. Open Telegram and search for `@BotFather`.\n"
            "2. Send `/newbot` and follow the prompts to name your bot.\n"
            "3. BotFather will provide an API Token (e.g. `123456789:ABCdefGhIJKlmNoPQRstuVWXyz`).\n"
            "4. Copy and paste it in the token field."
        )
    elif any(w in q_lower for w in ["chat id", "telegram chat"]):
        return (
            "💬 **How to find your Telegram Chat ID:**\n"
            "1. Message `@userinfobot` or `@RawDataBot` on Telegram.\n"
            "2. It will reply immediately with your numeric ID (e.g. `987654321`)."
        )
    elif any(w in q_lower for w in ["weather", "open-meteo", "api key"]):
        return (
            "🌤️ **Weather Data:**\n"
            "AgentFlow uses the **Open-Meteo API**, which is 100% free and open-source.\n"
            "No API key, signup, or paid subscription is ever required!"
        )
    elif any(w in q_lower for w in ["imap", "read inbox", "safe"]):
        return (
            "🔒 **IMAP Security & Safety:**\n"
            "AgentFlow accesses Gmail IMAP in **Read-Only** mode. It never deletes emails, "
            "never marks emails as read, and never sends unauthorized replies.\n"
            "All email body contents are sanitized to block prompt injection."
        )
    else:
        q_label = f"'{current_question['question']}'" if current_question else "the pending question"
        return (
            f"I'm here to help! Whenever you're ready, please answer {q_label} "
            f"in the side Questions panel to proceed with building your workflow."
        )



def check_missing_credentials(required_creds: List[str]) -> List[Dict[str, str]]:
    """Checks environment variables and returns missing credentials with setup guidance."""
    missing = []
    for cred in required_creds:
        val = os.getenv(cred, "").strip()
        if not val:
            guide = ""
            if cred == "EMAIL_USER":
                guide = "Configure your Gmail address in .env (e.g. EMAIL_USER=your_email@gmail.com)"
            elif cred == "EMAIL_PASS":
                guide = "Generate a 16-character Google App Password (not your normal password) and set EMAIL_PASS in .env"
            elif cred == "TELEGRAM_BOT_TOKEN":
                guide = "Create a bot with @BotFather on Telegram and set TELEGRAM_BOT_TOKEN in .env"
            elif cred == "TELEGRAM_CHAT_ID":
                guide = "Find your chat ID with @userinfobot and set TELEGRAM_CHAT_ID in .env"
            else:
                guide = f"Set {cred} in your server .env file"
            missing.append({"key": cred, "instructions": guide})
    return missing


def parse_llm_json_plan(raw_text: str) -> Optional[Dict[str, Any]]:
    """Extracts and validates a JSON workflow plan from LLM response."""
    # Find JSON blocks
    match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", raw_text)
    candidate = match.group(1) if match else raw_text.strip()

    try:
        data = json.loads(candidate)
        if isinstance(data, dict) and "steps" in data and isinstance(data["steps"], list):
            return data
    except Exception:
        pass

    # Try curly bracket slice
    start = candidate.find("{")
    end = candidate.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            data = json.loads(candidate[start : end + 1])
            if isinstance(data, dict) and "steps" in data:
                return data
        except Exception:
            pass

    return None


def extract_clean_news_topic(prompt: str) -> str:
    """
    Extracts a clean, concise search topic for news tools from natural language prompts.
    Never passes the user's raw instruction sentence or file paths.
    """
    p_lower = prompt.lower()

    # 1. Domain detection
    if any(w in p_lower for w in ["ai", "artificial intelligence", "machine learning", "deep learning"]):
        if any(w in p_lower for w in ["india", "bharat"]):
            return "AI news India"
        return "Artificial Intelligence"
    if any(w in p_lower for w in ["tech", "technology", "software", "startup"]):
        if any(w in p_lower for w in ["india", "bharat"]):
            return "Technology startups India"
        return "Technology news"
    if any(w in p_lower for w in ["market", "sensex", "nifty", "stock", "finance", "economy"]):
        return "India business economy markets"
    if any(w in p_lower for w in ["cricket", "ipl", "bcci", "match"]):
        return "Cricket India"
    if any(w in p_lower for w in ["weather", "monsoon", "rain"]):
        return "India weather forecast"

    # 2. Extract specific topic after keywords like 'news on', 'news about', etc.
    m = re.search(r"(?:news\s+(?:on|about|for|regarding)|khabar\s+(?:ki|ke\s+baare\s+mein))\s+([a-zA-Z0-9\s]{2,30}?)(?:\s+(?:daily|every|at|by|ko|ka|se|and|save|send|\b))", prompt, re.I)
    if m:
        cand = m.group(1).strip()
        if cand and len(cand) >= 2:
            return cand

    m2 = re.search(r"(?:fetch|get|check|find)\s+(?:latest|breaking|today's)?\s*([a-zA-Z0-9\s]{2,25}?)\s+news", prompt, re.I)
    if m2:
        cand = m2.group(1).strip()
        if cand and len(cand) >= 2:
            return f"{cand} news"

    # 3. Strip common command words and file paths
    cleaned = re.sub(
        r"\b(check|current|ist|time|fetch|get|latest|breaking|taza|samachar|khabar|news|and|save|to|file|workspace|"
        r"daily|every|day|morning|evening|subah|shaam|email|send|bhejo|likho|workspace/[\w\.-]+|[\w\.-]+\.txt)\b",
        " ",
        p_lower
    )
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if len(cleaned) >= 3:
        return f"{cleaned} news"

    return "Top AI and Technology news India"


def generate_fallback_plan(prompt: str) -> Dict[str, Any]:
    """
    Semantic deterministic fallback planner for English, Hindi, and Urdu prompts.
    Guarantees a 100% valid, runnable workflow plan with zero hallucinated tools.
    """
    p_lower = prompt.lower()
    steps = []

    # Check for weather request
    needs_weather = any(w in p_lower for w in ["weather", "temperature", "forecast", "mausam", "rain"])
    # Check for time/date request
    needs_time = any(w in p_lower for w in ["time", "date", "aaj", "waqt", "samay", "ist", "today"])
    # Check for news request
    needs_news = any(w in p_lower for w in ["news", "khabar", "samachar", "taza", "breaking", "latest", "update"])
    # Check for email request
    needs_email = any(w in p_lower for w in ["email", "mail", "bhejo", "send email", "gmail"])
    # Check for telegram request
    needs_telegram = any(w in p_lower for w in ["telegram", "tg", "telegram bot", "telegram message", "tele"])
    # Check for file save request
    needs_save = any(w in p_lower for w in ["save", "file", "workspace", "txt", "likho", "store", "write"])
    # Check for search/research
    needs_search = any(w in p_lower for w in ["search", "find", "research", "dhundo", "khojo", "pata karo", "top", "skills", "jobs"])

    step_idx = 1

    # Step: Weather check
    if needs_weather:
        known_ents = extract_known_entities(prompt)
        city = known_ents.get("city", "Lucknow")
        steps.append({
            "id": f"step_{step_idx}",
            "tool": "get_weather",
            "name": f"Fetch Weather Forecast for {city}",
            "params": {"city": city, "days": 1},
            "output_key": "weather_data",
            "requires_approval": False,
            "required_credentials": [],
        })
        step_idx += 1

    # Step: Time check
    elif needs_time or needs_news:
        steps.append({
            "id": f"step_{step_idx}",
            "tool": "get_datetime",
            "name": "Check Real-Time IST Timestamp",
            "params": {},
            "output_key": "ist_time",
            "requires_approval": False,
            "required_credentials": [],
        })
        step_idx += 1

    # Step: News or Search
    if needs_news:
        clean_topic = extract_clean_news_topic(prompt)
        steps.append({
            "id": f"step_{step_idx}",
            "tool": "get_latest_news",
            "name": f"Fetch Latest News on '{clean_topic}'",
            "params": {"topic": clean_topic, "days": 1},
            "output_key": "news_results",
            "requires_approval": False,
            "required_credentials": [],
        })
        step_idx += 1
    elif not needs_weather and (needs_search or len(steps) == 0):
        steps.append({
            "id": f"step_{step_idx}",
            "tool": "multi_search",
            "name": "Parallel Multi-Source Search",
            "params": {
                "queries": [
                    prompt[:60],
                    f"{prompt[:50]} latest updates",
                    f"{prompt[:50]} India details"
                ],
                "period": "m"
            },
            "output_key": "search_results",
            "requires_approval": False,
            "required_credentials": [],
        })
        step_idx += 1

    # Step: Save to file if asked or as useful output
    if needs_save or (not needs_email and not needs_telegram and not needs_weather):
        # Extract filename if specified
        fn_match = re.search(r"([\w\-]+\.(?:txt|md|csv|json))", prompt)
        filename = fn_match.group(1) if fn_match else "workflow_output.txt"
        prior_output = "{{weather_data}}" if needs_weather else ("{{news_results}}" if needs_news else "{{search_results}}")
        steps.append({
            "id": f"step_{step_idx}",
            "tool": "save_file",
            "name": f"Save Findings to workspace/{filename}",
            "params": {
                "filename": filename,
                "content": f"Workflow Execution Output:\n{prior_output}",
                "overwrite": True
            },
            "output_key": "saved_file_info",
            "requires_approval": True,
            "required_credentials": [],
        })
        step_idx += 1

    # Step: Send Email if requested
    if needs_email:
        email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", prompt)
        to_email = email_match.group(0) if email_match else os.getenv("EMAIL_USER", "user@example.com")
        if needs_weather:
            known_ents = extract_known_entities(prompt)
            city = known_ents.get("city", "Lucknow")
            subject = f"Weather Report for {city}"
            body = f"Hello,\n\nHere is your requested weather forecast for {city}:\n\n{{{{weather_data}}}}\n\nGenerated autonomously by AgentFlow."
        elif needs_news:
            subject = "AgentFlow Daily News Digest"
            body = f"Hello,\n\nHere is your requested daily news summary:\n\n{{{{news_results}}}}\n\nGenerated autonomously by AgentFlow."
        else:
            subject = "AgentFlow Automated Workflow Report"
            body = f"Hello,\n\nHere is your automated report:\n\n{{{{search_results}}}}\n\nGenerated autonomously by AgentFlow."

        steps.append({
            "id": f"step_{step_idx}",
            "tool": "send_email",
            "name": f"Email Weather Report to {to_email}" if needs_weather else f"Email Digest to {to_email}",
            "params": {
                "to_email": to_email,
                "subject": subject,
                "body": body
            },
            "output_key": "email_confirmation",
            "requires_approval": True,
            "required_credentials": ["EMAIL_USER", "EMAIL_PASS"],
        })
        step_idx += 1

    # Step: Send Telegram if requested
    if needs_telegram:
        prior_output = "{{weather_data}}" if needs_weather else ("{{news_results}}" if needs_news else "{{search_results}}")
        steps.append({
            "id": f"step_{step_idx}",
            "tool": "send_telegram_message",
            "name": "Send AI News Digest to Telegram" if needs_news else "Dispatch Automated Summary to Telegram",
            "params": {
                "message": f"🤖 *AgentFlow Automated Brief*\n\n{prior_output}",
                "parse_mode": "Markdown"
            },
            "output_key": "telegram_status",
            "requires_approval": True,
            "required_credentials": ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
        })
        step_idx += 1

    return {
        "title": prompt[:50] + ("..." if len(prompt) > 50 else ""),
        "description": f"Automated workflow generated from task: {prompt}",
        "steps": steps
    }


async def generate_workflow_plan(prompt: str, preferences: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """
    Translates a user prompt into a validated JSON workflow plan using only registered tools.
    Checks missing credentials, sets approval requirements, and constructs node-graph metadata.
    """
    clean_prompt = prompt.strip()
    if not clean_prompt:
        raise ValueError("Task prompt cannot be empty.")

    # 0. Check if prompt matches a built-in template exactly or by title
    import copy
    from backend.templates_data import BUILTIN_TEMPLATES
    matched_tpl = next(
        (t for t in BUILTIN_TEMPLATES if t["prompt"].strip().lower() == clean_prompt.lower() or t["title"].strip().lower() == clean_prompt.lower()),
        None
    )
    if matched_tpl and matched_tpl.get("plan") and matched_tpl["plan"].get("steps"):
        plan_data = copy.deepcopy(matched_tpl["plan"])
    else:
        plan_data = None

    ist_tz = timezone(timedelta(hours=5, minutes=30))
    now = datetime.now(ist_tz)
    today_str = now.strftime("%A, %d %B %Y")

    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    preferred_model = os.getenv("OLLAMA_MODEL", "llama3.1")
    model_name = detect_ollama_model(base_url, preferred_model)

    tools_catalog = "\n".join([
        f"- {tool_name}: {meta['description']} | Params: {list(meta['params'].keys())} | Requires Approval: {meta['requires_approval']}"
        for tool_name, meta in REGISTERED_TOOLS_META.items()
    ])

    system_msg = f"""You are AgentFlow's Workflow Architect.
Today's Date: {today_str}.
Your role is to translate user natural language requests (in English, Hindi, or Urdu) into a clean, multi-step JSON workflow plan.

CRITICAL RULES:
1. ONLY USE REGISTERED TOOLS. NEVER INVENT TOOLS.
Allowed tools:
{tools_catalog}

2. OUTPUT ONLY A VALID JSON OBJECT with this exact structure:
{{
  "title": "Short descriptive title (max 6 words)",
  "description": "Clear explanation of what the workflow does",
  "steps": [
    {{
      "id": "step_1",
      "tool": "registered_tool_name",
      "name": "Human-friendly step label",
      "params": {{ "param1": "value" }},
      "output_key": "variable_name",
      "requires_approval": false
    }}
  ]
}}

3. Data passing: Step parameters can reference outputs of previous steps using {{{{variable_name}}}} or {{{{step_id.output}}}}.
4. Flag requires_approval: true for send_email and file overwrites.
5. Provide ONLY the JSON. No conversational preamble."""

    if plan_data is None:
        def _is_ollama_alive(url: str) -> bool:
            try:
                import urllib.request
                req = urllib.request.Request(f"{url.rstrip('/')}/api/tags", headers={"User-Agent": "AgentFlow"})
                with urllib.request.urlopen(req, timeout=1.5) as r:
                    return r.status == 200
            except Exception:
                return False

        if _is_ollama_alive(base_url):
            try:
                llm = ChatOllama(
                    model=model_name,
                    base_url=base_url,
                    temperature=0.1,
                    format="json",
                )
                resp = await asyncio.wait_for(
                    asyncio.to_thread(
                        llm.invoke,
                        [
                            SystemMessage(content=system_msg),
                            HumanMessage(content=f"Create a workflow plan for this task:\n{clean_prompt}")
                        ]
                    ),
                    timeout=12.0
                )
                raw_text = resp.content.strip()
                plan_data = parse_llm_json_plan(raw_text)
            except Exception as e:
                print(f"[Workflow Planner] LLM plan generation exception: {e}")

    # Fallback if LLM was unreachable, timed out, or generated invalid structure
    if not plan_data or "steps" not in plan_data or not plan_data["steps"]:
        plan_data = generate_fallback_plan(clean_prompt)

    # STRICT VALIDATION: Filter out any invented tools and sanitize parameters
    validated_steps = []
    missing_credentials_list = []
    seen_creds = set()

    for i, step in enumerate(plan_data.get("steps", [])):
        tool_name = step.get("tool", "").strip()
        # If tool is invalid, map or skip
        if tool_name not in REGISTERED_TOOLS_META:
            if "search" in tool_name or "query" in tool_name:
                tool_name = "multi_search"
            elif "news" in tool_name:
                tool_name = "get_latest_news"
            elif "mail" in tool_name:
                tool_name = "send_email"
            elif "file" in tool_name or "write" in tool_name:
                tool_name = "save_file"
            else:
                tool_name = "multi_search"

        meta = REGISTERED_TOOLS_META[tool_name]
        step_id = step.get("id") or f"step_{i+1}"
        step_name = step.get("name") or meta["display_name"]
        params = step.get("params") or {}
        output_key = step.get("output_key") or f"{step_id}_output"
        requires_approval = meta["requires_approval"] or step.get("requires_approval", False)

        # Parameter validation against tool schemas
        if tool_name == "get_latest_news":
            raw_top = str(params.get("topic", "")).strip()
            if not raw_top or len(raw_top.split()) > 5 or any(w in raw_top.lower() for w in ["check", "current", "ist", "fetch", "save", "workspace", ".txt"]):
                clean_top = extract_clean_news_topic(raw_top or clean_prompt)
                params["topic"] = clean_top
            try:
                params["days"] = int(params.get("days", 1))
            except Exception:
                params["days"] = 1
        elif tool_name == "save_file":
            raw_fn = str(params.get("filename", "")).strip()
            if not raw_fn or len(raw_fn.split()) > 3 or "/" in raw_fn or "\\" in raw_fn:
                fn_match = re.search(r"([\w\-]+\.(?:txt|md|csv|json))", raw_fn or clean_prompt)
                params["filename"] = fn_match.group(1) if fn_match else "workflow_output.txt"
        elif tool_name == "get_weather":
            raw_city = str(params.get("city", "")).strip()
            if not raw_city or len(raw_city.split()) > 3:
                known_ents = extract_known_entities(clean_prompt)
                params["city"] = known_ents.get("city", "Lucknow")

        # Check required credentials
        for cred in meta["required_credentials"]:
            if cred not in seen_creds:
                seen_creds.add(cred)
                missing = check_missing_credentials([cred])
                if missing:
                    missing_credentials_list.extend(missing)

        validated_steps.append({
            "id": step_id,
            "tool": tool_name,
            "name": step_name,
            "description": meta["description"],
            "params": params,
            "parameters": params,
            "output_key": output_key,
            "requires_approval": requires_approval,
            "required_credentials": meta["required_credentials"],
            "status": "pending",
        })

    workflow_id = f"wf_{uuid.uuid4().hex[:10]}"
    final_plan = {
        "workflow_id": workflow_id,
        "title": plan_data.get("title", "Automated Workflow"),
        "description": plan_data.get("description", f"Generated workflow for: {clean_prompt}"),
        "prompt": clean_prompt,
        "steps": validated_steps,
        "missing_credentials": missing_credentials_list,
        "created_at": datetime.now().isoformat(),
    }

    # Persist in SQLite (save_workflow will reuse existing workflow_id for duplicate prompts)
    saved_rec = await save_workflow(
        workflow_id=workflow_id,
        title=final_plan["title"],
        prompt=clean_prompt,
        plan_json=json.dumps(final_plan),
        status="ready",
        dry_run=False
    )
    actual_wf_id = saved_rec["id"]
    if actual_wf_id != workflow_id:
        final_plan["workflow_id"] = actual_wf_id
        await save_workflow(
            workflow_id=actual_wf_id,
            title=final_plan["title"],
            prompt=clean_prompt,
            plan_json=json.dumps(final_plan),
            status="ready",
            dry_run=False
        )

    return final_plan


# ==========================================
# Step-by-Step Execution Engine
# ==========================================

class WorkflowExecutionEngine:
    def __init__(self, workflow_id: str, plan: Dict[str, Any], dry_run: bool = False):
        self.workflow_id = workflow_id
        self.plan = plan
        self.dry_run = dry_run
        self.run_id = f"run_{uuid.uuid4().hex[:10]}"
        self.step_context: Dict[str, Any] = {}
        self.logs: List[Dict[str, Any]] = []
        self.is_cancelled = False

    def substitute_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Substitutes variables {{step_id.output}} or {{variable}} in parameters."""
        resolved = {}
        for k, v in params.items():
            if isinstance(v, str):
                val_str = v
                # Replace pattern {{key}}
                for var_key, var_val in self.step_context.items():
                    pattern = f"{{{{{var_key}}}}}"
                    if pattern in val_str:
                        val_str = val_str.replace(pattern, str(var_val))
                resolved[k] = val_str
            elif isinstance(v, list):
                resolved_list = []
                for item in v:
                    if isinstance(item, str):
                        s = item
                        for var_key, var_val in self.step_context.items():
                            s = s.replace(f"{{{{{var_key}}}}}", str(var_val))
                        resolved_list.append(s)
                    else:
                        resolved_list.append(item)
                resolved[k] = resolved_list
            else:
                resolved[k] = v
        return resolved

    async def execute_step(self, step: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes a single step with bounded retries (up to 2 retries) and 30s timeout.
        """
        tool_name = step["tool"]
        meta = REGISTERED_TOOLS_META[tool_name]
        raw_params = step.get("params", {})
        resolved_params = self.substitute_params(raw_params)

        # Requirement 5: Ensure email body is fully rendered before sending.
        # Placeholders like {{search_results}} must be replaced with the real previous-step output.
        # If a placeholder is unresolved, fail the step with a clear message instead of emailing raw template text.
        if tool_name == "send_email":
            body = resolved_params.get("body", "")
            subject = resolved_params.get("subject", "")
            to_email = resolved_params.get("to_email", "")
            unresolved = list(set(
                re.findall(r"\{\{([a-zA-Z0-9_\.]+)\}\}", str(body)) +
                re.findall(r"\{\{([a-zA-Z0-9_\.]+)\}\}", str(subject)) +
                re.findall(r"\{\{([a-zA-Z0-9_\.]+)\}\}", str(to_email))
            ))
            if unresolved:
                bad_placeholders = ", ".join([f"{{{{{u}}}}}" for u in unresolved])
                return {
                    "status": "failed",
                    "error": (
                        f"Step failed: Email contains unresolved workflow placeholder(s): {bad_placeholders}. "
                        f"The preceding step output was not provided or failed to populate before sending."
                    )
                }

        # Check for any unresolved single-brace template placeholders ({city}, {email}, etc.)
        for p_k, p_v in resolved_params.items():
            if isinstance(p_v, str):
                single_braces = re.findall(r"\{([a-zA-Z_]+)\}", p_v)
                if single_braces:
                    bad_list = ", ".join([f"{{{b}}}" for b in single_braces])
                    return {
                        "status": "failed",
                        "error_type": "unresolved_placeholder",
                        "error": f"Step '{step['name']}' failed: Parameter '{p_k}' contains unresolved template placeholder(s): {bad_list}. Please provide required input."
                    }

        # Check Dry Run Mode - Strictly labelled SIMULATION and never says 'sent'
        if self.dry_run:
            if tool_name == "send_email":
                mock_res = f"SIMULATION: Simulated email dispatch to '{resolved_params.get('to_email')}' with subject '{resolved_params.get('subject')}'. (Dry run active - no actual email sent)"
                return {"status": "completed", "result": mock_res, "mock": True, "displayStatus": "SIMULATION"}
            elif tool_name == "save_file":
                filename = resolved_params.get("filename", "output.txt")
                mock_res = f"SIMULATION: Validated file workspace/{filename} for writing ({len(str(resolved_params.get('content', '')))} characters). (Dry run active - no disk write performed)"
                return {"status": "completed", "result": mock_res, "mock": True, "displayStatus": "SIMULATION"}
            elif tool_name == "get_latest_news":
                topic = resolved_params.get("topic", "News")
                mock_res = f"SIMULATION: Verified Google News RSS stream for topic '{topic}'."
                return {"status": "completed", "result": mock_res, "mock": True, "displayStatus": "SIMULATION"}
            elif tool_name == "multi_search":
                q_list = resolved_params.get("queries", [])
                mock_res = f"SIMULATION: Multi-search verified across {len(q_list)} queries: {', '.join(str(q) for q in q_list[:3])}."
                return {"status": "completed", "result": mock_res, "mock": True, "displayStatus": "SIMULATION"}
            elif tool_name == "fetch_page":
                url = resolved_params.get("url", "")
                mock_res = f"SIMULATION: URL '{url}' verified for Trafilatura extraction."
                return {"status": "completed", "result": mock_res, "mock": True, "displayStatus": "SIMULATION"}
            elif tool_name == "search_sources":
                src = resolved_params.get("source", "wikipedia")
                topic = resolved_params.get("topic", "")
                mock_res = f"SIMULATION: Query for '{topic}' on {src} verified."
                return {"status": "completed", "result": mock_res, "mock": True, "displayStatus": "SIMULATION"}
            elif tool_name == "send_telegram_message":
                cid = resolved_params.get("chat_id") or "default"
                mock_res = f"SIMULATION: Simulated Telegram message delivery to chat '{cid}'. (Dry run active - no actual message sent)"
                return {"status": "completed", "result": mock_res, "mock": True, "displayStatus": "SIMULATION"}
            elif tool_name == "get_weather":
                city = resolved_params.get("city", "Lucknow")
                mock_res = f"SIMULATION: Simulated weather lookup for '{city}'."
                return {"status": "completed", "result": mock_res, "mock": True, "displayStatus": "SIMULATION"}
            elif tool_name == "check_website_health":
                url = resolved_params.get("url", "")
                mock_res = f"SIMULATION: Simulated health check probe for '{url}'."
                return {"status": "completed", "result": mock_res, "mock": True, "displayStatus": "SIMULATION"}
            elif tool_name == "analyze_tabular_data":
                fn = resolved_params.get("filename", "")
                mock_res = f"SIMULATION: Simulated tabular analysis for '{fn}'."
                return {"status": "completed", "result": mock_res, "mock": True, "displayStatus": "SIMULATION"}
            elif tool_name == "read_important_emails":
                mock_res = f"SIMULATION: Simulated scan of inbox for important messages."
                return {"status": "completed", "result": mock_res, "mock": True, "displayStatus": "SIMULATION"}
            else:
                mock_res = f"SIMULATION: Step '{step['name']}' simulated in dry run."
                return {"status": "completed", "result": mock_res, "mock": True, "displayStatus": "SIMULATION"}

        # Execution with up to 2 retries and 30s timeout
        max_retries = 2
        last_error = None

        for attempt in range(max_retries + 1):
            if self.is_cancelled:
                return {"status": "cancelled", "error": "Execution cancelled by user."}

            try:
                # Execute tool function synchronously in threadpool with timeout
                func = meta["func"]
                loop = asyncio.get_running_loop()
                result = await asyncio.wait_for(
                    loop.run_in_executor(None, lambda: func(**resolved_params)),
                    timeout=30.0
                )
                res_str = str(result).strip()

                # Check for empty output
                if not res_str:
                    return {
                        "status": "failed",
                        "error_type": "no_data",
                        "error": f"Step '{step['name']}' returned empty output.",
                        "result": "",
                        "attempt": attempt + 1
                    }

                # Check for NO DATA indicators
                if res_str.startswith("NO DATA:") or res_str == "No recent news found." or res_str.startswith("No results found"):
                    return {
                        "status": "failed",
                        "error_type": "no_data",
                        "error": res_str,
                        "result": res_str,
                        "attempt": attempt + 1
                    }

                # Check for explicit Error indicators
                if res_str.startswith("Error:") or res_str.startswith("Failed to ") or "Unresolved workflow template placeholder(s)" in res_str:
                    return {
                        "status": "failed",
                        "error_type": "error",
                        "error": res_str,
                        "result": res_str,
                        "attempt": attempt + 1
                    }

                return {
                    "status": "completed",
                    "result": res_str,
                    "attempt": attempt + 1
                }
            except asyncio.TimeoutError:
                last_error = f"Step timed out after 30 seconds (attempt {attempt + 1}/{max_retries + 1})."
                await asyncio.sleep(1.0)
            except Exception as e:
                last_error = f"Error: {str(e)} (attempt {attempt + 1}/{max_retries + 1})"
                await asyncio.sleep(1.0)

        return {"status": "failed", "error": last_error}

    async def stream_workflow(self) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Streams step-by-step execution events over SSE, updating SQLite state.
        """
        start_time = time.time()
        await create_workflow_run_record(self.run_id, self.workflow_id, dry_run=self.dry_run)
        await update_workflow_status(self.workflow_id, "running")

        yield {
            "type": "workflow_start",
            "workflow_id": self.workflow_id,
            "run_id": self.run_id,
            "dry_run": self.dry_run,
            "title": self.plan.get("title"),
            "total_steps": len(self.plan.get("steps", [])),
            "timestamp": datetime.now().isoformat(),
        }

        overall_status = "completed"

        for idx, step in enumerate(self.plan.get("steps", [])):
            if self.workflow_id in ACTIVE_CANCELLATIONS:
                self.is_cancelled = True
                ACTIVE_CANCELLATIONS.discard(self.workflow_id)

            if self.is_cancelled:
                overall_status = "cancelled"
                yield {
                    "type": "workflow_cancelled",
                    "step_id": step["id"],
                    "message": "Workflow run was cancelled."
                }
                break

            step_id = step["id"]
            tool_name = step["tool"]
            raw_params = step.get("params", {})
            resolved_params = self.substitute_params(raw_params)

            yield {
                "type": "step_start",
                "step_index": idx,
                "step_id": step_id,
                "name": step["name"],
                "tool": tool_name,
                "requires_approval": step.get("requires_approval", False),
            }

            # Requirement: Stop execution and wait for approval on sensitive steps (email, telegram, or file overwrite)
            needs_approval = step.get("requires_approval", False) or tool_name in ("send_email", "send_telegram_message")
            if tool_name == "save_file" and not needs_approval:
                target_path = _safe_workspace_path(resolved_params.get("filename", ""))
                if target_path.exists():
                    needs_approval = True

            if needs_approval:
                approval_id = f"appr_{uuid.uuid4().hex[:10]}"
                approval_record = {
                    "id": approval_id,
                    "workflow_id": self.workflow_id,
                    "run_id": self.run_id,
                    "step_id": step_id,
                    "name": step["name"],
                    "tool": tool_name,
                    "parameters": resolved_params,
                    "dry_run": self.dry_run,
                    "details": f"Step '{step['name']}' requires your confirmation before proceeding.",
                    "status": "pending",
                    "decision": None,
                    "created_at": datetime.now().isoformat()
                }
                approval_manager.register_pending(approval_record)
                await update_workflow_status(self.workflow_id, "waiting_for_approval")

                # Yield approval_required SSE event with fully rendered parameters for user inspection
                yield {
                    "type": "approval_required",
                    "approval_id": approval_id,
                    "workflow_id": self.workflow_id,
                    "run_id": self.run_id,
                    "step_id": step_id,
                    "name": step["name"],
                    "tool": tool_name,
                    "parameters": resolved_params,
                    "dry_run": self.dry_run,
                    "details": approval_record["details"]
                }

                self.logs.append({
                    "step_id": step_id,
                    "status": "waiting_for_approval",
                    "message": f"Step '{step['name']}' paused: Waiting for human approval."
                })

                # Asynchronously wait for user decision (Approve or Reject)
                # Does NOT block the asyncio event loop so POST /api/approvals/{id} resolves immediately
                timeout = 300.0
                start_wait = time.time()
                decision = None

                while time.time() - start_wait < timeout:
                    if self.workflow_id in ACTIVE_CANCELLATIONS:
                        self.is_cancelled = True
                        decision = "reject"
                        break

                    rec = approval_manager.get_pending_approval(approval_id)
                    if rec and rec.get("decision"):
                        decision = rec.get("decision")
                        break

                    await asyncio.sleep(0.5)

                if decision == "approve":
                    await update_workflow_status(self.workflow_id, "running")
                    yield {
                        "type": "approval_resolved",
                        "approval_id": approval_id,
                        "decision": "approve",
                        "step_id": step_id
                    }
                    self.logs.append({
                        "step_id": step_id,
                        "status": "approved",
                        "message": f"Step '{step['name']}' approved by user. Resuming execution..."
                    })
                else:
                    await update_workflow_status(self.workflow_id, "cancelled")
                    yield {
                        "type": "approval_resolved",
                        "approval_id": approval_id,
                        "decision": "reject",
                        "step_id": step_id
                    }

                    err_msg = f"Execution halted: Step '{step['name']}' was rejected by user."
                    self.logs.append({
                        "step_id": step_id,
                        "status": "rejected",
                        "error": err_msg
                    })

                    yield {
                        "type": "step_error",
                        "step_id": step_id,
                        "status": "rejected",
                        "display_status": "REJECTED",
                        "error": err_msg
                    }

                    # Mark subsequent steps as skipped
                    all_steps = self.plan.get("steps", [])
                    for remaining_step in all_steps[idx + 1:]:
                        rem_id = remaining_step["id"]
                        skip_reason = f"Skipped: Run rejected by user at step '{step['name']}'."
                        self.logs.append({"step_id": rem_id, "status": "skipped", "error": skip_reason})
                        yield {
                            "type": "step_skipped",
                            "step_id": rem_id,
                            "name": remaining_step["name"],
                            "status": "skipped",
                            "reason": skip_reason
                        }

                    overall_status = "cancelled"
                    break

            step_exec = await self.execute_step(step)
            step_status = step_exec["status"]

            if step_status == "completed":
                result_val = step_exec["result"]
                out_key = step.get("output_key", step_id)
                self.step_context[out_key] = result_val
                self.step_context[f"{step_id}.output"] = result_val
                self.step_context["last_output"] = result_val
                self.step_context["previous_output"] = result_val

                step_log = {
                    "step_id": step_id,
                    "status": "completed",
                    "result_preview": result_val[:300] + ("..." if len(result_val) > 300 else ""),
                    "result": result_val,
                    "mock": step_exec.get("mock", False)
                }
                self.logs.append(step_log)

                yield {
                    "type": "step_result",
                    "step_id": step_id,
                    "name": step.get("name", ""),
                    "tool": step.get("tool", ""),
                    "status": "completed",
                    "result": result_val,
                    "mock": step_exec.get("mock", False)
                }
            else:
                err_msg = step_exec.get("error", "Unknown execution error")
                err_type = step_exec.get("error_type", "error")
                display_status = "NO DATA" if err_type == "no_data" else "FAILED"

                self.logs.append({
                    "step_id": step_id,
                    "status": "failed",
                    "display_status": display_status,
                    "error": err_msg
                })

                yield {
                    "type": "step_error",
                    "step_id": step_id,
                    "status": "failed",
                    "display_status": display_status,
                    "error": err_msg
                }

                # Mark any subsequent dependent steps as skipped so failure text is not processed or saved
                all_steps = self.plan.get("steps", [])
                for remaining_step in all_steps[idx + 1:]:
                    rem_id = remaining_step["id"]
                    skip_reason = f"Skipped: Preceding step '{step['name']}' ({step_id}) returned {display_status}."
                    self.logs.append({
                        "step_id": rem_id,
                        "status": "skipped",
                        "error": skip_reason
                    })
                    yield {
                        "type": "step_skipped",
                        "step_id": rem_id,
                        "name": remaining_step["name"],
                        "status": "skipped",
                        "reason": skip_reason
                    }

                # Calculate overall workflow status: partial if some completed, else failed
                has_completed = any(l.get("status") == "completed" for l in self.logs)
                overall_status = "partial" if has_completed else "failed"
                break

        duration = round(time.time() - start_time, 2)

        # Build comprehensive step_outputs and detect generated files
        step_outputs = []
        generated_files = []
        step_log_map = {l.get("step_id"): l for l in self.logs}

        for step in self.plan.get("steps", []):
            sid = step["id"]
            tool_name = step.get("tool")
            s_log = step_log_map.get(sid, {})
            s_status = s_log.get("status", "pending")
            s_res = s_log.get("result", "")
            s_err = s_log.get("error", "")

            step_outputs.append({
                "step_id": sid,
                "name": step.get("name", sid),
                "tool": tool_name,
                "params": self.substitute_params(step.get("params", {})),
                "status": s_status,
                "display_status": s_log.get("display_status", s_status.upper()),
                "result": s_res,
                "error": s_err,
                "mock": s_log.get("mock", False)
            })

            # Detect files saved to workspace
            if tool_name == "save_file" and s_status == "completed":
                resolved = self.substitute_params(step.get("params", {}))
                fname = resolved.get("filename") or resolved.get("path")
                if fname:
                    fpath = _safe_workspace_path(fname)
                    if fpath.exists():
                        fsize = fpath.stat().st_size
                        prev_text = ""
                        try:
                            prev_text = fpath.read_text(encoding="utf-8")[:2000]
                        except Exception:
                            prev_text = "(Binary or unreadable format)"
                        generated_files.append({
                            "filename": fname,
                            "path": f"workspace/{fname}",
                            "size_bytes": fsize,
                            "size_kb": round(fsize / 1024, 2),
                            "preview": prev_text,
                            "download_url": f"/api/workspace/files/{fname}/download"
                        })

        # Synthesize readable narrative summary
        total_steps = len(self.plan.get("steps", []))
        completed_count = sum(1 for s in step_outputs if s["status"] == "completed")
        failed_count = sum(1 for s in step_outputs if s["status"] == "failed")
        skipped_count = sum(1 for s in step_outputs if s["status"] == "skipped")

        summary_parts = []
        if overall_status == "completed":
            summary_parts.append(f"Successfully completed all {completed_count} workflow steps in {duration}s.")
        elif overall_status == "partial":
            summary_parts.append(f"Workflow finished partially: {completed_count} of {total_steps} steps succeeded in {duration}s.")
        elif overall_status == "cancelled":
            summary_parts.append(f"Workflow execution was cancelled or rejected by user after {duration}s.")
        else:
            summary_parts.append(f"Workflow failed after {duration}s ({failed_count} step failed, {skipped_count} skipped).")

        if generated_files:
            filenames_str = ", ".join([f"'{f['filename']}' ({f['size_kb']} KB)" for f in generated_files])
            summary_parts.append(f"Generated {len(generated_files)} file(s) in workspace: {filenames_str}.")

        readable_summary = " ".join(summary_parts)

        await update_workflow_run_record(
            run_id=self.run_id,
            status=overall_status,
            step_results=self.step_context,
            step_logs=self.logs,
            duration_seconds=duration
        )
        await update_workflow_status(self.workflow_id, overall_status)

        yield {
            "type": "workflow_complete",
            "workflow_id": self.workflow_id,
            "run_id": self.run_id,
            "status": overall_status,
            "duration_seconds": duration,
            "summary": readable_summary,
            "step_outputs": step_outputs,
            "generated_files": generated_files,
            "results_summary": self.step_context,
            "timestamp": datetime.now().isoformat(),
        }
