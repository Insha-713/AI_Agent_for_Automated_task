"""
AgentFlow - Stage 4 Automated Verification Test Suite
Tests data cleaning, KPI calculation, Recharts visual formatting,
executive summary authoring, and multi-format report exports (Excel, CSV, Markdown).
"""

import os
import sys
from pathlib import Path

# Fix Windows console encoding if needed
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.reports import (
    load_and_clean_tabular_data,
    calculate_kpis,
    generate_charts_data,
    generate_executive_summary,
    export_report_files,
    get_available_sample_datasets,
    SAMPLES_DIR,
    REPORTS_DIR,
)

def test_samples_discovery():
    print("--- Testing Sample Datasets Discovery ---")
    samples = get_available_sample_datasets()
    print(f"Discovered {len(samples)} preloaded datasets:")
    for s in samples:
        print(f"  * {s['title']} ({s['category']}) -> {s['filename']}")
    assert len(samples) >= 3, "Expected at least 3 preloaded sample datasets"
    print("[PASS] Sample datasets discovery passed.\n")


def test_ecommerce_analysis():
    print("--- Testing E-Commerce Sales Dataset Analysis ---")
    file_path = SAMPLES_DIR / "ecommerce_sales_india.csv"
    data = load_and_clean_tabular_data(file_path)
    
    assert data["row_count"] == 20, f"Expected 20 rows, got {data['row_count']}"
    assert "total_revenue_inr" in data["columns"]
    print(f"Loaded {data['row_count']} rows across {data['column_count']} columns.")
    
    kpis = calculate_kpis(data)
    assert kpis["dataset_summary"]["data_quality_score"] == 100.0
    assert "total_revenue_inr" in kpis["numeric_metrics"]
    
    rev_stats = kpis["numeric_metrics"]["total_revenue_inr"]
    print(f"Total Revenue Calculated: Rs {rev_stats['total']:,.2f} | Average: Rs {rev_stats['average']:,.2f}")
    assert rev_stats["total"] > 100000, "Revenue sum should exceed 1 lakh INR"
    
    # Visualizations
    charts = generate_charts_data(data, kpis)
    assert len(charts["bar_chart"]) > 0
    assert len(charts["stat_cards"]) >= 4
    print(f"Generated {len(charts['bar_chart'])} bar chart categories and {len(charts['stat_cards'])} stat cards.")
    
    # Executive Summary
    summary = generate_executive_summary("ecommerce_sales_india.csv", data, kpis)
    assert "## 1. Executive Overview" in summary
    assert "## 2. Key Performance Indicators (KPIs)" in summary
    assert "Strategic Insights" in summary
    print(f"Executive Summary generated ({len(summary)} characters).")
    
    # Export files
    exports = export_report_files("ecommerce_sales_india.csv", data, kpis, summary)
    assert os.path.exists(exports["xlsx_path"]), "Excel report should exist"
    assert os.path.exists(exports["csv_path"]), "CSV cleaned report should exist"
    assert os.path.exists(exports["md_path"]), "Markdown summary report should exist"
    print(f"[PASS] Exported Excel: {exports['xlsx']}")
    print(f"[PASS] Exported CSV: {exports['csv']}")
    print(f"[PASS] Exported Markdown: {exports['md']}\n")


def test_student_placement_analysis():
    print("--- Testing Student Placement Analytics ---")
    file_path = SAMPLES_DIR / "student_placement_data.csv"
    data = load_and_clean_tabular_data(file_path)
    kpis = calculate_kpis(data)
    
    assert "ctc_lpa" in kpis["numeric_metrics"]
    salary_stats = kpis["numeric_metrics"]["ctc_lpa"]
    print(f"Average CTC Package: {salary_stats['average']} LPA (Max: {salary_stats['max']} LPA)")
    
    cat_metrics = kpis["categorical_metrics"]
    assert "placement_status" in cat_metrics
    placed_pct = cat_metrics["placement_status"]["distribution"].get("Placed", 0)
    print(f"Placement Distribution: {cat_metrics['placement_status']['distribution']}")
    print("[PASS] Student placement analysis passed.\n")


def test_freelance_expenses_analysis():
    print("--- Testing Freelance Agency Expenses ---")
    file_path = SAMPLES_DIR / "freelance_agency_expenses.csv"
    data = load_and_clean_tabular_data(file_path)
    kpis = calculate_kpis(data)
    
    assert "amount_inr" in kpis["numeric_metrics"]
    exp_stats = kpis["numeric_metrics"]["amount_inr"]
    print(f"Total Operational Expenses: Rs {exp_stats['total']:,.2f}")
    assert exp_stats["total"] > 50000
    print("[PASS] Freelance agency expenses passed.\n")


def test_tabular_agent_tool():
    print("--- Testing analyze_tabular_data Agent Tool ---")
    from backend.tools import analyze_tabular_data
    result = analyze_tabular_data.invoke({"filename": "ecommerce_sales_india.csv"})
    assert "Successfully analyzed 'ecommerce_sales_india.csv'" in result
    assert "Exported Reports: Excel" in result
    print("[PASS] analyze_tabular_data agent tool passed.\n")


def test_api_endpoints():
    print("--- Testing FastAPI Reports Endpoints ---")
    from fastapi.testclient import TestClient
    from backend.main import app

    client = TestClient(app)

    # 1. GET /api/reports/samples
    resp = client.get("/api/reports/samples")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    samples = resp.json().get("samples", [])
    assert len(samples) >= 3
    print(f"[PASS] /api/reports/samples returned {len(samples)} datasets")

    # 2. POST /api/reports/analyze
    resp_analyze = client.post("/api/reports/analyze", json={"filename": "ecommerce_sales_india.csv"})
    assert resp_analyze.status_code == 200, f"Expected 200, got {resp_analyze.status_code}: {resp_analyze.text}"
    data = resp_analyze.json()
    assert data["status"] == "success"
    assert data["row_count"] == 20
    assert "charts" in data
    assert "exports" in data
    print(f"[PASS] /api/reports/analyze generated complete analysis with {len(data['charts']['bar_chart'])} chart groups")

    # 3. GET /api/reports/download/{filename}
    excel_file = data["exports"]["xlsx"]
    resp_dl = client.get(f"/api/reports/download/{excel_file}")
    assert resp_dl.status_code == 200
    assert len(resp_dl.content) > 1000
    print(f"[PASS] /api/reports/download/{excel_file} successfully downloaded ({len(resp_dl.content)} bytes)")


if __name__ == "__main__":
    print("==========================================")
    print("STAGE 4: CSV & EXCEL REPORT ENGINE TESTS")
    print("==========================================\n")
    test_samples_discovery()
    test_ecommerce_analysis()
    test_student_placement_analysis()
    test_freelance_expenses_analysis()
    test_tabular_agent_tool()
    test_api_endpoints()
    print("==========================================")
    print("ALL STAGE 4 REPORT ENGINE & API TESTS PASSED! [SUCCESS]")
    print("==========================================")

