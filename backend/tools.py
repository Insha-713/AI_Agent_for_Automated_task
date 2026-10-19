"""
AgentFlow - Agent Tools
Tools for deep multi-source research, sandboxed file operations (save/read/list), datetime, and email.
Strictly restricted to workspace/ directory for privacy and safety.
All web operations are 100% free with no paid APIs.
"""

import os
import re
import json
import socket
import smtplib
import urllib.parse
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any, Union
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
import feedparser
import trafilatura
import htmldate
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from langchain_core.tools import tool

# Preferred ddgs import
try:
    from ddgs import DDGS
except ImportError:
    from duckduckgo_search import DDGS

# Load environment variables
load_dotenv()

# Standard User-Agent for requests
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 AgentFlow/2.0"

# Resolve workspace directory securely
PROJECT_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_NAME = os.getenv("WORKSPACE_DIR", "workspace")
WORKSPACE_PATH = (PROJECT_ROOT / WORKSPACE_NAME).resolve()
WORKSPACE_PATH.mkdir(parents=True, exist_ok=True)


def _safe_workspace_path(filename: str) -> Path:
    """
    Ensure the path is strictly inside the workspace directory.
    Prevents path traversal attacks (e.g., ../../etc/passwd).
    """
    clean_name = filename.strip().lstrip("/\\")
    resolved_path = (WORKSPACE_PATH / clean_name).resolve()

    if not str(resolved_path).startswith(str(WORKSPACE_PATH)):
        raise ValueError(f"Security Alert: Access denied. Path '{filename}' attempts to escape the sandboxed workspace.")

    return resolved_path


def _normalize_url(raw_url: str) -> str:
    """Normalizes URL for accurate deduplication."""
    clean = raw_url.split("#")[0].strip()
    return clean.rstrip("/")


# ==========================================
# Research Tools (100% Free, Zero Paid APIs)
# ==========================================

@tool
def multi_search(queries: Union[List[str], str], period: str = "m") -> str:
    """
    Runs several distinct search queries in parallel on DuckDuckGo with time filtering and Indian/global region focus.
    Merges all results, removes duplicate URLs, extracts publisher domains, and returns titles, URLs, domains, and snippets.
    Args:
        queries: List of 3-5 search query strings (or comma-separated string)
        period: Time limit filter ('d'=day, 'w'=week, 'm'=month, 'y'=year). Default is 'm'.
    Returns:
        Deduplicated search results with title, publisher domain, URL, and snippet.
    """
    # Handle LLM inputs passed as JSON string or comma-separated string
    query_list: List[str] = []
    if isinstance(queries, str):
        q_str = queries.strip()
        if q_str.startswith("[") and q_str.endswith("]"):
            try:
                parsed = json.loads(q_str)
                if isinstance(parsed, list):
                    query_list = [str(x).strip() for x in parsed if str(x).strip()]
            except Exception:
                pass
        if not query_list:
            if "," in q_str:
                query_list = [part.strip() for part in q_str.split(",") if part.strip()]
            else:
                query_list = [q_str]
    elif isinstance(queries, list):
        query_list = [str(x).strip() for x in queries if str(x).strip()]

    if not query_list:
        return "Error: Please provide at least one search query."

    # Cap at 5 parallel queries for speed
    query_list = query_list[:5]

    clean_period = (period or "m").lower().strip()
    if clean_period not in ("d", "w", "m", "y"):
        clean_period = "m"

    results_by_url: Dict[str, Dict[str, str]] = {}

    def _execute_single_search(q: str) -> List[Dict[str, Any]]:
        try:
            ddgs_client = DDGS()
            # First attempt with specified timelimit
            hits = list(ddgs_client.text(q, region="in-en", timelimit=clean_period, max_results=4))
            if not hits and clean_period in ("d", "w"):
                # Fallback to month if day/week filter was too strict
                hits = list(ddgs_client.text(q, region="in-en", timelimit="m", max_results=4))
            if not hits:
                hits = list(ddgs_client.text(q, region="in-en", max_results=4))
            return hits
        except Exception:
            return []

    # Run searches concurrently
    with ThreadPoolExecutor(max_workers=min(len(query_list), 5)) as executor:
        future_map = {executor.submit(_execute_single_search, q): q for q in query_list}
        try:
            for future in as_completed(future_map, timeout=10):
                try:
                    hits = future.result()
                    for hit in hits:
                        href = hit.get("href", "").strip()
                        if not href:
                            continue
                        norm_url = _normalize_url(href)
                        if norm_url not in results_by_url:
                            domain = urllib.parse.urlparse(href).netloc or "web"
                            results_by_url[norm_url] = {
                                "title": hit.get("title", "Untitled"),
                                "url": href,
                                "domain": domain,
                                "snippet": hit.get("body", "").strip()
                            }
                except Exception:
                    continue
        except TimeoutError:
            pass  # Gracefully proceed with all results collected so far

    if not results_by_url:
        return f"No search results found across {len(query_list)} queries."

    output = [f"Found {len(results_by_url)} unique results across {len(query_list)} queries ({', '.join(query_list)}):\n"]
    for i, (u, data) in enumerate(results_by_url.items(), start=1):
        output.append(
            f"[{i}] {data['title']}\n"
            f"Domain: {data['domain']}\n"
            f"URL: {data['url']}\n"
            f"Snippet: {data['snippet']}\n"
        )

    return "\n".join(output)


