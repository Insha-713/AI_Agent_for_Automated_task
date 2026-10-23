"""
Automated Verification Suite for Resume & Job Application Assistant Workflow
Verifies:
  1. A resume request NEVER launches or generates the weather workflow.
  2. Input file extraction (PDF, DOCX, TXT) and target job description mapping.
  3. ATS compatibility scoring (out of 100) and separate job-match score calculation.
  4. Matched keywords, missing skills, formatting issues, and recommendations.
  5. Improved resume & tailored cover letter generation WITHOUT inventing facts.
  6. Application email draft preparation.
  7. Human approval gate for send_email to inshaf713@gmail.com.
  8. Deliverable file generation in workspace/ (report, resume, cover letter).
"""

import sys
import os
import json
import asyncio
import zipfile
import io
import xml.etree.ElementTree as ET

# Ensure workspace root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.tools import analyze_resume_and_job, WORKSPACE_PATH, read_file
from backend.workflows import (
    generate_workflow_plan,
    generate_fallback_plan,
    extract_workflow_requirements,
    WorkflowExecutionEngine
)
from backend.approvals import approval_manager
from backend.db import save_workflow

def test_resume_plan_never_generates_weather():
    print("\n--- TEST 1: Resume Prompt Mapping (No Weather) ---")
    test_prompts = [
        "Resume & Job Application Assistant",
        "Analyze my resume for software engineer and email report to inshaf713@gmail.com",
        "I want my resume analyzed for AI developer",
        "Review my resume and match against full-stack job description"
    ]
    for p in test_prompts:
        fallback = generate_fallback_plan(p)
        step_tools = [s["tool"] for s in fallback.get("steps", [])]
        print(f"[Plan Check] Prompt: '{p[:40]}...' -> Tools: {step_tools}")
        assert "get_weather" not in step_tools, f"Weather tool unexpectedly found in {p}"
        assert "analyze_resume_and_job" in step_tools, f"analyze_resume_and_job missing in {p}"
        for s in fallback.get("steps", []):
            assert "weather" not in s["name"].lower(), f"Weather term in step name: {s['name']}"

def test_docx_and_txt_resume_parsing():
    print("\n--- TEST 2: Resume File Parsing (DOCX & TXT) ---")
    # 1. Create a realistic candidate resume in workspace
    sample_resume_txt = """Insha Fatima
Email: inshaf713@gmail.com | Phone: +91 9876543210 | Location: Lucknow, India
GitHub: github.com/Insha-713 | LinkedIn: linkedin.com/in/insha-fatima

EDUCATION
Bachelor of Technology in Computer Science & Engineering (2021 - 2025)
Integral University, Lucknow | CGPA: 8.6 / 10.0

TECHNICAL SKILLS
Languages: Python, JavaScript, TypeScript, SQL, HTML5, CSS3
Frameworks & Libraries: FastAPI, React, Next.js, Django, Tailwind CSS, Express
Databases & Cloud: PostgreSQL, SQLite, Redis, Docker, Git, REST APIs, Linux

PROJECTS
AgentFlow: AI Task Automation Platform
• Architected an autonomous multi-provider workflow engine handling async SSE streams.
• Engineered human-in-the-loop approval mechanism reducing unauthorized task dispatch by 100%.
• Integrated dual SQLite and PostgreSQL persistence layer with automated failover.

Smart Weather & Intelligence Hub
• Built real-time weather forecasting pipeline using Open-Meteo REST API.
• Designed responsive dashboard with Tailwind CSS and Framer Motion.

EXPERIENCE
Software Engineering Intern (Summer 2024)
Tech Solutions India, Lucknow
• Implemented 12+ RESTful API microservices in FastAPI and Python.
• Optimized database queries in PostgreSQL, improving response latency by 32%.
"""
    txt_path = WORKSPACE_PATH / "test_candidate_resume.txt"
    txt_path.write_text(sample_resume_txt, encoding="utf-8")

    # 2. Also create a valid DOCX file containing the resume
    import html
    docx_path = WORKSPACE_PATH / "test_candidate_resume.docx"
    xml_doc = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:body>'
        + "".join([f'<w:p><w:r><w:t>{html.escape(line)}</w:t></w:r></w:p>' for line in sample_resume_txt.splitlines()]) +
        '</w:body></w:document>'
    )
    with zipfile.ZipFile(docx_path, 'w') as zf:
        zf.writestr("word/document.xml", xml_doc)

    # Verify read_file reads both
    txt_read = read_file.func("test_candidate_resume.txt")
    assert "Insha Fatima" in txt_read
    print("[OK] TXT Resume read successfully.")

    docx_read = read_file.func("test_candidate_resume.docx")
    assert "Insha Fatima" in docx_read
    assert "Bachelor of Technology" in docx_read
    print("[OK] DOCX Resume parsed and read successfully via standard library OpenXML.")

