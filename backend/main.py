from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

from backend.api import (
    routes_dataset,
    routes_analytics,
    routes_models,
    routes_forecast,
    routes_reports
)
from backend.services.data_service import DataStore
from backend.core.config import PRODUCTION_MODEL_NAME

app = FastAPI(
    title="AI-Powered Retail Sales Forecasting Platform API",
    description="Production-grade REST API for historical retail analytics, time-series forecasting, and model diagnostics.",
    version="2.0.0"
)

# Enable CORS for full-stack integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(routes_dataset.router)
app.include_router(routes_analytics.router)
app.include_router(routes_models.router)
app.include_router(routes_forecast.router)
app.include_router(routes_reports.router)

@app.get("/api/health", tags=["System"])
def health_check():
    """Health status and runtime readiness check."""
    try:
        summary = DataStore.get_summary()
        data_ready = summary is not None
        rows_count = summary.get("total_rows", 0) if summary else 0
    except Exception:
        data_ready = False
        rows_count = 0

    return {
        "status": "healthy" if data_ready else "initializing",
        "timestamp": datetime.now().isoformat(),
        "dataset_ready": data_ready,
        "dataset_rows": rows_count,
        "active_model": PRODUCTION_MODEL_NAME,
        "version": "2.0.0"
    }

# Mount static frontend production build if available
from pathlib import Path
from fastapi.staticfiles import StaticFiles

frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
else:
    @app.get("/", tags=["System"])
    def root():
        return {
            "platform": "AI-Powered Sales Prediction and Forecasting Platform",
            "status": "online",
            "docs_url": "/docs",
            "api_health": "/api/health"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
