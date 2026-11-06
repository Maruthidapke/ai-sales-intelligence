# VORTEX RETAIL // AI-Powered Sales Prediction and Forecasting Platform

A production-grade, full-stack enterprise retail analytics and predictive forecasting platform transforming the historical Walmart weekly sales study (45 stores, 6,435 observations) into a commercial SaaS intelligence application.

---

## 1. Executive Overview & System Architecture

The platform bridges empirical data science with a **Midnight Black**, **Electric Cobalt Blue**, and **Acid Lime** Bento Grid user interface. It combines automated data cleaning, leakage-safe feature engineering, machine learning ensemble modeling, rolling-origin nested backtesting, empirical prediction intervals, and publication-ready PDF briefings.

```text
AI_for_businesse/
├── backend/
│   ├── main.py                     # FastAPI application entrypoint & static mount
│   ├── core/
│   │   └── config.py               # Hyperparameters, paths, and baseline references
│   ├── services/
│   │   ├── data_service.py         # CSV ingestion, SHA-256 checks & panel validation
│   │   ├── feature_service.py      # Leakage-safe lag and rolling feature creation
│   │   ├── ml_service.py           # Model pipelines (RF, GB, XGBoost, Baselines)
│   │   ├── forecast_service.py     # 1-week-ahead point & empirical band forecasts
│   │   ├── diagnostic_service.py   # Backtesting, ablation, and alert precision/recall
│   │   └── report_service.py       # ReportLab PDF & CSV generation engine
│   ├── api/
│   │   ├── routes_dataset.py       # Dataset summary, preview, upload & reset
│   │   ├── routes_analytics.py     # Aggregated sales, store trends, holiday lift
│   │   ├── routes_models.py        # Benchmark comparisons, backtests, stability
│   │   ├── routes_forecast.py      # Store-level live predictions & parameters
│   │   └── routes_reports.py       # PDF & CSV download endpoints
│   └── tests/
│       ├── test_backend.py         # Backend unit and integration test suite
│       └── probe_server.py         # Live end-to-end socket & API probe
│
├── frontend/
│   ├── src/
│   │   ├── types/api.ts            # Strict TypeScript API interfaces
│   │   ├── api/client.ts           # Axios client for REST communication
│   │   ├── components/             # Reusable Bento Cards, Glass Panels, Metric Cards
│   │   ├── pages/                  # All 8 dedicated platform modules
│   │   │   ├── DashboardPage.tsx   # Module 1: Executive Overview
│   │   │   ├── DatasetPage.tsx     # Module 2: Dataset Explorer & Upload Wizard
│   │   │   ├── AnalyticsPage.tsx   # Module 3: Sales Analytics & Seasonality
│   │   │   ├── ForecastPage.tsx    # Module 4: Prediction Center (Live Engine)
│   │   │   ├── ComparisonPage.tsx  # Module 5: Model Comparison & Backtests
│   │   │   ├── DiagnosticsPage.tsx # Module 6: Reliability & Insights
│   │   │   ├── ReportsPage.tsx     # Module 7: Reports & Exports
│   │   │   └── SettingsPage.tsx    # Module 8: Settings & Methodology
│   │   ├── App.tsx                 # Responsive application shell
│   │   └── index.css               # Tailwind CSS v4 & Liquid Glass styling
│   ├── package.json
│   ├── vite.config.ts
│   └── dist/                       # Pre-compiled static production bundle
│
├── data/
│   └── Walmart.csv                 # Canonical dataset (SHA-256 verified)
├── Sales_Forecasting_ML.ipynb      # Preserved primary source of truth
├── AI_Based_Sales_Prediction_and_Forecasting_Report.pdf
├── requirements.txt                # Python dependencies
└── .env.example
```

---

## 2. Active-Data Evaluation and Forecasting

Uploaded CSV files are persisted under `backend/uploads/` as UUID-named originals, with JSON metadata sidecars. `backend/uploads/active_dataset.json` records the active upload; the backend verifies the referenced file before marking it **Persistent** and reloads it on startup.

Model benchmarks, chronological backtests, reliability, warning utility, and paired stability results are calculated at runtime from the currently active dataset and selected store scope. The historical benchmark numbers from prior versions are intentionally not repeated here as current results.

