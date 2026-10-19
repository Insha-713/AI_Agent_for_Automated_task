"""
AgentFlow - FastAPI Server with SSE Streaming & SQLite History
Serves live agent execution over Server-Sent Events (SSE) and exposes REST APIs.
"""

import os
import re
import sys
import json
import time
import uuid
import queue
import asyncio
import threading
from pathlib import Path
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Local imports
from backend.db import (
    init_db,
    create_task,
    update_task_status,
    record_task_step,
    complete_task,
    get_task_by_id,
    list_recent_tasks,
    delete_task_by_id,
    get_all_settings,
    update_setting,
    get_dashboard_metrics,
    create_approval_record,
    resolve_approval_record,
    get_approval_by_id,
    list_schedules_from_db,
    get_schedule_from_db,
    save_workflow,
    get_workflow_by_id,
    list_all_workflows,
    delete_workflow_by_id,
    delete_all_workflows,
    cleanup_stale_workflow_runs,
    deduplicate_saved_workflows,
    list_workflow_runs_by_workflow_id,
    create_monitor,
    list_all_monitors,
    get_monitor_by_id,
    delete_monitor_by_id,
    toggle_monitor_active,
    get_monitor_logs,
    get_all_templates_from_db,
    get_template_by_id_from_db,
    save_custom_template_to_db,
)
from backend.agent import stream_agent_steps, detect_ollama_model
from backend.tools import WORKSPACE_PATH
from backend.approvals import approval_manager
from backend.scheduler import (
    start_scheduler,
    shutdown_scheduler,
    add_scheduled_task,
    edit_scheduled_task,
    pause_scheduled_task,
    resume_scheduled_task,
    delete_scheduled_task,
    run_scheduled_task_now,
)
from backend.workflows import (
    generate_workflow_plan,
    WorkflowExecutionEngine,
    ACTIVE_CANCELLATIONS,
    REGISTERED_TOOLS_META,
    extract_workflow_requirements,
    process_question_answer,
    handle_chat_help_query,
)
from backend.reports import (
    load_and_clean_tabular_data,
    calculate_kpis,
    generate_charts_data,
    generate_executive_summary,
    export_report_files,
    get_available_sample_datasets,
    clean_nan_and_inf,
    REPORTS_DIR,
    SAMPLES_DIR,
)
from backend.monitors import (
    perform_health_check,
    execute_monitor_check,
    check_all_monitors_now,
    compute_monitoring_kpis,
)
from backend.integrations import (
    test_integration_by_name,
    get_all_integrations_summary,
    get_curated_workflow_templates,
)

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# App Lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database tables on startup
    await init_db()
    WORKSPACE_PATH.mkdir(parents=True, exist_ok=True)
    await start_scheduler()

    # Recovery: Mark any stale 'running' runs from crashed/restarted server as 'interrupted'
    recovery_stats = await cleanup_stale_workflow_runs()
    # Deduplicate: Clean duplicate saved workflows in SQLite
    dedup_stats = await deduplicate_saved_workflows()

    print(
        f"[Startup Recovery] Stale runs marked interrupted: {recovery_stats['interrupted_runs']}, "
        f"Workflows recovered: {recovery_stats['interrupted_workflows']}, "
        f"Duplicates merged: {dedup_stats['merged_workflows']}."
    )
    print("AgentFlow Backend & Scheduler initialized successfully.")
    yield
    shutdown_scheduler()