@tool
def get_latest_news(topic: str, days: int = 1) -> str:
    """
    Fetches real-time live news headlines from Google News RSS feed for India and global topics.
    ALWAYS call this tool first whenever asked for recent news, today's news, current events, or breaking developments.
    Args:
        topic: The topic or query to search news for (e.g., 'AI India', 'Artificial Intelligence developments', 'Tech startups')
        days: How many days back to search (default 1 for today's news, expands to 7 if needed)
    Returns:
        Up to 8 verified news items with title, publisher domain, published date, and direct source link.
    """
    clean_topic = topic.strip() if topic else ""
    if not clean_topic:
        return "Error: Topic cannot be empty."

    # Sanitize topic parameter: strip paths, actions, or accidental full sentences
    clean_topic = re.sub(r"workspace/[\w\.-]+|[\w\.-]+\.txt|check current ist time|fetch latest|and save to", "", clean_topic, flags=re.I).strip()
    clean_topic = re.sub(r"\s+", " ", clean_topic)
    if not clean_topic:
        clean_topic = "Top AI and Technology news India"

    def _fetch_rss(q_topic: str, q_days: int) -> List[Dict[str, str]]:
        encoded_topic = urllib.parse.quote(q_topic)
        url = f"https://news.google.com/rss/search?q={encoded_topic}+when:{q_days}d&hl=en-IN&gl=IN&ceid=IN:en"
        try:
            resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=7)
            if resp.status_code != 200:
                return []
            feed = feedparser.parse(resp.content)
        except Exception:
            return []

        items = []
        if feed and hasattr(feed, "entries"):
            for entry in feed.entries[:8]:
                title = getattr(entry, "title", "Untitled")
                pub_date = getattr(entry, "published", "Date unavailable")
                link = getattr(entry, "link", "")
                domain = urllib.parse.urlparse(link).netloc or "news.google.com"
                items.append({
                    "title": title,
                    "published": pub_date,
                    "link": link,
                    "domain": domain
                })
        return items

    try:
        # First attempt with requested days (default 1)
        used_days = max(1, days)
        items = _fetch_rss(clean_topic, used_days)
        window_note = f"past {used_days} day" if used_days == 1 else f"past {used_days} days"

        # If nothing found, automatically retry with wider window of days=7
        if not items and used_days < 7:
            items = _fetch_rss(clean_topic, 7)
            used_days = 7
            window_note = f"expanded 7-day search window (initial {days}-day search returned 0 items)"

        if not items:
            return f"NO DATA: No recent news found for '{clean_topic}' across {window_note}."

        output_lines = [f"Found {len(items)} verified recent news items for '{clean_topic}' ({window_note}):\n"]
        for i, item in enumerate(items, start=1):
            output_lines.append(
                f"[{i}] {item['title']}\n"
                f"Domain: {item['domain']}\n"
                f"Published: {item['published']}\n"
                f"Source Link: {item['link']}\n"
            )

        return "\n".join(output_lines)
    except Exception as e:
        return f"Error retrieving latest news for '{clean_topic}': {str(e)}. Please check your internet connection or try another topic."


