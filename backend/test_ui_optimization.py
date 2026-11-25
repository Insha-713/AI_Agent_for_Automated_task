import os
import sys
import json
import urllib.request

base = "http://127.0.0.1:8000"

def test_url(path):
    url = base + path
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "UIVerifier"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            content = resp.read()
            return resp.status, len(content), content[:200]
    except Exception as e:
        return 0, 0, str(e)

print("--- Testing UI Routes & Assets ---")
routes = [
    "/",
    "/?tab=dashboard",
    "/?tab=help",
    "/?tab=showcase",
    "/?tab=workflows",
    "/?tab=schedules",
    "/?tab=monitoring",
    "/?tab=news",
    "/?tab=integrations",
    "/?tab=history",
    "/api/health",
    "/api/stats",
    "/api/schedules"
]

all_ok = True
for r in routes:
    status, length, preview = test_url(r)
    if status == 200:
        print(f"[OK 200] {r:30} -> {length} bytes")
    else:
        print(f"[FAIL]   {r:30} -> status={status}, err={preview}")
        all_ok = False

# Check built dist index.html
dist_index = "frontend/dist/index.html"
if os.path.exists(dist_index):
    with open(dist_index, "r", encoding="utf-8") as f:
        html = f.read()
    print(f"\n[OK] frontend/dist/index.html exists ({len(html)} bytes)")
    assert "AgentFlow" in html or "root" in html
else:
    print("\n[FAIL] frontend/dist/index.html missing!")
    all_ok = False

# Verify Reports and CSV are NOT in Sidebar or App bundle
app_js = None
for f in os.listdir("frontend/dist/assets"):
    if f.startswith("index-") and f.endswith(".js"):
        with open(os.path.join("frontend/dist/assets", f), "r", encoding="utf-8") as jf:
            app_js = jf.read()
        break

if app_js:
    # Check that Reports & Excel is not in nav
    has_reports_nav = "Reports & Excel" in app_js
    print(f"[VERIFIED] 'Reports & Excel' in sidebar: {has_reports_nav} (Expected: False)")
    has_clean_csv = "Clean my CSV" in app_js
    print(f"[VERIFIED] 'Clean my CSV' prompt: {has_clean_csv} (Expected: False)")
    has_help_centre = "Help Centre" in app_js
    print(f"[VERIFIED] 'Help Centre' in navigation: {has_help_centre} (Expected: True)")
    if has_reports_nav or has_clean_csv or not has_help_centre:
        all_ok = False

if all_ok:
    print("\nALL UI OPTIMIZATION CHECKS PASSED (100% SUCCESS)")
    sys.exit(0)
else:
    print("\nSOME UI CHECKS FAILED")
    sys.exit(1)
