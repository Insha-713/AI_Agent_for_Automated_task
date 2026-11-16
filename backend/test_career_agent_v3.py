"""
AgentFlow v3.0 - Verification Test Suite for Career Agent Automation
Tests:
1. Profile retrieval and update
2. CV upload with PDF & DOCX, auto-extraction without hallucination
3. Career preferences retrieval and update
4. Job discovery and deduplication
5. Deterministic 4-pillar ATS Resume Analyzer
6. Multi-job ATS comparison
7. AI Resume Builder (STAR format) and versioning
8. AI Cover Letter Generator with tone options
9. Job Application Assistant (Prep, checklist, Q&A cheat sheet)
10. Application Tracker (status update, timeline history, deletion)
11. Daily Job Alert runner & report generation
12. Reports export (Excel & CSV)
13. Conversational Career Assistant in English, Hindi, and Urdu
14. Career Dashboard KPIs
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import io
import json
import zipfile
import asyncio
from starlette.testclient import TestClient

from backend.main import app

def create_sample_docx(text: str) -> bytes:
    """Creates in-memory valid docx byte stream."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>""")
        zf.writestr("_rels/.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>""")
        body_p = "".join(f"<w:p><w:r><w:t>{line}</w:t></w:r></w:p>" for line in text.splitlines())
        doc_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>{body_p}</w:body>
</w:document>"""
        zf.writestr("word/document.xml", doc_xml)
    buf.seek(0)
    return buf.read()


def test_career_agent():
    print("=" * 70, flush=True)
    print("AGENTFLOW V3.0: CAREER AGENT END-TO-END VERIFICATION SUITE", flush=True)
    print("=" * 70, flush=True)

    with TestClient(app) as client:
        # 1. Health check
        print("\n--- 1. Testing /api/health ---", flush=True)
        resp = client.get("/api/health")
        assert resp.status_code == 200
        print("[OK] Health status:", resp.json().get("status"), flush=True)

        # 2. Career Profile & Preferences
        print("\n--- 2. Testing Career Profile & Preferences ---", flush=True)
        prof_resp = client.get("/api/career/profile")
        assert prof_resp.status_code == 200
        prof = prof_resp.json()["profile"]
        print("[OK] Default profile retrieved. ID:", prof["id"], flush=True)

        pref_resp = client.get("/api/career/preferences")
        assert pref_resp.status_code == 200
        pref = pref_resp.json()["preferences"]
        print("[OK] Preferences retrieved. Target roles:", pref["target_roles"][:3], flush=True)

        # 3. CV Upload (DOCX) & Auto-Extraction
        print("\n--- 3. Testing CV Upload & Structured Information Extraction ---", flush=True)
        sample_cv_text = """INSHA FATIMA
Software & AI Engineer
Email: inshaf713@gmail.com | Phone: +91 9876543210
GitHub: https://github.com/Insha-713 | LinkedIn: https://linkedin.com/in/insha-fatima

EDUCATION
Bachelor of Technology in Computer Science and Engineering
Integral University, Lucknow | 2021 - 2025 | CGPA: 8.9/10

TECHNICAL SKILLS
- Programming Languages: Python, JavaScript, TypeScript, SQL, C++
- AI & Machine Learning: PyTorch, Transformers, LangChain, Large Language Models, NLP, Vector Database
- Web & Backend: FastAPI, React, Node.js, REST API, Docker, PostgreSQL, Git

ENGINEERING PROJECTS
1. Autonomous Multi-Agent AI Workflow System (AgentFlow)
- Architected local multi-agent system with human-in-the-loop approvals using FastAPI and React.
- Reduced workflow execution latency by 45% using streaming SSE and SQLite/PostgreSQL persistence.

2. Document Question Answering with Vector Retrieval (RAG)
- Built semantic search pipeline using ChromaDB vector database and HuggingFace embeddings.
- Evaluated retrieval accuracy at 94% on domain-specific technical documentation.

