import urllib.request
import json

def get_json(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode())

def post_json(url, data=None):
    if data is None:
        data = {}
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode(),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode())

print("=== 1. Live GET /api/health ===")
status, health_data = get_json("http://127.0.0.1:8000/api/health")
print(f"HTTP {status}:")
print(json.dumps(health_data, indent=2))

print("\n=== 2. Live GET /api/integrations/status ===")
status, int_data = get_json("http://127.0.0.1:8000/api/integrations/status")
print(f"HTTP {status} (Total: {int_data.get('total_integrations')}, Connected: {int_data.get('connected_count')}):")
for s in int_data.get('services', []):
    print(f"  • {s.get('service'):<10} | {s.get('display_name'):<25} | Status: {s.get('status'):<12} | Latency: {s.get('latency_ms')}ms")

print("\n=== 3. Live POST /api/integrations/test/llm ===")
status, test_data = post_json("http://127.0.0.1:8000/api/integrations/test/llm")
print(f"HTTP {status}:")
print(json.dumps(test_data, indent=2))
