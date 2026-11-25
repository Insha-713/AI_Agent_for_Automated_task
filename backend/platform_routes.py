"""
AgentFlow v3.0 - Unified Platform API Router
Endpoints under /api/platform/ and /api/webhooks/
"""

import os
import json
import uuid
import hmac
import hashlib
from datetime import datetime, timezone
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
    test_service_connectivity
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
    save_instagram_rule,
    list_instagram_rules,
    get_instagram_rule_by_id,
    delete_instagram_rule,
    save_instagram_interaction,
    list_instagram_interactions,
    save_whatsapp_rule,
    list_whatsapp_rules,
    get_whatsapp_rule_by_id,
    delete_whatsapp_rule,
    save_whatsapp_message,
    list_whatsapp_messages,
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
    SocialMediaEngine,
    LinkedInAdapter,
    InstagramAdapter,
    WhatsAppAdapter,
    CallingAdapter,
    EmailAgentEngine,
    ResearchEngine,
    AutomationRuleRunner,
    ImageGenerationEngine,
    calculate_schedule_times,
    compute_next_occurrence,
    get_safe_timezone
)
from backend.voice_agent import (
    validate_twilio_signature,
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
# 2. Social Media Agent
# =====================================================================

class SocialPostGenRequest(BaseModel):
    topic: str
    platform: str = "linkedin"
    tone: str = "professional"
    target_audience: str = "tech professionals"
    include_hashtags: bool = True

@platform_router.post("/social/generate")
async def generate_social_post(req: SocialPostGenRequest):
    """Generates social media content with hashtags and posting time recommendation."""
    post_data = SocialMediaEngine.generate_post_content(
        topic=req.topic,
        platform=req.platform,
        tone=req.tone,
        target_audience=req.target_audience,
        include_hashtags=req.include_hashtags
    )
    return {"status": "success", "draft": post_data, "post": post_data}

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
        # Publish immediately
        content = post.get("content", "")
        if post.get("hashtags"):
            ht_str = " ".join(post["hashtags"]) if isinstance(post["hashtags"], list) else str(post["hashtags"])
            if ht_str and ht_str not in content:
                content = f"{content}\n\n{ht_str}"

        plat = (post.get("platform") or "linkedin").lower().strip()
        if plat == "linkedin":
            res = LinkedInAdapter.publish_ugc_post(content=content)
        elif plat == "instagram":
            res = InstagramAdapter.publish_media(caption=content, image_url=post.get("media_url"))
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
    """Publishes a scheduled or approved post directly to LinkedIn or Instagram."""
    post = await get_social_post_by_id(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Social post not found")

    platform_name = (post.get("platform") or "linkedin").lower().strip()
    content = post.get("content", "")
    hashtags = post.get("hashtags")
    if hashtags:
        ht_str = " ".join(hashtags) if isinstance(hashtags, list) else str(hashtags)
        if ht_str and ht_str not in content:
            content = f"{content}\n\n{ht_str}"

    if platform_name == "linkedin":
        res = LinkedInAdapter.publish_ugc_post(content=content)
    elif platform_name == "instagram":
        res = InstagramAdapter.publish_media(
            caption=content,
            image_url=post.get("media_url")
        )
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

@platform_router.post("/linkedin/publish")
async def publish_direct_linkedin(payload: Dict[str, Any] = Body(...)):
    """Directly publishes provided text content to LinkedIn."""
    content = payload.get("content") or payload.get("caption", "")
    if not content.strip():
        raise HTTPException(status_code=400, detail="Content is required for publishing to LinkedIn")
    res = LinkedInAdapter.publish_ugc_post(content=content)
    return res

@platform_router.post("/linkedin/reply")
async def draft_linkedin_reply(payload: Dict[str, Any] = Body(...)):
    snippet = payload.get("post_snippet", "")
    commenter = payload.get("commenter_name", "Connection")
    reply = LinkedInAdapter.draft_comment_reply(snippet, commenter)
    return {"status": "success", "reply": reply}


# =====================================================================
# 4. Instagram Automation Agent & Comment-to-DM
# =====================================================================

@platform_router.get("/instagram/status")
async def get_instagram_status():
    return InstagramAdapter.get_status()

@platform_router.get("/instagram/rules")
async def get_instagram_rules():
    rules = await list_instagram_rules()
    return {"status": "success", "rules": rules}

@platform_router.post("/instagram/rules")
async def save_ig_rule(rule: Dict[str, Any] = Body(...)):
    saved = await save_instagram_rule(rule)
    return {"status": "success", "rule": saved}

@platform_router.delete("/instagram/rules/{rule_id}")
async def delete_ig_rule(rule_id: str):
    await delete_instagram_rule(rule_id)
    return {"status": "success", "deleted": True}

@platform_router.get("/instagram/interactions")
async def get_instagram_interactions(limit: int = 50):
    logs = await list_instagram_interactions(limit=limit)
    return {"status": "success", "interactions": logs}

@platform_router.post("/instagram/simulate-comment")
async def simulate_instagram_comment(payload: Dict[str, Any] = Body(...)):
    """Simulates an incoming Instagram comment to test the Comment-to-DM rule matching."""
    comment_text = payload.get("comment_text", "GUIDE")
    username = payload.get("username", "ai_builder_insha")

    simulated_webhook_payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "id": f"comm_{uuid.uuid4().hex[:8]}",
                            "text": comment_text,
                            "media": {"id": "media_test_reel_123"},
                            "from": {"id": "user_456", "username": username}
                        }
                    }
                ]
            }
        ]
    }
    interactions = await InstagramAdapter.process_comment_webhook(simulated_webhook_payload, is_simulation=True)
    return {
        "status": "success",
        "matched": len(interactions) > 0,
        "interactions": interactions
    }