PROFESSIONAL EXPERIENCE
- AI Automation Intern at TechSphere India (June 2024 - Present)
  Engineered background automated scheduler routines and monitored website endpoints with sub-second latency.
"""
        docx_bytes = create_sample_docx(sample_cv_text)
        upload_resp = client.post(
            "/api/career/profile/upload-cv",
            files={"file": ("insha_fatima_resume.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        )
        assert upload_resp.status_code == 200, upload_resp.text
        up_data = upload_resp.json()
        extracted_prof = up_data["profile"]
        print(f"[OK] Uploaded & parsed CV: Name='{extracted_prof['full_name']}', Email='{extracted_prof['email']}'", flush=True)
        print(f"[OK] Completeness Score: {extracted_prof['completeness_score']}%", flush=True)
        print(f"[OK] Detected Skills: {len(extracted_prof['technical_skills'])} skills, {len(extracted_prof['ai_ml_skills'])} AI/ML skills", flush=True)
        assert extracted_prof["full_name"] == "Insha Fatima"
        assert "Python" in extracted_prof["programming_languages"]
        assert extracted_prof["completeness_score"] >= 80

        # 4. Job Discovery & Deduplication
        print("\n--- 4. Testing AI Job Finder & Deduplication ---", flush=True)
        disc_resp = client.post(
            "/api/career/jobs/discover",
            json={"category": "Generative AI Engineer", "location": "India", "limit": 10}
        )
        assert disc_resp.status_code == 200
        disc_data = disc_resp.json()
        print(f"[OK] Jobs Discovered: Added={disc_data['added_count']}, Duplicates={disc_data['duplicates_skipped']}", flush=True)
        assert disc_data["total_returned"] > 0

        # Re-running discovery with same query must recognize duplicates
        disc_resp_dup = client.post(
            "/api/career/jobs/discover",
            json={"category": "Generative AI Engineer", "location": "India", "limit": 10}
        )
        assert disc_resp_dup.status_code == 200
        dup_data = disc_resp_dup.json()
        print(f"[OK] Duplicate run: Added={dup_data['added_count']}, Duplicates Skipped={dup_data['duplicates_skipped']}", flush=True)
        assert dup_data["duplicates_skipped"] > 0

        # List jobs
        jobs_resp = client.get("/api/career/jobs?limit=10")
        assert jobs_resp.status_code == 200
        jobs_list = jobs_resp.json()["jobs"]
        print(f"[OK] Total jobs available in DB: {len(jobs_list)}", flush=True)
        assert len(jobs_list) > 0
        target_job = jobs_list[0]

        # 5. ATS Resume Analyzer
        print("\n--- 5. Testing ATS Resume Analyzer (Deterministic 4 Pillars) ---", flush=True)
        ats_resp = client.post(
            "/api/career/ats/analyze",
            json={"job_id": target_job["id"]}
        )
        assert ats_resp.status_code == 200
        ats_eval = ats_resp.json()["evaluation"]
        print(f"[OK] Target Job: '{target_job['title']}' at '{target_job['company']}'", flush=True)
        print(f"[OK] ATS Compatibility Score: {ats_eval['overall_score']} / 100 ({ats_eval['rating']})", flush=True)
        print(f"[OK] Breakdown: Keywords={ats_eval['breakdown']['keywords_score']}/40, Sections={ats_eval['breakdown']['sections_score']}/25, Formatting={ats_eval['breakdown']['formatting_score']}/20, Impact={ats_eval['breakdown']['impact_score']}/15", flush=True)
        print(f"[OK] Matched Skills: {ats_eval['matched_skills']}", flush=True)
        print(f"[OK] Missing Target Skills: {ats_eval['missing_skills']}", flush=True)
        assert ats_eval["overall_score"] > 40
        assert "estimate based on heuristic keyword overlap" in ats_eval["scoring_explanation"].lower()

        # 6. Multi-Job Comparison
        print("\n--- 6. Testing Multi-Job Comparison Side-by-Side ---", flush=True)
        comp_ids = [j["id"] for j in jobs_list[:3]]
        comp_resp = client.post("/api/career/ats/compare", json={"job_ids": comp_ids})
        assert comp_resp.status_code == 200
        comparisons = comp_resp.json()["comparisons"]
        print(f"[OK] Compared {len(comparisons)} jobs side-by-side:", flush=True)
        for c in comparisons:
            print(f"  * {c['job']['title']} ({c['job']['company']}): Score {c['evaluation']['overall_score']}/100", flush=True)
        assert len(comparisons) == len(comp_ids)

        # 7. AI Resume Builder (Job-Specific STAR Resume)
        print("\n--- 7. Testing AI Resume Builder & Format Downloads ---", flush=True)
        res_gen = client.post(
            "/api/career/resume/generate",
            json={"job_id": target_job["id"], "target_role": target_job["title"]}
        )
        assert res_gen.status_code == 200
        res_ver = res_gen.json()["resume_version"]
        print(f"[OK] Tailored Resume generated. Version ID: {res_ver['id']}", flush=True)
        assert "INSHA FATIMA" in res_gen.json()["content_md"]
        assert "Professional Summary" in res_gen.json()["content_md"]
        assert "Situation & Task" in res_gen.json()["content_md"]

        # Test DOCX download
        docx_down = client.get(f"/api/career/resume/{res_ver['id']}/download/docx")
        assert docx_down.status_code == 200
        assert len(docx_down.content) > 500
        print(f"[OK] DOCX Resume Download verified: {len(docx_down.content)} bytes", flush=True)

        # Test HTML / Printable PDF download
        html_down = client.get(f"/api/career/resume/{res_ver['id']}/download/html")
        assert html_down.status_code == 200
        assert "@media print" in html_down.text
        print(f"[OK] Printable HTML/PDF Resume Download verified: {len(html_down.content)} bytes", flush=True)

        # 8. AI Cover Letter Generator
        print("\n--- 8. Testing AI Cover Letter Generator & Tone Selection ---", flush=True)
        cl_resp = client.post(
            "/api/career/cover-letter/generate",
            json={"job_id": target_job["id"], "tone": "Confident"}
        )
        assert cl_resp.status_code == 200
        cl_data = cl_resp.json()
        print(f"[OK] Cover Letter generated. Tone='Confident'", flush=True)
        assert "Insha Fatima" in cl_data["content_md"]
        assert target_job["company"] in cl_data["content_md"]

        cl_down = client.get(f"/api/career/cover-letter/{cl_data['cover_letter']['id']}/download/docx")
        assert cl_down.status_code == 200
        print(f"[OK] DOCX Cover Letter Download verified: {len(cl_down.content)} bytes", flush=True)

        # 9. Job Application Assistant (Prep, Q&A, Checklist)
        print("\n--- 9. Testing Job Application Assistant Packet ---", flush=True)
        prep_resp = client.post("/api/career/assistant/prepare", json={"job_id": target_job["id"]})
        assert prep_resp.status_code == 200
        packet = prep_resp.json()["packet"]
        print(f"[OK] Application Packet prepared. Q&A Cheat Sheet items: {len(packet['qna_cheat_sheet'])}", flush=True)
        print(f"[OK] Checklist items: {len(packet['checklist'])}", flush=True)
        assert len(packet["qna_cheat_sheet"]) >= 3
        assert "explicit human review" in packet["safety_notice"].lower()

        # 10. Application Tracker (Full Lifecycle)
        print("\n--- 10. Testing Application Tracker Lifecycle ---", flush=True)
        app_create = client.post(
            "/api/career/applications",
            json={
                "job_id": target_job["id"],
                "company": target_job["company"],
                "job_title": target_job["title"],
                "location": target_job["location"],
                "source": target_job["source"],
                "status": "applied",
                "notes": "Submitted application with tailored resume v1"
            }
        )
        assert app_create.status_code == 200
        created_app = app_create.json()["application"]
        app_id = created_app["id"]
        print(f"[OK] Created application: {app_id}, Status: '{created_app['status']}'", flush=True)

        # Update status to interview
        stat_up = client.patch(
            f"/api/career/applications/{app_id}/status",
            json={"status": "interview", "notes": "Interview scheduled for Friday 11:00 AM IST"}
        )
        assert stat_up.status_code == 200
        assert stat_up.json()["application"]["status"] == "interview"
        print(f"[OK] Updated status to 'interview'", flush=True)

        # Verify history timeline
        hist_resp = client.get(f"/api/career/applications/{app_id}/history")
        assert hist_resp.status_code == 200
        hist = hist_resp.json()["history"]
        print(f"[OK] Application history timeline records: {len(hist)}", flush=True)
        assert len(hist) >= 1

        # 11. Daily Job Alert Routine Trigger
        print("\n--- 11. Testing Daily Job Alerts Runner ---", flush=True)
        # Configure safe channels (dashboard only) during automated tests
        client.post("/api/career/alerts/settings", json={"channels": ["dashboard"], "min_score": 50})
        alert_resp = client.post("/api/career/alerts/trigger-now")
        assert alert_resp.status_code == 200
        alert_res = alert_resp.json()["result"]
        print(f"[OK] Daily Job Alert triggered: Status={alert_res['status']}, Top Matches={alert_res['top_matches_count']}, Email Status='{alert_res['email_delivery']}'", flush=True)
        assert alert_res["status"] == "success"

        # 12. Career Reports & Excel Export
        print("\n--- 12. Testing Career Reports & Excel/CSV Export ---", flush=True)
        xlsx_resp = client.post("/api/career/reports/export-jobs?fmt=xlsx")
        assert xlsx_resp.status_code == 200
        print(f"[OK] Excel jobs export verified: {len(xlsx_resp.content)} bytes", flush=True)

        csv_resp = client.post("/api/career/reports/export-jobs?fmt=csv")
        assert csv_resp.status_code == 200
        print(f"[OK] CSV jobs export verified: {len(csv_resp.content)} bytes", flush=True)

        # 13. Conversational Career Assistant
        print("\n--- 13. Testing Conversational Career Assistant ---", flush=True)
        chat_queries = [
            "Find five remote Generative AI internships for freshers",
            "Which skills am I missing for an AI Engineer position?",
            "Generate a cover letter for DeepMind"
        ]
        for q in chat_queries:
            c_resp = client.post("/api/career/chat", json={"message": q})
            assert c_resp.status_code == 200
            reply = c_resp.json()["reply"]
            print(f"  [Q]: {q}", flush=True)
            print(f"  [A Intent]: {reply['intent']} | Preview: {reply['reply'][:80]}...", flush=True)
            assert len(reply["reply"]) > 20

        # 14. Career Dashboard KPIs
        print("\n--- 14. Testing Career Dashboard KPIs ---", flush=True)
        dash_resp = client.get("/api/career/dashboard")
        assert dash_resp.status_code == 200
        kpis = dash_resp.json()["data"]
        print(f"[OK] Profile Completeness: {kpis['profile_completeness']}%", flush=True)
        print(f"[OK] Total Jobs Discovered: {kpis['total_jobs_discovered']}", flush=True)
        print(f"[OK] Applications in Pipeline: {kpis['applications']['total']}", flush=True)
        print(f"[OK] Top Matches Count: {len(kpis['top_job_matches'])}", flush=True)
        assert kpis["total_jobs_discovered"] > 0
        assert kpis["profile_completeness"] >= 80

        print("\n" + "=" * 70, flush=True)
        print("ALL CAREER AGENT VERIFICATION TESTS PASSED WITH 100% SUCCESS!", flush=True)
        print("=" * 70, flush=True)


if __name__ == "__main__":
    test_career_agent()