app = FastAPI(
    title="AgentFlow API",
    description="Free, Private, Local Autonomous AI Agent with Live SSE Streaming",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for React frontend (Vite default port 5173, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request & Response Models
class CreateTaskRequest(BaseModel):
    prompt: str = Field(..., description="The user's task prompt in English, Hindi, or Urdu")
    deep_research: bool = Field(False, description="Quick research (1 round, 3 pages) vs Deep research (3 rounds, 8 pages)")


class ApprovalDecisionRequest(BaseModel):
    decision: str = Field(..., description="'approve' or 'reject'")
    comment: Optional[str] = None


class UpdateSettingRequest(BaseModel):
    key: str
    value: str


class BulkUpdateSettingsRequest(BaseModel):
    settings: Dict[str, str]


class CreateScheduleRequest(BaseModel):
    name: str = Field(..., description="Name of the scheduled task")
    prompt: str = Field(..., description="Task instructions to execute")
    frequency: str = Field("daily", description="Schedule trigger: hourly, daily, weekly, cron, daily_8am, daily_9pm, interval_60m")
    timezone: Optional[str] = Field("Asia/Kolkata", description="Target timezone e.g. Asia/Kolkata, UTC")
    cron_expression: Optional[str] = Field("", description="Custom cron expression e.g. 0 9 * * 1-5")
    hour: Optional[int] = Field(8, description="Execution hour (0-23)")
    minute: Optional[int] = Field(0, description="Execution minute (0-59)")
    day_of_week: Optional[str] = Field("mon", description="Day of week (mon-sun)")


class UpdateScheduleRequest(BaseModel):
    name: str
    prompt: str
    frequency: str
    timezone: Optional[str] = "Asia/Kolkata"
    cron_expression: Optional[str] = ""
    hour: Optional[int] = 8
    minute: Optional[int] = 0
    day_of_week: Optional[str] = "mon"



class GenerateWorkflowRequest(BaseModel):
    prompt: str = Field(..., description="The user's workflow task prompt in English, Hindi, or Urdu")


class ExtractRequirementsRequest(BaseModel):
    prompt: str = Field(..., description="The user's task prompt in English, Hindi, or Urdu")


class AnswerQuestionRequest(BaseModel):
    session: Dict[str, Any] = Field(..., description="Current requirement extraction session state")
    field: str = Field(..., description="Field identifier of the question answered")
    answer: str = Field(..., description="User's response to the question")


class ChatHelpRequest(BaseModel):
    query: str = Field(..., description="User's setup query or question in chat")
    current_question: Optional[Dict[str, Any]] = None


class ExecuteWorkflowRequest(BaseModel):
    workflow_id: str
    plan: Optional[Dict[str, Any]] = None
    dry_run: bool = False


class DeliverTelegramRequest(BaseModel):
    message: str = Field(..., description="Message text or digest to deliver via Telegram")
    chat_id: Optional[str] = None


class AnalyzeReportRequest(BaseModel):
    filename: str = Field(..., description="Target CSV or Excel filename in workspace/ or workspace/samples/")
    focus_metric: Optional[str] = Field("", description="Optional metric or KPI to focus the analysis on")


class CreateMonitorRequest(BaseModel):
    name: str = Field(..., description="Name or label of website or API service")
    url: str = Field(..., description="Target HTTP or HTTPS URL")
    expected_status: Optional[int] = Field(200, description="Expected HTTP response code")
    timeout_seconds: Optional[int] = Field(10, ge=1, le=60)
    interval_minutes: Optional[int] = Field(30, ge=1, le=1440)
    failure_threshold: Optional[int] = Field(3, ge=1, le=10)


class SaveCustomTemplateRequest(BaseModel):
    id: Optional[str] = Field(None, description="Optional unique ID for the custom template")
    title: str = Field(..., description="Title of the custom template")
    prompt: str = Field(..., description="Task prompt")
    category: Optional[str] = Field("Custom", description="Template category")
    description: Optional[str] = Field("", description="One-line description")
    tools_used: Optional[List[str]] = Field([], description="List of tool names")
    required_credentials: Optional[List[str]] = Field([], description="Credentials needed")
    default_inputs: Optional[Dict[str, Any]] = Field({}, description="Default parameters")
    requires_approval: Optional[bool] = Field(True, description="Whether human approval is required")
    plan: Optional[Dict[str, Any]] = Field({}, description="Pre-configured plan JSON")
    icon: Optional[str] = Field("Sparkles", description="Lucide icon name")
    badge: Optional[str] = Field("My Template", description="Display badge")



# ==========================================
# REST API Endpoints
# ==========================================

@app.get("/api/health")
async def health_check():
    """Health check endpoint displaying Ollama model status and workspace details."""
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    preferred_model = os.getenv("OLLAMA_MODEL", "llama3.1")
    active_model = detect_ollama_model(base_url, preferred_model)
    
    workspace_files_count = len(list(WORKSPACE_PATH.glob("*")))
    
    return {
        "status": "healthy",
        "app": "AgentFlow",
        "ollama_base_url": base_url,
        "active_model": active_model,
        "workspace_path": str(WORKSPACE_PATH),
        "workspace_files_count": workspace_files_count,
        "server_time": time.strftime("%Y-%m-%d %H:%M:%S")
    }


@app.post("/api/tasks")
async def create_new_task(req: CreateTaskRequest):
    """
    Creates a new task in SQLite and returns its unique task_id.
    Clients can then connect to /api/tasks/{task_id}/stream to watch execution.
    """
    clean_prompt = req.prompt.strip()
    if not clean_prompt:
        raise HTTPException(status_code=400, detail="Task prompt cannot be empty.")

    task_id = str(uuid.uuid4())
    task_record = await create_task(task_id, clean_prompt, deep_research=req.deep_research)
    return task_record


@app.get("/api/tasks")
async def get_tasks(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    """Lists past task history with status, duration, and completion details."""
    tasks = await list_recent_tasks(limit=limit, offset=offset)
    return {"tasks": tasks}


@app.get("/api/tasks/{task_id}")
async def get_task_details(task_id: str):
    """Retrieves full details for a task, including all recorded steps and sources."""
    task = await get_task_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
    return task


@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str):
    """Deletes a task and its recorded steps from SQLite."""
    deleted = await delete_task_by_id(task_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
    return {"message": f"Task '{task_id}' deleted successfully.", "id": task_id}


@app.get("/api/stats")
async def get_stats():
    """Returns dashboard metrics: total tasks, success rate, tool usage, estimated time saved."""
    stats = await get_dashboard_metrics()
    return stats


@app.get("/api/settings")
async def get_settings():
    """Retrieves stored user preferences and memory."""
    settings = await get_all_settings()
    return {"settings": settings}


@app.put("/api/settings")
async def update_user_setting(req: UpdateSettingRequest):
    """Updates a single user preference or memory entry."""
    await update_setting(req.key, req.value)
    return {"message": f"Setting '{req.key}' updated successfully."}


@app.post("/api/settings")
async def bulk_update_settings(req: BulkUpdateSettingsRequest):
    """Updates multiple user memory and preferences at once."""
    for k, v in req.settings.items():
        await update_setting(k, str(v))
    all_updated = await get_all_settings()
    return {"message": "Settings updated successfully.", "settings": all_updated}


@app.get("/api/workspace/files")
async def list_workspace_files():
    """Lists all files currently in the sandboxed workspace directory."""
    files = []
    for p in WORKSPACE_PATH.rglob("*"):
        if p.is_file():
            rel = str(p.relative_to(WORKSPACE_PATH))
            size = p.stat().st_size
            mtime = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(p.stat().st_mtime))
            files.append({
                "name": rel,
                "size_bytes": size,
                "size_kb": round(size / 1024, 2),
                "modified": mtime
            })
    return {"files": files, "count": len(files)}


@app.post("/api/workspace/upload")
async def upload_workspace_file(file: UploadFile = File(...)):
    """Uploads a PDF, TXT, CSV, MD, or JSON document into the sandboxed workspace."""
    filename = Path(file.filename or "uploaded_file.txt").name
    filename = os.path.basename(filename)
    if not filename or filename.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid file name.")

    allowed_exts = {".txt", ".pdf", ".csv", ".md", ".json", ".py", ".html", ".log", ".doc", ".docx"}
    ext = Path(filename).suffix.lower()
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"File extension '{ext}' not supported. Allowed: {', '.join(sorted(allowed_exts))}"
        )

    target_path = (WORKSPACE_PATH / filename).resolve()
    if not str(target_path).startswith(str(WORKSPACE_PATH.resolve())):
        raise HTTPException(status_code=403, detail="Access denied: path outside workspace.")

    try:
        content = await file.read()
        target_path.write_bytes(content)
        size = len(content)
        return {
            "success": True,
            "filename": filename,
            "size_bytes": size,
            "size_kb": round(size / 1024, 2),
            "message": f"File '{filename}' successfully saved to workspace."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")


@app.delete("/api/workspace/files/{filename}")
async def delete_workspace_file(filename: str):
    """Deletes a file from the sandboxed workspace directory."""
    safe_name = os.path.basename(filename)
    target_path = (WORKSPACE_PATH / safe_name).resolve()

    if not str(target_path).startswith(str(WORKSPACE_PATH.resolve())):
        raise HTTPException(status_code=403, detail="Access denied: path outside workspace.")

    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=404, detail=f"File '{safe_name}' not found.")

    try:
        target_path.unlink()
        return {"success": True, "message": f"File '{safe_name}' deleted.", "filename": safe_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")


@app.get("/api/workspace/files/{filename}/preview")
async def preview_workspace_file(filename: str):
    """Returns preview text for a workspace file (PDF or text)."""
    from backend.tools import read_file
    preview = read_file.func(filename)
    return {"filename": filename, "content": preview[:2500]}


@app.get("/api/workspace/files/{filename}/download")
async def download_workspace_file(filename: str):
    """Safely downloads a generated file from the workspace/ directory."""
    from fastapi.responses import FileResponse
    safe_name = os.path.basename(filename)
    target = (WORKSPACE_PATH / safe_name).resolve()
    if not str(target).startswith(str(WORKSPACE_PATH.resolve())) or not target.exists():
        raise HTTPException(status_code=404, detail=f"Workspace file '{safe_name}' not found.")
    return FileResponse(
        path=target,
        filename=safe_name,
        media_type="application/octet-stream"
    )


# ==========================================
# Scheduled Tasks Endpoints (APScheduler)
# ==========================================

@app.get("/api/schedules")
async def list_schedules():
    """Lists all active and paused recurring schedules."""
    schedules = await list_schedules_from_db()
    return {"schedules": schedules}


@app.post("/api/schedules")
async def create_schedule(req: CreateScheduleRequest):
    """Creates a new recurring schedule in APScheduler and SQLite with timezone and custom cron support."""
    record = await add_scheduled_task(
        name=req.name,
        prompt=req.prompt,
        frequency=req.frequency,
        timezone_str=req.timezone or "Asia/Kolkata",
        cron_expression=req.cron_expression or "",
        hour=req.hour if req.hour is not None else 8,
        minute=req.minute if req.minute is not None else 0,
        day_of_week=req.day_of_week or "mon"
    )
    return record


@app.put("/api/schedules/{schedule_id}")
async def update_schedule(schedule_id: str, req: UpdateScheduleRequest):
    """Edits an existing recurring schedule in APScheduler and SQLite."""
    success = await edit_scheduled_task(
        schedule_id=schedule_id,
        name=req.name,
        prompt=req.prompt,
        frequency=req.frequency,
        timezone_str=req.timezone or "Asia/Kolkata",
        cron_expression=req.cron_expression or "",
        hour=req.hour if req.hour is not None else 8,
        minute=req.minute if req.minute is not None else 0,
        day_of_week=req.day_of_week or "mon"
    )
    if not success:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    updated = await get_schedule_from_db(schedule_id)
    return {"message": "Schedule updated successfully.", "id": schedule_id, "schedule": updated}



@app.post("/api/schedules/{schedule_id}/pause")
async def pause_schedule(schedule_id: str):
    """Pauses a recurring schedule."""
    success = await pause_scheduled_task(schedule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    return {"message": "Schedule paused successfully.", "id": schedule_id, "status": "paused"}


@app.post("/api/schedules/{schedule_id}/resume")
async def resume_schedule(schedule_id: str):
    """Resumes a paused recurring schedule."""
    success = await resume_scheduled_task(schedule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    return {"message": "Schedule resumed successfully.", "id": schedule_id, "status": "active"}


@app.delete("/api/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str):
    """Deletes a recurring schedule."""
    success = await delete_scheduled_task(schedule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    return {"message": "Schedule deleted successfully.", "id": schedule_id}


@app.post("/api/schedules/{schedule_id}/run-now")
async def trigger_schedule_now(schedule_id: str):
    """Manually triggers an immediate run of a scheduled task."""
    success = await run_scheduled_task_now(schedule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    return {"message": "Scheduled task triggered immediately in background.", "id": schedule_id}


# ==========================================
# AI News & Telegram Delivery Endpoints (Stage 3)
# ==========================================

from backend.news_module import generate_daily_ai_news_digest, deliver_news_to_telegram

@app.get("/api/news/digest")
async def get_news_digest(
    topic: str = Query("AI in India", description="News search topic"),
    include_arxiv: bool = Query(True, description="Include arXiv AI preprints"),
    max_stories: int = Query(6, ge=1, le=15)
):
    """Compiles and deduplicates latest news across feeds with verified publish dates."""
    digest = await asyncio.to_thread(
        generate_daily_ai_news_digest,
        topic=topic,
        include_arxiv=include_arxiv,
        max_stories=max_stories
    )
    return digest


@app.post("/api/news/deliver-telegram")
async def send_digest_to_telegram(req: DeliverTelegramRequest):
    """Delivers the formatted news digest or report to Telegram."""
    result = await asyncio.to_thread(
        deliver_news_to_telegram,
        digest_text=req.message,
        chat_id=req.chat_id
    )
    return result


# ==========================================
# CSV & Excel Reports Engine Endpoints (Stage 4)
# ==========================================

@app.get("/api/reports/samples")
async def get_report_samples():
    """Returns preloaded sample datasets for immediate testing (E-Commerce, Placements, Expenses)."""
    samples = get_available_sample_datasets()
    return {"samples": samples}


@app.post("/api/reports/analyze")
async def analyze_report_endpoint(req: AnalyzeReportRequest):
    """Analyzes a CSV or Excel file: cleans data, calculates KPIs, generates Recharts data, and exports Excel/CSV/MD reports."""
    try:
        clean_file = req.filename.strip().lstrip("/\\")
        data = await asyncio.to_thread(load_and_clean_tabular_data, clean_file)
        kpis = await asyncio.to_thread(calculate_kpis, data)
        charts = await asyncio.to_thread(generate_charts_data, data, kpis)
        summary = await asyncio.to_thread(generate_executive_summary, data["file_name"], data, kpis, req.focus_metric)
        exports = await asyncio.to_thread(export_report_files, data["file_name"], data, kpis, summary)

        response_payload = {
            "status": "success",
            "file_name": data["file_name"],
            "row_count": data["row_count"],
            "column_count": data["column_count"],
            "columns": data["columns"],
            "column_types": data["column_types"],
            "missing_counts": data["missing_counts"],
            "kpis": kpis,
            "charts": charts,
            "summary_markdown": summary,
            "exports": exports,
            "records_preview": data["records"][:25],
        }
        clean_payload = clean_nan_and_inf(response_payload)
        return JSONResponse(status_code=200, content=clean_payload)
    except FileNotFoundError as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=404,
            content={
                "error": f"Dataset file not found: {str(e)}",
                "hint": "Please select a valid preloaded dataset or upload a new file from your computer."
            }
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=400,
            content={
                "error": f"Failed to analyze dataset '{req.filename}': {str(e)}",
                "hint": "Please verify that the file contains tabular rows with valid column headers and delimiter."
            }
        )


@app.post("/api/reports/upload")
async def upload_and_analyze_report(file: UploadFile = File(...)):
    """Uploads a CSV or Excel file to workspace/ and immediately runs full analysis."""
    allowed = [".csv", ".xlsx", ".xls", ".tsv"]
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed:
        return JSONResponse(
            status_code=400,
            content={
                "error": f"Unsupported file extension '{ext}'.",
                "hint": f"Allowed formats are {', '.join(allowed)}."
            }
        )

    safe_name = re.sub(r"[^\w\-.]", "_", file.filename)
    dest_path = WORKSPACE_PATH / safe_name
    try:
        content = await file.read()
        if not content:
            return JSONResponse(
                status_code=400,
                content={
                    "error": "The uploaded file is empty (0 bytes).",
                    "hint": "Please upload a CSV or Excel file with data rows."
                }
            )

        with open(dest_path, "wb") as f:
            f.write(content)

        data = await asyncio.to_thread(load_and_clean_tabular_data, dest_path)
        kpis = await asyncio.to_thread(calculate_kpis, data)
        charts = await asyncio.to_thread(generate_charts_data, data, kpis)
        summary = await asyncio.to_thread(generate_executive_summary, data["file_name"], data, kpis)
        exports = await asyncio.to_thread(export_report_files, data["file_name"], data, kpis, summary)

        response_payload = {
            "status": "success",
            "file_name": data["file_name"],
            "row_count": data["row_count"],
            "column_count": data["column_count"],
            "columns": data["columns"],
            "column_types": data["column_types"],
            "missing_counts": data["missing_counts"],
            "kpis": kpis,
            "charts": charts,
            "summary_markdown": summary,
            "exports": exports,
            "records_preview": data["records"][:25],
        }
        clean_payload = clean_nan_and_inf(response_payload)
        return JSONResponse(status_code=200, content=clean_payload)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=400,
            content={
                "error": f"Failed to process uploaded file: {str(e)}",
                "hint": "Please ensure the uploaded CSV or Excel file is properly formatted and non-empty."
            }
        )


@app.get("/api/reports/download/{filename}")
async def download_report_file(filename: str):
    """Safely streams generated report files (.xlsx, .csv, .md) for user download."""
    from fastapi.responses import FileResponse
    clean_name = filename.strip().lstrip("/\\")
    target = (REPORTS_DIR / clean_name).resolve()
    if not str(target).startswith(str(REPORTS_DIR)) or not target.exists():
        target = (WORKSPACE_PATH / clean_name).resolve()
        if not str(target).startswith(str(WORKSPACE_PATH)) or not target.exists():
            raise HTTPException(status_code=404, detail=f"Report file '{filename}' not found.")

    return FileResponse(
        path=target,
        filename=target.name,
        media_type="application/octet-stream"
    )


# ==========================================
# Website Monitoring Endpoints (Stage 5)
# ==========================================

@app.get("/api/monitors")
async def get_all_monitors_endpoint():
    """Retrieves all website monitors, their latest check status, and system-wide health KPIs."""
    monitors = await list_all_monitors()
    kpis = compute_monitoring_kpis(monitors)
    return {
        "monitors": monitors,
        "kpis": kpis,
        "count": len(monitors)
    }


@app.post("/api/monitors")
async def create_monitor_endpoint(req: CreateMonitorRequest):
    """Creates a new website monitor and immediately triggers an initial check."""
    monitor_id = f"mon-{uuid.uuid4().hex[:8]}"
    created = await create_monitor(
        monitor_id=monitor_id,
        name=req.name.strip(),
        url=req.url.strip(),
        expected_status=req.expected_status or 200,
        timeout_seconds=req.timeout_seconds or 10,
        interval_minutes=req.interval_minutes or 30,
        failure_threshold=req.failure_threshold or 3
    )
    # Run immediate initial health probe
    check_result = await execute_monitor_check(created)
    fresh_monitor = await get_monitor_by_id(monitor_id)
    return {
        "status": "success",
        "monitor": fresh_monitor,
        "initial_check": check_result
    }


@app.post("/api/monitors/{monitor_id}/check")
async def check_single_monitor_endpoint(monitor_id: str):
    """Triggers an immediate live uptime and latency probe for a specific monitor."""
    monitor = await get_monitor_by_id(monitor_id)
    if not monitor:
        raise HTTPException(status_code=404, detail=f"Monitor '{monitor_id}' not found.")
    result = await execute_monitor_check(monitor)
    fresh_monitor = await get_monitor_by_id(monitor_id)
    return {
        "status": "success",
        "monitor": fresh_monitor,
        "check": result
    }


@app.post("/api/monitors/check-all")
async def check_all_monitors_endpoint():
    """Triggers health probes across all active monitors in parallel."""
    results = await check_all_monitors_now()
    monitors = await list_all_monitors()
    kpis = compute_monitoring_kpis(monitors)
    return {
        "status": "success",
        "results": results,
        "kpis": kpis,
        "monitors": monitors
    }


@app.post("/api/monitors/{monitor_id}/toggle")
async def toggle_monitor_endpoint(monitor_id: str):
    """Pauses or resumes automatic monitoring for a target."""
    monitor = await get_monitor_by_id(monitor_id)
    if not monitor:
        raise HTTPException(status_code=404, detail=f"Monitor '{monitor_id}' not found.")
    new_state = not bool(monitor.get("is_active", 1))
    await toggle_monitor_active(monitor_id, new_state)
    return {
        "status": "success",
        "monitor_id": monitor_id,
        "is_active": 1 if new_state else 0
    }


@app.delete("/api/monitors/{monitor_id}")
async def delete_monitor_endpoint(monitor_id: str):
    """Deletes a website monitor and all associated check logs."""
    deleted = await delete_monitor_by_id(monitor_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Monitor '{monitor_id}' not found.")
    return {"status": "success", "deleted_id": monitor_id}


@app.get("/api/monitors/{monitor_id}/logs")
async def get_monitor_logs_endpoint(monitor_id: str, limit: int = Query(30, ge=5, le=100)):
    """Retrieves chronological check logs for latency sparklines and uptime trends."""
    monitor = await get_monitor_by_id(monitor_id)
    if not monitor:
        raise HTTPException(status_code=404, detail=f"Monitor '{monitor_id}' not found.")
    logs = await get_monitor_logs(monitor_id, limit=limit)
    return {
        "monitor_id": monitor_id,
        "name": monitor["name"],
        "logs": logs
    }


# ==========================================
# Integrations Hub & Templates Endpoints (Stage 6)
# ==========================================

@app.get("/api/integrations/status")
async def get_integrations_status_endpoint():
    """Returns real-time connection status across all services (Ollama, Telegram, Gmail, DDG, News, Workspace)."""
    summary = await asyncio.to_thread(get_all_integrations_summary)
    return summary


@app.post("/api/integrations/test/{service_name}")
async def test_integration_endpoint(service_name: str):
    """Triggers an isolated live handshake test for a specific integration service."""
    res = await asyncio.to_thread(test_integration_by_name, service_name)
    return res


@app.get("/api/templates")
async def get_templates_endpoint():
    """Lists preloaded and user-created workflow templates from SQLite (with built-in fallback)."""
    try:
        templates = await get_all_templates_from_db()
        return {"templates": templates, "count": len(templates)}
    except Exception as e:
        print(f"[GET /api/templates Error] {e}")
        templates = get_curated_workflow_templates()
        return {"templates": templates, "count": len(templates)}


@app.get("/api/templates/{template_id}")
async def get_single_template_endpoint(template_id: str):
    """Retrieves a single workflow template by ID."""
    tpl = await get_template_by_id_from_db(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found.")
    return tpl


@app.post("/api/templates")
async def save_custom_template_endpoint(req: SaveCustomTemplateRequest):
    """Saves a user workflow as a reusable custom template in SQLite."""
    try:
        saved_tpl = await save_custom_template_to_db(req.dict())
        return {
            "status": "success",
            "message": f"Template '{req.title}' saved successfully.",
            "template": saved_tpl
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to save custom template: {str(e)}")


@app.get("/api/workflows/templates")
async def get_workflow_templates_endpoint():
    """Backwards-compatible alias for GET /api/templates."""
    try:
        templates = await get_all_templates_from_db()
        return {"templates": templates, "count": len(templates)}
    except Exception:
        templates = get_curated_workflow_templates()
        return {"templates": templates, "count": len(templates)}


@app.post("/api/workflows/from-template/{template_id}")
async def instantiate_workflow_from_template(template_id: str):
    """Clones a curated template into SQLite as a persistent runnable workflow."""
    target_tpl = await get_template_by_id_from_db(template_id)
    if not target_tpl:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found.")

    new_wf_id = f"wf-{uuid.uuid4().hex[:8]}"
    plan_data = target_tpl.get("plan", target_tpl.get("plan_json", {}))
    record = await save_workflow(
        workflow_id=new_wf_id,
        title=target_tpl["title"],
        prompt=target_tpl["prompt"],
        plan_json=json.dumps(plan_data)
    )
    return {
        "status": "success",
        "workflow_id": record["id"],
        "workflow": record,
        "plan": plan_data,
        "message": f"Successfully cloned template '{target_tpl['title']}'."
    }


@app.post("/api/approvals/{approval_id}")
async def resolve_approval_endpoint(approval_id: str, req: ApprovalDecisionRequest):
    """Resolves a human-in-the-loop approval request with 'approve' or 'reject'."""
    decision = req.decision.lower().strip()
    if decision not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Decision must be 'approve' or 'reject'.")

    success = approval_manager.resolve_approval(approval_id, decision)
    await resolve_approval_record(approval_id, decision)

    if not success:
        raise HTTPException(status_code=404, detail="Approval request not found or expired.")

    return {"status": "success", "approval_id": approval_id, "decision": decision}


@app.get("/api/approvals/{approval_id}")
async def get_approval_endpoint(approval_id: str):
    """Retrieves metadata for a human-in-the-loop approval request."""
    appr = approval_manager.get_pending_approval(approval_id)
    if not appr:
        appr = await get_approval_by_id(approval_id)
    if not appr:
        raise HTTPException(status_code=404, detail="Approval request not found.")
    return appr


# ==========================================
# Prompt-to-Workflow Engine Endpoints (Stage 1)
# ==========================================

@app.get("/api/workflows/tools")
async def list_registered_tools():
    """Lists all registered tools with metadata, parameter specs, and required credentials."""
    tools_list = []
    for tool_name, meta in REGISTERED_TOOLS_META.items():
        tools_list.append({
            "tool": tool_name,
            "display_name": meta["display_name"],
            "description": meta["description"],
            "params": meta["params"],
            "requires_approval": meta["requires_approval"],
            "required_credentials": meta["required_credentials"]
        })
    return {"tools": tools_list, "count": len(tools_list)}


@app.post("/api/workflows/generate")
async def generate_workflow(req: GenerateWorkflowRequest):
    """Generates a structured, validated JSON workflow plan from user natural language prompt."""
    try:
        user_prefs = await get_all_settings()
        plan = await generate_workflow_plan(req.prompt, preferences=user_prefs)
        return plan
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/workflows/extract-requirements")
async def extract_requirements_endpoint(req: ExtractRequirementsRequest):
    """
    Stage 1 Conversational Workflow Builder:
    Extracts high-level goal, schedule/trigger, registered tools needed,
    known inputs, and formulates a ONE-at-a-time interactive question queue.
    """
    try:
        user_prefs = await get_all_settings()
        reqs = await extract_workflow_requirements(req.prompt, user_context=user_prefs)
        return reqs
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/workflows/answer-question")
async def answer_question_endpoint(req: AnswerQuestionRequest):
    """
    Processes the user's answer to the active question in the Questions panel,
    updates collected inputs, and returns the next question or completion state.
    """
    try:
        updated_session = process_question_answer(req.session, req.field, req.answer)
        return updated_session
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/workflows/chat-help")
async def chat_help_endpoint(req: ChatHelpRequest):
    """
    Provides conversational assistance or setup guidance for integrations
    without interrupting the pending question queue in the Questions panel.
    """
    reply = handle_chat_help_query(req.query, req.current_question)
    return {"reply": reply}


@app.get("/api/workflows")
async def get_all_workflows(
    limit: int = Query(100, ge=1, le=200),
    status: Optional[str] = Query(None, description="Filter by status: completed, partial, failed, interrupted, draft"),
    search: Optional[str] = Query(None, description="Search workflows by title or prompt")
):
    """Lists saved workflows from SQLite with status and search filters."""
    workflows = await list_all_workflows(limit=limit, status=status, search=search)
    return {"workflows": workflows, "count": len(workflows)}


@app.post("/api/workflows/deduplicate")
async def deduplicate_workflows_endpoint():
    """Finds workflows with identical prompts, merges runs, and eliminates duplicate entries."""
    stats = await deduplicate_saved_workflows()
    return {
        "status": "success",
        "message": f"Deduplication complete: Merged {stats['merged_workflows']} redundant workflow entries.",
        "stats": stats
    }


@app.delete("/api/workflows")
async def clear_all_workflows_endpoint(status: Optional[str] = Query(None)):
    """Deletes all saved workflows or those matching a specified status."""
    deleted_count = await delete_all_workflows(status=status)
    return {
        "status": "success",
        "message": f"Deleted {deleted_count} workflow(s).",
        "deleted_count": deleted_count
    }


@app.get("/api/workflows/{workflow_id}")
async def get_workflow_details(workflow_id: str):
    """Retrieves full workflow details and past execution runs."""
    wf = await get_workflow_by_id(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found.")
    runs = await list_workflow_runs_by_workflow_id(workflow_id)
    wf_dict = dict(wf)
    try:
        wf_dict["plan"] = json.loads(wf_dict["plan_json"])
    except Exception:
        wf_dict["plan"] = {}
    wf_dict["runs"] = runs
    return wf_dict


@app.delete("/api/workflows/{workflow_id}")
async def delete_workflow(workflow_id: str):
    """Deletes a workflow and all associated runs from SQLite."""
    deleted = await delete_workflow_by_id(workflow_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found.")
    return {"message": f"Workflow '{workflow_id}' deleted successfully.", "id": workflow_id}


@app.post("/api/workflows/{workflow_id}/cancel")
async def cancel_workflow_execution(workflow_id: str):
    """Cancels a currently active workflow execution."""
    ACTIVE_CANCELLATIONS.add(workflow_id)
    return {"message": f"Cancellation requested for workflow '{workflow_id}'."}


@app.get("/api/workflows/{workflow_id}/stream")
async def stream_workflow_execution(workflow_id: str, dry_run: bool = Query(False)):
    """
    Streams live step-by-step workflow execution over Server-Sent Events (SSE).
    """
    wf = await get_workflow_by_id(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found.")

    try:
        plan = json.loads(wf["plan_json"])
    except Exception:
        raise HTTPException(status_code=500, detail="Invalid stored workflow plan JSON.")

    engine = WorkflowExecutionEngine(workflow_id, plan, dry_run=dry_run)

    async def sse_generator():
        try:
            async for event in engine.stream_workflow():
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as err:
            err_payload = {"type": "error", "error": str(err), "workflow_id": workflow_id}
            yield f"data: {json.dumps(err_payload)}\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


# ==========================================
# SSE Streaming Endpoint (Live Agent Brain)
# ==========================================

async def sse_task_generator(task_id: str, prompt: str, deep_research: bool = False):
    """
    Executes the agent in a background thread, streams live steps via SSE,
    and simultaneously persists each step into SQLite.
    """
    start_time = time.time()
    await update_task_status(task_id, "running")

    # Fetch stored user preferences and memory
    user_prefs = await get_all_settings()

    step_queue: queue.Queue = queue.Queue()

    def approval_listener(event_data):
        step_queue.put(event_data)

    approval_manager.register_listener(approval_listener)

    def run_agent_in_thread():
        try:
            for step in stream_agent_steps(prompt, preferences=user_prefs, deep_research=deep_research):
                step_queue.put(step)
        except Exception as err:
            step_queue.put({"type": "error", "error": str(err)})
        finally:
            step_queue.put(None)  # Sentinel to denote completion

    thread = threading.Thread(target=run_agent_in_thread, daemon=True)
    thread.start()

    loop = asyncio.get_running_loop()
    step_index = 0
    final_answer = ""
    collected_sources: List[str] = []
    task_status = "completed"

    try:
        while True:
            # Non-blocking pull from thread queue
            step = await loop.run_in_executor(None, step_queue.get)
            
            if step is None:
                # Agent run finished
                break

            step_index += 1
            stype = step.get("type", "unknown")
            step["step_index"] = step_index
            step["task_id"] = task_id

            # Save step to SQLite
            tool_name = step.get("tool", "")
            content = step.get("content") or step.get("result") or step.get("message") or step.get("details") or json.dumps(step.get("args") or {})
            
            await record_task_step(
                task_id=task_id,
                step_index=step_index,
                step_type=stype,
                tool_name=tool_name,
                content=str(content)
            )

            if stype == "approval_required":
                await create_approval_record(
                    approval_id=step.get("approval_id", ""),
                    task_id=task_id,
                    action_type=step.get("action_type", ""),
                    tool_name=step.get("tool", ""),
                    parameters=step.get("args") or {},
                    details=step.get("details", "")
                )

            elif stype == "final_answer":
                final_answer = step.get("content", "")
                collected_sources = step.get("sources", [])

            elif stype == "error":
                task_status = "failed"
                final_answer = step.get("error", "An error occurred.")

            # Format as standard Server-Sent Event
            sse_data = f"data: {json.dumps(step)}\n\n"
            yield sse_data

        # Final completion event
        duration = round(time.time() - start_time, 2)
        await complete_task(
            task_id=task_id,
            status=task_status,
            final_answer=final_answer,
            sources=collected_sources,
            duration_seconds=duration
        )

        done_payload = {
            "type": "done",
            "task_id": task_id,
            "status": task_status,
            "duration_seconds": duration,
            "sources": collected_sources
        }
        yield f"data: {json.dumps(done_payload)}\n\n"

    except Exception as e:
        duration = round(time.time() - start_time, 2)
        await complete_task(
            task_id=task_id,
            status="failed",
            final_answer=str(e),
            sources=[],
            duration_seconds=duration
        )
        err_payload = {"type": "error", "error": str(e), "task_id": task_id}
        yield f"data: {json.dumps(err_payload)}\n\n"

    finally:
        approval_manager.unregister_listener(approval_listener)


@app.get("/api/tasks/{task_id}/stream")
async def stream_task_events(task_id: str, deep_research: Optional[bool] = Query(None)):
    """
    Server-Sent Events endpoint streaming the agent's live brain timeline:
    Thinking -> Tool Call -> Tool Result -> Final Answer.
    If the task was already completed, replays its recorded steps.
    """
    existing_task = await get_task_by_id(task_id)
    if not existing_task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")

    # If task already completed or failed, replay from SQLite
    if existing_task["status"] in ("completed", "failed"):
        async def replay_generator():
            for s in existing_task.get("steps", []):
                payload = {
                    "type": s["step_type"],
                    "step_index": s["step_index"],
                    "tool": s["tool_name"],
                    "content": s["content"],
                    "created_at": s["created_at"],
                    "task_id": task_id
                }
                yield f"data: {json.dumps(payload)}\n\n"
            
            done_payload = {
                "type": "done",
                "task_id": task_id,
                "status": existing_task["status"],
                "duration_seconds": existing_task["duration_seconds"],
                "sources": existing_task["sources"],
                "final_answer": existing_task["final_answer"]
            }
            yield f"data: {json.dumps(done_payload)}\n\n"

        return StreamingResponse(
            replay_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )

    # Determine deep_research mode
    is_deep = deep_research if deep_research is not None else bool(existing_task.get("deep_research", 0))

    # Otherwise stream live execution
    return StreamingResponse(
        sse_task_generator(task_id, existing_task["prompt"], deep_research=is_deep),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Mount built React frontend (SPA) if dist exists
DIST_DIR = PROJECT_ROOT / "frontend" / "dist"
if DIST_DIR.exists():
    assets_dir = DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        target_file = DIST_DIR / full_path
        if target_file.is_file():
            return FileResponse(target_file)
        return FileResponse(
            DIST_DIR / "index.html",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "127.0.0.1")
    print(f"Starting AgentFlow Backend on http://{host}:{port}")
    uvicorn.run("backend.main:app", host=host, port=port, reload=True)
import os
from dotenv import load_dotenv

import os
from pathlib import Path
from dotenv import load_dotenv

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"

loaded = load_dotenv(dotenv_path=ENV_FILE, override=True)

print("Env file exists:", ENV_FILE.is_file())
print("Env file loaded:", loaded)
print("Telegram token configured:", bool(os.getenv("TELEGRAM_BOT_TOKEN")))
print("Telegram chat ID configured:", bool(os.getenv("TELEGRAM_CHAT_ID")))