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
│       ├── test_backend.py         # Unit & integration test suite (100% pass)
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

## 2. Core Machine Learning & Statistical Findings

### A. Original 14-Week Holdout Benchmark (27 July – 26 October 2012)
| Model | MAE (USD) | RMSE (USD) | WAPE (%) | R² Score | Key Empirical Finding |
|---|---:|---:|---:|---:|---|
| **Random Forest** | **$36,036.48** | $56,558.73 | **3.51%** | 0.9884 | Lowest holdout MAE and WAPE |
| **Gradient Boosting** | $36,167.74 | **$53,824.53** | 3.53% | **0.9895** | Lowest holdout RMSE (penalizes large misses) |
| **XGBoost** | $40,119.75 | $59,765.80 | 3.91% | 0.9871 | Regularized CPU gradient-boosted trees |
| **Last-Week Baseline** | $48,895.62 | $73,367.26 | 4.77% | 0.9805 | Lag 1 persistence |
| **Seasonal Baseline** | $52,325.36 | $83,959.12 | 5.10% | 0.9745 | Lag 52 persistence |

### B. Four-Period Chronological Nested Backtesting
| Model | Pooled MAE (USD) | Pooled RMSE (USD) | WAPE (%) | Key Empirical Finding |
|---|---:|---:|---:|---|
| **Seasonal Baseline** | **$61,207.48** | **$88,498.27** | **5.74%** | **Wins pooled nested backtesting** |
| **Random Forest** | $69,422.13 | $141,344.31 | 6.52% | Strong non-holiday performance |
| **Gradient Boosting** | $70,489.50 | $137,922.15 | 6.62% | Close second in backtests |
| **XGBoost** | $74,863.54 | $147,567.81 | 7.03% | Stable across outer folds |
| **Last-Week Baseline** | $98,545.96 | $191,208.72 | 9.25% | Prone to trend lag error |

> **Critical Retail Conclusion**: Machine Learning is not universally superior to traditional baselines. In nested backtesting across full annual cycles, the simple Seasonal Baseline (Lag 52) wins pooled MAE.

### C. Forecast Reliability & Store 36 Caution
- **Aggregate Holdout Coverage**: **98.89%** with a mean prediction band width of **$340,857.45**.
- **Individual Failure Retained**: Store 36 achieved only **78.57% empirical coverage** on the holdout (below the nominal 90% target).
- **Caveat**: Aggregate coverage does not guarantee safety for every store.

### D. Warning Utility Matrix
| Warning Rule | Alerts | Material Moves | Precision (%) | Recall (%) | False Alarms | Missed Moves |
|---|---:|---:|---:|---:|---:|---:|
| **Always NORMAL** | 0 | 396 | N/A | 0.00% | 0 | 396 |
| **Fixed ±15%** | 181 | 396 | 84.53% | 38.64% | 28 | 243 |
| **Origin Quantiles** | 97 | 396 | **91.75%** | 22.47% | **8** | 307 |

---

## 3. Installation & Setup Instructions (Windows PowerShell)

### Prerequisites
- Python 3.10+ (Verified with Python 3.13 / 3.14)
- Node.js v18+ & npm (Verified with Node v24.18.0)

### Step 1: Install Python Dependencies
```powershell
# From the project root
pip install -r requirements.txt
pip install fastapi uvicorn reportlab
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
All 6 tests verify:
- Dataset integrity & SHA-256 fingerprint matching
- Feature engineering without look-ahead leakage
- Metric calculations (MAE, RMSE, WAPE, R²)
- Forecast generation for 2 November 2012
- ReportLab executive PDF generation & CSV export
- API endpoints response format and status codes

---

## 6. API Reference

- `GET /api/health`: Health status and system readiness.
- `GET /api/dataset/summary`: Dataset integrity, dimensions, statistics, and SHA-256 checksum.
- `GET /api/dataset/preview`: Paginated records with store and date filters.
- `POST /api/dataset/upload`: Upload and validate a new compatible CSV dataset.
- `POST /api/dataset/reset`: Reset active dataset to canonical Walmart.csv.
- `GET /api/analytics/sales`: Weekly aggregate timeline, holiday comparisons, and monthly seasonality.
- `GET /api/analytics/stores`: Store performance rankings (top/bottom performers).
- `GET /api/models/benchmarks`: Original 14-week holdout benchmark table.
- `GET /api/models/backtest`: Four-period nested backtest results.
- `GET /api/models/stability`: Paired RF vs GB stability analysis and bootstrap confidence intervals.
- `GET /api/models/diagnostics`: Store-level coverage array, feature ablation, and alert utility.
- `GET /api/forecast/summary`: 1-week-ahead forecast metadata (Date: 2012-11-02).
- `GET /api/forecast/stores`: Store-level point predictions, 90% bounds, and alert flags.
- `POST /api/forecast/generate`: Interactive forecast generation endpoint.
- `GET /api/reports/pdf`: Stream and download executive analytics PDF report.
- `GET /api/reports/csv`: Stream and download store forecasts CSV.
