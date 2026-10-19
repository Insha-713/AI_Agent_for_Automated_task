import os
import sys
import json
import csv
import requests
import openpyxl
import pandas as pd

BASE_URL = "http://127.0.0.1:8000"
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def test_dataset(filename, title):
    print(f"\n=======================================================")
    print(f"TESTING DATASET: {title} ({filename})")
    print(f"=======================================================")
    
    url = f"{BASE_URL}/api/reports/analyze"
    resp = requests.post(url, json={"filename": filename}, timeout=15)
    print(f"HTTP Status Code: {resp.status_code}")
    assert resp.status_code == 200, f"Expected 200 but got {resp.status_code}: {resp.text}"
    
    data = resp.json()
    print(f"Response Status: {data.get('status')}")
    print(f"File Name: {data.get('file_name')}")
    print(f"Rows: {data.get('row_count')}, Columns: {data.get('column_count')}")
    
    # Print KPIs
    kpis = data.get("kpis", {})
    summary = kpis.get("dataset_summary", {})
    print(f"Data Quality Score: {summary.get('data_quality_score')}%")
    
    print("\n--- Top Business Metrics ---")
    for bm in kpis.get("top_business_metrics", []):
        print(f"  * {bm['metric_name']}: Total = {bm['total_display']}, Avg = {bm['avg_display']} (min: {bm['min']}, max: {bm['max']})")
        
    print("\n--- Numeric Metrics Breakdown ---")
    for col, nm in kpis.get("numeric_metrics", {}).items():
        print(f"  * {col}: count={nm['count']}, total={nm['total']}, avg={nm['average']}, median={nm['median']}, min={nm['min']}, max={nm['max']}")
        
    print("\n--- Categorical Metrics Breakdown ---")
    for col, cm in kpis.get("categorical_metrics", {}).items():
        print(f"  * {col}: unique={cm['unique_values_count']}, top='{cm['top_value']}' ({cm['top_value_frequency']} occurrences, {cm['top_percentage']}%)")

    # Verify Exports and Downloads
    exports = data.get("exports", {})
    print("\n--- Testing Export Downloads ---")
    for ext, fname in [("xlsx", exports.get("xlsx")), ("csv", exports.get("csv")), ("md", exports.get("md"))]:
        dl_url = f"{BASE_URL}/api/reports/download/{fname}"
        dl_resp = requests.get(dl_url, timeout=10)
        print(f"  * Download {fname} [{ext.upper()}]: HTTP {dl_resp.status_code}, {len(dl_resp.content)} bytes")
        assert dl_resp.status_code == 200, f"Download failed for {fname}"
        assert len(dl_resp.content) > 0, f"Empty file downloaded for {fname}"
        
        # Verify Excel opens cleanly without corruption
        if ext == "xlsx":
            save_path = f"workspace/reports/{fname}"
            wb = openpyxl.load_workbook(save_path)
            sheet_names = wb.sheetnames
            print(f"    -> Excel Verified! Sheets: {sheet_names}")
            assert "Executive Summary" in sheet_names
            assert "Cleaned Data" in sheet_names

    return data


def recompute_and_compare(filename, api_data):
    print(f"\n--- Plain Python Verification Comparison for {filename} ---")
    file_path = f"workspace/samples/{filename}"
    df = pd.read_csv(file_path)
    
    api_numeric = api_data.get("kpis", {}).get("numeric_metrics", {})
    
    for col in df.columns:
        # Check if numeric in API
        if col in api_numeric:
            api_stats = api_numeric[col]
            if api_stats.get("count", 0) > 0:
                raw_s = pd.to_numeric(df[col], errors="coerce").dropna()
                py_total = round(float(raw_s.sum()), 2)
                py_avg = round(float(raw_s.mean()), 2)
                
                api_tot = api_stats["total"]
                api_avg = api_stats["average"]
                
                print(f"  Column [{col}]:")
                print(f"    API   -> Total: {api_tot}, Avg: {api_avg}")
                print(f"    Py    -> Total: {py_total}, Avg: {py_avg}")
                
                assert abs(py_total - api_tot) < 0.05, f"Mismatch in total for {col}: API {api_tot} vs Py {py_total}"
                assert abs(py_avg - api_avg) < 0.05, f"Mismatch in avg for {col}: API {api_avg} vs Py {py_avg}"
                print(f"    [MATCH VERIFIED]")


def test_edge_case_upload():
    print(f"\n=======================================================")
    print("TESTING EDGE-CASE FILE UPLOAD (POST /api/reports/upload)")
    print("=======================================================")
    
    edge_csv = "workspace/edge_case_test.csv"
    with open(edge_csv, "rb") as f:
        files = {"file": ("edge_case_test.csv", f, "text/csv")}
        resp = requests.post(f"{BASE_URL}/api/reports/upload", files=files, timeout=15)
        
    print(f"Upload HTTP Status Code: {resp.status_code}")
    assert resp.status_code == 200, f"Expected 200 but got {resp.status_code}: {resp.text}"
    
    # Verify strict JSON compliance (cannot contain NaN or Inf)
    res_json = resp.json()
    dumped = json.dumps(res_json, allow_nan=False)
    print(f"Edge case upload response is 100% JSON compliant! Payload length: {len(dumped)}")
    print(f"Data Quality Score: {res_json['kpis']['dataset_summary']['data_quality_score']}%")
    print(f"Numeric metrics detected: {list(res_json['kpis']['numeric_metrics'].keys())}")
    for col, nm in res_json['kpis']['numeric_metrics'].items():
        print(f"  * {col}: total={nm['total']}, avg={nm['average']}, count={nm['count']}")
    print("[PASS] Edge-case upload handles empty cells, all-empty column, zero-denominator, and bad date without any 500 error!")


if __name__ == "__main__":
    # Test all 3 datasets
    d1 = test_dataset("ecommerce_sales_india.csv", "Indian E-Commerce Sales & Orders")
    recompute_and_compare("ecommerce_sales_india.csv", d1)

    d2 = test_dataset("student_placement_data.csv", "College Campus Placement Analytics")
    recompute_and_compare("student_placement_data.csv", d2)

    d3 = test_dataset("freelance_agency_expenses.csv", "Freelance Agency Expense Ledger")
    recompute_and_compare("freelance_agency_expenses.csv", d3)

    # Test edge case upload
    test_edge_case_upload()

    print("\n=======================================================")
    print("ALL VERIFICATIONS COMPLETED SUCCESSFULLY WITH ZERO ERRORS!")
    print("=======================================================")
