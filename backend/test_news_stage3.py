"""
Automated Test for Stage 3: AI News Module with Telegram Delivery.
Verifies:
1. News feed ingestion and semantic duplicate removal
2. Daily news digest formatting with sources, dates, and links
3. Telegram delivery tool (with simulation mode check)
4. REST API endpoints /api/news/digest and /api/news/deliver-telegram
5. Tool registration in ALL_TOOLS and REGISTERED_TOOLS_META
"""

import sys
import os
from pathlib import Path

# Fix Windows console encoding if needed
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from backend.main import app
from backend.news_module import (
    generate_daily_ai_news_digest,
    deduplicate_news,
    deliver_news_to_telegram
)
from backend.tools import ALL_TOOLS, send_telegram_message
from backend.workflows import REGISTERED_TOOLS_META

def test_stage3():
    print("=== Testing Stage 3: AI News Module & Telegram Delivery ===")

    # 1. Test Duplicate Detection Logic
    sample_stories = [
        {"title": "OpenAI Releases GPT-5 with Enhanced Reasoning - TechCrunch", "link": "https://techcrunch.com/gpt5", "published": "Today"},
        {"title": "OpenAI Releases GPT-5 with Enhanced Reasoning | VentureBeat", "link": "https://venturebeat.com/gpt-5-news", "published": "Today"},
        {"title": "Indian Startup Sarvam AI Unveils New Voice Models", "link": "https://sarvam.ai/voice", "published": "Yesterday"},
    ]
    deduped, removed_count = deduplicate_news(sample_stories)
    assert len(deduped) == 2, f"Expected 2 unique stories, got {len(deduped)}"
    assert removed_count == 1, f"Expected 1 duplicate removed, got {removed_count}"
    print(f"1. Duplicate detection verified: {removed_count} duplicate merged correctly.")

    # 2. Test Tool Registration
    assert send_telegram_message in ALL_TOOLS, "send_telegram_message must be registered in ALL_TOOLS"
    assert "send_telegram_message" in REGISTERED_TOOLS_META, "send_telegram_message must be registered in REGISTERED_TOOLS_META"
    print("2. Registered tools verified: send_telegram_message present in all tool catalogs.")

    # 3. Test News Digest Generation
    print("3. Ingesting live feeds and compiling AI news digest...")
    digest = generate_daily_ai_news_digest(topic="AI India", include_arxiv=True, max_stories=4)
    assert "date" in digest
    assert "stories" in digest
    assert len(digest["stories"]) > 0, "Expected at least 1 story from live feeds"
    assert "AgentFlow Daily AI & Tech Brief" in digest["markdown_digest"]
    print(f"   Compiled {len(digest['stories'])} stories. Filtered {digest['duplicates_removed']} duplicates.")
    for s in digest["stories"][:2]:
        print(f"   - {s['title'][:60]}... ({s['domain']}) [{s.get('published', 'Recent')}]")

    # 4. Test Telegram Delivery (Simulation Mode)
    delivery = deliver_news_to_telegram(digest["markdown_digest"])
    assert delivery["success"] is True, "Delivery simulation should succeed"
    assert delivery["mock"] is True, "Should operate in simulation mode when no bot token is set"
    print("4. Telegram delivery verified: Simulated mode safely handled without paid APIs.")

    # 5. Test REST Endpoints via TestClient
    client = TestClient(app)
    res_digest = client.get("/api/news/digest?topic=AI+India&max_stories=3")
    assert res_digest.status_code == 200, res_digest.text
    assert "stories" in res_digest.json()

    res_tg = client.post("/api/news/deliver-telegram", json={
        "message": "Test daily news alert from AgentFlow"
    })
    assert res_tg.status_code == 200, res_tg.text
    assert res_tg.json().get("mock") is True
    print("5. FastAPI endpoints /api/news/digest and /api/news/deliver-telegram verified.")

    print("\nALL STAGE 3 AI NEWS & TELEGRAM MODULE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_stage3()
