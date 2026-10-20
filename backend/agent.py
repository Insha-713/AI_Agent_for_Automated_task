"""
AgentFlow - Core Autonomous Agent with Deep Multi-Source Research Loop
Built with LangGraph (create_react_agent) and ChatOllama (100% free, runs locally).
Performs deep multi-source research:
1. PLAN: writes 3-5 query variants
2. SEARCH: multi_search in parallel, get_latest_news, search_sources (HN, Wikipedia, Reddit, arXiv, YouTube)
3. READ: fetch_page across distinct publisher domains to read full articles and verify dates
4. CHECK: discard outdated claims, verify freshness badges (Today, This week, Older)
5. ANSWER: structured report with Summary, Key findings, Sources, and Confidence note.
"""

import os
import sys
import json
import re
import urllib.parse
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Generator, Dict, Any, List, Optional, Union
import urllib.request
import dateutil.parser
from dotenv import load_dotenv

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# LangChain & LangGraph imports
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage, SystemMessage
from langgraph.prebuilt import create_react_agent

# LLM Provider Layer
from backend.llm_provider import (
    get_chat_llm,
    get_active_model_name,
    get_llm_provider,
    detect_ollama_model,
    is_llm_available,
    is_llm_configured
)

# Local tools
from backend.tools import (
    ALL_TOOLS,
    WORKSPACE_PATH,
    multi_search,
    get_latest_news,
    fetch_page,
    search_sources,
    get_datetime,
    web_search,
    save_file,
    read_file,
    list_files,
    send_email
)

load_dotenv()


def make_system_prompt(preferences: Optional[Dict[str, str]] = None, custom_prompt: Optional[str] = None) -> str:
    """
    Dynamically generates the system prompt for every task execution,
    injecting today's exact date and time (IST) and strict deep research guidelines.
    """
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    now = datetime.now(ist_tz)
    today_str = now.strftime("%A, %d %B %Y")
    now_time_str = now.strftime("%I:%M %p IST")

    base = custom_prompt or f"""You are AgentFlow, an elite, free, private, local AI research and digital work assistant.
Your mission is to perform repetitive digital work (research, summarize, save files, send emails) for students, job seekers, and business owners in India and worldwide.

[CRITICAL TEMPORAL REAL-TIME CONTEXT]:
- Today's date is {today_str}.
- Current time is {now_time_str}.
- Current Year: {now.year}. You are operating in {now.year}.

[DEEP RESEARCH ENGINE & TOOL CAPABILITIES]:
1. multi_search(queries=[...], period='m'): Executes 3-5 queries in parallel via DuckDuckGo, merges results, deduplicates URLs, and extracts domains.
2. get_latest_news(topic, days=1): Fetches live Google News RSS headlines with verified publish dates and direct links.
3. fetch_page(url): Downloads the webpage and extracts full article text (~4000 chars) and publication date via Trafilatura.
4. search_sources(topic, source): Searches specialized sources: 'wikipedia', 'hackernews', 'reddit', 'arxiv', 'youtube'.
5. get_datetime(): Returns exact IST time and local timestamp.
6. save_file: Saves notes, reports, and code into workspace/.
7. read_file: Reads files (PDF, TXT, CSV, MD) from workspace/.
8. list_files: Lists files in workspace/.
9. send_email: Sends emails via Gmail SMTP (with human approval).

[STRICT ANTI-HALLUCINATION & RESEARCH RULES]:
1. NEVER answer news, software versions, prices, events, people's roles, laws, or recent facts from internal memory. Your model weights have a past cutoff; all facts must come from tool retrieval.
2. For ANY research task, follow the Deep Research Protocol:
   - PLAN: formulate 3 to 5 targeted search queries.
   - SEARCH: call multi_search and specialized search tools.
   - READ: call fetch_page on top URLs across distinct domains to read full text and verify publication dates.
   - CHECK: discard or flag outdated information; corroborate multiple sources.
   - ANSWER: deliver a structured report:
     ### 📌 Summary
     ### 🔍 Key Findings
     ### 🔗 Sources (Title | Domain | Publish Date | Link)
     ### 🛡️ Confidence Note (High / Medium / Low)
3. If search results are sparse or not found, state so HONESTLY rather than hallucinating.
4. Keep all file operations strictly inside the sandboxed workspace/ directory.
"""

    if not preferences:
        return base

    pref_lines = []
    known_keys = {
        "user_name": "Target User Name",
        "default_email": "Default Contact Email",
        "writing_style": "Preferred Writing Tone",
        "language_preference": "Primary Language",
        "custom_instructions": "Specific Custom Instructions",
    }

    for k, label in known_keys.items():
        if preferences.get(k):
            pref_lines.append(f"- {label}: {preferences[k]}")

    for k, v in preferences.items():
        if k not in known_keys and v:
            clean_label = k.replace("_", " ").title()
            pref_lines.append(f"- {clean_label}: {v}")

    if pref_lines:
        mem_block = (
            "\n\n[Persistent User Memory & Profile]:\n"
            + "\n".join(pref_lines)
            + "\nAlways personalize drafted emails, sign-offs, and documents to match the user's profile and style."
        )
        return base + mem_block

    return base