@tool
def fetch_page(url: str) -> str:
    """
    Downloads a webpage and extracts its full article text and publication date using Trafilatura (fallback: BeautifulSoup).
    Call this on top URLs to get rich, authentic context instead of shallow snippets.
    Args:
        url: The web page URL to fetch and read
    Returns:
        The extracted main text (first ~4000 characters), publish date if detected, and page URL.
    """
    clean_url = url.strip()
    if not clean_url or not clean_url.startswith("http"):
        return f"Error: Invalid URL '{clean_url}'."

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }

    try:
        resp = requests.get(clean_url, headers=headers, timeout=10, allow_redirects=True)
        if resp.status_code >= 400:
            return f"Notice: Could not read page '{clean_url}' (HTTP {resp.status_code}). Skipped gracefully."

        # Verify content type
        content_type = resp.headers.get("Content-Type", "").lower()
        if "text/html" not in content_type and "text/plain" not in content_type:
            return f"Notice: Skipped non-HTML content type ({content_type}) at '{clean_url}'."

        html_text = resp.text

        # Extract publish date if present
        pub_date = None
        try:
            pub_date = htmldate.find_date(html_text)
        except Exception:
            pass

        # Primary extraction using trafilatura
        extracted_text = None
        try:
            extracted_text = trafilatura.extract(
                html_text,
                include_comments=False,
                include_tables=True,
                no_fallback=False
            )
        except Exception:
            extracted_text = None

        # Fallback to BeautifulSoup if trafilatura extracted nothing
        if not extracted_text:
            soup = BeautifulSoup(html_text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                tag.decompose()
            paras = [p.get_text().strip() for p in soup.find_all(["p", "h1", "h2", "h3", "li"])]
            extracted_text = "\n".join([p for p in paras if len(p) > 20])

        if not extracted_text or len(extracted_text.strip()) < 50:
            return f"Notice: No readable article text found at '{clean_url}' (it may be dynamically rendered with JavaScript or paywalled)."

        # Truncate to first ~4000 characters
        capped_text = extracted_text.strip()
        is_truncated = False
        if len(capped_text) > 4000:
            capped_text = capped_text[:4000]
            is_truncated = True

        domain = urllib.parse.urlparse(clean_url).netloc

        res = [
            f"--- Content from {domain} ---",
            f"URL: {clean_url}",
            f"Publish Date: {pub_date or 'Not explicitly specified'}",
            f"\n{capped_text}"
        ]
        if is_truncated:
            res.append("\n[Note: Content truncated to first ~4000 characters for optimal reasoning.]")

        return "\n".join(res)
    except requests.Timeout:
        return f"Notice: Request to '{clean_url}' timed out after 10 seconds. Skipped gracefully."
    except requests.RequestException as re_err:
        return f"Notice: Could not access '{clean_url}': {str(re_err)}. Skipped gracefully."
    except Exception as e:
        return f"Notice: Error reading '{clean_url}': {str(e)}. Skipped gracefully."


@tool
def search_sources(topic: str, source: str) -> str:
    """
    Searches specialized trusted sources for deep, domain-specific information.
    Args:
        topic: The topic, question, or keyword to search
        source: The specialized source to search ('wikipedia', 'reddit', 'hackernews', 'arxiv', 'youtube')
    Returns:
        Structured findings, titles, URLs, and snippets from that source.
    """
    clean_topic = topic.strip()
    clean_src = (source or "").strip().lower()

    if not clean_topic:
        return "Error: Topic cannot be empty."

    headers = {"User-Agent": USER_AGENT}

    # 1. Wikipedia API
    if clean_src in ("wikipedia", "wiki"):
        try:
            encoded_q = urllib.parse.quote(clean_topic)
            wiki_api = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={encoded_q}&format=json&utf8=1&srlimit=4"
            r = requests.get(wiki_api, headers=headers, timeout=8)
            data = r.json()
            items = data.get("query", {}).get("search", [])
            if not items:
                return f"No Wikipedia articles found for '{clean_topic}'."
            out = [f"Wikipedia results for '{clean_topic}':"]
            for i, it in enumerate(items, 1):
                clean_snippet = re.sub(r"<[^>]+>", "", it.get("snippet", ""))
                title = it.get("title", "")
                page_url = f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}"
                out.append(f"[{i}] {title}\nURL: {page_url}\nSnippet: {clean_snippet}\n")
            return "\n".join(out)
        except Exception as e:
            return f"Notice: Wikipedia search error: {str(e)}."

    # 2. HackerNews (Algolia HN API)
    elif clean_src in ("hackernews", "hn", "ycombinator"):
        try:
            encoded_q = urllib.parse.quote(clean_topic)
            hn_api = f"https://hn.algolia.com/api/v1/search?query={encoded_q}&tags=story&hitsPerPage=4"
            r = requests.get(hn_api, headers=headers, timeout=8)
            data = r.json()
            hits = data.get("hits", [])
            if not hits:
                return f"No HackerNews stories found for '{clean_topic}'."
            out = [f"HackerNews discussions for '{clean_topic}':"]
            for i, h in enumerate(hits, 1):
                title = h.get("title", "Untitled")
                story_url = h.get("url") or f"https://news.ycombinator.com/item?id={h.get('objectID')}"
                created = h.get("created_at", "")[:10]
                points = h.get("points", 0)
                comments = h.get("num_comments", 0)
                out.append(f"[{i}] {title}\nDate: {created} | Points: {points} | Comments: {comments}\nURL: {story_url}\n")
            return "\n".join(out)
        except Exception as e:
            return f"Notice: HackerNews search error: {str(e)}."

    # 3. Reddit (Direct JSON with DDGS fallback)
    elif clean_src in ("reddit", "subreddit"):
        try:
            # First attempt Reddit JSON
            encoded_q = urllib.parse.quote(clean_topic)
            reddit_url = f"https://www.reddit.com/search.json?q={encoded_q}&sort=relevance&limit=4"
            r = requests.get(reddit_url, headers={"User-Agent": "AgentFlowBot/2.0"}, timeout=6)
            if r.status_code == 200:
                data = r.json()
                children = data.get("data", {}).get("children", [])
                if children:
                    out = [f"Reddit discussions for '{clean_topic}':"]
                    for i, child in enumerate(children[:4], 1):
                        d = child.get("data", {})
                        title = d.get("title", "")
                        sub = d.get("subreddit_name_prefixed", "")
                        permalink = f"https://reddit.com{d.get('permalink', '')}"
                        score = d.get("score", 0)
                        out.append(f"[{i}] {title} ({sub})\nScore: {score}\nURL: {permalink}\n")
                    return "\n".join(out)
        except Exception:
            pass

        # Fallback to DDGS site search
        try:
            ddgs_client = DDGS()
            hits = list(ddgs_client.text(f"site:reddit.com {clean_topic}", max_results=4))
            if hits:
                out = [f"Reddit discussions for '{clean_topic}' (via web search):"]
                for i, h in enumerate(hits, 1):
                    out.append(f"[{i}] {h.get('title')}\nURL: {h.get('href')}\nSnippet: {h.get('body')}\n")
                return "\n".join(out)
        except Exception as e:
            return f"Notice: Reddit search unavailable: {str(e)}."
        return f"No Reddit discussions found for '{clean_topic}'."

    # 4. arXiv API (with DDGS fallback)
    elif clean_src in ("arxiv", "papers", "research"):
        try:
            encoded_q = urllib.parse.quote(clean_topic)
            arxiv_url = f"https://export.arxiv.org/api/query?search_query=all:{encoded_q}&start=0&max_results=4"
            r = requests.get(arxiv_url, headers=headers, timeout=6)
            if r.status_code == 200:
                feed = feedparser.parse(r.text)
                if feed.entries:
                    out = [f"arXiv research papers for '{clean_topic}':"]
                    for i, entry in enumerate(feed.entries[:4], 1):
                        title = getattr(entry, "title", "").replace("\n", " ")
                        pub = getattr(entry, "published", "")[:10]
                        link = getattr(entry, "link", "")
                        summary = getattr(entry, "summary", "").replace("\n", " ")[:200]
                        out.append(f"[{i}] {title}\nPublished: {pub}\nURL: {link}\nAbstract: {summary}...\n")
                    return "\n".join(out)
        except Exception:
            pass

        # Fallback to DDGS site search
        try:
            ddgs_client = DDGS()
            hits = list(ddgs_client.text(f"site:arxiv.org {clean_topic}", max_results=4))
            if hits:
                out = [f"arXiv research papers for '{clean_topic}' (via web search):"]
                for i, h in enumerate(hits, 1):
                    out.append(f"[{i}] {h.get('title')}\nURL: {h.get('href')}\nSnippet: {h.get('body')}\n")
                return "\n".join(out)
        except Exception as e:
            return f"Notice: arXiv search error: {str(e)}."
        return f"No arXiv papers found for '{clean_topic}'."

    # 5. YouTube (DDGS videos or site:youtube.com fallback)
    elif clean_src in ("youtube", "video", "videos"):
        try:
            ddgs_client = DDGS()
            try:
                vids = list(ddgs_client.videos(clean_topic, max_results=4))
            except Exception:
                vids = []

            if vids:
                out = [f"YouTube video results for '{clean_topic}':"]
                for i, v in enumerate(vids, 1):
                    title = v.get("title", "")
                    content_url = v.get("content") or v.get("href", "")
                    pub = v.get("published", "")
                    dur = v.get("duration", "")
                    out.append(f"[{i}] {title}\nDuration: {dur} | Published: {pub}\nURL: {content_url}\n")
                return "\n".join(out)

            # Fallback to text search on youtube.com
            hits = list(ddgs_client.text(f"site:youtube.com {clean_topic}", max_results=4))
            if hits:
                out = [f"YouTube video results for '{clean_topic}':"]
                for i, h in enumerate(hits, 1):
                    out.append(f"[{i}] {h.get('title')}\nURL: {h.get('href')}\nSnippet: {h.get('body')}\n")
                return "\n".join(out)
        except Exception as e:
            return f"Notice: YouTube search error: {str(e)}."
        return f"No YouTube videos found for '{clean_topic}'."

    else:
        return f"Unknown source '{clean_src}'. Supported sources: 'wikipedia', 'reddit', 'hackernews', 'arxiv', 'youtube'."


