import json
from backend.reports import (
    load_and_clean_tabular_data,
    calculate_kpis,
    generate_charts_data,
    generate_executive_summary,
    export_report_files,
    clean_nan_and_inf,
    get_available_sample_datasets
)

def run_tests():
    # Test 3 preloaded samples
    for s in get_available_sample_datasets():
        fn = s["filename"]
        print(f"Testing preloaded: {fn}")
        data = load_and_clean_tabular_data(fn)
        kpis = calculate_kpis(data)
        charts = generate_charts_data(data, kpis)
        summary = generate_executive_summary(data["file_name"], data, kpis)
        exports = export_report_files(data["file_name"], data, kpis, summary)
        payload = {
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
        cleaned = clean_nan_and_inf(payload)
        dumped = json.dumps(cleaned, allow_nan=False)
        print(f"  [PASS] {fn}: JSON valid (len: {len(dumped)})")

    # Test edge case CSV
    print("Testing edge case: edge_case_test.csv")
    data = load_and_clean_tabular_data("edge_case_test.csv")
    kpis = calculate_kpis(data)
    charts = generate_charts_data(data, kpis)
    summary = generate_executive_summary(data["file_name"], data, kpis)
    exports = export_report_files(data["file_name"], data, kpis, summary)
    payload = {
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
    cleaned = clean_nan_and_inf(payload)
    dumped = json.dumps(cleaned, allow_nan=False)
    print(f"  [PASS] edge_case_test.csv: JSON valid (len: {len(dumped)})")
    print("ALL TESTS PASSED WITH allow_nan=False!")

if __name__ == "__main__":
    run_tests()
