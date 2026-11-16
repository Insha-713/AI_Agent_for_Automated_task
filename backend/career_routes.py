"""
AgentFlow v3.0 - Career Agent API Router
Exposes all career automation endpoints under /api/career:
- Profile & CV Upload
- Preferences
- Job Discovery & Search
- ATS Scoring & Multi-Job Comparison
- Resume Customizer & Version Management
- Cover Letter Generator
- Application Assistant & Checklist
- Application Tracker
- Daily Job Alerts
- Career Reports & Multi-Format Downloads
- Career Chat Assistant
- Dashboard KPIs
"""

import os
import io
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Body, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

# Local imports
from backend.db import (
    get_career_profile,
    save_career_profile,
    get_career_preferences,
    save_career_preferences,
    save_job_listing,
    save_job_listings_bulk,
    list_job_listings,
    get_job_listing_by_id,
    delete_job_listing,
    save_job_match,
    get_job_match,
    list_job_matches,
    save_resume_version,
    list_resume_versions,
    get_resume_version_by_id,
    delete_resume_version,
    save_cover_letter,
    list_cover_letters,
    get_cover_letter_by_id,
    delete_cover_letter,
    save_job_application,
    list_job_applications,
    get_job_application_by_id,
    update_application_status,
    delete_job_application,
    get_application_history,
    get_career_alert_settings,
    save_career_alert_settings,
    save_career_report,
    list_career_reports,
    get_career_report_by_id,
    get_career_dashboard_kpis,
    save_uploaded_resume,
)
from backend.career import (
    extract_text_from_cv_bytes,
    parse_cv_into_profile,
    discover_jobs,
    evaluate_ats_compatibility,
    build_job_specific_resume,
    build_job_cover_letter,
    prepare_job_application_packet,
    export_text_to_docx,
    export_text_to_printable_html,
    export_jobs_to_excel,
    export_jobs_to_csv,
    run_daily_job_alerts,
    handle_career_chat_message,
    REPORTS_DIR,
    SUPPORTED_JOB_CATEGORIES,
)
from backend.credentials import get_credential
from backend.email_provider import send_email_via_provider

router = APIRouter(prefix="/api/career", tags=["Career Agent"])


# =====================================================================
# Request Models
# =====================================================================

class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    college: Optional[str] = ""
    education: Optional[List[str]] = []
    technical_skills: Optional[List[str]] = []
    programming_languages: Optional[List[str]] = []
    ai_ml_skills: Optional[List[str]] = []
    projects: Optional[List[str]] = []
    experience: Optional[List[str]] = []
    certifications: Optional[List[str]] = []
    achievements: Optional[List[str]] = []
    github_url: Optional[str] = ""
    linkedin_url: Optional[str] = ""
    portfolio_url: Optional[str] = ""

class PreferencesUpdateRequest(BaseModel):
    target_roles: Optional[List[str]] = []
    preferred_industries: Optional[List[str]] = []
    preferred_locations: Optional[List[str]] = []
    workplace_types: Optional[List[str]] = []
    job_types: Optional[List[str]] = []
    expected_salary: Optional[str] = ""
    experience_level: Optional[str] = "Fresher / Entry-Level"
    preferred_companies: Optional[List[str]] = []
    min_match_score: Optional[int] = 65

class DiscoverJobsRequest(BaseModel):
    category: Optional[str] = "AI Engineer"
    location: Optional[str] = "India"
    limit: Optional[int] = 15

class ATSAnalyzeRequest(BaseModel):
    job_id: Optional[str] = None
    job_title: Optional[str] = ""
    company: Optional[str] = ""
    job_description: Optional[str] = ""

class ATSCompareRequest(BaseModel):
    job_ids: List[str]

class ResumeGenerateRequest(BaseModel):
    job_id: Optional[str] = None
    target_role: Optional[str] = "AI Engineer"
    company: Optional[str] = ""
    job_description: Optional[str] = ""

class ResumeSaveRequest(BaseModel):
    title: str
    target_role: str
    content_md: str
    job_id: Optional[str] = ""

