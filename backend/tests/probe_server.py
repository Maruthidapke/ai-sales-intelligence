import threading
import time
import urllib.request
import json
import uvicorn
from backend.main import app

def run_server():
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="warning")

if __name__ == "__main__":
    t = threading.Thread(target=run_server, daemon=True)
    t.start()
    time.sleep(2)

    # 1. Health
    with urllib.request.urlopen("http://127.0.0.1:8001/api/health") as resp:
        health = json.loads(resp.read().decode())
        print("HEALTH_ENDPOINT:", health)

    # 2. Dataset summary
    with urllib.request.urlopen("http://127.0.0.1:8001/api/dataset/summary") as resp:
        summary = json.loads(resp.read().decode())
        print(f"DATASET_SUMMARY: {summary['data']['total_rows']} rows, {summary['data']['total_stores']} stores, SHA={summary['data']['sha256'][:16]}...")

    # 3. Model benchmarks
    with urllib.request.urlopen("http://127.0.0.1:8001/api/models/benchmarks") as resp:
        benchmarks = json.loads(resp.read().decode())
        print(f"BENCHMARKS: {len(benchmarks['data'])} models returned.")
        for m in benchmarks['data']:
            print(f"  - {m['Model']}: MAE=${m['MAE']:,.2f}, WAPE={m['WAPE (%)']:.2f}%")

    # 4. Forecasts
    with urllib.request.urlopen("http://127.0.0.1:8001/api/forecast/stores?store_id=36") as resp:
        fc = json.loads(resp.read().decode())
        s36 = fc['data'][0]
        print(f"STORE 36 FORECAST: ${s36['Forecast_Sales']:,.2f} (90% Band: ${s36['Lower_Bound']:,.2f} - ${s36['Upper_Bound']:,.2f})")
        print(f"STORE 36 CAUTION: {s36['Band_Caution']}")

    # 5. Frontend HTML
    with urllib.request.urlopen("http://127.0.0.1:8001/") as resp:
        html = resp.read().decode()
        print(f"FRONTEND_STATIC: status={resp.status}, contains_vortex={'VORTEX AI' in html}")

    print("PROBE_SERVER_SUCCESS: ALL CHECKS PASSED!")

