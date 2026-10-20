import urllib.request
import json

req = urllib.request.Request(
    'http://127.0.0.1:8000/api/workflows/generate',
    data=json.dumps({'prompt': 'Fetch top 5 AI news in India and save to workspace/render_test_news.txt'}).encode(),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req) as resp:
    plan = json.loads(resp.read().decode())
    print('Generated Workflow Plan:')
    print('Title:', plan.get('title'))
    print('Steps count:', len(plan.get('steps', [])))
    for s in plan.get('steps', []):
        print(f"  • {s.get('id')}: {s.get('name')} (Tool: {s.get('tool')})")
