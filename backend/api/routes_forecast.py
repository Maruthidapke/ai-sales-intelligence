from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.services.data_service import DataStore
from backend.services.forecast_service import ForecastService

router = APIRouter(prefix="/api/forecast", tags=["Forecasting"])

class ForecastRequest(BaseModel):
    store_id: Optional[int] = None
    model_name: Optional[str] = "Random Forest"

@router.get("/summary")
def get_forecast_summary():
    """Returns high-level metadata for the upcoming 1-week-ahead forecast."""
    try:
        df = DataStore.get_data()
        ForecastService.calibrate_and_fit(df)
        summary = ForecastService.get_forecast_summary()
        return {"success": True, "data": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stores")
def get_all_store_forecasts(store_id: Optional[int] = Query(None)):
    """Returns store-level forecasts with point estimates, 90% bounds, and alert flags."""
    try:
        df = DataStore.get_data()
        ForecastService.calibrate_and_fit(df)
        forecasts = ForecastService.get_forecasts(store_id=store_id)
        return {"success": True, "data": forecasts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/actual-vs-predicted")
def get_actual_vs_predicted(store_id: Optional[int] = Query(None)):
    """Returns recent actual sales vs model predictions with forecast horizon point."""
    try:
        df = DataStore.get_data()
        history = ForecastService.get_actual_vs_predicted_history(df, store_id=store_id)
        return {"success": True, "data": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate")
def generate_interactive_forecast(req: ForecastRequest):
    """Generates an interactive forecast for a given store and model family."""
    try:
        df = DataStore.get_data()
        model_name = req.model_name or "Random Forest"
        forecasts = ForecastService.generate_forecast_with_model(
            df,
            model_name=model_name,
            store_id=req.store_id
        )
        return {
            "success": True,
            "model_selected": model_name,
            "store_id": req.store_id,
            "forecasts": forecasts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