@tool
def web_search(query: str, period: str = "m", max_results: int = 5) -> str:
    """
    Searches the live web using DuckDuckGo with time filtering.
    Use this tool to find real-time facts, recent developments, research topics, job postings, and answers.
    Args:
        query: The search query keywords
        period: Time limit filter ('d' for past day, 'w' for past week, 'm' for past month, 'y' for past year). Default is 'm'.
        max_results: Maximum results to retrieve (default 5)
    Returns:
        Titles, publisher domains, publication dates/snippets, and direct source URLs.
    """
    try:
        clean_period = (period or "m").lower().strip()
        if clean_period not in ("d", "w", "m", "y"):
            clean_period = "m"

        ddgs = DDGS()
        results = list(ddgs.text(
            query,
            region="in-en",
            timelimit=clean_period,
            max_results=max_results
        ))

        if not results and clean_period == "d":
            results = list(ddgs.text(query, region="in-en", timelimit="w", max_results=max_results))
        if not results and clean_period in ("d", "w"):
            results = list(ddgs.text(query, region="in-en", timelimit="m", max_results=max_results))
        if not results:
            results = list(ddgs.text(query, region="in-en", max_results=max_results))

        if not results:
            return f"No results found for query: '{query}'."

        formatted_results = []
        for i, item in enumerate(results, start=1):
            title = item.get("title", "No Title")
            snippet = item.get("body", "No Snippet")
            href = item.get("href", "")
            domain = urllib.parse.urlparse(href).netloc or "web"
            formatted_results.append(
                f"[{i}] {title}\nDomain: {domain}\nURL: {href}\nSnippet: {snippet}\n"
            )

        return "\n".join(formatted_results)
    except Exception as e:
        return f"Error executing web search for '{query}': {str(e)}. Please check your internet connection or try another query."


@tool
def get_datetime() -> str:
    """
    Returns the current local date, time, weekday, and Indian Standard Time (IST).
    Useful for time-sensitive tasks, calculating deadlines, or scheduling.
    """
    now_utc = datetime.now(timezone.utc)
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    now_ist = now_utc.astimezone(ist_tz)
    local_now = datetime.now()

    return (
        f"Indian Standard Time (IST): {now_ist.strftime('%A, %B %d, %Y - %I:%M:%S %p')}\n"
        f"Local Machine Time: {local_now.strftime('%A, %B %d, %Y - %I:%M:%S %p')}\n"
        f"ISO Format: {local_now.isoformat()}"
    )


# ==========================================
# Sandboxed File Tools & Email Tools
# ==========================================

@tool
def save_file(filename: Optional[str] = None, content: str = "", overwrite: bool = False, path: Optional[str] = None) -> str:
    """
    Saves text content to a file in the sandboxed workspace directory.
    Restricted strictly to the workspace/ folder.
    Args:
        filename: Name of the file (e.g., 'notes.txt', 'summary.md', 'leads.csv')
        content: The text content to write into the file
        overwrite: If False, raises a warning if the file already exists
        path: Alias for filename
    """
    target_name = filename or path
    if not target_name:
        return "Error: Please specify a filename to save."

    try:
        target_path = _safe_workspace_path(target_name)

        if target_path.exists():
            from backend.approvals import approval_manager
            if approval_manager.has_active_listeners():
                is_approved = approval_manager.request_approval(
                    task_id="active",
                    action_type="overwrite_file",
                    tool_name="save_file",
                    parameters={"filename": target_name, "existing_size": target_path.stat().st_size, "new_size": len(content)},
                    details=f"File '{target_name}' already exists ({target_path.stat().st_size} bytes). Overwriting will replace its existing contents."
                )
                if not is_approved:
                    return f"[ACTION REJECTED BY USER] Overwriting existing file '{target_name}' was rejected by user. Original file preserved."
            elif not overwrite:
                return (
                    f"WARNING: File '{target_name}' already exists in workspace. "
                    f"To overwrite it, specify overwrite=True, or choose a different filename."
                )

        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_text(content, encoding="utf-8")
        size_bytes = target_path.stat().st_size
        return f"File successfully saved: '{target_name}' ({size_bytes} bytes) in workspace."
    except Exception as e:
        return f"Error saving file '{target_name}': {str(e)}"