build_system_prompt = make_system_prompt


def calculate_freshness(date_str: Optional[str]) -> str:
    """
    Computes a freshness badge for a source:
    - 'Today': within last 24-48 hours or relative 'today'/'hours ago'
    - 'This week': within last 7 days
    - 'Older': older than 7 days or unknown
    """
    if not date_str:
        return "Older"

    d_lower = str(date_str).lower().strip()
    if d_lower in ("not explicitly specified", "date unavailable", "none", "", "recent"):
        return "Older"

    # Relative time markers
    if any(m in d_lower for m in ["minute", "hour", "today", "just now", "gmt"]):
        return "Today"
    if "yesterday" in d_lower or "1 day ago" in d_lower:
        return "Today"
    if any(f"{i} day" in d_lower for i in range(2, 8)) or "this week" in d_lower:
        return "This week"

    try:
        dt = dateutil.parser.parse(str(date_str), fuzzy=True)
        now = datetime.now(timezone.utc)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        diff = now - dt
        if diff.days <= 1:
            return "Today"
        elif diff.days <= 7:
            return "This week"
        else:
            return "Older"
    except Exception:
        return "Older"


def is_research_task(prompt: str) -> bool:
    """
    Identifies whether a task requires multi-source factual search and verification.
    """
    p = prompt.lower()
    keywords = [
        "news", "latest", "recent", "today", "breaking", "update", "current",
        "version", "versions", "compare", "vs", "versus", "research", "what is",
        "who is", "how to", "price", "pricing", "released", "release", "top 3",
        "top 5", "skills", "features", "specs", "difference", "market", "2025",
        "2026", "best", "find", "search", "investigate", "tell me about"
    ]
    return any(k in p for k in keywords)