def _enforce_meta_signature(request: Request, raw_body: bytes) -> None:
    """
    Validates Meta (Instagram / WhatsApp) webhook authenticity using HMAC-SHA256 signature.
    In production (when META_APP_SECRET is set), strictly forbids requests without valid signature.
    """
    secret = get_credential("META_APP_SECRET")
    if not secret:
        # In development/demo when META_APP_SECRET is not configured, pass through
        return

    sig_header = request.headers.get("X-Hub-Signature-256") or request.headers.get("x-hub-signature-256")
    if not sig_header:
        raise HTTPException(status_code=403, detail="Missing X-Hub-Signature-256 header.")

    expected_prefix = "sha256="
    if not sig_header.startswith(expected_prefix):
        raise HTTPException(status_code=403, detail="Invalid X-Hub-Signature-256 header format.")

    received_sig = sig_header[len(expected_prefix):].strip()
    expected_sig = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(received_sig, expected_sig):
        raise HTTPException(status_code=403, detail="Invalid Meta webhook signature.")

# Meta Instagram Webhook Endpoints
@webhook_router.get("/instagram")
async def verify_instagram_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge")
):
    challenge = InstagramAdapter.verify_webhook(hub_mode or "", hub_verify_token or "", hub_challenge or "")
    if challenge:
        return PlainTextResponse(content=challenge)
    raise HTTPException(status_code=403, detail="Verification token mismatch")

@webhook_router.post("/instagram")
async def handle_instagram_webhook(request: Request):
    raw_body = await request.body()
    _enforce_meta_signature(request, raw_body)
    try:
        payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except Exception:
        return {"status": "ignored"}
    interactions = await InstagramAdapter.process_comment_webhook(payload, is_simulation=False)
    return {"status": "processed", "interactions_count": len(interactions)}


# =====================================================================
# 5. WhatsApp Automation Agent
# =====================================================================

@platform_router.get("/whatsapp/status")
async def get_whatsapp_status():
    return WhatsAppAdapter.get_status()

@platform_router.get("/whatsapp/rules")
async def get_whatsapp_rules():
    rules = await list_whatsapp_rules()
    return {"status": "success", "rules": rules}

@platform_router.post("/whatsapp/rules")
async def save_wa_rule(rule: Dict[str, Any] = Body(...)):
    saved = await save_whatsapp_rule(rule)
    return {"status": "success", "rule": saved}

@platform_router.delete("/whatsapp/rules/{rule_id}")
async def delete_wa_rule(rule_id: str):
    await delete_whatsapp_rule(rule_id)
    return {"status": "success", "deleted": True}

