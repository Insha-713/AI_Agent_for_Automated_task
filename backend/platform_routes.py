"""
AgentFlow v3.0 - Unified Platform API Router
Endpoints under /api/platform/ and /api/webhooks/
"""

import os
import json
import uuid
import hmac
import hashlib
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Body, Request, Response
from fastapi.responses import JSONResponse, PlainTextResponse, FileResponse
from pydantic import BaseModel, Field

# Local imports
from backend.credentials import (
    get_credential,
    set_credential,
    delete_credential,
    get_masked_credentials_summary,
    test_service_connectivity,
    is_masked_secret
)
from backend.email_provider import (
    test_email_connection,
    send_email_via_provider,
    is_email_configured,
    fetch_inbox_emails
)
from backend.db import (
    get_unified_dashboard_kpis,
    save_social_post,
    get_social_post_by_id,
    list_social_posts,
    update_social_post_status,
    update_social_post_schedule,
    claim_scheduled_social_post,
    delete_social_post,
    get_linkedin_preferences,
    save_linkedin_preferences,
    get_recent_linkedin_history,
    save_call_task,
    get_call_task_by_id,
    get_call_task_by_sid,
    list_call_tasks,
    update_call_task_status,
    delete_call_task,
    save_email_task,
    get_email_task_by_id,
    list_email_tasks,
    update_email_task_status,
    save_research_document,
    get_research_document_by_id,
    list_research_documents,
    delete_research_document,
    get_memory_value,
    set_memory_value,
    list_memory_items,
    delete_memory_item,
    get_all_memory_context,
    save_automation_rule,
    list_automation_rules,
    get_automation_rule_by_id,
    toggle_automation_rule,
    delete_automation_rule,
    save_automation_rule_log,
    list_automation_rule_logs,
    save_approval,
    purge_demo_and_test_data
)

from backend.platform_engine import (
    LinkedInAdapter,
    LinkedInContentEngine,
    CallingAdapter,
    EmailAgentEngine,
    ResearchEngine,
    AutomationRuleRunner,
    ImageGenerationEngine,
    calculate_schedule_times,
    compute_next_occurrence,
    get_safe_timezone,
    PublishingJobTracker
)
from backend.voice_agent import (
    validate_exotel_request,
    parse_exotel_call_payload,
    validate_twilio_signature,
    DEFAULT_VOICE_GREETING,
    generate_greeting_twiml,
    generate_turn_twiml,
    generate_farewell_twiml,
    generate_reprompt_twiml,
    process_caller_speech_turn,
    is_caller_farewell,
    summarize_voice_call,
    send_voice_call_telegram_alert
)

platform_router = APIRouter(prefix="/api/platform", tags=["Platform Engine"])
webhook_router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])


# =====================================================================
# 1. Unified Dashboard
# =====================================================================

@platform_router.get("/dashboard")
async def get_platform_dashboard():
    """Returns aggregated KPIs across all AgentFlow modules and agents."""
    data = await get_unified_dashboard_kpis()
    return {"status": "success", "data": data}


# =====================================================================
# 2. Social Posts & Visuals Pipeline (LinkedIn Support)
# =====================================================================

@platform_router.get("/social/posts")
async def get_social_posts(
    platform: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50
):
    posts = await list_social_posts(platform=platform, status=status, limit=limit)
    return {"status": "success", "posts": posts, "total": len(posts)}

@platform_router.post("/social/posts")
async def create_social_post(post: Dict[str, Any] = Body(...)):
    saved = await save_social_post(post)
    return {"status": "success", "post": saved}

class SocialScheduleRequest(BaseModel):
    platform: str = "linkedin"
    content: str
    headline: Optional[str] = None
    hashtags: Optional[List[str]] = None
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    timezone: str = "Asia/Kolkata"
    frequency: str = "one_time"  # one_time, daily, weekly
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    approval_required: bool = False
    auto_publish: bool = False

@platform_router.post("/social/schedule")
async def schedule_social_post(req: SocialScheduleRequest):
    """Creates a structured, timezone-aware scheduled social media post."""
    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Post content is required")

    full_content = f"{req.headline.strip()}\n\n{content}" if (req.headline and req.headline.strip() and req.headline.strip() not in content) else content

    local_dt, utc_dt, utc_iso = calculate_schedule_times(
        date_str=req.date,
        time_str=req.time,
        tz_name=req.timezone,
        frequency=req.frequency,
        start_date_str=req.start_date,
        end_date_str=req.end_date
    )

    initial_status = "pending_approval" if req.approval_required else "scheduled"

    post_data = {
        "platform": req.platform.lower().strip(),
        "content": full_content,
        "caption": full_content,
        "hashtags": req.hashtags or [],
        "status": initial_status,
        "scheduled_for": utc_iso,
        "next_run_at": utc_iso,
        "timezone": req.timezone,
        "frequency": req.frequency,
        "start_date": req.start_date or req.date,
        "end_date": req.end_date or "",
        "approval_required": req.approval_required,
        "auto_publish": req.auto_publish,
        "approved_at": ""
    }

    saved = await save_social_post(post_data)
    return {
        "status": "success",
        "post": saved,
        "schedule_meta": {
            "local_time": local_dt.strftime("%Y-%m-%d %H:%M:%S %Z"),
            "utc_time": utc_iso,
            "timezone": req.timezone,
            "frequency": req.frequency,
            "approval_required": req.approval_required,
            "auto_publish": req.auto_publish
        }
    }