@tool
def read_file(filename: Optional[str] = None, path: Optional[str] = None) -> str:
    """
    Reads the content of a file from the workspace/ directory.
    Supports text files (.txt, .md, .csv, .json, .py) and PDF documents (.pdf).
    Restricted strictly to the workspace/ folder.
    Args:
        filename: Name of the file to read (e.g., 'resume.pdf', 'report.txt')
        path: Alias for filename
    """
    target_name = filename or path
    if not target_name:
        return "Error: Please specify a filename to read."

    try:
        target_path = _safe_workspace_path(target_name)

        if not target_path.exists():
            return f"Error: File '{target_name}' does not exist in workspace. Use list_files to see available files."

        if not target_path.is_file():
            return f"Error: '{target_name}' is a directory, not a file."

        suffix = target_path.suffix.lower()

        if suffix == ".pdf":
            try:
                from pypdf import PdfReader
                reader = PdfReader(str(target_path))
                num_pages = len(reader.pages)
                extracted_text = []

                for page_idx, page in enumerate(reader.pages):
                    text = page.extract_text() or ""
                    extracted_text.append(f"--- Page {page_idx + 1} of {num_pages} ---\n{text}")

                full_text = "\n".join(extracted_text).strip()
                if not full_text:
                    return f"PDF '{target_name}' was read ({num_pages} pages) but no extractable text was found."

                if len(full_text) > 12000:
                    return full_text[:12000] + f"\n\n[Note: Truncated for length. Total {len(full_text)} characters across {num_pages} pages.]"
                return full_text
            except Exception as pdf_err:
                return f"Error reading PDF file '{target_name}': {str(pdf_err)}"

        try:
            content = target_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            content = target_path.read_text(encoding="latin-1")

        if len(content) > 12000:
            return content[:12000] + f"\n\n[Note: Content truncated. Total {len(content)} characters.]"

        return content

    except Exception as e:
        return f"Error reading file '{target_name}': {str(e)}"


@tool
def list_files(path: Optional[str] = None) -> str:
    """
    Lists all files currently stored in the sandboxed workspace/ directory.
    Returns filenames, sizes in KB, and last modification times.
    """
    try:
        files = [p for p in WORKSPACE_PATH.rglob("*") if p.is_file()]

        if not files:
            return "Workspace is currently empty (no files found in workspace/)."

        output = ["Files in workspace:"]
        for p in files:
            rel_path = p.relative_to(WORKSPACE_PATH)
            size_kb = p.stat().st_size / 1024
            mtime = datetime.fromtimestamp(p.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
            output.append(f"- {rel_path} ({size_kb:.1f} KB, modified: {mtime})")

        return "\n".join(output)
    except Exception as e:
        return f"Error listing files in workspace: {str(e)}"


def connect_gmail_smtp(email_user: str, email_pass: str, timeout: int = 20) -> tuple:
    """
    Establishes an authenticated connection to Gmail SMTP with dual-port failover:
    - Attempt 1: Port 587 with STARTTLS (explicit TLS).
    - Attempt 2: Port 465 with SMTP_SSL (implicit TLS) if port 587 is blocked or disconnected.
    - Strips quotes and internal spaces from app passwords.
    - Returns (server, port_used: int).
    - Never prints or reveals passwords in error messages or logs.
    """
    clean_user = (email_user or "").strip().strip("'\"")
    clean_pass = (email_pass or "").strip().strip("'\"").replace(" ", "")

    if not clean_user or not clean_pass:
        raise ValueError("EMAIL_USER or EMAIL_PASS not configured in server environment.")

    # Attempt 1: Port 587 with STARTTLS
    port_587_error = None
    try:
        server = smtplib.SMTP("smtp.gmail.com", 587, timeout=timeout)
        server.ehlo()
        server.starttls()
        server.ehlo()
        # Enforce LOGIN mechanism to prevent Gmail socket termination during PLAIN->LOGIN fallback
        if hasattr(server, "esmtp_features") and isinstance(server.esmtp_features, dict):
            server.esmtp_features["auth"] = "LOGIN"
        server.login(clean_user, clean_pass)
        return server, 587
    except smtplib.SMTPAuthenticationError as auth_err:
        # Invalid credentials will fail on both ports, so fail immediately with honest guidance
        raise smtplib.SMTPAuthenticationError(
            auth_err.smtp_code,
            f"Authentication failed for '{clean_user}'. Invalid Google App Password. "
            "Please generate a 16-character App Password at https://myaccount.google.com/apppasswords. "
            "Note: Your regular Gmail account password will not work."
        )
    except (smtplib.SMTPServerDisconnected, socket.timeout, TimeoutError, ConnectionRefusedError, OSError, smtplib.SMTPConnectError) as conn_err:
        port_587_error = str(conn_err)

    # Attempt 2: Port 465 with SSL (Fallback)
    try:
        server = smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=timeout)
        server.ehlo()
        if hasattr(server, "esmtp_features") and isinstance(server.esmtp_features, dict):
            server.esmtp_features["auth"] = "LOGIN"
        server.login(clean_user, clean_pass)
        return server, 465
    except smtplib.SMTPAuthenticationError as auth_err:
        raise smtplib.SMTPAuthenticationError(
            auth_err.smtp_code,
            f"Authentication failed for '{clean_user}'. Invalid Google App Password. "
            "Please generate a 16-character App Password at https://myaccount.google.com/apppasswords. "
            "Note: Your regular Gmail account password will not work."
        )
    except Exception as e:
        raise smtplib.SMTPConnectError(
            -1,
            f"Connection blocked or timed out when contacting smtp.gmail.com on port 587 ({port_587_error or 'Connection closed'}) "
            f"and port 465 ({str(e)}). Please check your internet connection, firewall, VPN, or antivirus settings."
        )