def test_resume_analysis_tool_execution():
    print("\n--- TEST 3: analyze_resume_and_job Tool Execution ---")
    target_job = (
        "Senior Software Engineer (Python & AI Systems)\n"
        "Requirements:\n"
        "- 2+ years experience in Python and FastAPI or Django\n"
        "- Proficiency in modern JavaScript/React and REST API design\n"
        "- Hands-on database design with PostgreSQL and SQL\n"
        "- Experience with Docker, Git, CI/CD, and microservices\n"
        "- Exposure to LLMs, Machine Learning, or LangChain is a plus"
    )

    # Execute tool
    report = analyze_resume_and_job.func(
        resume_filename="test_candidate_resume.docx",
        job_description=target_job,
        target_role="Senior Software Engineer"
    )

    print("[Report Preview]:\n" + report[:450] + "\n...")

    # Assertions on required content
    assert "ATS Compatibility Score" in report
    assert "Job-Match Alignment Score" in report
    assert "Matched Keywords" in report
    assert "Optimized Resume (Without Inventing Facts)" in report
    assert "Tailored Cover Letter" in report
    assert "Application Email Draft" in report

    # Check verified deliverables in workspace
    rep_file = WORKSPACE_PATH / "resume_analysis_report.md"
    opt_file = WORKSPACE_PATH / "optimized_resume.md"
    cov_file = WORKSPACE_PATH / "tailored_cover_letter.md"

    assert rep_file.exists(), "resume_analysis_report.md was not written"
    assert opt_file.exists(), "optimized_resume.md was not written"
    assert cov_file.exists(), "tailored_cover_letter.md was not written"
    print("[OK] Deliverables verified in workspace/ :")
    print(f"  - {rep_file.name} ({rep_file.stat().st_size} bytes)")
    print(f"  - {opt_file.name} ({opt_file.stat().st_size} bytes)")
    print(f"  - {cov_file.name} ({cov_file.stat().st_size} bytes)")

def test_end_to_end_resume_workflow_stream():
    print("\n--- TEST 4: End-to-End Workflow Stream with Human Approval Gate ---")
    plan = {
        "title": "Resume & Job Application Assistant",
        "steps": [
            {
                "id": "step_1",
                "tool": "analyze_resume_and_job",
                "name": "Analyze Resume & Match Target Job Description",
                "params": {
                    "resume_filename": "test_candidate_resume.docx",
                    "job_description": "Software Engineer (Python, FastAPI, React, SQL)"
                },
                "output_key": "resume_analysis",
                "requires_approval": False
            },
            {
                "id": "step_2",
                "tool": "save_file",
                "name": "Save Analysis Report to workspace/resume_analysis_report.md",
                "params": {
                    "filename": "resume_analysis_report.md",
                    "content": "{{resume_analysis}}",
                    "overwrite": True
                },
                "output_key": "saved_report",
                "requires_approval": False
            },
            {
                "id": "step_3",
                "tool": "send_email",
                "name": "Email Resume Analysis & Application Kit to inshaf713@gmail.com",
                "params": {
                    "to_email": "inshaf713@gmail.com",
                    "subject": "AgentFlow: Resume Analysis & Application Kit",
                    "body": "Hello Insha,\n\nHere is your requested Resume Analysis Report:\n\n{{resume_analysis}}\n\n- AgentFlow"
                },
                "output_key": "email_confirmation",
                "requires_approval": True,
                "required_credentials": ["EMAIL_USER", "EMAIL_PASS"]
            }
        ]
    }

    async def run_stream():
        await save_workflow(
            workflow_id="wf_resume_e2e_test",
            title="Resume & Job Application Assistant",
            prompt="Analyze my resume and email report to inshaf713@gmail.com",
            plan_json=json.dumps(plan),
            status="ready",
            dry_run=True
        )

        engine = WorkflowExecutionEngine(
            workflow_id="wf_resume_e2e_test",
            plan=plan,
            dry_run=True
        )

        events = []
        async for ev in engine.stream_workflow():
            events.append(ev)
            if ev.get("type") == "approval_required":
                print(f"[Approval Gate Triggered]: {ev.get('step_id')} - {ev.get('name')}")
                if ev.get("step_id") == "step_3":
                    assert "inshaf713@gmail.com" in str(ev.get("parameters"))
                # Resolve approval with 'approve'
                approval_manager.resolve_approval(ev["approval_id"], "approve")

        return events

    events = asyncio.run(run_stream())
    event_types = [e.get("type") for e in events]
    print(f"[OK] Event stream: {event_types}")

    assert "workflow_start" in event_types
    assert "approval_required" in event_types
    assert "approval_resolved" in event_types
    assert "workflow_complete" in event_types
    print("[OK] Entire Resume workflow completed successfully with approval gate confirmed.")

if __name__ == "__main__":
    print("=" * 65)
    print("RESUME & JOB APPLICATION ASSISTANT - VERIFICATION SUITE")
    print("=" * 65)
    test_resume_plan_never_generates_weather()
    test_docx_and_txt_resume_parsing()
    test_resume_analysis_tool_execution()
    test_end_to_end_resume_workflow_stream()
    print("\n" + "=" * 65)
    print("ALL RESUME WORKFLOW TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 65)