@platform_router.get("/whatsapp/messages")
async def get_whatsapp_messages(contact_phone: Optional[str] = None, limit: int = 50):
    msgs = await list_whatsapp_messages(contact_phone=contact_phone, limit=limit)
    return {"status": "success", "messages": msgs}

@platform_router.post("/whatsapp/simulate-message")
async def simulate_whatsapp_message(payload: Dict[str, Any] = Body(...)):
    """Simulates an incoming WhatsApp message to test keyword auto-reply logic."""
    from_num = payload.get("from_phone", "+919876543210")
    contact_name = payload.get("contact_name", "Developer Friend")
    text = payload.get("message_text", "PORTFOLIO")

    simulated_payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "contacts": [{"profile": {"name": contact_name}}],
                            "messages": [
                                {
                                    "id": f"wamid_{uuid.uuid4().hex[:8]}",
                                    "from": from_num,
                                    "text": {"body": text}
                                }
                            ]
                        }
                    }
                ]
            }
        ]
    }
    replies = await WhatsAppAdapter.process_message_webhook(simulated_payload, is_simulation=True)
    return {
        "status": "success",
        "replies": replies
    }

@platform_router.post("/whatsapp/send")
async def send_direct_whatsapp_message(payload: Dict[str, Any] = Body(...)):
    """Dispatches an outbound WhatsApp message via the official WhatsApp Business Cloud API."""
    phone = payload.get("recipient_phone") or payload.get("to_phone") or payload.get("phone", "")
    body = payload.get("message_body") or payload.get("message") or payload.get("body", "")
    template_name = payload.get("template_name")

    if not phone or not body:
        raise HTTPException(status_code=400, detail="Recipient phone number and message body are required.")

    res = WhatsAppAdapter.send_cloud_message(to_phone=phone, body=body, template_name=template_name)
    if res.get("success"):
        await save_whatsapp_message({
            "contact_phone": phone,
            "direction": "outbound",
            "message_body": body,
            "message_id": res.get("message_id", ""),
            "status": "sent"
        })
    return res

# WhatsApp Business Webhook Endpoints
@webhook_router.get("/whatsapp")
async def verify_whatsapp_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge")
):
    challenge = WhatsAppAdapter.verify_webhook(hub_mode or "", hub_verify_token or "", hub_challenge or "")
    if challenge:
        return PlainTextResponse(content=challenge)
    raise HTTPException(status_code=403, detail="Verification token mismatch")

@webhook_router.post("/whatsapp")
async def handle_whatsapp_webhook(request: Request):
    raw_body = await request.body()
    _enforce_meta_signature(request, raw_body)
    try:
        payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except Exception:
        return {"status": "ignored"}
    replies = await WhatsAppAdapter.process_message_webhook(payload, is_simulation=False)
    return {"status": "processed", "replies_count": len(replies)}


# =====================================================================
# 6. AI Calling Agent
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


def _enforce_twilio_signature(request: Request, post_params: Dict[str, Any]) -> None:
    """
    Validates Twilio webhook authenticity using HMAC-SHA1 signature.
    In production (when TWILIO_AUTH_TOKEN is set), strictly forbids requests without valid signature.
    """
    token = get_credential("TWILIO_AUTH_TOKEN")
    if token:
        sig = request.headers.get("X-Twilio-Signature")
        if not sig:
            raise HTTPException(status_code=403, detail="Missing X-Twilio-Signature header.")
        full_url = _get_public_webhook_url(request)
        if not validate_twilio_signature(full_url, post_params, sig, auth_token=token):
            raise HTTPException(status_code=403, detail="Invalid Twilio signature.")


# =====================================================================
# INCOMING AI VOICE CALL WEBHOOKS (TWILIO)
# =====================================================================