@tool
def send_email(to_email: str, subject: str, body: str) -> str:
    """
    Sends an email to the specified recipient via Gmail SMTP with dual-port failover (587 STARTTLS -> 465 SSL).
    Requires EMAIL_USER and EMAIL_PASS environment variables configured.
    If credentials are not configured, safely simulates the email delivery.
    """
    clean_to = to_email.strip()

    # Pre-flight check: Verify that body, subject, and to_email are fully rendered
    # Placeholders like {{search_results}} or {{output}} must not remain in the outgoing email!
    unresolved_placeholders = list(set(
        re.findall(r"\{\{([a-zA-Z0-9_\.]+)\}\}", body) + 
        re.findall(r"\{\{([a-zA-Z0-9_\.]+)\}\}", subject) +
        re.findall(r"\{\{([a-zA-Z0-9_\.]+)\}\}", clean_to)
    ))
    if unresolved_placeholders:
        formatted_placeholders = ", ".join([f"{{{{{p}}}}}" for p in unresolved_placeholders])
        return (
            f"Failed to send email: Unresolved workflow template placeholder(s) detected: {formatted_placeholders}. "
            f"The previous step output was not provided or failed to populate before sending."
        )

    # Human approval check
    from backend.approvals import approval_manager
    if approval_manager.has_active_listeners():
        is_approved = approval_manager.request_approval(
            task_id="active",
            action_type="send_email",
            tool_name="send_email",
            parameters={"to_email": clean_to, "subject": subject, "body_preview": body[:300]},
            details=f"The agent wants to send an email to '{clean_to}' with subject '{subject}'."
        )
        if not is_approved:
            return f"[ACTION REJECTED BY USER] Sending email to '{clean_to}' was rejected by user. Email not sent."

    # Read and sanitize credentials from environment
    email_user = (os.getenv("EMAIL_USER") or os.getenv("GMAIL_EMAIL") or "").strip().strip("'\"")
    email_pass = (os.getenv("EMAIL_PASS") or os.getenv("GMAIL_APP_PASSWORD") or "").strip().strip("'\"").replace(" ", "")

    if not email_user or not email_pass:
        return (
            f"[SIMULATION MODE - EMAIL NOT SENT (APPROVED)]\n"
            f"Notice: EMAIL_USER / EMAIL_PASS not configured in .env file.\n"
            f"To: {clean_to}\n"
            f"Subject: {subject}\n"
            f"Body preview:\n{body[:300]}..."
        )

    try:
        msg = MIMEMultipart()
        msg["From"] = email_user
        msg["To"] = clean_to
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain", "utf-8"))

        server, port_used = connect_gmail_smtp(email_user, email_pass, timeout=20)
        try:
            server.send_message(msg)
        finally:
            try:
                server.quit()
            except Exception:
                pass

        return f"Email successfully sent to '{clean_to}' with subject '{subject}' (via Gmail SMTP port {port_used})."

    except smtplib.SMTPAuthenticationError as auth_err:
        return (
            f"Failed to send email to '{clean_to}': Authentication failed for '{email_user}'. "
            f"Invalid Google App Password. Please generate a 16-character App Password at "
            f"https://myaccount.google.com/apppasswords and update your server settings."
        )
    except smtplib.SMTPRecipientsRefused as recip_err:
        return (
            f"Failed to send email to '{clean_to}': Recipient rejected. "
            f"Gmail SMTP rejected destination address '{clean_to}'. Please verify the recipient address."
        )
    except (smtplib.SMTPServerDisconnected, socket.timeout, TimeoutError, ConnectionRefusedError, OSError) as conn_err:
        return (
            f"Failed to send email to '{clean_to}': Connection blocked or timed out on ports 587 and 465. "
            f"Please check your internet connection, firewall, VPN, or antivirus settings."
        )
    except Exception as e:
        return f"Failed to send email to '{clean_to}': {str(e)}"


@tool
def send_telegram_message(message: str, chat_id: Optional[str] = None, parse_mode: str = "Markdown") -> str:
    """
    Sends an instant message, news report, or alert via Telegram Bot.
    Requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in environment variables.
    If credentials are not configured, safely simulates delivery.
    Requires explicit human approval before live sending.
    """
    from backend.approvals import approval_manager
    if approval_manager.has_active_listeners():
        is_approved = approval_manager.request_approval(
            task_id="active",
            action_type="send_telegram_message",
            tool_name="send_telegram_message",
            parameters={"chat_id": chat_id or "default", "preview": message[:300]},
            details=f"The agent wants to send a Telegram message ({len(message)} characters)."
        )
        if not is_approved:
            return "[ACTION REJECTED BY USER] Sending Telegram message was rejected by user."

    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    target_chat_id = (chat_id or os.getenv("TELEGRAM_CHAT_ID", "")).strip()

    if not bot_token or not target_chat_id:
        return (
            f"[SIMULATION MODE - TELEGRAM NOT SENT (APPROVED)]\n"
            f"Notice: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured in .env\n"
            f"Target Chat: {target_chat_id or 'Not Set'}\n"
            f"Message Preview:\n{message[:300]}..."
        )

    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": target_chat_id,
            "text": message[:4000],
            "parse_mode": parse_mode,
            "disable_web_page_preview": False
        }
        resp = requests.post(url, json=payload, timeout=10)
        data = resp.json()
        if data.get("ok"):
            return f"Telegram message successfully delivered to chat '{target_chat_id}'."
        else:
            # Fallback to plain text if Markdown formatting fails
            if "can't parse entities" in data.get("description", "").lower():
                payload.pop("parse_mode", None)
                retry_resp = requests.post(url, json=payload, timeout=10)
                if retry_resp.json().get("ok"):
                    return f"Telegram message successfully delivered to chat '{target_chat_id}' (plain text fallback)."
            return f"Telegram API Error: {data.get('description', 'Unknown error')}"
    except Exception as e:
        return f"Failed to send Telegram message: {str(e)}"