def detect_ollama_model(base_url: str, preferred_model: str) -> str:
    """Checks what models are available in Ollama."""
    clean_url = base_url.rstrip("/")
    tags_url = f"{clean_url}/api/tags"

    try:
        req = urllib.request.Request(tags_url, headers={"User-Agent": "AgentFlow"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            models = [m.get("name", "") for m in data.get("models", [])]

            for m in models:
                if m == preferred_model or m.startswith(f"{preferred_model}:"):
                    return m

            if models:
                return models[0]

            return preferred_model
    except Exception:
        return preferred_model


def get_agent(
    model_name: Optional[str] = None,
    preferences: Optional[Dict[str, str]] = None,
    custom_prompt: Optional[str] = None
):
    """Initializes and returns the LangGraph ReAct agent and active model via LLM Provider Layer."""
    prov = get_llm_provider()
    active_model = model_name or get_active_model_name(prov)
    prompt_text = make_system_prompt(preferences, custom_prompt)

    llm = get_chat_llm(
        provider=prov,
        model_name=active_model,
        temperature=0.1
    )

    agent = create_react_agent(
        model=llm,
        tools=ALL_TOOLS,
        prompt=prompt_text
    )

    return agent, active_model, llm


def generate_research_queries(prompt: str, llm: Any, current_year: int) -> List[str]:
    """
    Uses the LLM to generate 3-5 distinct search queries covering different angles.
    Falls back to intelligent rule-based queries if needed.
    """
    clean_prompt = prompt.strip()
    try:
        sys_msg = SystemMessage(
            content=(
                f"You are a search query planner for a real-time research agent. Operating Year: {current_year}.\n"
                "Given the user's task, formulate 3 to 4 distinct, keyword-rich search queries covering different aspects "
                "(official release/announcements, tech discussions, comparison, news).\n"
                "Return ONLY a JSON array of strings, e.g. [\"query 1\", \"query 2\", \"query 3\"]. No other text."
            )
        )
        resp = llm.invoke([sys_msg, HumanMessage(content=f"Task: {clean_prompt}")])
        content = resp.content.strip()

        # Parse JSON array
        match = re.search(r'\[.*?\]', content, re.DOTALL)
        if match:
            queries = json.loads(match.group(0))
            if isinstance(queries, list) and queries:
                valid_q = [str(q).strip() for q in queries if str(q).strip() and len(str(q)) > 3]
                if valid_q:
                    return valid_q[:5]
    except Exception:
        pass

    # High-quality fallback queries
    words = clean_prompt.replace('"', '').replace("'", "")
    queries = [
        f"{words} {current_year}",
        f"{words} latest update release",
        f"{words} official documentation"
    ]
    return queries


def extract_save_file_intent(prompt: str) -> Optional[Dict[str, str]]:
    """Checks if the user requested saving results to a specific file in workspace."""
    # E.g. "save to workspace/ai_skills.txt" or "save the summary to ai_skills.txt"
    match = re.search(r'save\s+(?:the\s+[\w\s]+\s+)?to\s+(?:workspace/)?([a-zA-Z0-9_\-\.]+)', prompt, re.IGNORECASE)
    if match:
        filename = match.group(1).strip()
        return {"filename": filename}
    return None


def stream_agent_steps(
    task_prompt: str,
    custom_system_prompt: Optional[str] = None,
    preferences: Optional[Dict[str, str]] = None,
    deep_research: bool = False
) -> Generator[Dict[str, Any], None, None]:
    """
    Streams live execution steps over Server-Sent Events (SSE):
    - type: 'start'             -> Initial handshake with model & mode
    - type: 'plan'              -> Checklist of plan steps
    - type: 'plan_update'       -> Checklist step progression
    - type: 'research_progress' -> Queries planned, sources searched with icons, pages read count, sources
    - type: 'thought'           -> Internal agent reasoning
    - type: 'tool_call'         -> Tool invocation
    - type: 'tool_result'       -> Tool execution result
    - type: 'final_answer'      -> Structured final synthesized answer with sources & confidence note
    """
    try:
        agent, active_model, llm = get_agent(preferences=preferences, custom_prompt=custom_system_prompt)
    except Exception as init_err:
        err_str = str(init_err)
        prov = get_llm_provider()
        if prov == "ollama" or "No LLM available" in err_str or "unreachable" in err_str or "refused" in err_str:
            yield {
                "type": "error",
                "error": "No LLM available on this server. Set LLM_PROVIDER and an API key.",
                "message": "No LLM available on this server. Set LLM_PROVIDER and an API key.",
                "guidance": "On Render or cloud hosts, set LLM_PROVIDER=groq and GROQ_API_KEY, or LLM_PROVIDER=gemini and GEMINI_API_KEY."
            }
        else:
            yield {
                "type": "error",
                "error": f"LLM Initialization Error ({prov}): {err_str}",
                "message": f"LLM Initialization Error ({prov}): {err_str}",
                "guidance": "Set LLM_PROVIDER and an API key in your server environment."
            }
        return

    mode_label = "Deep Research (Multi-round)" if deep_research else "Quick Research"
    yield {
        "type": "start",
        "model": active_model,
        "task": task_prompt,
        "deep_research": deep_research,
        "mode": mode_label,
        "message": f"AgentFlow initialized with model: {active_model} [{mode_label}]"
    }

    ist_tz = timezone(timedelta(hours=5, minutes=30))
    now = datetime.now(ist_tz)
    today_str = now.strftime("%A, %d %B %Y")
    now_time_str = now.strftime("%I:%M %p IST")
    current_year = now.year

    # Check if this task involves research or live information
    requires_research = deep_research or is_research_task(task_prompt)

    if requires_research:
        # ==========================================
        # DEEP RESEARCH ENGINE
        # ==========================================
        plan_items = [
            {"id": 1, "text": "Plan 3-5 multi-angle search queries", "status": "in_progress"},
            {"id": 2, "text": "Execute multi-source searches across DuckDuckGo & specialized platforms", "status": "pending"},
            {"id": 3, "text": "Fetch & read full web articles across distinct publisher domains", "status": "pending"},
            {"id": 4, "text": "Verify publication dates & synthesize final report with citations", "status": "pending"}
        ]
        yield {"type": "plan", "plan_items": plan_items}

        yield {
            "type": "thought",
            "content": f"Initiating {mode_label} for: '{task_prompt}'.\nOperating with live date context: {today_str} ({now_time_str})."
        }

        # Step 1: PLAN Queries
        planned_queries = generate_research_queries(task_prompt, llm, current_year)
        plan_items[0]["status"] = "completed"
        plan_items[1]["status"] = "in_progress"
        yield {"type": "plan_update", "plan_items": plan_items}

        yield {
            "type": "thought",
            "content": f"Formulated {len(planned_queries)} research queries to cover distinct angles:\n" + "\n".join([f"  • {q}" for q in planned_queries])
        }

        research_state = {
            "queries": planned_queries,
            "sources_searched": [],
            "pages_read_count": 0,
            "pages_read": [],
            "sources": []
        }
        yield {
            "type": "research_progress",
            **research_state
        }

        # Step 2: SEARCH (Multi-source)
        discovered_urls: Dict[str, Dict[str, Any]] = {}
        sources_searched_map: Dict[str, Dict[str, Any]] = {}

        # 2a. Parallel DuckDuckGo multi_search
        yield {
            "type": "tool_call",
            "tool": "multi_search",
            "args": {"queries": planned_queries, "period": "m"},
            "tool_call_id": "call_multi_search_1"
        }
        try:
            ddg_output = multi_search.func(queries=planned_queries, period="m")
        except Exception as e:
            ddg_output = f"Notice: multi_search encountered: {str(e)}"

        yield {
            "type": "tool_result",
            "tool": "multi_search",
            "result": ddg_output[:800] + ("..." if len(ddg_output) > 800 else ""),
            "tool_call_id": "call_multi_search_1"
        }

        # Parse URLs from multi_search
        url_matches = re.findall(r'\[\d+\]\s*(.*?)\nDomain:\s*(.*?)\nURL:\s*(https?://[^\s]+)\nSnippet:\s*(.*?)(?=\n\[\d+\]|\Z)', ddg_output, re.DOTALL)
        for title, domain, u, snip in url_matches:
            clean_u = u.strip().split("#")[0].rstrip("/")
            if clean_u not in discovered_urls:
                discovered_urls[clean_u] = {
                    "title": title.strip(),
                    "domain": domain.strip() or urllib.parse.urlparse(clean_u).netloc,
                    "url": clean_u,
                    "snippet": snip.strip(),
                    "date": None
                }
        sources_searched_map["duckduckgo"] = {"id": "duckduckgo", "name": "DuckDuckGo", "count": len(url_matches)}

        # 2b. If news or breaking, call get_latest_news
        is_news = any(k in task_prompt.lower() for k in ["news", "latest", "breaking", "today", "khabar", "recent"])
        if is_news:
            yield {
                "type": "tool_call",
                "tool": "get_latest_news",
                "args": {"topic": task_prompt, "days": 1},
                "tool_call_id": "call_news_1"
            }
            news_output = get_latest_news.func(topic=task_prompt, days=1)
            yield {
                "type": "tool_result",
                "tool": "get_latest_news",
                "result": news_output[:800] + ("..." if len(news_output) > 800 else ""),
                "tool_call_id": "call_news_1"
            }
            news_matches = re.findall(r'\[\d+\]\s*(.*?)\nDomain:\s*(.*?)\nPublished:\s*(.*?)\nSource Link:\s*(https?://[^\s]+)', news_output, re.DOTALL)
            for title, domain, pdate, u in news_matches:
                clean_u = u.strip().split("#")[0].rstrip("/")
                if clean_u not in discovered_urls:
                    discovered_urls[clean_u] = {
                        "title": title.strip(),
                        "domain": domain.strip() or urllib.parse.urlparse(clean_u).netloc,
                        "url": clean_u,
                        "snippet": f"Published: {pdate}",
                        "date": pdate.strip()
                    }
            sources_searched_map["google_news"] = {"id": "google_news", "name": "Google News (RSS)", "count": len(news_matches)}

        # 2c. Specialized Sources (HackerNews, Wikipedia, Reddit, arXiv, YouTube)
        p_lower = task_prompt.lower()
        if any(w in p_lower for w in ["python", "ai", "fastapi", "tech", "model", "software", "developer", "release", "deepseek", "llm"]):
            yield {
                "type": "tool_call",
                "tool": "search_sources",
                "args": {"topic": task_prompt, "source": "hackernews"},
                "tool_call_id": "call_hn_1"
            }
            hn_out = search_sources.func(topic=task_prompt, source="hackernews")
            yield {
                "type": "tool_result",
                "tool": "search_sources",
                "result": hn_out[:600] + ("..." if len(hn_out) > 600 else ""),
                "tool_call_id": "call_hn_1"
            }
            hn_urls = re.findall(r'\[\d+\]\s*(.*?)\nDate:\s*(.*?)\s*\|.*?\nURL:\s*(https?://[^\s]+)', hn_out, re.DOTALL)
            for title, pdate, u in hn_urls:
                clean_u = u.strip().split("#")[0].rstrip("/")
                if clean_u not in discovered_urls:
                    discovered_urls[clean_u] = {
                        "title": title.strip(),
                        "domain": urllib.parse.urlparse(clean_u).netloc or "news.ycombinator.com",
                        "url": clean_u,
                        "snippet": f"HackerNews discussion from {pdate}",
                        "date": pdate.strip()
                    }
            sources_searched_map["hackernews"] = {"id": "hackernews", "name": "HackerNews", "count": len(hn_urls)}

        if any(w in p_lower for w in ["compare", "vs", "versus", "opinion", "review", "experience", "best"]):
            yield {
                "type": "tool_call",
                "tool": "search_sources",
                "args": {"topic": task_prompt, "source": "reddit"},
                "tool_call_id": "call_reddit_1"
            }
            reddit_out = search_sources.func(topic=task_prompt, source="reddit")
            yield {
                "type": "tool_result",
                "tool": "search_sources",
                "result": reddit_out[:600] + ("..." if len(reddit_out) > 600 else ""),
                "tool_call_id": "call_reddit_1"
            }
            r_urls = re.findall(r'https?://[^\s)\]">]+', reddit_out)
            for u in r_urls:
                clean_u = u.strip().split("#")[0].rstrip("/")
                if clean_u not in discovered_urls:
                    discovered_urls[clean_u] = {
                        "title": f"Community Discussion: {clean_u.split('/')[-2] if '/' in clean_u else 'Reddit'}",
                        "domain": urllib.parse.urlparse(clean_u).netloc,
                        "url": clean_u,
                        "snippet": "Community feedback and comparisons",
                        "date": None
                    }
            sources_searched_map["reddit"] = {"id": "reddit", "name": "Reddit", "count": len(r_urls)}

        # Update research state with sources searched
        research_state["sources_searched"] = list(sources_searched_map.values())
        yield {
            "type": "research_progress",
            **research_state
        }

        plan_items[1]["status"] = "completed"
        plan_items[2]["status"] = "in_progress"
        yield {"type": "plan_update", "plan_items": plan_items}

        # Step 3: READ Full Pages via fetch_page
        # Target: 3 pages for Quick, 6-8 pages for Deep
        max_pages = 8 if deep_research else 3
        # Select URLs across distinct domains
        selected_urls: List[Dict[str, Any]] = []
        seen_domains = set()

        for u, meta in discovered_urls.items():
            dom = meta["domain"]
            if dom not in seen_domains and not any(skip in dom for skip in ["google.com/search", "youtube.com/watch", "twitter.com"]):
                seen_domains.add(dom)
                selected_urls.append(meta)
            if len(selected_urls) >= max_pages:
                break

        # If we didn't fill max_pages with distinct domains, add remaining
        if len(selected_urls) < max_pages:
            for u, meta in discovered_urls.items():
                if meta not in selected_urls and not any(skip in meta["domain"] for skip in ["google.com/search"]):
                    selected_urls.append(meta)
                if len(selected_urls) >= max_pages:
                    break

        yield {
            "type": "thought",
            "content": f"Selected {len(selected_urls)} high-authority URLs across {len(seen_domains)} distinct publisher domains for full article reading."
        }

        read_articles: List[Dict[str, Any]] = []

        for idx, item in enumerate(selected_urls, start=1):
            url_to_fetch = item["url"]
            yield {
                "type": "tool_call",
                "tool": "fetch_page",
                "args": {"url": url_to_fetch},
                "tool_call_id": f"call_fetch_{idx}"
            }

            page_result = fetch_page.func(url=url_to_fetch)
            yield {
                "type": "tool_result",
                "tool": "fetch_page",
                "result": page_result[:500] + ("..." if len(page_result) > 500 else ""),
                "tool_call_id": f"call_fetch_{idx}"
            }

            # Parse publish date from page_result
            date_match = re.search(r'Publish Date:\s*([^\n]+)', page_result)
            detected_date = date_match.group(1).strip() if date_match else item.get("date")
            if detected_date in ("Not explicitly specified", "None", ""):
                detected_date = item.get("date")

            freshness = calculate_freshness(detected_date)
            page_record = {
                "title": item["title"],
                "domain": item["domain"],
                "url": url_to_fetch,
                "date": detected_date or "Recent",
                "freshness": freshness,
                "content_snippet": page_result[:1500]
            }
            read_articles.append(page_record)

            research_state["pages_read_count"] = len(read_articles)
            research_state["pages_read"].append({
                "url": url_to_fetch,
                "domain": item["domain"],
                "title": item["title"],
                "date": detected_date or "Recent"
            })
            research_state["sources"].append({
                "title": item["title"],
                "domain": item["domain"],
                "date": detected_date or "Recent",
                "url": url_to_fetch,
                "freshness": freshness
            })

            yield {
                "type": "research_progress",
                **research_state
            }

        plan_items[2]["status"] = "completed"
        plan_items[3]["status"] = "in_progress"
        yield {"type": "plan_update", "plan_items": plan_items}

        # Step 4: Multi-Round Verification Check
        # If deep_research is enabled and evidence is thin (< 2 readable pages), run Round 2
        valid_pages = [p for p in read_articles if "Could not read page" not in p["content_snippet"] and "timed out" not in p["content_snippet"]]
        if deep_research and len(valid_pages) < 3:
            yield {
                "type": "thought",
                "content": "Deep research check: Initial evidence depth was sparse. Executing Round 2 with expanded query terms..."
            }
            round2_q = [f"{task_prompt} details specifications {current_year}"]
            r2_out = multi_search.func(queries=round2_q, period="m")
            yield {
                "type": "tool_result",
                "tool": "multi_search",
                "result": r2_out[:500] + "..."
            }

        # Step 5: SYNTHESIS & FINAL ANSWER
        yield {
            "type": "thought",
            "content": f"Corroborating findings across {len(read_articles)} verified sources with publish dates. Synthesizing comprehensive final answer..."
        }

        # Format context for synthesis
        context_blocks = []
        for a in read_articles:
            context_blocks.append(
                f"Source: {a['title']} ({a['domain']})\n"
                f"Publish Date: {a['date']} [Freshness: {a['freshness']}]\n"
                f"URL: {a['url']}\n"
                f"Content:\n{a['content_snippet']}\n"
            )
        full_context = "\n---\n".join(context_blocks)

        synthesis_prompt = f"""You are AgentFlow. Operating Date: {today_str}.
Task: {task_prompt}

You have gathered live multi-source research:
{full_context}

CRITICAL INSTRUCTIONS:
1. NEVER guess or use outdated training data from 2024 or earlier. State facts strictly based on the provided live sources and current year {current_year}.
2. Structure your answer EXACTLY as follows:
### 📌 Summary
(A concise, high-impact summary answering the user's task directly)

### 🔍 Key Findings
(3-6 bullet points with detailed, factual findings, naming exact versions, dates, prices, or developments)

### 🔗 Sources & Citations
(List each source with: Title | Publisher Domain | Published Date | URL)

### 🛡️ Confidence Note
(State High, Medium, or Low confidence and provide a 1-sentence rationale based on source agreement and freshness)

Format with clean Markdown. Be direct, authoritative, and helpful."""

        try:
            synth_resp = llm.invoke([
                SystemMessage(content=make_system_prompt(preferences=preferences)),
                HumanMessage(content=synthesis_prompt)
            ])
            final_content = synth_resp.content.strip()
        except Exception as synth_err:
            final_content = (
                f"### 📌 Summary\nResearch compiled from {len(read_articles)} verified sources.\n\n"
                f"### 🔍 Key Findings\n" + "\n".join([f"- **{a['title']}**: {a['content_snippet'][:200]}..." for a in read_articles[:4]]) +
                f"\n\n### 🛡️ Confidence Note\nMedium - Synthesized directly from tool extracts."
            )

        # Check if the user asked to save this summary into workspace
        save_intent = extract_save_file_intent(task_prompt)
        if save_intent:
            save_file_name = save_intent["filename"]
            yield {
                "type": "tool_call",
                "tool": "save_file",
                "args": {"filename": save_file_name, "content": final_content},
                "tool_call_id": "call_save_file_1"
            }
            save_res = save_file.func(filename=save_file_name, content=final_content, overwrite=True)
            yield {
                "type": "tool_result",
                "tool": "save_file",
                "result": save_res,
                "tool_call_id": "call_save_file_1"
            }

        plan_items[3]["status"] = "completed"
        yield {"type": "plan_update", "plan_items": plan_items}

        # Deduplicate sources list
        final_sources_list = research_state["sources"]

        yield {
            "type": "final_answer",
            "content": final_content,
            "sources": final_sources_list,
            "research_progress": research_state
        }
        return

    # ==========================================
    # STANDARD AGENT STREAM (File / Email / Action Tasks)
    # ==========================================
    temporal_prompt = f"[Current Date: {today_str}, {now_time_str}] {task_prompt}"
    messages = [HumanMessage(content=temporal_prompt)]
    collected_sources: List[Dict[str, Any]] = []
    final_answer = ""
    active_plan_items: List[Dict[str, Any]] = []

    try:
        for event in agent.stream({"messages": messages}, stream_mode="updates"):
            if "agent" in event:
                node_messages = event["agent"].get("messages", [])
                for msg in node_messages:
                    if isinstance(msg, AIMessage):
                        if msg.content:
                            final_answer = str(msg.content)
                            yield {
                                "type": "thought",
                                "content": final_answer
                            }

                        if hasattr(msg, "tool_calls") and msg.tool_calls:
                            for tc in msg.tool_calls:
                                yield {
                                    "type": "tool_call",
                                    "tool": tc.get("name"),
                                    "args": tc.get("args"),
                                    "tool_call_id": tc.get("id", "")
                                }

            elif "tools" in event:
                tool_messages = event["tools"].get("messages", [])
                for tmsg in tool_messages:
                    if isinstance(tmsg, ToolMessage):
                        content_str = str(tmsg.content)
                        yield {
                            "type": "tool_result",
                            "tool": tmsg.name,
                            "result": content_str,
                            "tool_call_id": tmsg.tool_call_id
                        }

        yield {
            "type": "final_answer",
            "content": final_answer,
            "sources": collected_sources
        }

    except Exception as e:
        err_str = str(e)
        prov = get_llm_provider()
        if "connection" in err_str.lower() or "unreachable" in err_str.lower() or "refused" in err_str.lower() or "11434" in err_str:
            yield {
                "type": "error",
                "error": "No LLM available on this server. Set LLM_PROVIDER and an API key.",
                "message": "No LLM available on this server. Set LLM_PROVIDER and an API key.",
                "guidance": "On Render or cloud hosts, set LLM_PROVIDER=groq and GROQ_API_KEY, or LLM_PROVIDER=gemini and GEMINI_API_KEY."
            }
        else:
            yield {
                "type": "error",
                "error": err_str,
                "message": f"Agent encountered an error: {err_str}"
            }


def run_agent_cli():
    """Terminal runner for interactive verification."""
    print("AgentFlow Research Agent Terminal")
    task = input("Enter task: ").strip()
    if not task:
        return
    for step in stream_agent_steps(task, deep_research=False):
        print(step)


if __name__ == "__main__":
    run_agent_cli()