@webhook_router.post("/voice/incoming")
@webhook_router.get("/voice/incoming")
async def handle_incoming_voice_call(request: Request):
    """
    Dedicated Twilio Webhook for incoming voice calls.
    Answers call, initializes call_tasks inbound record, and returns TwiML greeting with speech recognition.
    """
    post_params, params = await _extract_voice_params(request)
    _enforce_twilio_signature(request, post_params)

    caller_phone = params.get("From", "Unknown Caller").strip()
    called_phone = params.get("To", "").strip()
    call_sid = params.get("CallSid", f"inc_sid_{uuid.uuid4().hex[:12]}")
    caller_city = params.get("FromCity", "")
    caller_state = params.get("FromState", "")
    caller_country = params.get("FromCountry", "")
    caller_location = ", ".join(filter(bool, [caller_city, caller_state, caller_country]))

    # Check for existing record for this CallSid or create new
    existing = await get_call_task_by_sid(call_sid)
    if existing:
        call_id = existing["id"]
    else:
        call_id = f"call_inbound_{uuid.uuid4().hex[:8]}"
        greeting_text = get_credential("VOICE_GREETING_MESSAGE", "Hello! Thank you for calling. I am your AgentFlow AI voice assistant. How may I assist you today?")
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
            "recipient_name": caller_location or "Incoming Caller",
            "direction": "inbound",
            "purpose": "Inbound AI Voice Assistance",
            "prompt_script": "Incoming AI Call - Active Voice Session",
            "scheduled_time": datetime.now().isoformat(),
            "status": "in_progress",
            "call_sid": call_sid,
            "duration_seconds": 0,
            "transcript": json.dumps(initial_transcript),
            "summary": "Inbound call in progress...",
            "outcome": "in_progress"
        })

    turn_action_url = f"/api/webhooks/voice/process-turn?call_id={call_id}"
    twiml = generate_greeting_twiml(turn_action_url=turn_action_url)
    return Response(content=twiml, media_type="application/xml")


@webhook_router.post("/voice/process-turn")
async def handle_voice_process_turn(request: Request):
    """
    Multi-turn conversational voice turn handler.
    Receives SpeechResult from Twilio <Gather>, queries LLM provider,
    and returns next conversational turn with <Say> and <Gather>.
    """
    post_params, params = await _extract_voice_params(request)
    _enforce_twilio_signature(request, post_params)
    call_id = request.query_params.get("call_id") or params.get("call_id")
    call_sid = params.get("CallSid")

    call_record = None
    if call_id:
        call_record = await get_call_task_by_id(call_id)
    if not call_record and call_sid:
        call_record = await get_call_task_by_sid(call_sid)

    caller_phone = params.get("From", "")
    speech_result = params.get("SpeechResult", "").strip()

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
        farewell_reply = "Thank you for calling. I have logged your message and our team will follow up if needed. Have a wonderful day. Goodbye!"
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
                transcript=json.dumps(transcript_turns)
            )
            # Dispatch Telegram Notification
            send_voice_call_telegram_alert(updated or call_record)

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