@tool
def analyze_tabular_data(filename: str, focus_metric: Optional[str] = "") -> str:
    """
    Cleans CSV or Excel tabular data, calculates KPIs, generates an executive summary,
    and exports downloadable Excel (.xlsx), CSV, and Markdown reports.
    Takes a filename located in workspace/ or workspace/samples/.
    """
    from backend.reports import (
        load_and_clean_tabular_data,
        calculate_kpis,
        generate_executive_summary,
        export_report_files,
    )
    try:
        data = load_and_clean_tabular_data(filename)
        kpis = calculate_kpis(data)
        summary = generate_executive_summary(data["file_name"], data, kpis, focus_metric)
        exports = export_report_files(data["file_name"], data, kpis, summary)

        preview = (
            f"Successfully analyzed '{data['file_name']}'.\n"
            f"- Rows: {data['row_count']} | Columns: {data['column_count']} | Data Quality: {kpis['dataset_summary']['data_quality_score']}%\n"
            f"- Exported Reports: Excel ({exports['xlsx']}), CSV ({exports['csv']}), Summary ({exports['md']})\n\n"
            f"{summary[:1200]}..."
        )
        return preview
    except Exception as e:
        return f"Error analyzing tabular data '{filename}': {str(e)}"


@tool
def check_website_health(url: str, expected_status: Optional[int] = 200) -> str:
    """
    Checks real-time uptime, HTTP status code, and latency (in milliseconds) for any website or API endpoint.
    Detects whether the target is operational, degraded, or down.
    """
    from backend.monitors import perform_health_check
    try:
        res = perform_health_check(url, expected_status=expected_status or 200)
        status = res["status"].upper()
        err_note = f"- Notes: {res['error_message']}" if res.get("error_message") else "- All systems healthy."
        return (
            f"Website Health Check for {res['url']}:\n"
            f"- Status: {status} (HTTP {res['status_code']})\n"
            f"- Response Latency: {res['latency_ms']} ms\n"
            f"- Checked At: {res['checked_at']}\n"
            f"{err_note}"
        )
    except Exception as e:
        return f"Error probing website {url}: {str(e)}"


# Weather code mappings for Open-Meteo
WEATHER_CODE_DESCRIPTIONS = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


@tool
def get_weather(city: str, days: int = 1) -> str:
    """
    Fetches real-time weather and forecast for any city worldwide using the free Open-Meteo API.
    Zero API key required.
    Args:
        city: City name (e.g., 'Lucknow', 'Delhi', 'Mumbai', 'London')
        days: Number of forecast days (1 to 7). Default is 1.
    Returns:
        Structured weather report with temperature (°C), weather condition, humidity %, wind speed, and daily forecast.
    """
    clean_city = city.strip()
    if not clean_city:
        return "Error: City name cannot be empty."

    try:
        # Step 1: Free Geocoding with Open-Meteo
        geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={urllib.parse.quote(clean_city)}&count=1&language=en&format=json"
        geo_res = requests.get(geo_url, headers={"User-Agent": USER_AGENT}, timeout=8)
        if geo_res.status_code != 200:
            return f"Error geocoding city '{clean_city}': HTTP {geo_res.status_code}"

        geo_data = geo_res.json()
        results = geo_data.get("results", [])
        if not results:
            return f"No location found matching city '{clean_city}'. Please check the city spelling."

        loc = results[0]
        lat = loc["latitude"]
        lon = loc["longitude"]
        resolved_name = loc.get("name", clean_city)
        admin1 = loc.get("admin1", "")
        country = loc.get("country", "")
        location_header = f"{resolved_name}, {admin1}, {country}".replace(", ,", ",").strip(", ")

        # Step 2: Fetch forecast
        days_clamped = max(1, min(7, int(days)))
        forecast_url = (
            f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m"
            f"&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
            f"&timezone=auto&forecast_days={days_clamped}"
        )
        fc_res = requests.get(forecast_url, headers={"User-Agent": USER_AGENT}, timeout=8)
        if fc_res.status_code != 200:
            return f"Error fetching weather forecast: HTTP {fc_res.status_code}"

        fc_data = fc_res.json()
        current = fc_data.get("current", {})
        temp = current.get("temperature_2m", "N/A")
        feels_like = current.get("apparent_temperature", "N/A")
        humidity = current.get("relative_humidity_2m", "N/A")
        wind = current.get("wind_speed_10m", "N/A")
        w_code = current.get("weather_code", 0)
        condition = WEATHER_CODE_DESCRIPTIONS.get(w_code, "Fair")

        daily = fc_data.get("daily", {})
        daily_lines = []
        dates = daily.get("time", [])
        max_temps = daily.get("temperature_2m_max", [])
        min_temps = daily.get("temperature_2m_min", [])
        precips = daily.get("precipitation_probability_max", [])
        codes = daily.get("weather_code", [])

        for i in range(len(dates)):
            d_date = dates[i]
            d_max = max_temps[i] if i < len(max_temps) else "N/A"
            d_min = min_temps[i] if i < len(min_temps) else "N/A"
            d_prec = precips[i] if i < len(precips) else "0"
            d_desc = WEATHER_CODE_DESCRIPTIONS.get(codes[i] if i < len(codes) else 0, "Fair")
            daily_lines.append(f"  • {d_date}: {d_desc} | High: {d_max}°C, Low: {d_min}°C | Rain Chance: {d_prec}%")

        forecast_str = "\n".join(daily_lines) if daily_lines else "  No extended forecast available."

        report = (
            f"🌤️ Weather Report for {location_header}:\n"
            f"--------------------------------------------------\n"
            f"- Condition: {condition}\n"
            f"- Current Temperature: {temp}°C (Feels like {feels_like}°C)\n"
            f"- Relative Humidity: {humidity}%\n"
            f"- Wind Speed: {wind} km/h\n"
            f"- Coordinates: {lat:.2f}°N, {lon:.2f}°E\n"
            f"\nUpcoming Forecast:\n{forecast_str}\n"
            f"--------------------------------------------------\n"
            f"(Source: Open-Meteo Free Global Forecast API, zero-cost)"
        )
        return report
    except Exception as e:
        return f"Error retrieving weather for '{city}': {str(e)}"