@platform_router.put("/social/posts/{post_id}")
@platform_router.patch("/social/posts/{post_id}")
async def update_social_post_endpoint(post_id: str, payload: Dict[str, Any] = Body(...)):
    post = await get_social_post_by_id(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Social post not found")

    date_val = payload.get("date")
    time_val = payload.get("time")
    tz_val = payload.get("timezone", post.get("timezone", "Asia/Kolkata"))
    freq_val = payload.get("frequency", post.get("frequency", "one_time"))
    start_date_val = payload.get("start_date", post.get("start_date"))
    end_date_val = payload.get("end_date", post.get("end_date"))

    next_run_at = None
    scheduled_for = None
    if date_val and time_val:
        _, _, utc_iso = calculate_schedule_times(
            date_str=date_val,
            time_str=time_val,
            tz_name=tz_val,
            frequency=freq_val,
            start_date_str=start_date_val,
            end_date_str=end_date_val
        )
        next_run_at = utc_iso
        scheduled_for = utc_iso

    approval_req = payload.get("approval_required")
    auto_pub = payload.get("auto_publish")
    new_status = payload.get("status")
    if new_status is None and approval_req is True and not post.get("approved_at"):
        new_status = "pending_approval"

    updated = await update_social_post_schedule(
        post_id=post_id,
        status=new_status,
        scheduled_for=scheduled_for,
        next_run_at=next_run_at,
        approval_required=approval_req,
        auto_publish=auto_pub,
        frequency=freq_val,
        timezone_name=tz_val,
        start_date=start_date_val,
        end_date=end_date_val,
        content=payload.get("content"),
        hashtags=payload.get("hashtags")
    )
    return {"status": "success", "post": updated}

@platform_router.post("/social/posts/{post_id}/approve")
async def approve_social_post_endpoint(post_id: str):
    """
    Approves a pending post.
    If its scheduled time has already arrived or passed, publishes immediately.
    Otherwise, transitions to 'scheduled' and awaits execution time.
    """
    post = await get_social_post_by_id(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Social post not found")

    now_utc = datetime.now(timezone.utc)
    sched_time_str = post.get("next_run_at") or post.get("scheduled_for")

    is_due = False
    if sched_time_str:
        try:
            sched_dt = datetime.fromisoformat(sched_time_str.replace("Z", "+00:00"))
            if sched_dt.tzinfo is None:
                sched_dt = sched_dt.replace(tzinfo=timezone.utc)
            if sched_dt <= now_utc:
                is_due = True
        except Exception:
            is_due = True
    else:
        is_due = True

    if is_due:
        # Prevent concurrent / duplicate publishing
        if post.get("status") == "publishing":
            return {
                "status": "in_progress",
                "action": "already_publishing",
                "message": "This post is currently being published to LinkedIn. Please wait.",
                "post": post
            }

        # Atomically mark as publishing
        await update_social_post_status(post_id=post_id, status="publishing")

        # Publish immediately
        content = post.get("content", "")
        if post.get("hashtags"):
            ht_str = " ".join(post["hashtags"]) if isinstance(post["hashtags"], list) else str(post["hashtags"])
            if ht_str and ht_str not in content:
                content = f"{content}\n\n{ht_str}"

        plat = (post.get("platform") or "linkedin").lower().strip()
        if plat == "linkedin":
            media_urls = post.get("media_urls") or []
            media_url = media_urls[0] if media_urls else None
            res = await asyncio.to_thread(LinkedInAdapter.publish_ugc_post, content=content, media_url=media_url)
        else:
            res = {"success": False, "status": "unsupported", "error": f"Direct publishing not supported for '{plat}'"}

        if res.get("success"):
            frequency = post.get("frequency") or "one_time"
            next_occurrence = compute_next_occurrence(
                current_utc_iso=sched_time_str or now_utc.isoformat(),
                frequency=frequency,
                tz_name=post.get("timezone", "Asia/Kolkata"),
                end_date_str=post.get("end_date")
            )
            if next_occurrence:
                next_status = "pending_approval" if post.get("approval_required") else "scheduled"
                updated = await update_social_post_schedule(
                    post_id=post_id,
                    status=next_status,
                    scheduled_for=next_occurrence,
                    next_run_at=next_occurrence,
                    approved_at="",
                    external_post_id=res.get("post_id", "")
                )
            else:
                updated = await update_social_post_status(post_id, "published", external_post_id=res.get("post_id", ""))
            return {"status": "success", "action": "published", "post": updated, "result": res}
        else:
            err_msg = res.get("error", "Publishing failed")
            updated = await update_social_post_status(post_id, "failed", error_message=err_msg)
            return {"status": "failed", "action": "publish_attempted", "post": updated, "result": res}
    else:
        # Future scheduled time: mark as scheduled and record approved_at
        updated = await update_social_post_schedule(
            post_id=post_id,
            status="scheduled",
            approved_at=now_utc.isoformat()
        )
        return {"status": "success", "action": "approved_scheduled", "post": updated}

@platform_router.post("/social/posts/{post_id}/pause")
async def pause_social_post_endpoint(post_id: str):
    updated = await update_social_post_status(post_id, "paused")
    if not updated:
        raise HTTPException(status_code=404, detail="Social post not found")
    return {"status": "success", "post": updated}

@platform_router.post("/social/posts/{post_id}/resume")
async def resume_social_post_endpoint(post_id: str):
    post = await get_social_post_by_id(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Social post not found")
    resumed_status = "pending_approval" if (post.get("approval_required") and not post.get("approved_at")) else "scheduled"
    updated = await update_social_post_status(post_id, resumed_status)
    return {"status": "success", "post": updated}

@platform_router.post("/social/posts/{post_id}/cancel")
async def cancel_social_post_endpoint(post_id: str):
    updated = await update_social_post_status(post_id, "cancelled")
    if not updated:
        raise HTTPException(status_code=404, detail="Social post not found")
    return {"status": "success", "post": updated}

@platform_router.post("/social/sync-now")
async def sync_social_scheduler_now():
    from backend.scheduler import run_social_publishing_cycle
    await run_social_publishing_cycle()
    return {"status": "success", "message": "Social media auto-publisher cycle executed"}

@platform_router.patch("/social/posts/{post_id}/status")
async def change_social_post_status(post_id: str, payload: Dict[str, Any] = Body(...)):
    st = payload.get("status", "draft")
    updated = await update_social_post_status(
        post_id=post_id,
        status=st,
        external_post_id=payload.get("external_post_id", ""),
        error_message=payload.get("error_message", "")
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Social post not found")
    return {"status": "success", "post": updated}

@platform_router.post("/social/posts/{post_id}/publish")
async def publish_social_post_endpoint(post_id: str):
    """Publishes a scheduled or approved post directly to LinkedIn."""
    post = await get_social_post_by_id(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Social post not found")

    # Prevent concurrent / duplicate publishing
    if post.get("status") == "publishing":
        return {
            "status": "in_progress",
            "message": "This post is currently being published to LinkedIn. Please wait.",
            "post": post
        }

    # Atomically mark as publishing
    await update_social_post_status(post_id=post_id, status="publishing")

    platform_name = (post.get("platform") or "linkedin").lower().strip()
    content = post.get("content", "")
    hashtags = post.get("hashtags")
    if hashtags:
        ht_str = " ".join(hashtags) if isinstance(hashtags, list) else str(hashtags)
        if ht_str and ht_str not in content:
            content = f"{content}\n\n{ht_str}"

    if platform_name == "linkedin":
        media_urls = post.get("media_urls") or []
        media_url = media_urls[0] if media_urls else None
        res = await asyncio.to_thread(LinkedInAdapter.publish_ugc_post, content=content, media_url=media_url)
    else:
        res = {"success": False, "status": "unsupported", "error": f"Direct publishing not supported for '{platform_name}'"}

    if res.get("success"):
        updated = await update_social_post_status(
            post_id=post_id,
            status="published",
            external_post_id=res.get("post_id", "")
        )
        return {"status": "success", "post": updated, "result": res}
    else:
        err_msg = res.get("error", "Publishing failed")
        updated = await update_social_post_status(
            post_id=post_id,
            status="failed",
            error_message=err_msg
        )
        return {"status": "failed", "post": updated, "result": res}

@platform_router.delete("/social/posts/{post_id}")
async def remove_social_post(post_id: str):
    await delete_social_post(post_id)
    return {"status": "success", "deleted": True}


# =====================================================================
# 3. LinkedIn Automation Agent
# =====================================================================

@platform_router.get("/linkedin/status")
async def get_linkedin_status():
    return LinkedInAdapter.get_status()

class LinkedInDraftRequest(BaseModel):
    post_type: str = "project_showcase"
    topic: str
    tone: str = "professional"
    details: Optional[Dict[str, Any]] = None

@platform_router.post("/linkedin/draft")
async def draft_linkedin_content(req: LinkedInDraftRequest):
    draft = LinkedInAdapter.draft_post(
        post_type=req.post_type,
        topic=req.topic,
        tone=req.tone,
        details=req.details
    )
    return {"status": "success", "draft": draft, "post": draft, "draft_post": draft.get("content", "")}

async def _execute_publishing_job(
    job_id: str,
    post_id: str,
    content: str,
    media_url: Optional[str],
    dry_run: bool,
    mock_mode: Optional[str] = None
):
    """Background task executing the multi-stage LinkedIn publishing workflow."""
    try:
        PublishingJobTracker.update_job(
            job_id,
            stage="preparing_post",
            progress=25,
            message="Preparing Post",
            status="publishing"
        )

        res = await asyncio.to_thread(
            LinkedInAdapter.publish_ugc_post,
            content=content,
            media_url=media_url,
            dry_run=dry_run,
            job_id=job_id,
            mock_mode=mock_mode
        )

        # Sync final result to database
        if res.get("status") == "published" or res.get("success"):
            try:
                await update_social_post_status(
                    post_id=post_id,
                    status="published",
                    external_post_id=res.get("post_id", "")
                )
            except Exception as e:
                print(f"[LinkedIn Background Worker] DB sync notice: {e}")
        elif res.get("status") == "unknown":
            try:
                await update_social_post_status(
                    post_id=post_id,
                    status="unknown",
                    error_message=res.get("error", "Publication status unknown")
                )
            except Exception as e:
                print(f"[LinkedIn Background Worker] DB sync notice: {e}")
        else:
            try:
                await update_social_post_status(
                    post_id=post_id,
                    status="failed",
                    error_message=res.get("error", "Direct publishing failed")
                )
            except Exception as e:
                print(f"[LinkedIn Background Worker] DB sync notice: {e}")

    except Exception as exc:
        err_msg = f"Unexpected background publishing error: {str(exc)}"
        print(f"[LinkedIn Background Worker] Exception: {err_msg}")
        PublishingJobTracker.update_job(
            job_id,
            stage="publishing_failed",
            progress=100,
            message="Publishing Failed",
            status="failed",
            error=err_msg
        )
        try:
            await update_social_post_status(post_id=post_id, status="failed", error_message=err_msg)
        except Exception:
            pass


@platform_router.post("/linkedin/publish")
async def publish_direct_linkedin(payload: Dict[str, Any] = Body(...)):
    """
    Directly publishes provided text content to LinkedIn with optional single image attachment.
    Supports asynchronous background execution (default) returning job_id immediately,
    as well as sync/wait mode for automated tests and legacy callers.
    """
    content = payload.get("content") or payload.get("caption", "")
    if not content or not str(content).strip():
        raise HTTPException(status_code=400, detail="Content is required for publishing to LinkedIn")

    content_clean = str(content).strip()
    if len(content_clean) > 3000:
        return {
            "success": False,
            "status": "failed",
            "error": f"Post content exceeds LinkedIn limit of 3000 characters ({len(content_clean)} characters)."
        }

    media_url = payload.get("media_url") or payload.get("image_url")
    dry_run = bool(payload.get("dry_run") or payload.get("mock"))
    mock_mode = payload.get("mock_mode") or payload.get("simulate")
    idempotency_key = payload.get("idempotency_key")
    sync_mode = bool(payload.get("wait") or payload.get("sync") or payload.get("synchronous"))

    # Check for active duplicate job by idempotency key
    if idempotency_key:
        existing_job = PublishingJobTracker.get_job_by_idempotency_key(idempotency_key)
        if existing_job:
            curr_status = existing_job.get("status")
            if curr_status in ("pending", "publishing", "processing", "accepted"):
                return {
                    "success": True,
                    "status": "already_running",
                    "job_id": existing_job["job_id"],
                    "post_id": existing_job["post_id"],
                    "stage": existing_job.get("stage", "publishing"),
                    "message": "A publishing request with this idempotency key is already in progress.",
                    "dry_run": existing_job.get("dry_run", False)
                }
            elif curr_status in ("published", "completed"):
                return {
                    "success": True,
                    "status": "already_running",
                    "job_id": existing_job["job_id"],
                    "post_id": existing_job["post_id"],
                    "stage": existing_job.get("stage", "published_successfully"),
                    "message": "A post with this idempotency key has already been published.",
                    "result": existing_job.get("result"),
                    "dry_run": existing_job.get("dry_run", False)
                }

    # Generate unique IDs for tracking
    job_id = f"pub_job_{uuid.uuid4().hex[:10]}"
    post_id = f"post_{uuid.uuid4().hex[:10]}"

    # Initialize job in tracker
    PublishingJobTracker.create_job(
        post_id=post_id,
        dry_run=dry_run,
        job_id=job_id,
        idempotency_key=idempotency_key,
        content_preview=content_clean,
        stage="accepted",
        message="Publishing Request Accepted",
        progress=10,
        status="pending"
    )

    # Save post record in database immediately as 'publishing'
    try:
        await save_social_post({
            "id": post_id,
            "platform": "linkedin",
            "post_type": payload.get("post_type", "post"),
            "content": content_clean,
            "caption": payload.get("caption", ""),
            "hashtags": payload.get("hashtags", []),
            "media_urls": [media_url] if media_url else [],
            "status": "publishing"
        })
    except Exception as dberr:
        print(f"[LinkedIn Publish] Notice on pre-save post: {dberr}")

    if sync_mode:
        # Synchronous execution mode (for tests or callers requiring immediate completion)
        await _execute_publishing_job(job_id, post_id, content_clean, media_url, dry_run, mock_mode)
        job = PublishingJobTracker.get_job(job_id) or {}
        res = job.get("result") or {}
        if not res:
            res = {
                "success": job.get("status") == "published",
                "status": job.get("status", "failed"),
                "error": job.get("error"),
                "post_id": job.get("result", {}).get("post_id", ""),
                "post_url": job.get("result", {}).get("post_url", "")
            }
        res["job_id"] = job_id
        res["post_db_id"] = post_id
        return res

    # Asynchronous background execution (default for frontend & robust workflow)
    asyncio.create_task(
        _execute_publishing_job(job_id, post_id, content_clean, media_url, dry_run, mock_mode)
    )

    return {
        "success": True,
        "status": "accepted",
        "stage": "accepted",
        "progress": 10,
        "job_id": job_id,
        "post_id": post_id,
        "post_db_id": post_id,
        "message": "Publishing Request Accepted",
        "dry_run": dry_run
    }

@platform_router.get("/linkedin/active-job")
async def get_active_linkedin_job():
    """Returns the currently active publishing job if one is in progress."""
    active = PublishingJobTracker.get_active_job()
    return {"has_active_job": bool(active), "job": active}

@platform_router.get("/linkedin/jobs/{job_id}")
async def get_linkedin_job_status(job_id: str):
    """Fetches real-time multi-stage status for an ongoing or completed publishing job."""
    job = PublishingJobTracker.get_job(job_id)
    if job:
        return job

    # Fallback: check SQLite database if job was saved to DB but removed from memory
    try:
        posts = await list_social_posts(platform="linkedin", limit=15)
        for p in posts:
            if p.get("id") == job_id or (job_id in p.get("id", "")):
                st = p.get("status", "unknown")
                stage = "published_successfully" if st == "published" else ("publishing_failed" if st == "failed" else "accepted")
                msg = "Published Successfully" if st == "published" else ("Publishing Failed" if st == "failed" else "Processing")
                return {
                    "job_id": job_id,
                    "post_id": p.get("id"),
                    "status": st,
                    "stage": stage,
                    "progress": 100 if st in ("published", "failed") else 50,
                    "message": msg,
                    "post_url": f"https://www.linkedin.com/feed/update/{p.get('external_post_id')}" if p.get("external_post_id") else "",
                    "external_post_id": p.get("external_post_id", ""),
                    "error": p.get("error_message")
                }
    except Exception:
        pass

    raise HTTPException(status_code=404, detail=f"Publishing job '{job_id}' not found")

@platform_router.post("/linkedin/detect-member")
async def detect_linkedin_member(payload: Dict[str, Any] = Body(default={})):
    """Automatically detects the authenticated LinkedIn member identifier using the active token."""
    token = payload.get("token")
    res = LinkedInAdapter.detect_authenticated_member(token=token)
    return res

@platform_router.post("/linkedin/validate-urn")
async def validate_linkedin_urn(payload: Dict[str, Any] = Body(...)):
    """Validates and canonicalizes a candidate LinkedIn Author URN or Member ID."""
    author_urn = payload.get("author_urn", "")
    is_valid, canonical_urn, err_msg = LinkedInAdapter.validate_author_urn(author_urn)
    return {
        "valid": is_valid,
        "author_urn": canonical_urn,
        "error": err_msg
    }

@platform_router.post("/linkedin/validate-author-urn")
async def validate_linkedin_author_urn_endpoint(payload: Dict[str, Any] = Body(...)):
    """Validates, decodes HTML, strips Markdown, and canonicalizes a LinkedIn Author URN."""
    author_urn = payload.get("author_urn", "")
    is_valid, canonical_urn, err_msg = LinkedInAdapter.validate_author_urn(author_urn)
    return {
        "valid": is_valid,
        "author_urn": canonical_urn,
        "cleaned_value": canonical_urn,
        "error": err_msg
    }

@platform_router.post("/linkedin/set-author-urn")
async def set_linkedin_author_urn(payload: Dict[str, Any] = Body(...)):
    """Validates, cleans, and persists a LinkedIn Author URN."""
    from backend.credentials import set_credential
    author_urn = payload.get("author_urn", "")
    is_valid, canonical_urn, err_msg = LinkedInAdapter.validate_author_urn(author_urn)
    if not is_valid:
        raise HTTPException(status_code=400, detail=err_msg)
    set_credential("LINKEDIN_AUTHOR_URN", canonical_urn)
    return {
        "success": True,
        "author_urn": canonical_urn,
        "cleaned_value": canonical_urn,
        "message": f"LinkedIn Author URN successfully updated to '{canonical_urn}'."
    }

@platform_router.post("/linkedin/reply")
async def draft_linkedin_reply(payload: Dict[str, Any] = Body(...)):
    snippet = payload.get("post_snippet", "")
    commenter = payload.get("commenter_name", "Connection")
    reply = LinkedInAdapter.draft_comment_reply(snippet, commenter)
    return {"status": "success", "reply": reply}


# ---------------------------------------------------------------------
# LinkedIn Content Direction, Deep Research & Quality Endpoints
# ---------------------------------------------------------------------

@platform_router.get("/linkedin/preferences")
async def get_linkedin_preferences_endpoint():
    """Retrieve user-defined LinkedIn content direction, preferences, and scheduler settings."""
    prefs = await get_linkedin_preferences()
    return {"status": "success", "preferences": prefs}


@platform_router.post("/linkedin/preferences")
async def save_linkedin_preferences_endpoint(payload: Dict[str, Any] = Body(...)):
    """Save user-defined LinkedIn content direction, preferences, and scheduler settings."""
    updated = await save_linkedin_preferences(payload)
    return {"status": "success", "preferences": updated, "message": "Content direction and preferences saved"}


class ResearchAndGenerateRequest(BaseModel):
    topic: Optional[str] = None
    angle: Optional[str] = None
    post_type: Optional[str] = None
    generate_image: bool = True
    auto_save_draft: bool = True


@platform_router.post("/linkedin/research-and-generate")
async def research_and_generate_endpoint(req: ResearchAndGenerateRequest):
    """Deep multi-source research, anti-repetition synthesis, quality scoring, and image generation."""
    result = await LinkedInContentEngine.research_and_generate_complete_post(
        topic=req.topic,
        angle=req.angle,
        post_type=req.post_type,
        generate_image=req.generate_image,
        auto_save_draft=req.auto_save_draft
    )
    return {"status": "success", "result": result}


class QualityEvaluationRequest(BaseModel):
    content: str
    sources: Optional[List[Dict[str, Any]]] = None
    topic: Optional[str] = ""


@platform_router.post("/linkedin/evaluate-quality")
async def evaluate_quality_endpoint(req: QualityEvaluationRequest):
    """Pre-publish quality verification scoring (0-100), hook check, substance, and suggestions."""
    report = LinkedInContentEngine.evaluate_post_quality(
        content=req.content,
        sources=req.sources,
        topic=req.topic
    )
    return {"status": "success", "quality_report": report}


@platform_router.get("/linkedin/history")
async def get_linkedin_history_endpoint(limit: int = 30):
    """Retrieve recent LinkedIn post history with research summaries, quality scores, and image metadata."""
    history = await get_recent_linkedin_history(limit=limit)
    return {"status": "success", "posts": history}


@platform_router.get("/linkedin/image-providers")
async def get_image_providers_endpoint():
    """Returns available AI image generation providers, active connection status, and free tier notes."""
    status = ImageGenerationEngine.get_providers_status()
    return {"status": "success", "providers": status}


@platform_router.post("/linkedin/test-image-provider")
async def test_image_provider_endpoint(payload: Dict[str, Any] = Body(...)):
    """Tests connection to a specific image generation provider (cloudflare_ai, stability, ideogram, pollinations)."""
    provider = payload.get("provider", "pollinations")
    test_result = test_service_connectivity("image_gen", {"provider": provider, **payload})
    return test_result


# =====================================================================
# 4. AI Calling Agent
# =====================================================================

@platform_router.get("/calls/status")
async def get_calling_status():
    return CallingAdapter.get_status()

@platform_router.get("/calls/diagnostics")
async def get_calling_diagnostics():
    return CallingAdapter.get_status()

@platform_router.get("/calls/twiml/preview")
async def get_twiml_preview():
    twiml = CallingAdapter.generate_twiml_script(
        script_text="I am your AgentFlow AI Voice Assistant. If you are calling regarding job opportunities or collaborations, please leave a message.",
        is_incoming=True
    )
    return {
        "status": "success",
        "voice": "Polly.Aditi",
        "language": "en-IN",
        "twiml": twiml
    }

@platform_router.get("/calls")
async def get_call_tasks(status: Optional[str] = None, limit: int = 50):
    calls = await list_call_tasks(status=status, limit=limit)
    return {"status": "success", "calls": calls}

@platform_router.post("/calls")
@platform_router.post("/calls/schedule")
async def schedule_ai_call(call: Dict[str, Any] = Body(...)):
    """Schedules an AI phone call task. Requires human approval before placing external calls."""
    phone = (call.get("recipient_phone") or call.get("phone") or "").strip()
    if not phone:
        raise HTTPException(status_code=400, detail="Recipient phone number is required")

    purpose = call.get("purpose") or call.get("goal") or "General outreach briefing"
    prompt_script = call.get("prompt_script") or call.get("notes") or purpose

    appr_id = f"appr_call_{uuid.uuid4().hex[:8]}"
    await save_approval({
        "id": appr_id,
        "workflow_id": "calling_agent",
        "run_id": f"call_{uuid.uuid4().hex[:8]}",
        "step_id": "step_place_call",
        "tool_name": "place_ai_call",
        "parameters": {
            "recipient_phone": phone,
            "purpose": purpose,
            "prompt_script": prompt_script
        },
        "status": "pending",
        "decision": "pending",
        "details": f"AI Calling Agent requires approval before calling {phone} regarding: '{purpose}'."
    })

    call["recipient_phone"] = phone
    call["purpose"] = purpose
    call["prompt_script"] = prompt_script
    call["approval_id"] = appr_id
    call["status"] = "pending_approval"
    call["direction"] = "outbound"
    saved = await save_call_task(call)
    return {
        "status": "success",
        "call": saved,
        "approval_required": True,
        "approval_id": appr_id
    }

@platform_router.patch("/calls/{call_id}")
async def update_call_status(call_id: str, payload: Dict[str, Any] = Body(...)):
    """Updates call task status (e.g. approved, completed, cancelled)."""
    status = payload.get("status", "completed")
    updated = await update_call_task_status(call_id, status=status)
    if not updated:
        raise HTTPException(status_code=404, detail="Call task not found")
    return {"status": "success", "call": updated}

@platform_router.post("/calls/{call_id}/initiate")
async def initiate_call_now(call_id: str):
    """Executes or simulates the AI voice call."""
    call = await get_call_task_by_id(call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call task not found")

    # Update to in_progress / completed with simulated transcript
    now_iso = datetime.now().isoformat()
    transcript = (
        f"Assistant: Hello, I am calling from AgentFlow regarding {call['purpose']}.\n"
        f"Recipient: Thank you for calling. I received the update.\n"
        f"Assistant: Wonderful. The details are recorded in our system. Have a great day!"
    )
    summary = f"Successfully contacted recipient regarding {call['purpose']}. Meeting details confirmed."
    updated = await update_call_task_status(
        call_id=call_id,
        status="completed",
        outcome="confirmed",
        summary=summary,
        transcript=transcript,
        duration_seconds=42
    )
    return {"status": "success", "call": updated}

@platform_router.delete("/calls/{call_id}")
async def cancel_call_task(call_id: str):
    await delete_call_task(call_id)
    return {"status": "success", "cancelled": True}

async def _extract_voice_params(request: Request) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Parses incoming Twilio requests (form-encoded POST, JSON, or query parameters).
    Returns (post_body_params, combined_params).
    Twilio HMAC signature uses post_body_params; business logic uses combined_params.
    """
    content_type = request.headers.get("content-type", "").lower()
    post_params: Dict[str, Any] = {}
    if "application/json" in content_type:
        try:
            parsed = await request.json()
            if isinstance(parsed, dict):
                post_params = parsed
        except Exception:
            post_params = {}
    elif "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type or request.method == "POST":
        try:
            form = await request.form()
            post_params = {k: str(v) for k, v in form.items()}
        except Exception:
            post_params = {}

    combined = dict(post_params)
    for k, v in request.query_params.items():
        if k not in combined:
            combined[k] = v

    return post_params, combined


def _get_public_webhook_url(request: Request) -> str:
    """Reconstructs the external public URL requested by Twilio across reverse proxies."""
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
    path = request.url.path
    query = request.url.query
    url = f"{proto}://{host}{path}"
    if query:
        url += f"?{query}"
    return url


def _enforce_voice_security(request: Request, post_params: Dict[str, Any]) -> None:
    """
    Validates Exotel webhook requests and legacy signatures.
    Ensures webhook requests are genuine without breaking trial testing.
    """
    sig = request.headers.get("X-Twilio-Signature")
    if sig:
        full_url = _get_public_webhook_url(request)
        if not validate_twilio_signature(full_url, post_params, sig):
            raise HTTPException(status_code=403, detail="Invalid webhook signature.")
    else:
        # Validate Exotel webhook payload / headers
        if not validate_exotel_request(dict(request.headers), post_params):
            raise HTTPException(status_code=403, detail="Invalid Exotel webhook request.")


# =====================================================================
# INCOMING AI VOICE CALL WEBHOOKS (EXOTEL & TELEPHONY)
# =====================================================================

@webhook_router.post("/voice/exotel/incoming")
@webhook_router.get("/voice/exotel/incoming")
@webhook_router.post("/voice/incoming")
@webhook_router.get("/voice/incoming")
async def handle_incoming_voice_call(request: Request):
    """
    Dedicated Exotel Webhook for incoming voice calls.
    Handles Exotel Passthru requests when a call reaches the virtual number (ExoPhone).
    Initializes inbound call task with Hindi/Hinglish greeting and sets up speech turn processing.
    """
    post_params, params = await _extract_voice_params(request)
    _enforce_voice_security(request, post_params)

    payload = parse_exotel_call_payload(params)
    caller_phone = payload.get("caller_phone", "Unknown Caller").strip()
    called_phone = payload.get("called_phone", "").strip()
    call_sid = payload.get("call_sid") or f"exo_sid_{uuid.uuid4().hex[:12]}"

    # Check for existing record for this CallSid or create new
    existing = await get_call_task_by_sid(call_sid)
    if existing:
        call_id = existing["id"]
    else:
        call_id = f"call_inbound_{uuid.uuid4().hex[:8]}"
        greeting_text = get_credential("VOICE_GREETING_MESSAGE", DEFAULT_VOICE_GREETING)
        initial_transcript = [
            {
                "role": "assistant",
                "text": greeting_text,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
        ]
        await save_call_task({
            "id": call_id,
            "recipient_phone": caller_phone,
            "recipient_name": "Incoming Caller",
            "direction": "inbound",
            "provider": "exotel",
            "purpose": "Inbound AI Voice Receptionist",
            "prompt_script": greeting_text,
            "scheduled_time": datetime.now().isoformat(),
            "status": "in_progress",
            "call_sid": call_sid,
            "duration_seconds": 0,
            "transcript": json.dumps(initial_transcript),
            "summary": "Inbound call in progress...",
            "outcome": "in_progress",
            "telegram_alert_sent": 0
        })

    turn_action_url = f"/api/webhooks/voice/process-turn?call_id={call_id}"
    twiml = generate_greeting_twiml(turn_action_url=turn_action_url)
    return Response(content=twiml, media_type="application/xml")


@webhook_router.post("/voice/exotel/passthru")
@webhook_router.get("/voice/exotel/passthru")
async def handle_exotel_passthru(request: Request):
    """
    Exotel Passthru Applet Callback.
    Exotel invokes this URL during call flow execution to decide routing.
    Returns HTTP 200 OK to continue call flow to greeting / voicemail recording.
    """
    _, params = await _extract_voice_params(request)
    payload = parse_exotel_call_payload(params)
    call_sid = payload.get("call_sid", "")
    return Response(
        content=json.dumps({"select": "1", "status": "connected", "call_sid": call_sid}),
        media_type="application/json"
    )


@webhook_router.post("/voice/process-turn")
@webhook_router.get("/voice/process-turn")
async def handle_voice_process_turn(request: Request):
    """
    Multi-turn conversational voice turn handler.
    Receives caller speech input, queries AI engine with conversational Hindi/Hinglish prompt,
    and returns next dialogue response.
    """
    post_params, params = await _extract_voice_params(request)
    _enforce_voice_security(request, post_params)
    call_id = request.query_params.get("call_id") or params.get("call_id")
    call_sid = params.get("CallSid") or params.get("call_sid")

    call_record = None
    if call_id:
        call_record = await get_call_task_by_id(call_id)
    if not call_record and call_sid:
        call_record = await get_call_task_by_sid(call_sid)

    caller_phone = params.get("CallFrom") or params.get("From") or (call_record.get("recipient_phone") if call_record else "")
    speech_result = (params.get("SpeechResult") or params.get("speech_input") or "").strip()

    # Load existing transcript history
    transcript_turns = []
    if call_record and call_record.get("transcript"):
        try:
            transcript_turns = json.loads(call_record["transcript"])
            if not isinstance(transcript_turns, list):
                transcript_turns = []
        except Exception:
            transcript_turns = []

    turn_action_url = f"/api/webhooks/voice/process-turn?call_id={call_id or (call_record['id'] if call_record else '')}"

    # Handle silence or unclear speech
    if not speech_result:
        reprompt_twiml = generate_reprompt_twiml(turn_action_url=turn_action_url)
        return Response(content=reprompt_twiml, media_type="application/xml")

    # Record caller speech
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    transcript_turns.append({
        "role": "caller",
        "text": speech_result,
        "timestamp": now_str
    })

    # Check for farewell
    if is_caller_farewell(speech_result):
        farewell_reply = "Shukriya! Maine aapka message note kar liya hai. Insha aapse jald hi connect karengi. Have a great day! Alvida."
        transcript_turns.append({
            "role": "assistant",
            "text": farewell_reply,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })

        # Finalize call
        plain_transcript = "\n".join([f"{t['role'].capitalize()}: {t['text']}" for t in transcript_turns])
        summary_data = summarize_voice_call(plain_transcript, caller_phone=caller_phone)

        if call_record:
            updated = await update_call_task_status(
                call_id=call_record["id"],
                status="completed",
                outcome=summary_data.get("intent", "completed"),
                summary=summary_data.get("summary", ""),
                caller_name=summary_data.get("caller_name", "Not provided"),
                reason_for_calling=summary_data.get("reason_for_calling", "General Inquiry"),
                full_message=summary_data.get("full_message", plain_transcript),
                transcript=json.dumps(transcript_turns)
            )
            # Dispatch Telegram Notification (duplicate-guarded)
            if not call_record.get("telegram_alert_sent"):
                tg_res = send_voice_call_telegram_alert(updated or call_record)
                if tg_res.get("success"):
                    await update_call_task_status(call_id=call_record["id"], telegram_alert_sent=1)

        twiml = generate_farewell_twiml(closing_text=farewell_reply)
        return Response(content=twiml, media_type="application/xml")

    # Generate conversational AI response
    ai_reply = process_caller_speech_turn(
        caller_speech=speech_result,
        transcript_history=transcript_turns,
        caller_phone=caller_phone
    )

    transcript_turns.append({
        "role": "assistant",
        "text": ai_reply,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    })

    # Update in DB
    if call_record:
        await update_call_task_status(
            call_id=call_record["id"],
            status="in_progress",
            transcript=json.dumps(transcript_turns)
        )

    twiml = generate_turn_twiml(ai_reply=ai_reply, turn_action_url=turn_action_url)
    return Response(content=twiml, media_type="application/xml")


@webhook_router.post("/voice/exotel/status")
@webhook_router.get("/voice/exotel/status")
@webhook_router.post("/voice/status")
@webhook_router.get("/voice/status")
async def handle_voice_call_status(request: Request):
    """
    Exotel Call Status Callback webhook.
    Fires at the end of every incoming call.
    Updates call duration, status, recording URL, extracts AI summary, and dispatches rich Telegram alert.
    """
    post_params, params = await _extract_voice_params(request)
    _enforce_voice_security(request, post_params)

    payload = parse_exotel_call_payload(params)
    call_sid = payload.get("call_sid")
    call_status = payload.get("status", "completed").lower()
    duration_sec = payload.get("duration_seconds", 0)
    recording_url = payload.get("recording_url", "")
    caller_phone = payload.get("caller_phone", "")

    call_record = None
    if call_sid:
        call_record = await get_call_task_by_sid(call_sid)

    final_status = "completed"
    if call_status in ("busy", "no-answer", "canceled", "failed-busy"):
        final_status = "missed"
    elif call_status in ("failed", "error"):
        final_status = "failed"
    elif call_status in ("completed", "answered", "normal-clearing"):
        final_status = "completed"

    if call_record:
        # Load transcript for summary
        try:
            turns = json.loads(call_record.get("transcript") or "[]")
            plain_transcript = "\n".join([f"{t.get('role', 'speaker').capitalize()}: {t.get('text', '')}" for t in turns])
        except Exception:
            plain_transcript = call_record.get("transcript", "")

        summary_info = summarize_voice_call(plain_transcript, caller_phone=caller_phone or call_record.get("recipient_phone", ""))
        
        merged_rec = {
            **call_record,
            "status": final_status,
            "duration_seconds": duration_sec,
            "recording_url": recording_url or call_record.get("recording_url", ""),
            "caller_name": summary_info.get("caller_name", "Not provided"),
            "reason_for_calling": summary_info.get("reason_for_calling", "General Inquiry"),
            "full_message": summary_info.get("full_message", plain_transcript),
            "summary": summary_info.get("summary", ""),
            "outcome": summary_info.get("intent", final_status)
        }

        updated = await update_call_task_status(
            call_id=call_record["id"],
            status=final_status,
            outcome=summary_info.get("intent", final_status),
            summary=summary_info.get("summary", ""),
            duration_seconds=duration_sec,
            recording_url=recording_url or call_record.get("recording_url", ""),
            caller_name=summary_info.get("caller_name", "Not provided"),
            reason_for_calling=summary_info.get("reason_for_calling", "General Inquiry"),
            full_message=summary_info.get("full_message", plain_transcript)
        )

        # Dispatch Telegram alert (duplicate-guarded)
        if not call_record.get("telegram_alert_sent"):
            tg_res = send_voice_call_telegram_alert(merged_rec)
            if tg_res.get("success"):
                await update_call_task_status(call_id=call_record["id"], telegram_alert_sent=1)

    return {"status": "recorded", "call_sid": call_sid, "final_status": final_status, "recording_url": recording_url}


# =====================================================================
# INCOMING CALLS DASHBOARD & CONFIGURATION APIS
# =====================================================================

@platform_router.get("/calls/incoming")
async def get_incoming_calls(status: Optional[str] = None, limit: int = 50):
    """Returns list of all incoming voice calls, duration, transcripts, and summaries."""
    calls = await list_call_tasks(status=status, direction="inbound", limit=limit)
    return {"status": "success", "calls": calls}


@platform_router.get("/calls/incoming-config")
async def get_incoming_calls_config(request: Request):
    """Returns webhook endpoints, Exotel configuration, Airtel forwarding codes, and trial notes."""
    base_url = str(request.base_url).rstrip("/")
    exo_key = bool(get_credential("EXOTEL_API_KEY"))
    exo_token = bool(get_credential("EXOTEL_API_TOKEN"))
    exo_sid = get_credential("EXOTEL_ACCOUNT_SID") or ""
    exo_phone = get_credential("EXOTEL_EXOPHONE") or ""
    exo_subdomain = get_credential("EXOTEL_SUBDOMAIN") or "api.exotel.com"
    exo_app_id = get_credential("EXOTEL_APP_ID") or ""
    tg_token = bool(get_credential("TELEGRAM_BOT_TOKEN"))
    tg_chat = bool(get_credential("TELEGRAM_CHAT_ID"))

    masked_phone = f"{exo_phone[:4]}***{exo_phone[-3:]}" if len(exo_phone) >= 7 else exo_phone
    api_key_val = get_credential("EXOTEL_API_KEY") or ""
    masked_key = f"{api_key_val[:4]}***{api_key_val[-3:]}" if len(api_key_val) >= 7 else (api_key_val if api_key_val else None)

    is_configured = bool(exo_key and exo_token and exo_sid and exo_phone)

    return {
        "status": "ready" if is_configured else "pending_credentials",
        "provider": "exotel",
        "phone_number": exo_phone,
        "masked_phone": masked_phone,
        "account_sid": exo_sid,
        "api_key": masked_key,
        "has_api_token": exo_token,
        "subdomain": exo_subdomain,
        "app_id": exo_app_id,
        "greeting_message": get_credential("VOICE_GREETING_MESSAGE", DEFAULT_VOICE_GREETING),
        "instructions": get_credential("VOICE_INSTRUCTIONS", ""),
        "language": get_credential("VOICE_LANGUAGE", "hi-IN"),
        "telegram_alerts": get_credential("VOICE_TELEGRAM_ALERTS", "true") == "true",
        "webhook_url": f"{base_url}/api/webhooks/voice/exotel/incoming",
        "process_turn_url": f"{base_url}/api/webhooks/voice/process-turn",
        "status_callback_url": f"{base_url}/api/webhooks/voice/exotel/status",
        "passthru_url": f"{base_url}/api/webhooks/voice/exotel/passthru",
        "legacy_webhook_url": f"{base_url}/api/webhooks/voice/incoming",
        "credentials": {
            "exotel_configured": is_configured,
            "exotel_phone_number": masked_phone if masked_phone else None,
            "telegram_notifications_configured": bool(tg_token and tg_chat)
        },
        "exotel_flow_guide": [
            "1. Log in to your Exotel Dashboard at https://my.exotel.com.",
            "2. Navigate to App Bazaar -> Create Flow.",
            "3. Add a Passthru Applet to receive inbound call notifications.",
            f"4. Configure Passthru HTTP POST URL: {base_url}/api/webhooks/voice/exotel/incoming",
            "5. Under Passthru Success branch, attach a Play / Record Applet to greet caller and capture message.",
            f"6. In the Applet / Flow settings, set Status Callback URL: {base_url}/api/webhooks/voice/exotel/status",
            "7. Save the Flow and assign your trial ExoPhone number to it under Phone Numbers -> Connect Flow."
        ],
        "airtel_forwarding_guide": [
            "Airtel Call Forwarding Setup (Dial these USSD codes on your Airtel phone):",
            f"• When Unanswered (25s): *61*{exo_phone or '<Your-ExoPhone>'}*11*25#",
            f"• When Busy: *67*{exo_phone or '<Your-ExoPhone>'}#",
            f"• When Unreachable / Switched Off: *62*{exo_phone or '<Your-ExoPhone>'}#",
            f"• All Conditional Forwarding at Once: *004*{exo_phone or '<Your-ExoPhone>'}#",
            "• Cancel All Forwarding Anytime: ##004#"
        ],
        "trial_limitations_guide": [
            "Exotel Free Trial Specifics:",
            "• Free trial provides a shared virtual number (ExoPhone) and account demo credits.",
            "• Calls from your registered mobile number route directly to your flow without restrictions.",
            "• Calls from unknown/unregistered numbers will hear Exotel ask for your 4-digit Account PIN before connecting.",
            "• Account validity is 15 days from trial activation."
        ]
    }


@platform_router.post("/calls/incoming/simulate")
async def simulate_incoming_call_turn(payload: Dict[str, Any] = Body(...)):
    """
    Simulates an incoming call turn-by-turn for testing without a real phone call.
    Accepts speech_input, generates LLM reply in Hindi/Hinglish, updates transcript, and returns summary.
    """
    caller_phone = payload.get("caller_phone", "+919876543210")
    speech_input = payload.get("speech_input", "Hello, main Insha se project ke baare mein baat karna chahta hoon.")
    call_sid = payload.get("call_sid") or f"sim_exo_{uuid.uuid4().hex[:10]}"
    history = payload.get("history", [])

    is_farewell = is_caller_farewell(speech_input)
    if is_farewell:
        ai_reply = "Shukriya! Maine aapka message note kar liya hai. Insha aapse jald hi connect karengi. Have a great day! Alvida."
        twiml = generate_farewell_twiml(ai_reply)
    else:
        ai_reply = process_caller_speech_turn(
            caller_speech=speech_input,
            transcript_history=history,
            caller_phone=caller_phone
        )
        twiml = generate_turn_twiml(ai_reply=ai_reply, turn_action_url="/api/webhooks/voice/process-turn")

    updated_history = list(history)
    updated_history.append({"role": "caller", "text": speech_input, "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")})
    updated_history.append({"role": "assistant", "text": ai_reply, "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")})

    plain_transcript = "\n".join([f"{t['role'].capitalize()}: {t['text']}" for t in updated_history])
    summary = summarize_voice_call(plain_transcript, caller_phone=caller_phone)

    return {
        "status": "success",
        "call_sid": call_sid,
        "caller_phone": caller_phone,
        "speech_input": speech_input,
        "ai_reply": ai_reply,
        "is_farewell": is_farewell,
        "twiml": twiml,
        "history": updated_history,
        "summary": summary
    }


# =====================================================================
# 7. Email Automation Agent
# =====================================================================

@platform_router.get("/email/inbox")
async def get_email_inbox_endpoint(limit: int = Query(15, ge=1, le=50)):
    """Fetches genuine incoming emails via IMAP/Gmail, or returns clean empty state if not configured."""
    result = fetch_inbox_emails(limit=limit)
    return result

@platform_router.post("/email/draft-reply")
async def draft_email_reply_endpoint(payload: Dict[str, Any] = Body(...)):
    subject = payload.get("subject", "Collaboration")
    sender = payload.get("sender", "hiring@team.com")
    snippet = payload.get("snippet", "")
    reply = EmailAgentEngine.draft_reply(subject, sender, snippet)
    return {"status": "success", "reply": reply}

@platform_router.post("/email/reply")
async def draft_email_reply_for_page(payload: Dict[str, Any] = Body(...)):
    """API endpoint used by EmailAgentPage to draft intelligent responses."""
    subject = payload.get("subject", "Inquiry")
    sender = payload.get("email_from") or payload.get("sender", "hiring@team.com")
    body = payload.get("body") or payload.get("snippet", "")
    reply_text = EmailAgentEngine.draft_reply(subject, sender, body)
    return {
        "status": "success",
        "draft_reply": {
            "subject": f"Re: {subject}",
            "reply_body": reply_text
        }
    }

@platform_router.post("/email/categorize")
async def categorize_emails_endpoint(payload: Dict[str, Any] = Body(...)):
    emails = payload.get("emails", [])
    res = EmailAgentEngine.categorize_and_summarize(emails)
    return {"status": "success", "categorized": res["categorized"], "total": res["total_count"]}

@platform_router.post("/email/briefing")
async def briefing_emails_endpoint(payload: Dict[str, Any] = Body(...)):
    emails = payload.get("emails", [])
    res = EmailAgentEngine.categorize_and_summarize(emails)
    return {
        "status": "success",
        "briefing": {
            "summary": res["summary_md"],
            "action_items": [em.get("subject") for em in res["categorized"].get("urgent", [])]
        }
    }

@platform_router.get("/email/tasks")
async def get_email_tasks(status: Optional[str] = None):
    tasks = await list_email_tasks(status=status)
    return {"status": "success", "tasks": tasks}

@platform_router.post("/email/tasks/{task_id}/send")
async def execute_send_email_task(task_id: str):
    """Executes sending of an approved email task using configured SMTP or API provider."""
    task = await get_email_task_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Email task not found")

    to_email = task.get("to_email") or task.get("recipient_email", "")
    subject = task.get("subject", "")
    body = task.get("body", "")

    if not to_email:
        raise HTTPException(status_code=400, detail="Recipient email address is missing.")

    res_str = send_email_via_provider(to_email=to_email, subject=subject, body=body)
    ok = res_str.startswith("Email successfully sent")
    if ok:
        updated = await update_email_task_status(task_id, "sent", message_id=res_str)
        return {"status": "success", "task": updated, "message_id": res_str}
    else:
        updated = await update_email_task_status(task_id, "failed", error_message=res_str)
        return {"status": "failed", "error": res_str, "task": updated}

@platform_router.post("/email/queue-send")
async def queue_email_send(task: Dict[str, Any] = Body(...)):
    """Queues an email with approval requirement for new recipients."""
    to_email = task.get("to_email", "").strip()
    if not to_email:
        raise HTTPException(status_code=400, detail="Recipient email is required")

    appr_id = f"appr_em_{uuid.uuid4().hex[:8]}"
    await save_approval({
        "id": appr_id,
        "workflow_id": "email_agent",
        "run_id": f"em_run_{uuid.uuid4().hex[:8]}",
        "step_id": "step_send_email",
        "tool_name": "send_email",
        "parameters": {
            "to_email": to_email,
            "subject": task.get("subject", ""),
            "body": task.get("body", "")
        },
        "status": "pending",
        "decision": "pending",
        "details": f"Email Agent requires approval before sending email to '{to_email}' with subject '{task.get('subject', '')}'."
    })

    task["approval_id"] = appr_id
    task["status"] = "pending_approval"
    saved = await save_email_task(task)
    return {"status": "success", "task": saved, "approval_id": appr_id}


# =====================================================================
# 8. AI Research & Content Agent
# =====================================================================

class ResearchRequest(BaseModel):
    topic: str
    target_platform: str = "article"  # article, linkedin, instagram, newsletter, report
    tone: str = "informative"
    language: str = "en"  # en, hi, ur
    sources_count: int = 5
    include_fact_attribution: bool = True

@platform_router.post("/research/generate")
@platform_router.post("/research/synthesize")
async def generate_research_dossier(req: ResearchRequest):
    """Researches a topic across live sources and produces a structured multilingual dossier."""
    dossier = ResearchEngine.generate_research_dossier(
        topic=req.topic,
        target_platform=req.target_platform,
        tone=req.tone,
        language=req.language,
        sources_count=req.sources_count,
        include_fact_attribution=req.include_fact_attribution
    )
    saved = await save_research_document(dossier)
    return {"status": "success", "document": saved, "dossier": saved}

@platform_router.get("/research/documents")
async def get_research_docs(limit: int = 50):
    docs = await list_research_documents(limit=limit)
    return {"status": "success", "documents": docs}

@platform_router.delete("/research/documents/{doc_id}")
async def remove_research_doc(doc_id: str):
    await delete_research_document(doc_id)
    return {"status": "success", "deleted": True}


# =====================================================================
# 9. Central AI Memory
# =====================================================================

@platform_router.get("/memory")
async def get_memory_items(category: Optional[str] = None):
    items = await list_memory_items(category=category)
    context = await get_all_memory_context()
    return {"status": "success", "items": items, "memory": items, "context": context}

@platform_router.get("/memory/context")
async def get_memory_context_endpoint():
    context = await get_all_memory_context()
    return {"status": "success", "context": context}

@platform_router.post("/memory")
async def save_memory_item(payload: Dict[str, Any] = Body(...)):
    cat = payload.get("category", "general")
    key = payload.get("key", "").strip()
    val = payload.get("value")
    desc = payload.get("description", "")
    if not key:
        raise HTTPException(status_code=400, detail="Key is required")
    saved = await set_memory_value(cat, key, val, desc)
    return {"status": "success", "item": saved}

@platform_router.delete("/memory/{item_id}")
async def remove_memory_item(item_id: str):
    await delete_memory_item(item_id)
    return {"status": "success", "deleted": True}


# =====================================================================
# 10. Central Automation Rules Engine (WHEN / THEN)
# =====================================================================

@platform_router.get("/rules")
async def get_automation_rules():
    rules = await list_automation_rules()
    return {"status": "success", "rules": rules}

@platform_router.post("/rules")
async def create_automation_rule(rule: Dict[str, Any] = Body(...)):
    saved = await save_automation_rule(rule)
    return {"status": "success", "rule": saved}

@platform_router.patch("/rules/{rule_id}/toggle")
async def toggle_rule(rule_id: str, request: Request):
    payload = {}
    try:
        body_bytes = await request.body()
        if body_bytes:
            payload = json.loads(body_bytes.decode("utf-8"))
    except Exception:
        payload = {}

    if payload and "is_enabled" in payload:
        enabled = bool(payload["is_enabled"])
    else:
        existing = await get_automation_rule_by_id(rule_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Rule not found")
        enabled = not bool(existing.get("is_enabled"))

    updated = await toggle_automation_rule(rule_id, enabled)
    if not updated:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"status": "success", "rule": updated}

@platform_router.delete("/rules/{rule_id}")
async def remove_automation_rule(rule_id: str):
    await delete_automation_rule(rule_id)
    return {"status": "success", "deleted": True}

@platform_router.get("/rules/logs")
async def get_rule_logs(rule_id: Optional[str] = None, limit: int = 50):
    logs = await list_automation_rule_logs(rule_id=rule_id, limit=limit)
    return {"status": "success", "logs": logs}

@platform_router.post("/rules/trigger")
async def trigger_rule_simulation(payload: Dict[str, Any] = Body(...)):
    """Simulates an event to test rule matching and action execution in AutomationRulesPage."""
    event_name = payload.get("event_name") or payload.get("trigger_type", "schedule")
    p_data = payload.get("payload") or payload.get("event_data", {})
    logs = await AutomationRuleRunner.evaluate_event(trigger_type=event_name, event_data=p_data)
    return {
        "status": "success",
        "event": event_name,
        "matched_count": len(logs),
        "logs": logs
    }

@platform_router.post("/rules/{rule_id}/trigger")
async def manual_trigger_rule(rule_id: str):
    rule = await get_automation_rule_by_id(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    logs = await AutomationRuleRunner.evaluate_event(
        trigger_type=rule["trigger_type"],
        event_data={"manual_test": True, "triggered_at": datetime.now().isoformat()}
    )
    return {"status": "success", "triggered_rule": rule["name"], "logs": logs}


# =====================================================================
# 11. Centralized Connections & Setup API (V4.1)
# =====================================================================

def _verify_local_admin(request: Request) -> None:
    """
    Restricts administrative mutations (credentials, data purge) to localhost clients
    or requests bearing a valid X-AgentFlow-Admin-Key using constant-time comparison.
    """
    client_host = request.client.host if request.client else "unknown"
    is_local = client_host in ("127.0.0.1", "::1", "localhost", "testclient")
    
    admin_key = get_credential("AGENTFLOW_ADMIN_KEY")
    req_key = (
        request.headers.get("X-AgentFlow-Admin-Key")
        or request.headers.get("x-agentflow-admin-key")
        or ""
    ).strip()
    
    # Constant-time comparison to prevent timing side-channel attacks
    if admin_key and req_key and hmac.compare_digest(req_key, admin_key.strip()):
        return
        
    if is_local:
        return
        
    raise HTTPException(
        status_code=403,
        detail="Administrative operation prohibited from non-local client without valid X-AgentFlow-Admin-Key."
    )


@platform_router.post("/admin/verify")
async def verify_admin_key_endpoint(request: Request):
    """
    Validates whether the provided X-AgentFlow-Admin-Key header or local client is authorized.
    Returns HTTP 200 on success or HTTP 403 if unauthorized.
    """
    _verify_local_admin(request)
    return {
        "status": "success",
        "authorized": True,
        "message": "Administrative access verified."
    }

@platform_router.get("/connections")
async def get_connections_summary():
    """Returns safe, masked credentials and verified connection status across all 4 categories."""
    summary = get_masked_credentials_summary()
    category_meta = [
        {"id": "social_media", "label": "Social Media", "desc": "LinkedIn"},
        {"id": "messaging", "label": "Messaging", "desc": "Telegram"},
        {"id": "communication", "label": "Communication", "desc": "Email, AI Calling"},
        {"id": "ai_providers", "label": "AI Providers", "desc": "LLM, Image Engine"},
    ]
    categories = []
    for meta in category_meta:
        cat_id = meta["id"]
        services_map = summary.get(cat_id, {})
        categories.append({
            "id": cat_id,
            "label": meta["label"],
            "desc": meta["desc"],
            "services": list(services_map.values())
        })
    return {"status": "success", "connections": summary, "categories": categories}


@platform_router.post("/connections/save")
async def save_connection_credentials(request: Request, payload: Dict[str, Any] = Body(...)):
    """Saves credentials securely into SQLite user_settings and runtime os.environ."""
    _verify_local_admin(request)
    saved = []
    cleaned_urn = None
    for k, v in payload.items():
        if v is not None and not is_masked_secret(v):  # Ignore masked placeholders
            clean_v = str(v).strip()
            if k == "LINKEDIN_AUTHOR_URN" and clean_v:
                is_valid, canon_urn, urn_err = LinkedInAdapter.validate_author_urn(clean_v)
                if not is_valid:
                    raise HTTPException(status_code=400, detail=urn_err)
                clean_v = canon_urn
                cleaned_urn = canon_urn
            set_credential(k, clean_v)
            saved.append(k)
    resp = {"status": "success", "saved_keys": saved, "message": f"Successfully updated {len(saved)} credentials."}
    if cleaned_urn:
        resp["cleaned_author_urn"] = cleaned_urn
        resp["author_urn"] = cleaned_urn
    return resp


@platform_router.post("/connections/test")
async def test_connection_endpoint(payload: Dict[str, Any] = Body(...)):
    """Live validates credentials against the target service."""
    service_id = payload.get("service_id") or payload.get("integration_id") or ""
    res = test_service_connectivity(service_id, payload)
    return res


@platform_router.post("/connections/disconnect")
async def disconnect_connection_endpoint(request: Request, payload: Dict[str, Any] = Body(...)):
    """Disconnects and safely clears stored credentials for an integration."""
    _verify_local_admin(request)
    service_id = (payload.get("service_id") or "").lower().strip()
    keys_map = {
        "linkedin": ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_ACCESS_TOKEN", "LINKEDIN_AUTHOR_URN"],
        "telegram": ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
        "email": ["EMAIL_USER", "EMAIL_PASS", "GMAIL_EMAIL", "GMAIL_APP_PASSWORD", "RESEND_API_KEY", "BREVO_API_KEY", "SMTP_HOST", "SMTP_PORT", "IMAP_HOST", "IMAP_PORT"],
        "calling": ["EXOTEL_API_KEY", "EXOTEL_API_TOKEN", "EXOTEL_ACCOUNT_SID", "EXOTEL_EXOPHONE", "EXOTEL_SUBDOMAIN", "EXOTEL_APP_ID", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
        "llm": ["GROQ_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"]
    }
    keys_to_delete = list(keys_map.get(service_id, []))
    if payload.get("keys"):
        keys_to_delete.extend(payload["keys"])
    for k in keys_to_delete:
        delete_credential(k)
    return {"status": "success", "disconnected": service_id, "deleted_keys": keys_to_delete}


@platform_router.get("/integrations/catalog")
@platform_router.get("/integrations")
async def get_all_integrations():
    """Returns the comprehensive 8-category integrations catalog with live statuses."""
    from backend.credentials import get_all_integrations_catalog
    catalog = get_all_integrations_catalog()
    return {
        "status": "success",
        "summary": catalog["summary"],
        "categories": catalog["categories"],
        "integrations": catalog["all_integrations"]
    }


@platform_router.post("/integrations/save")
async def save_integration_credentials(request: Request, payload: Dict[str, Any] = Body(...)):
    """Saves credentials for a specific integration service into SQLite, cache, and .env."""
    _verify_local_admin(request)
    integration_id = payload.get("integration_id") or payload.get("service_id", "")
    creds = payload.get("credentials") or {}
    if not creds and "key" in payload and "value" in payload:
        creds = {payload["key"]: payload["value"]}
    elif not creds:
        for k, v in payload.items():
            if k not in ("integration_id", "service_id"):
                creds[k] = v

    saved = []
    cleaned_urn = None
    for k, v in creds.items():
        if v is not None and str(v).strip():
            clean_v = str(v).strip()
            if is_masked_secret(clean_v):
                continue
            if k == "LINKEDIN_AUTHOR_URN" and clean_v:
                is_valid, canon_urn, urn_err = LinkedInAdapter.validate_author_urn(clean_v)
                if not is_valid:
                    raise HTTPException(status_code=400, detail=urn_err)
                clean_v = canon_urn
                cleaned_urn = canon_urn
            set_credential(k, clean_v)
            saved.append(k)

    resp = {
        "status": "success",
        "integration_id": integration_id,
        "saved_keys": saved,
        "message": f"Successfully configured {integration_id}."
    }
    if cleaned_urn:
        resp["cleaned_author_urn"] = cleaned_urn
        resp["author_urn"] = cleaned_urn
    return resp


@platform_router.post("/integrations/test")
async def test_integration_connection_legacy(payload: Dict[str, Any] = Body(...)):
    """Live validates credentials against the target service."""
    target = payload.get("service_id") or payload.get("integration_id") or payload.get("provider_id", "")
    return test_service_connectivity(target, payload)


@platform_router.post("/integrations/disconnect")
async def disconnect_integration_endpoint(request: Request, payload: Dict[str, Any] = Body(...)):
    """Disconnects and safely clears stored credentials for an integration."""
    _verify_local_admin(request)
    service_id = (payload.get("service_id") or payload.get("integration_id") or "").lower().strip()
    keys_map = {
        "linkedin": ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_ACCESS_TOKEN", "LINKEDIN_AUTHOR_URN"],
        "telegram": ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
        "email": ["EMAIL_USER", "EMAIL_PASS", "GMAIL_EMAIL", "GMAIL_APP_PASSWORD", "RESEND_API_KEY", "BREVO_API_KEY", "SMTP_HOST", "SMTP_PORT", "IMAP_HOST", "IMAP_PORT"],
        "email_smtp": ["EMAIL_USER", "EMAIL_PASS", "GMAIL_EMAIL", "GMAIL_APP_PASSWORD", "SMTP_HOST", "SMTP_PORT"],
        "email_resend": ["RESEND_API_KEY"],
        "email_brevo": ["BREVO_API_KEY"],
        "calling": ["EXOTEL_API_KEY", "EXOTEL_API_TOKEN", "EXOTEL_ACCOUNT_SID", "EXOTEL_EXOPHONE", "EXOTEL_SUBDOMAIN", "EXOTEL_APP_ID", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
        "gemini": ["GEMINI_API_KEY"],
        "groq": ["GROQ_API_KEY"],
        "huggingface": ["HUGGINGFACE_API_KEY"],
        "openai": ["OPENAI_API_KEY", "OPENAI_BASE_URL"],
        "llm": ["GROQ_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"],
        "webhooks": ["WEBHOOK_SECRET"]
    }
    keys_to_delete = list(keys_map.get(service_id, []))
    if payload.get("keys"):
        keys_to_delete.extend(payload["keys"])
    for k in keys_to_delete:
        delete_credential(k)
    return {"status": "success", "disconnected": service_id, "deleted_keys": keys_to_delete, "message": f"Successfully disconnected {service_id}."}


# =====================================================================
# 12. Database Sanitizer & Clean Slate Endpoint
# =====================================================================

@platform_router.post("/data/clear-demo")
async def clear_demo_data_endpoint(request: Request):
    """Purges seeded demo records, test calls, mock interactions, and hardcoded repos for a clean slate."""
    _verify_local_admin(request)
    counts = await purge_demo_and_test_data()
    return {"status": "success", "purged": counts, "message": "Demo data successfully purged. Database clean."}


# =====================================================================
# 13. AI Image & Carousel Generation API
# =====================================================================

class SingleImageGenRequest(BaseModel):
    prompt: str
    style: str = "Modern Tech"
    aspect_ratio: str = "1:1"
    visual_type: str = "showcase_visual"
    goal: Optional[str] = "project_showcase"
    provider: Optional[str] = None
    auto_fallback: Optional[bool] = True


@platform_router.post("/images/generate")
async def generate_single_image_endpoint(req: SingleImageGenRequest):
    """Generates an authentic AI visual for posts, infographics, or system diagrams."""
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt is required")
    res = ImageGenerationEngine.generate_single_image(
        prompt=req.prompt,
        style=req.style,
        aspect_ratio=req.aspect_ratio,
        visual_type=req.visual_type,
        goal=req.goal or "project_showcase",
        provider=req.provider,
        auto_fallback=True if req.auto_fallback is None else req.auto_fallback
    )
    if res.get("success") is False:
        return {
            "status": "error",
            "message": res.get("error", "AI image generation failed"),
            "image": res,
            "image_url": "",
            "download_url": "",
            "filename": ""
        }
    return {
        "status": "success",
        "image": res,
        "image_url": res.get("image_url", ""),
        "download_url": res.get("download_url", f"/api/platform/media/{res.get('filename')}/download"),
        "filename": res.get("filename", "")
    }


class CarouselGenRequest(BaseModel):
    topic: str
    slide_count: int = 4
    num_slides: Optional[int] = None
    style: str = "Modern Tech"
    goal: str = "educational"


@platform_router.post("/images/generate-carousel")
async def generate_carousel_endpoint(req: CarouselGenRequest):
    """Generates a sequence of 3 to 5 educational slides with structured takeaways and dedicated visuals."""
    if not req.topic.strip():
        raise HTTPException(status_code=400, detail="Topic is required")
    slides_to_gen = req.num_slides if req.num_slides is not None else req.slide_count
    res = ImageGenerationEngine.generate_carousel_slides(
        topic=req.topic,
        slide_count=slides_to_gen,
        style=req.style,
        goal=req.goal
    )
    return {
        "status": "success",
        "carousel": res,
        "slides": res.get("slides", []),
        "zip_download_url": res.get("zip_download_url", "")
    }


@platform_router.get("/media/{filename}")
async def serve_generated_media(filename: str):
    """Serves locally generated image files with caching headers."""
    safe_name = os.path.basename(filename)
    file_path = ImageGenerationEngine.WORKSPACE_MEDIA_DIR / safe_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Media file not found")
    media_type = "image/png"
    if safe_name.lower().endswith(".jpg") or safe_name.lower().endswith(".jpeg"):
        media_type = "image/jpeg"
    return FileResponse(str(file_path), media_type=media_type)


@platform_router.get("/media/{filename}/download")
async def download_generated_media(filename: str):
    """Forces direct image download with Content-Disposition header."""
    safe_name = os.path.basename(filename)
    file_path = ImageGenerationEngine.WORKSPACE_MEDIA_DIR / safe_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Media file not found")
    ext = Path(safe_name).suffix.lower() or ".png"
    media_type = "image/jpeg" if ext in [".jpg", ".jpeg"] else "image/png"
    download_filename = f"AgentFlow_LinkedIn_Visual{ext}"
    return FileResponse(
        str(file_path),
        media_type=media_type,
        filename=download_filename,
        headers={"Content-Disposition": f'attachment; filename="{download_filename}"'}
    )


@platform_router.get("/media/carousel/zip")
async def download_carousel_zip(filenames: str = Query(...)):
    """Packages carousel slide images into a downloadable ZIP archive."""
    import io
    import zipfile
    from fastapi.responses import Response

    names = [os.path.basename(f.strip()) for f in filenames.split(",") if f.strip()]
    if not names:
        raise HTTPException(status_code=400, detail="No filenames provided")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for idx, fname in enumerate(names, start=1):
            fpath = ImageGenerationEngine.WORKSPACE_MEDIA_DIR / fname
            if fpath.exists():
                ext = fpath.suffix.lower() or ".png"
                arcname = f"Slide_{idx}{ext}"
                zf.write(fpath, arcname=arcname)
        manifest = f"AgentFlow LinkedIn Carousel\nTotal Slides: {len(names)}\nGenerated: {datetime.now().isoformat()}\n"
        zf.writestr("carousel_info.txt", manifest)

    zip_buffer.seek(0)
    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="AgentFlow_LinkedIn_Carousel.zip"'}
    )



# =====================================================================
# 15. Incoming Telephony & Voice Assistant Settings API
# =====================================================================

@platform_router.post("/calls/incoming-config")
async def save_incoming_call_config(payload: Dict[str, Any] = Body(...)):
    """Saves incoming call assistant settings and Exotel credentials."""
    if "api_key" in payload and payload["api_key"]:
        set_credential("EXOTEL_API_KEY", str(payload["api_key"]).strip())
    if "api_token" in payload and payload["api_token"] and not str(payload["api_token"]).startswith("••••"):
        set_credential("EXOTEL_API_TOKEN", str(payload["api_token"]).strip())
    if "account_sid" in payload and payload["account_sid"]:
        set_credential("EXOTEL_ACCOUNT_SID", str(payload["account_sid"]).strip())
    if "exophone" in payload and payload["exophone"]:
        set_credential("EXOTEL_EXOPHONE", str(payload["exophone"]).strip())
    elif "phone_number" in payload and payload["phone_number"]:
        set_credential("EXOTEL_EXOPHONE", str(payload["phone_number"]).strip())
    if "subdomain" in payload and payload["subdomain"]:
        set_credential("EXOTEL_SUBDOMAIN", str(payload["subdomain"]).strip())
    if "app_id" in payload and payload["app_id"]:
        set_credential("EXOTEL_APP_ID", str(payload["app_id"]).strip())
    if "greeting_message" in payload:
        set_credential("VOICE_GREETING_MESSAGE", str(payload["greeting_message"]).strip())
    if "instructions" in payload:
        set_credential("VOICE_INSTRUCTIONS", str(payload["instructions"]).strip())
    if "language" in payload:
        set_credential("VOICE_LANGUAGE", str(payload["language"]).strip())
    if "telegram_alerts" in payload:
        set_credential("VOICE_TELEGRAM_ALERTS", "true" if payload["telegram_alerts"] else "false")
    return {"status": "success", "message": "Voice assistant configuration updated."}