The supervised machine-learning feature set includes lags through 53 weeks. A dataset with only 10 weeks per store therefore has **zero complete supervised rows**; this is the expected warm-up requirement, not a feature-generation failure. Random Forest, Gradient Boosting, or XGBoost must report insufficient history in that case. The one-week Last-Week baseline remains available when each selected store has a valid latest observation. Forecast intervals, 13-week comparisons, and alerts are shown only when their required history/calibration exists.

Prediction Center offers two date modes:
- **Future Forecast**: a cadence-aligned target after today, limited to 52 weeks beyond the latest observation. Old data requires a newer upload.
- **Historical Next-Week Evaluation**: forecasts the next week after the latest observation, useful for explicitly evaluating archived datasets.

Both modes use actual observations; multi-week supported model forecasts are recursive. The Last-Week baseline is deliberately limited to one week.

---

## 3. Installation & Setup Instructions (Windows PowerShell)

### Prerequisites
- Python 3.10+ (Verified with Python 3.13 / 3.14)
- Node.js v18+ & npm (Verified with Node v24.18.0)

### Step 1: Install Python Dependencies
```powershell
# From the project root
pip install -r requirements.txt
```

### Step 2: Build the Frontend (Pre-built in `frontend/dist`)
```powershell
cd frontend
npm install
npm run build
cd ..
```

---

## 4. How to Run the Application

### Option A: Single Unified Server (Recommended)
FastAPI serves both the REST API and the compiled React SPA:
```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser.

### Option B: Separate Frontend Dev Server
If you want hot-reloading for frontend modifications:
1. **Terminal 1 (Backend)**:
   ```powershell
   python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```
2. **Terminal 2 (Frontend)**:
   ```powershell
   cd frontend
   npm run dev
   ```
   Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 5. Automated Verification & Testing

Execute the complete backend test suite:
```powershell
python -m pytest backend/tests/test_backend.py -v
```
The backend tests verify:
- Dataset integrity & SHA-256 fingerprint matching
- Feature engineering without look-ahead leakage
- Metric calculations (MAE, RMSE, WAPE, R²)
- Persistent upload, restart reload, and baseline forecasts on a small dataset
- Model/forecast behavior against the active dataset
- ReportLab executive PDF generation & CSV export
- API endpoints response format and status codes

---

## 6. API Reference

- `GET /api/health`: Health status and system readiness.
- `GET /api/dataset/summary`: Dataset integrity, dimensions, statistics, and SHA-256 checksum.
- `GET /api/dataset/preview`: Paginated records with store and date filters.
- `POST /api/dataset/upload`: Validate and persist a new compatible CSV dataset.
- `GET /api/dataset/uploads`: List saved uploads and their storage metadata.
- `POST /api/dataset/uploads/{stored_filename}/activate`: Select a previously uploaded dataset.
- `GET /api/dataset/uploads/{stored_filename}/download`: Download an uploaded source CSV.
- `POST /api/dataset/reset`: Reset active dataset to canonical Walmart.csv.
- `GET /api/analytics/sales`: Weekly aggregate timeline, holiday comparisons, and monthly seasonality.
- `GET /api/analytics/stores`: Store performance rankings (top/bottom performers).
- `GET /api/models/benchmarks?store_id={id}`: Chronological holdout comparison from active data (all stores when omitted).
- `GET /api/models/backtest?store_id={id}`: Expanding-window chronological backtest from active data.
- `GET /api/models/stability?store_id={id}`: Paired RF/GB expanding-window results and block-bootstrap interval.
- `GET /api/models/diagnostics?store_id={id}`: Scope-specific interval coverage, feature ablation, and warning utility.
- `GET /api/models/leakage-audit?store_id={id}`: Runtime chronological, past-only feature, and preprocessing checks.
- `GET /api/forecast/target-date?mode=future|historical`: Current local date, active history, and cadence-aligned target.
- `GET /api/forecast/summary`: Calibrated 1-week-ahead forecast metadata when sufficient history exists.
- `GET /api/forecast/stores`: Store-level point predictions, 90% bounds, and alert flags.
- `POST /api/forecast/generate`: Generate an active-data forecast with `store_id`, `model_name`, `forecast_date` (`YYYY-MM-DD`), and `date_mode` (`future` or `historical`); supported model horizons are limited to 52 weeks.
- `GET /api/reports/pdf`: Download a valid PDF using optional `store_id`, `model_name`, `forecast_date`, and `date_mode`; a dataset-only report is returned when that forecast cannot be supported.
- `GET /api/reports/csv`: Download a CSV for the requested scope/model/date when a supported forecast is available.
