from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Literal
import pandas as pd

from backend.services.data_service import DataStore
from backend.services.forecast_service import ForecastService
from backend.services.ml_service import ModelService
from backend.core.config import FORECAST_TIMEZONE

router = APIRouter(prefix="/api/forecast", tags=["Forecasting"])

class ForecastRequest(BaseModel):
    store_id: Optional[int] = None
    model_name: Optional[str] = "Random Forest"
    forecast_date: Optional[str] = None
    date_mode: Literal["future", "historical"] = "future"

@router.get("/target-date")
def get_target_date(mode: Literal["future", "historical"] = "future"):
    """Returns the current India date, the default target, and active history bounds."""
    try:
        df = DataStore.get_data()
        today = datetime.now(FORECAST_TIMEZONE).date()
        latest_date = df["Date"].max().date()
        historical_target = latest_date + timedelta(weeks=1)
        if mode == "future":
            weeks_until_future = max(1, (today - latest_date).days // 7 + 1)
            default_target = latest_date + timedelta(weeks=weeks_until_future)
        else:
            default_target = historical_target
        return {
            "today": today.isoformat(),
            "default_target_date": default_target.isoformat(),
            "timezone": "Asia/Kolkata",
            "latest_historical_date": latest_date.isoformat(),
            "max_horizon_weeks": 52,
            "mode": mode,
            "minimum_target_date": historical_target.isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/summary")
def get_forecast_summary():
    """Returns high-level metadata for the upcoming 1-week-ahead forecast."""
    try:
        df = DataStore.get_data()
        ForecastService.calibrate_and_fit(df)
        summary = ForecastService.get_forecast_summary()
        return {"success": True, "data": summary}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
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
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/actual-vs-predicted")
def get_actual_vs_predicted(
    store_id: Optional[int] = Query(None),
    model_name: str = Query("Random Forest"),
):
    """Returns active-data chronological holdout actuals and predictions for a selected model."""
    try:
        if store_id is not None:
            active_stores = set(DataStore.get_data()["Store"].unique())
            if store_id not in active_stores:
                raise ValueError(f"Store {store_id} is not present in the active dataset.")
        history = ModelService.get_actual_vs_predicted_timeline(model_name, store_id=store_id)
        return {"success": True, "data": history}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate")
def generate_interactive_forecast(req: ForecastRequest):
    """Generates an interactive forecast for a given store and model family."""
    try:
        df = DataStore.get_data()
        model_name = req.model_name
        if model_name is None:
            model_name = "Random Forest"
        elif not model_name.strip():
            raise HTTPException(status_code=422, detail="model_name must name a supported forecasting model.")
        target_date = None
        if req.forecast_date:
            try:
                target_date = pd.Timestamp(datetime.strptime(req.forecast_date, "%Y-%m-%d"))
            except ValueError:
                raise HTTPException(status_code=422, detail="forecast_date must use YYYY-MM-DD format.")
        latest_date = pd.Timestamp(df["Date"].max()).normalize()
        if target_date is None:
            if req.date_mode == "future":
                today = datetime.now(FORECAST_TIMEZONE).date()
                weeks_until_future = max(1, (today - latest_date.date()).days // 7 + 1)
                target_date = latest_date + pd.Timedelta(weeks=weeks_until_future)
            else:
                target_date = latest_date + pd.Timedelta(weeks=1)
        horizon_weeks = int((target_date.normalize() - latest_date).days // 7)
        if req.date_mode == "future":
            today = datetime.now(FORECAST_TIMEZONE).date()
            if target_date.date() <= today:
                raise HTTPException(
                    status_code=422,
                    detail="Future Forecast mode requires a target date after today. Choose a future weekly date or use Historical Next-Week Evaluation mode.",
                )
            if horizon_weeks > 52:
                raise HTTPException(
                    status_code=422,
                    detail=f"The active dataset ends {latest_date:%Y-%m-%d}; its default future target is {horizon_weeks} weeks beyond history. Upload newer sales data or use Historical Next-Week Evaluation mode.",
                )
        forecasts = ForecastService.generate_forecast_with_model(
            df,
            model_name=model_name,
            store_id=req.store_id,
            forecast_date=target_date,
        )
        sales = [row["Forecast_Sales"] for row in forecasts]
        interval_widths = [
            row["Upper_Bound"] - row["Lower_Bound"]
            for row in forecasts
            if row["Upper_Bound"] is not None and row["Lower_Bound"] is not None
        ]
        return {
            "success": True,
            "model_selected": model_name,
            "store_id": req.store_id,
            "stores_forecasted": len(forecasts),
            "forecast_date": forecasts[0]["Forecast_Date"] if forecasts else None,
            "horizon_weeks": int(
                ((datetime.strptime(forecasts[0]["Forecast_Date"], "%Y-%m-%d").date() - df["Date"].max().date()).days + 6) // 7
            ) if forecasts else 0,
            "summary": {
                "forecast_date": forecasts[0]["Forecast_Date"] if forecasts else None,
                "total_forecast_sales": float(sum(sales)),
                "mean_store_forecast": float(sum(sales) / len(sales)) if sales else 0.0,
                "mean_band_width": float(sum(interval_widths) / len(interval_widths)) if interval_widths else None,
                "model_used": model_name,
                "alert_counts": {
                    alert: sum(1 for row in forecasts if row["Alert"] == alert)
                    for alert in ("NORMAL", "HIGH", "LOW")
                },
                "intervals_available": bool(interval_widths),
            },
            "forecasts": forecasts
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