@webhook_router.post("/voice/status")
async def handle_voice_call_status(request: Request):
    """
    Twilio Call Status Callback webhook.
    Updates call duration and final status, generates AI summary, and dispatches Telegram notification.
    """
    post_params, params = await _extract_voice_params(request)
    _enforce_twilio_signature(request, post_params)
    call_sid = params.get("CallSid")
    call_status = params.get("CallStatus", "completed").lower()
    duration_sec = int(params.get("CallDuration") or 0)

    call_record = None
    if call_sid:
        call_record = await get_call_task_by_sid(call_sid)

    final_status = "completed"
    if call_status in ("busy", "no-answer", "canceled"):
        final_status = "missed"
    elif call_status == "failed":
        final_status = "failed"
    elif call_status == "completed":
        final_status = "completed"

    if call_record:
        # Load transcript for summary if not already summarized
        existing_summary = call_record.get("summary", "")
        if not existing_summary or existing_summary == "Inbound call in progress...":
            try:
                turns = json.loads(call_record.get("transcript") or "[]")
                plain_transcript = "\n".join([f"{t.get('role', 'speaker').capitalize()}: {t.get('text', '')}" for t in turns])
            except Exception:
                plain_transcript = call_record.get("transcript", "")
            
            summary_info = summarize_voice_call(plain_transcript, caller_phone=call_record.get("recipient_phone", ""))
            updated = await update_call_task_status(
                call_id=call_record["id"],
                status=final_status,
                outcome=summary_info.get("intent", final_status),
                summary=summary_info.get("summary", ""),
                duration_seconds=duration_sec
            )
            # Dispatch Telegram alert
            send_voice_call_telegram_alert(updated or call_record)
        else:
            await update_call_task_status(
                call_id=call_record["id"],
                status=final_status,
                duration_seconds=duration_sec
            )

    return {"status": "recorded", "call_sid": call_sid, "final_status": final_status}


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
    """Returns webhook endpoints, environment configuration, and Twilio Console setup guide."""
    base_url = str(request.base_url).rstrip("/")
    tw_sid = bool(get_credential("TWILIO_ACCOUNT_SID"))
    tw_token = bool(get_credential("TWILIO_AUTH_TOKEN"))
    tw_phone = get_credential("TWILIO_PHONE_NUMBER") or ""
    tg_token = bool(get_credential("TELEGRAM_BOT_TOKEN"))
    tg_chat = bool(get_credential("TELEGRAM_CHAT_ID"))

    masked_phone = f"{tw_phone[:4]}***{tw_phone[-3:]}" if len(tw_phone) >= 7 else tw_phone

    return {
        "status": "ready" if (tw_sid and tw_token and tw_phone) else "pending_credentials",
        "phone_number": tw_phone,
        "account_sid": get_credential("TWILIO_ACCOUNT_SID"),
        "has_auth_token": tw_token,
        "greeting_message": get_credential("VOICE_GREETING_MESSAGE", "Hello! Thank you for calling. I am your AgentFlow AI voice assistant. How may I assist you today?"),
        "instructions": get_credential("VOICE_INSTRUCTIONS", ""),
        "language": get_credential("VOICE_LANGUAGE", "en-IN"),
        "telegram_alerts": get_credential("VOICE_TELEGRAM_ALERTS", "true") == "true",
        "webhook_url": f"{base_url}/api/webhooks/voice/incoming",
        "process_turn_url": f"{base_url}/api/webhooks/voice/process-turn",
        "status_callback_url": f"{base_url}/api/webhooks/voice/status",
        "credentials": {
            "twilio_configured": bool(tw_sid and tw_token and tw_phone),
            "twilio_phone_number": masked_phone if masked_phone else None,
            "telegram_notifications_configured": bool(tg_token and tg_chat)
        },
        "twilio_console_guide": [
            "1. Log in to Twilio Console at console.twilio.com.",
            "2. Navigate to Phone Numbers -> Manage -> Active numbers -> Click your Twilio phone number.",
            "3. Scroll to 'Voice Configuration' section.",
            "4. Under 'A CALL COMES IN', set: Webhook -> HTTP POST.",
            f"5. Enter your URL: {base_url}/api/webhooks/voice/incoming",
            f"6. Under 'STATUS CALLBACK URL', set: {base_url}/api/webhooks/voice/status (HTTP POST).",
            "7. Click 'Save configuration' at the bottom of the page."
        ]
    }


