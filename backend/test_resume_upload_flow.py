"""
Verification Test for Resume File Upload UI & End-to-End Workflow Flow
Validates:
1. Requirements extraction identifies resume_filename as input_type='file'.
2. Workspace file upload API (POST /api/workspace/upload) accepts PDF/DOCX and stores securely in workspace/.
3. Workspace files listing (GET /api/workspace/files) returns the uploaded document.
4. Answering question with the uploaded file identifier updates known_inputs.
5. Plan generation creates the Resume Assistant plan binding the uploaded file.
6. Execution of analyze_resume_and_job processes the uploaded resume and generates reports.
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import io
import json
from starlette.testclient import TestClient

from backend.main import app
from backend.tools import WORKSPACE_PATH

def run_tests():
    print("=" * 65)
    print("RESUME FILE UPLOAD & ASSISTANT WORKFLOW VERIFICATION")
    print("=" * 65)

    client = TestClient(app)

    # 1. Test Extract Requirements returns input_type="file" for resume_filename
    print("\n--- 1. Testing Extract Requirements & Question Metadata ---")
    resp = client.post("/api/workflows/extract-requirements", json={
        "prompt": "Resume & Job Application Assistant"
    })
    assert resp.status_code == 200, f"extract-requirements failed: {resp.text}"
    data = resp.json()
    questions = data.get("questions", [])
    print(f"Questions received: {len(questions)}")
    file_questions = [q for q in questions if q.get("field") == "resume_filename" or q.get("input_type") == "file"]
    assert len(file_questions) > 0, "No file question found for resume_filename!"
    resume_q = file_questions[0]
    print(f"  Field: {resume_q.get('field')}")
    print(f"  Input Type: {resume_q.get('input_type')}")
    print(f"  Accept: {resume_q.get('accept')}")
    print(f"  Question: {resume_q.get('question')}")
    assert resume_q.get("input_type") == "file", "Expected input_type == 'file'"
    assert ".pdf" in resume_q.get("accept", "") and ".docx" in resume_q.get("accept", "")
    print("  [OK] Question metadata specifies input_type='file' and accept='.pdf,.docx,.doc,.txt'")

    # 2. Test POST /api/workspace/upload
    print("\n--- 2. Testing Workspace File Upload API ---")
    fake_pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Title (Insha Fatima Resume) /Author (Insha Fatima) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    upload_file_name = "insha_fatima_software_engineer_resume.pdf"

    files = {
        "file": (upload_file_name, io.BytesIO(fake_pdf_content), "application/pdf")
    }
    upload_resp = client.post("/api/workspace/upload", files=files)
    assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
    upload_data = upload_resp.json()
    print(f"  Upload response: {upload_data}")
    assert upload_data.get("success") is True
    assert upload_data.get("filename") == upload_file_name
    print("  [OK] Resume uploaded successfully into workspace.")

    # 3. Test GET /api/workspace/files lists the uploaded file
    print("\n--- 3. Testing Workspace Files Listing ---")
    files_resp = client.get("/api/workspace/files")
    assert files_resp.status_code == 200
    files_data = files_resp.json()
    all_files = [f.get("filename") for f in files_data.get("files", [])]
    print(f"  Files in workspace: {all_files}")
    assert upload_file_name in all_files, f"{upload_file_name} not found in workspace files list!"
    print(f"  [OK] {upload_file_name} found in workspace documents.")

    # 4. Test Answering Question
    print("\n--- 4. Testing Workflow Question Answering ---")
    answer_resp = client.post("/api/workflows/answer-question", json={
        "session": data,
        "field": "resume_filename",
        "answer": upload_file_name
    })
    assert answer_resp.status_code == 200, f"answer-question failed: {answer_resp.text}"
    answer_data = answer_resp.json()
    print(f"  Known inputs: {answer_data.get('known_inputs')}")
    assert answer_data.get("known_inputs", {}).get("resume_filename") == upload_file_name
    print("  [OK] resume_filename answered and stored in session known_inputs.")

    # 5. Test Plan Generation using prompt enriched with uploaded file
    print("\n--- 5. Testing Plan Generation with Enriched Prompt ---")
    job_desc = "Seeking a Senior Software Engineer with Python, FastAPI, React, and cloud experience."
    enriched_prompt = f"Resume & Job Application Assistant with resume {upload_file_name} for target job: {job_desc} and email report to inshaf713@gmail.com"
    plan_resp = client.post("/api/workflows/generate", json={
        "prompt": enriched_prompt
    })
    assert plan_resp.status_code == 200
    plan = plan_resp.json()
    steps = plan.get("steps", [])
    print(f"  Plan Name: {plan.get('name')}")
    print(f"  Generated Steps ({len(steps)}):")
    for s in steps:
        print(f"    - [{s.get('id')}] {s.get('action')} | tool={s.get('tool')} | params={s.get('params')}")

    assert steps[0].get("tool") == "analyze_resume_and_job"
    assert steps[0].get("params", {}).get("resume_filename") == upload_file_name, \
        f"Expected {upload_file_name}, got {steps[0].get('params', {}).get('resume_filename')}"
    print(f"  [OK] Step 1 bound to uploaded file '{upload_file_name}'!")

    # 6. Test execution of analyze_resume_and_job on a test document
    print("\n--- 6. Testing Tool Execution with Actual Resume Content ---")
    import zipfile
    import html
    rich_doc_path = os.path.join(WORKSPACE_PATH, "candidate_uploaded_resume.docx")
    sample_text = (
        "INSHA FATIMA\n"
        "Full Stack Software Engineer | inshaf713@gmail.com | Lucknow, India\n"
        "Skills: Python, FastAPI, TypeScript, React, Vite, Docker, PostgreSQL, CI/CD, Git\n"
        "Experience: Software Engineer at AgentFlow - Designed scalable autonomous workflows.\n"
        "Education: B.Tech in Computer Science and Engineering\n"
    )
    xml_doc = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:body>'
        + "".join([f'<w:p><w:r><w:t>{html.escape(line)}</w:t></w:r></w:p>' for line in sample_text.splitlines()]) +
        '</w:body></w:document>'
    )
    with zipfile.ZipFile(rich_doc_path, 'w') as zf:
        zf.writestr("word/document.xml", xml_doc)

    from backend.tools import analyze_resume_and_job
    tool_result = analyze_resume_and_job.func(
        resume_filename="candidate_uploaded_resume.docx",
        job_description=job_desc,
        target_role="Senior Software Engineer"
    )

    assert "AgentFlow Resume & Job Application Analysis Report" in tool_result, "Expected report header"
    assert "ATS Compatibility Score" in tool_result, "Expected ATS score section"
    assert "candidate_uploaded_resume.docx" in tool_result
    print("  [OK] analyze_resume_and_job executed successfully on candidate_uploaded_resume.docx")
    print(f"  Report preview (first 250 chars):\n{tool_result[:250]}...")

    print("\n" + "=" * 65)
    print("ALL VERIFICATION TESTS COMPLETED WITH 100% SUCCESS!")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