class CoverLetterGenerateRequest(BaseModel):
    job_id: Optional[str] = None
    company: Optional[str] = "Company"
    target_role: Optional[str] = "AI Engineer"
    job_description: Optional[str] = ""
    tone: Optional[str] = "Professional"

class ApplicationCreateRequest(BaseModel):
    job_id: Optional[str] = ""
    company: str
    job_title: str
    location: Optional[str] = "Remote"
    source: Optional[str] = "Direct"
    status: Optional[str] = "saved"
    notes: Optional[str] = ""
    salary_offered: Optional[str] = ""

class ApplicationStatusUpdateRequest(BaseModel):
    status: str
    notes: Optional[str] = ""

class CareerChatRequest(BaseModel):
    message: str


# =====================================================================
# 1. Career Dashboard KPIs
# =====================================================================

@router.get("/dashboard")
async def get_dashboard_metrics():
    """Returns real-time KPIs, application funnel, and top matches for Career Dashboard."""
    kpis = await get_career_dashboard_kpis()
    return {"success": True, "data": kpis}


# =====================================================================
# 2. Career Profile Management & CV Upload
# =====================================================================

@router.get("/profile")
async def get_profile():
    """Retrieves user's career profile."""
    profile = await get_career_profile("default")
    return {"success": True, "profile": profile}

@router.post("/profile")
async def update_profile(req: ProfileUpdateRequest):
    """Updates user's career profile."""
    saved = await save_career_profile(req.model_dump(), "default")
    return {"success": True, "profile": saved, "message": "Career profile updated successfully."}

@router.post("/profile/upload-cv")
async def upload_cv_document(file: UploadFile = File(...)):
    """
    Accepts PDF or DOCX CV (<= 5 MB), extracts text, automatically organizes fields into
    the career profile without hallucinations, and persists in SQLite.
    """
    filename = file.filename or "cv_document.pdf"
    content = await file.read()
    file_size = len(content)

    if file_size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds the 5 MB limit.")

    file_id = f"cv_{uuid.uuid4().hex[:10]}"
    mime_type = file.content_type or ""

    # Extract text safely
    raw_text = extract_text_from_cv_bytes(content, filename, mime_type)
    if not raw_text.strip() or len(raw_text.strip()) < 30:
        raise HTTPException(
            status_code=400,
            detail="Could not extract text from document. Ensure file is not password-protected or image-only scanned."
        )

    # Save to uploaded_resumes table
    await save_uploaded_resume(
        file_id=file_id,
        filename=filename,
        file_size=file_size,
        mime_type=mime_type,
        raw_content=content,
        extracted_text=raw_text
    )

    # Parse into structured profile
    parsed = parse_cv_into_profile(raw_text, filename)
    parsed["raw_cv_id"] = file_id

    # Persist in career_profiles
    saved_profile = await save_career_profile(parsed, "default")

    return {
        "success": True,
        "message": f"Successfully parsed and saved {filename}.",
        "file_id": file_id,
        "profile": saved_profile
    }


# =====================================================================
# 3. Career Preferences
# =====================================================================

@router.get("/preferences")
async def get_preferences():
    """Retrieves saved career preferences."""
    pref = await get_career_preferences("default")
    return {"success": True, "preferences": pref, "supported_categories": SUPPORTED_JOB_CATEGORIES}

@router.post("/preferences")
async def update_preferences(req: PreferencesUpdateRequest):
    """Updates career preferences."""
    saved = await save_career_preferences(req.model_dump(), "default")
    return {"success": True, "preferences": saved, "message": "Career preferences updated successfully."}


# =====================================================================
# 4. AI Job Finder & Discovery
# =====================================================================

@router.get("/jobs")
async def list_jobs(
    limit: int = Query(50, ge=1, le=200),
    search: str = Query("", description="Search term"),
    category: str = Query("", description="Category filter"),
    location: str = Query("", description="Location filter"),
    workplace_type: str = Query("", description="Remote/Hybrid/On-site"),
    source: str = Query("", description="Source filter")
):
    """Lists discovered jobs with search and filters."""
    jobs = await list_job_listings(
        limit=limit,
        search=search,
        category=category,
        location=location,
        workplace_type=workplace_type,
        source=source
    )
    return {"success": True, "count": len(jobs), "jobs": jobs}

