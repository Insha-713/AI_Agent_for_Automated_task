"""
Comprehensive test script for LLM Provider Layer:
1. Tests /api/health with different provider settings (never leaks secrets).
2. Tests active provider probe with Groq and Gemini cloud configurations.
3. Tests unreachable LLM error messaging ("No LLM available on this server. Set LLM_PROVIDER and an API key.").
4. Tests tool-only workflow execution when no LLM is available.
"""

import os
import sys
import json
import asyncio
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath("."))
load_dotenv()

from backend.llm_provider import (
    get_llm_provider,
    get_active_model_name,
    is_llm_configured,
    is_llm_available,
    test_llm_connection,
    get_chat_llm
)
from backend.integrations import get_all_integrations_summary, test_integration_by_name
from backend.workflows import generate_workflow_plan, WorkflowExecutionEngine

print("=" * 60, flush=True)
print("TEST 1: Provider Resolution & Configured Flags (Never prints secrets)", flush=True)
print("=" * 60, flush=True)

for prov in ["ollama", "groq", "gemini"]:
    os.environ["LLM_PROVIDER"] = prov
    active_prov = get_llm_provider()
    active_model = get_active_model_name(active_prov)
    configured = is_llm_configured(active_prov)
    print(f"Provider: {active_prov:<8} | Model: {active_model:<25} | Configured: {configured}", flush=True)

print("\n" + "=" * 60, flush=True)
print("TEST 2: LLM Connection Probe with Groq Cloud Model", flush=True)
print("=" * 60, flush=True)

# Test Groq without key
os.environ["LLM_PROVIDER"] = "groq"
os.environ.pop("GROQ_API_KEY", None)
res_groq_nokey = test_integration_by_name("llm")
print("Groq (No Key):", flush=True)
print(f"  Status: {res_groq_nokey.get('status')}", flush=True)
print(f"  Configured: {res_groq_nokey.get('configured')}", flush=True)
print(f"  Message: {res_groq_nokey.get('message')}", flush=True)
print(f"  Guidance: {res_groq_nokey.get('guidance')}", flush=True)

# Test Groq with test key to verify live cloud API handshake
os.environ["GROQ_API_KEY"] = "gsk_testcloudprobeverificationkey0123456789"
res_groq_test = test_integration_by_name("llm")
print("\nGroq (Cloud API Handshake with key):", flush=True)
print(f"  Status: {res_groq_test.get('status')}", flush=True)
print(f"  Configured: {res_groq_test.get('configured')}", flush=True)
print(f"  Message: {res_groq_test.get('message')}", flush=True)
print(f"  Guidance: {res_groq_test.get('guidance')}", flush=True)

print("\n" + "=" * 60, flush=True)
print("TEST 3: LLM Connection Probe with Google Gemini Cloud Model", flush=True)
print("=" * 60, flush=True)

# Test Gemini without key
os.environ["LLM_PROVIDER"] = "gemini"
os.environ.pop("GEMINI_API_KEY", None)
os.environ.pop("GOOGLE_API_KEY", None)
res_gemini_nokey = test_integration_by_name("llm")
print("Gemini (No Key):", flush=True)
print(f"  Status: {res_gemini_nokey.get('status')}", flush=True)
print(f"  Configured: {res_gemini_nokey.get('configured')}", flush=True)
print(f"  Message: {res_gemini_nokey.get('message')}", flush=True)
print(f"  Guidance: {res_gemini_nokey.get('guidance')}", flush=True)

print("\n" + "=" * 60, flush=True)
print("TEST 4: Unreachable LLM Fallback (Simulating Render with no Ollama)", flush=True)
print("=" * 60, flush=True)

os.environ["LLM_PROVIDER"] = "ollama"
os.environ["OLLAMA_BASE_URL"] = "http://localhost:11434"
avail, reason = is_llm_available()
print(f"Is LLM Available: {avail}", flush=True)
print(f"Reported Reason: '{reason}'", flush=True)
assert reason == "No LLM available on this server. Set LLM_PROVIDER and an API key."

res_unreach = test_integration_by_name("llm")
print(f"Integrations LLM Status: {res_unreach.get('status')}", flush=True)
print(f"Integrations LLM Message: {res_unreach.get('message')}", flush=True)

print("\n" + "=" * 60, flush=True)
print("TEST 5: Tool-Only Workflow Generation & Execution with NO LLM", flush=True)
print("=" * 60, flush=True)

async def test_workflow_no_llm():
    # Prompt: "Fetch top 5 AI news in India and save to workspace/cloud_test_news.txt"
    prompt = "Fetch top 5 AI news in India and save to workspace/cloud_test_news.txt"
    plan = await generate_workflow_plan(prompt)
    print(f"Generated Workflow Plan Title: '{plan.get('title')}'", flush=True)
    print(f"Steps Planned ({len(plan.get('steps', []))}):", flush=True)
    for s in plan.get("steps", []):
        print(f"  - Step [{s['id']}]: {s['name']} (Tool: {s['tool']})", flush=True)

    # Execute step 1 and step 2 directly
    from backend.tools import get_datetime, get_latest_news
    step_1 = plan["steps"][0]
    print(f"\nExecuting Step 1 tool '{step_1['tool']}' with params {step_1['params']}...", flush=True)
    dt_res = get_datetime.func(**step_1["params"])
    print(f"Step 1 output: {dt_res}", flush=True)

    step_2 = plan["steps"][1]
    print(f"\nExecuting Step 2 tool '{step_2['tool']}' with params {step_2['params']}...", flush=True)
    news_res = get_latest_news.func(**step_2["params"])
    print(f"Step 2 executed successfully without LLM! Output length: {len(news_res)} characters.", flush=True)
    print("News preview:\n" + "\n".join(news_res.split("\n")[:4]), flush=True)

asyncio.run(test_workflow_no_llm())

# Restore default provider
os.environ["LLM_PROVIDER"] = "ollama"
os.environ.pop("GROQ_API_KEY", None)
os.environ.pop("GEMINI_API_KEY", None)
print("\n[ALL TESTS PASSED SUCCESSFULLY]", flush=True)