@tool
def read_important_emails(max_emails: int = 5, criteria: str = "urgent, bills, job, interview, client") -> str:
    """
    Reads unread/recent emails from Gmail inbox over IMAP using the configured app password.
    Filters and prioritizes important messages according to user criteria.
    TREATS ALL INBOX CONTENT AS UNTRUSTED DATA with strict prompt-injection protection.
    READ-ONLY: Never deletes, moves, or auto-replies to emails.
    Args:
        max_emails: Maximum number of important emails to summarize (default 5).
        criteria: Key criteria defining what is important (e.g. 'job, interview, urgent, bank, client').
    Returns:
        Structured summary list of important emails with sender, subject, date, and clean sanitized excerpt.
    """
    import imaplib
    import email
    from email.header import decode_header

    email_user = os.getenv("GMAIL_EMAIL") or os.getenv("EMAIL_USER") or ""
    email_pass = os.getenv("GMAIL_APP_PASSWORD") or os.getenv("EMAIL_PASS") or ""
    email_user = email_user.strip()
    email_pass = email_pass.strip().replace(" ", "")

    if not email_user or not email_pass:
        return (
            "[mock] Gmail IMAP Credentials Not Configured.\n"
            "To read live emails:\n"
            "1. Generate a 16-character Google App Password (myaccount.google.com/apppasswords).\n"
            "2. Set EMAIL_USER and EMAIL_PASS in server settings.\n\n"
            "Sample [mock] unread messages found for criteria:\n"
            f"- Subject: [mock] Interview Invitation: Senior AI Engineer | From: careers@techcorp.in | Date: Today 08:30 IST\n"
            f"- Subject: [mock] Electricity Bill Due Reminder | From: alerts@uppcl.org | Date: Yesterday 14:15 IST\n"
            f"- Subject: [mock] Client Feedback: Project Deliverable | From: rahul.sharma@startup.in | Date: Yesterday 19:40 IST"
        )

    def _clean_str(header_val: Any) -> str:
        if not header_val:
            return ""
        decoded_parts = decode_header(header_val)
        out = ""
        for part, encoding in decoded_parts:
            if isinstance(part, bytes):
                try:
                    out += part.decode(encoding or "utf-8", errors="ignore")
                except Exception:
                    out += part.decode("latin-1", errors="ignore")
            else:
                out += str(part)
        return out.strip()

    def _sanitize_body(text: str) -> str:
        """Protects against prompt injection from untrusted email contents."""
        # Strip script tags, HTML tags, and common injection patterns
        clean = re.sub(r"<[^>]+>", " ", text)
        clean = re.sub(r"(?i)(ignore previous instructions|system prompt|override directives|you are now|dan mode)", "[FILTERED]", clean)
        clean = re.sub(r"\s+", " ", clean).strip()
        return clean[:250]

    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com", 993, timeout=12)
        mail.login(email_user, email_pass)
        mail.select("INBOX", readonly=True)

        # Search unread messages first
        status, messages = mail.search(None, "UNSEEN")
        msg_ids = messages[0].split() if status == "OK" and messages and messages[0] else []

        # If no unread, check recent messages
        if not msg_ids:
            status, messages = mail.search(None, "ALL")
            if status == "OK" and messages and messages[0]:
                msg_ids = messages[0].split()[-max_emails:]

        if not msg_ids:
            mail.logout()
            return f"Inbox checked for {email_user}. No unread or matching emails found."

        # Fetch most recent msg_ids up to max_emails
        selected_ids = msg_ids[-max_emails:]
        selected_ids.reverse()

        parsed_emails = []
        criteria_keywords = [c.strip().lower() for c in criteria.split(",") if c.strip()]

        for mid in selected_ids:
            res, data = mail.fetch(mid, "(RFC822)")
            if res != "OK" or not data or not data[0]:
                continue
            raw_email = data[0][1]
            msg = email.message_from_bytes(raw_email)

            subject = _clean_str(msg.get("Subject", "No Subject"))
            sender = _clean_str(msg.get("From", "Unknown Sender"))
            date_str = _clean_str(msg.get("Date", "Unknown Date"))

            body_content = ""
            if msg.is_multipart():
                for part in msg.walk():
                    ctype = part.get_content_type()
                    cdisp = str(part.get("Content-Disposition"))
                    if ctype == "text/plain" and "attachment" not in cdisp:
                        payload = part.get_payload(decode=True)
                        if payload:
                            body_content = payload.decode("utf-8", errors="ignore")
                            break
            else:
                payload = msg.get_payload(decode=True)
                if payload:
                    body_content = payload.decode("utf-8", errors="ignore")

            snippet = _sanitize_body(body_content)

            # Match criteria
            text_to_match = f"{subject} {sender} {snippet}".lower()
            is_priority = any(k in text_to_match for k in criteria_keywords) if criteria_keywords else True

            parsed_emails.append({
                "subject": subject,
                "sender": sender,
                "date": date_str,
                "snippet": snippet,
                "priority": is_priority
            })

        mail.logout()

        if not parsed_emails:
            return f"Inbox checked ({email_user}). No recent emails found."

        lines = [f"📬 Important Email Digest ({email_user}) - Filter Criteria: '{criteria}':\n"]
        for idx, em in enumerate(parsed_emails, 1):
            pri_tag = " [High Priority]" if em["priority"] else ""
            lines.append(f"{idx}. {em['subject']}{pri_tag}")
            lines.append(f"   • From: {em['sender']}")
            lines.append(f"   • Date: {em['date']}")
            lines.append(f"   • Snippet: {em['snippet']}")
            lines.append("")

        return "\n".join(lines).strip()
    except Exception as e:
        return f"Error reading inbox via IMAP: {str(e)}. Check that IMAP is enabled in Gmail settings."


# Export list of all agent tools
ALL_TOOLS = [
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
]