@router.post("/jobs/discover")
async def trigger_job_discovery(req: DiscoverJobsRequest):
    """Executes modular job search across sources and deduplicates in database."""
    category = req.category or "AI Engineer"
    location = req.location or "India"
    limit = req.limit or 15

    discovered = discover_jobs(category=category, location=location, limit_per_source=max(5, limit // 2))
    bulk_result = await save_job_listings_bulk(discovered)

    return {
        "success": True,
        "message": f"Discovery complete for '{category}' in '{location}'.",
        "added_count": bulk_result["added"],
        "duplicates_skipped": bulk_result["duplicates"],
        "total_returned": len(discovered),
        "jobs": bulk_result["jobs"]
    }

@router.get("/jobs/{job_id}")
async def get_job_detail(job_id: str):
    """Gets full detail for a single job listing."""
    job = await get_job_listing_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job listing not found.")
    return {"success": True, "job": job}

@router.delete("/jobs/{job_id}")
async def remove_job_listing(job_id: str):
    """Removes a job listing from database."""
    ok = await delete_job_listing(job_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Job listing not found.")
    return {"success": True, "message": "Job listing deleted successfully."}


# =====================================================================
# 5. ATS Resume Analyzer & Job Matching
# =====================================================================

@router.post("/ats/analyze")
async def run_ats_analysis(req: ATSAnalyzeRequest):
    """
    Evaluates saved career profile against target job description using
    the deterministic 4-pillar model. Works 100% without an LLM.
    """
    profile = await get_career_profile("default")
    if not profile.get("technical_skills") and not profile.get("full_name"):
        raise HTTPException(
            status_code=400,
            detail="Career profile is empty. Please upload your CV or fill out your profile first."
        )

    job_data = {}
    if req.job_id:
        existing = await get_job_listing_by_id(req.job_id)
        if existing:
            job_data = existing
    if not job_data:
        job_data = {
            "id": f"temp_{uuid.uuid4().hex[:8]}",
            "title": req.job_title or "Target Role",
            "company": req.company or "Target Company",
            "description": req.job_description or "Python, FastAPI, Machine Learning, SQL, Git",
            "required_skills": []
        }

    evaluation = evaluate_ats_compatibility(profile, job_data)

    # Save to job_matches if it was a saved job
    if req.job_id and job_data.get("id") == req.job_id:
        await save_job_match({
            "job_id": req.job_id,
            "profile_id": "default",
            "overall_score": evaluation["overall_score"],
            "skill_score": evaluation["skill_score"],
            "matched_skills": evaluation["matched_skills"],
            "missing_skills": evaluation["missing_skills"],
            "education_score": evaluation["education_score"],
            "experience_score": evaluation["experience_score"],
            "project_score": evaluation["project_score"],
            "recommendations": evaluation["recommendations"],
            "breakdown": evaluation["breakdown"]
        })

    return {"success": True, "evaluation": evaluation}

@router.post("/ats/compare")
async def compare_jobs_side_by_side(req: ATSCompareRequest):
    """Compares up to 5 jobs side-by-side against candidate profile."""
    profile = await get_career_profile("default")
    results = []
    for jid in req.job_ids[:5]:
        job = await get_job_listing_by_id(jid)
        if job:
            eval_res = evaluate_ats_compatibility(profile, job)
            results.append({
                "job": job,
                "evaluation": eval_res
            })
    return {"success": True, "comparisons": results}


# =====================================================================
# 6. AI Resume Builder (STAR Customization)
# =====================================================================

@router.post("/resume/generate")
async def generate_customized_resume(req: ResumeGenerateRequest):
    """Generates a job-targeted resume with STAR format bullets using verified facts only."""
    profile = await get_career_profile("default")
    job = {}
    if req.job_id:
        job = await get_job_listing_by_id(req.job_id) or {}
    if not job:
        job = {
            "title": req.target_role or "AI Engineer",
            "company": req.company or "Tech Company",
            "description": req.job_description or "Python, AI, FastAPI, Machine Learning"
        }

    custom_md = build_job_specific_resume(profile, job, req.target_role)

    # Save initial version
    version_rec = await save_resume_version({
        "profile_id": "default",
        "job_id": req.job_id or "",
        "target_role": req.target_role or job.get("title", "AI Engineer"),
        "title": f"Tailored Resume - {job.get('company', 'Target')}",
        "content_md": custom_md,
        "is_active": 1
    })

    return {
        "success": True,
        "resume_version": version_rec,
        "content_md": custom_md
    }

@router.get("/resume/versions")
async def list_saved_resume_versions():
    """Lists saved resume versions."""
    versions = await list_resume_versions("default")
    return {"success": True, "versions": versions}

@router.post("/resume/save")
async def save_edited_resume_version(req: ResumeSaveRequest):
    """Saves edited content for a resume version."""
    saved = await save_resume_version({
        "profile_id": "default",
        "title": req.title,
        "target_role": req.target_role,
        "content_md": req.content_md,
        "job_id": req.job_id or ""
    })
    return {"success": True, "version": saved, "message": "Resume version saved successfully."}

@router.get("/resume/{version_id}/download/{fmt}")
async def download_resume_version(version_id: str, fmt: str):
    """Exports customized resume to DOCX, printable HTML/PDF, or Markdown."""
    ver = await get_resume_version_by_id(version_id)
    if not ver:
        raise HTTPException(status_code=404, detail="Resume version not found.")

    fmt_clean = fmt.lower().strip()
    title_slug = f"resume_{version_id}"

    if fmt_clean == "docx":
        docx_path = export_text_to_docx(ver["content_md"], f"{title_slug}.docx")
        return FileResponse(docx_path, filename=f"{title_slug}.docx", media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    elif fmt_clean in ["pdf", "html"]:
        html_path = export_text_to_printable_html(ver.get("title", "Tailored Resume"), ver["content_md"], f"{title_slug}.html")
        return FileResponse(html_path, filename=f"{title_slug}.html", media_type="text/html")
    else:
        # Plain markdown text
        return JSONResponse({"content_md": ver["content_md"]})


# =====================================================================
# 7. AI Cover Letter Generator
# =====================================================================

@router.post("/cover-letter/generate")
async def generate_cover_letter_endpoint(req: CoverLetterGenerateRequest):
    """Generates tailored cover letter with chosen tone and verified profile credentials."""
    profile = await get_career_profile("default")
    job = {}
    if req.job_id:
        job = await get_job_listing_by_id(req.job_id) or {}
    if not job:
        job = {
            "title": req.target_role or "AI Engineer",
            "company": req.company or "Target Company",
            "description": req.job_description or "Python, Machine Learning, Automation"
        }

    cl_text = build_job_cover_letter(profile, job, tone=req.tone or "Professional")

    # Persist record
    saved_cl = await save_cover_letter({
        "profile_id": "default",
        "job_id": req.job_id or "",
        "company": job.get("company", "Company"),
        "target_role": req.target_role or job.get("title", "AI Engineer"),
        "tone": req.tone or "Professional",
        "content_md": cl_text
    })

    return {"success": True, "cover_letter": saved_cl, "content_md": cl_text}

@router.get("/cover-letters")
async def list_user_cover_letters():
    """Lists saved cover letters."""
    letters = await list_cover_letters("default")
    return {"success": True, "cover_letters": letters}

@router.get("/cover-letter/{letter_id}/download/{fmt}")
async def download_cover_letter_file(letter_id: str, fmt: str):
    """Downloads cover letter in DOCX or printable HTML."""
    cl = await get_cover_letter_by_id(letter_id)
    if not cl:
        raise HTTPException(status_code=404, detail="Cover letter not found.")

    fmt_clean = fmt.lower().strip()
    title_slug = f"cover_letter_{letter_id}"

    if fmt_clean == "docx":
        docx_path = export_text_to_docx(cl["content_md"], f"{title_slug}.docx")
        return FileResponse(docx_path, filename=f"{title_slug}.docx", media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    else:
        html_path = export_text_to_printable_html(f"Cover Letter - {cl.get('company')}", cl["content_md"], f"{title_slug}.html")
        return FileResponse(html_path, filename=f"{title_slug}.html", media_type="text/html")


# =====================================================================
# 8. Job Application Assistant
# =====================================================================

@router.post("/assistant/prepare")
async def prepare_application_packet_endpoint(job_id: str = Body(..., embed=True)):
    """Prepares an application dossier with eligibility checks, custom resume, cover letter, and Q&A cheat sheet."""
    job = await get_job_listing_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    profile = await get_career_profile("default")

    packet = prepare_job_application_packet(profile, job)
    return {"success": True, "packet": packet}


# =====================================================================
# 9. Application Tracker
# =====================================================================

@router.get("/applications")
async def list_applications(status: Optional[str] = None):
    """Lists tracked job applications."""
    apps = await list_job_applications(status=status)
    return {"success": True, "applications": apps}

@router.post("/applications")
async def create_application(req: ApplicationCreateRequest):
    """Adds a new tracked application."""
    saved = await save_job_application(req.model_dump())
    return {"success": True, "application": saved, "message": "Application added to tracker."}

@router.patch("/applications/{app_id}/status")
async def update_status(app_id: str, req: ApplicationStatusUpdateRequest):
    """Updates application status with history timeline logging."""
    updated = await update_application_status(app_id, req.status, req.notes or "")
    if not updated:
        raise HTTPException(status_code=404, detail="Application not found.")
    return {"success": True, "application": updated, "message": f"Status updated to '{req.status}'."}

@router.delete("/applications/{app_id}")
async def remove_application(app_id: str):
    """Deletes application from tracker."""
    ok = await delete_job_application(app_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Application not found.")
    return {"success": True, "message": "Application removed."}

@router.get("/applications/{app_id}/history")
async def get_history(app_id: str):
    """Retrieves status progression timeline for an application."""
    hist = await get_application_history(app_id)
    return {"success": True, "history": hist}


# =====================================================================
# 10. Daily Job Alert Settings & Routine Trigger
# =====================================================================

@router.get("/alerts/settings")
async def get_alert_settings():
    """Gets daily job alert configuration."""
    settings = await get_career_alert_settings("default")
    return {"success": True, "settings": settings}

@router.post("/alerts/settings")
async def save_alert_settings_endpoint(settings: Dict[str, Any] = Body(...)):
    """Saves daily job alert configuration."""
    saved = await save_career_alert_settings(settings, "default")
    return {"success": True, "settings": saved, "message": "Alert settings saved."}

@router.post("/alerts/trigger-now")
async def trigger_alerts_now():
    """Manually triggers the daily job alert search and report immediately."""
    result = await run_daily_job_alerts()
    return {"success": True, "result": result}


# =====================================================================
# 11. Career Reports & Exports
# =====================================================================

@router.get("/reports")
async def get_career_reports():
    """Lists saved career reports."""
    reports = await list_career_reports(50)
    return {"success": True, "reports": reports}

@router.post("/reports/export-jobs")
async def export_jobs_report(fmt: str = Query("xlsx", pattern="^(xlsx|csv)$")):
    """Exports discovered jobs table to Excel or CSV."""
    jobs = await list_job_listings(limit=200)
    if fmt == "xlsx":
        path = export_jobs_to_excel(jobs, f"all_jobs_{datetime.now().strftime('%Y%m%d')}")
        return FileResponse(path, filename=path.name, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    else:
        path = export_jobs_to_csv(jobs, f"all_jobs_{datetime.now().strftime('%Y%m%d')}")
        return FileResponse(path, filename=path.name, media_type="text/csv")


# =====================================================================
# 12. Conversational Career Assistant
# =====================================================================

@router.post("/chat")
async def career_chat_endpoint(req: CareerChatRequest):
    """Responds to career chat prompts in English, Hindi, and Urdu."""
    profile = await get_career_profile("default")
    pref = await get_career_preferences("default")
    reply_data = handle_career_chat_message(req.message, profile, pref)
    return {"success": True, "reply": reply_data}