@platform_router.post("/calls/incoming/simulate")
async def simulate_incoming_call_turn(payload: Dict[str, Any] = Body(...)):
    """
    Simulates an incoming call turn-by-turn for testing without a real phone call.
    Accepts speech_input, generates LLM reply, updates or creates mock transcript, and returns TwiML.
    """
    caller_phone = payload.get("caller_phone", "+15550001111")
    speech_input = payload.get("speech_input", "Hello, I am calling about the AI Engineer opening.")
    call_sid = payload.get("call_sid") or f"sim_call_{uuid.uuid4().hex[:10]}"
    history = payload.get("history", [])

    is_farewell = is_caller_farewell(speech_input)
    if is_farewell:
        ai_reply = "Thank you for calling. I have logged your message for our team. Have a wonderful day. Goodbye!"
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
    or requests bearing a valid X-AgentFlow-Admin-Key.
    """
    client_host = request.client.host if request.client else "unknown"
    is_local = client_host in ("127.0.0.1", "::1", "localhost", "testclient")
    
    admin_key = get_credential("AGENTFLOW_ADMIN_KEY")
    req_key = request.headers.get("X-AgentFlow-Admin-Key")
    
    if admin_key and req_key == admin_key:
        return
        
    if is_local:
        return
        
    raise HTTPException(
        status_code=403,
        detail="Administrative operation prohibited from non-local client without valid X-AgentFlow-Admin-Key."
    )

@platform_router.get("/connections")
async def get_connections_summary():
    """Returns safe, masked credentials and verified connection status across all 4 categories."""
    summary = get_masked_credentials_summary()
    category_meta = [
        {"id": "social_media", "label": "Social Media", "desc": "LinkedIn, Instagram"},
        {"id": "messaging", "label": "Messaging", "desc": "WhatsApp, Telegram"},
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
    for k, v in payload.items():
        if v is not None and not str(v).startswith("••••"):  # Ignore masked placeholders
            set_credential(k, str(v).strip())
            saved.append(k)
    return {"status": "success", "saved_keys": saved, "message": f"Successfully updated {len(saved)} credentials."}


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
        "instagram": ["META_APP_ID", "META_APP_SECRET", "INSTAGRAM_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_WEBHOOK_VERIFY_TOKEN", "INSTAGRAM_CALLBACK_URL"],
        "whatsapp": ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_WABA_ID", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_TOKEN", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_CALLBACK_URL"],
        "telegram": ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
        "email": ["EMAIL_USER", "EMAIL_PASS", "GMAIL_EMAIL", "GMAIL_APP_PASSWORD", "RESEND_API_KEY", "BREVO_API_KEY", "SMTP_HOST", "SMTP_PORT", "IMAP_HOST", "IMAP_PORT"],
        "calling": ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
        "llm": ["GROQ_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"]
    }
    keys_to_delete = list(keys_map.get(service_id, []))
    if payload.get("keys"):
        keys_to_delete.extend(payload["keys"])
    for k in keys_to_delete:
        delete_credential(k)
    return {"status": "success", "disconnected": service_id, "deleted_keys": keys_to_delete}


@platform_router.get("/integrations")
async def get_all_integrations():
    """Backward compatibility alias for /api/platform/connections."""
    summary = get_masked_credentials_summary()
    flat_list = []
    for cat_name, cat_items in summary.items():
        for s_id, s_data in cat_items.items():
            flat_list.append({
                "id": s_id,
                "name": s_data.get("name", s_id),
                "category": s_data.get("category", cat_name),
                "configured": s_data.get("configured", False),
                "status": s_data.get("status", "not_connected"),
                "instructions": s_data.get("instructions", "")
            })
    return {"status": "success", "integrations": flat_list}


@platform_router.post("/integrations/test")
async def test_integration_connection_legacy(payload: Dict[str, Any] = Body(...)):
    """Backward compatibility alias for testing."""
    target = payload.get("integration_id") or payload.get("provider_id") or payload.get("service_id", "")
    return test_service_connectivity(target, payload)


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


@platform_router.post("/images/generate")
async def generate_single_image_endpoint(req: SingleImageGenRequest):
    """Generates an authentic AI visual for posts, infographics, or system diagrams."""
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt is required")
    res = ImageGenerationEngine.generate_single_image(
        prompt=req.prompt,
        style=req.style,
        aspect_ratio=req.aspect_ratio,
        visual_type=req.visual_type
    )
    return {
        "status": "success",
        "image": res,
        "image_url": res.get("image_url", ""),
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
    return {"status": "success", "carousel": res, "slides": res.get("slides", [])}


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



# =====================================================================
# 15. Incoming Telephony & Voice Assistant Settings API
# =====================================================================

@platform_router.post("/calls/incoming-config")
async def save_incoming_call_config(payload: Dict[str, Any] = Body(...)):
    """Saves incoming call assistant settings."""
    if "phone_number" in payload and payload["phone_number"]:
        set_credential("TWILIO_PHONE_NUMBER", str(payload["phone_number"]).strip())
    if "greeting_message" in payload:
        set_credential("VOICE_GREETING_MESSAGE", str(payload["greeting_message"]).strip())
    if "instructions" in payload:
        set_credential("VOICE_INSTRUCTIONS", str(payload["instructions"]).strip())
    if "language" in payload:
        set_credential("VOICE_LANGUAGE", str(payload["language"]).strip())
    if "telegram_alerts" in payload:
        set_credential("VOICE_TELEGRAM_ALERTS", "true" if payload["telegram_alerts"] else "false")
    return {"status": "success", "message": "Voice assistant configuration updated."}


