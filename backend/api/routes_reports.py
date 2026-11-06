import re
from pathlib import Path
from datetime import datetime
from typing import Optional, Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
import pandas as pd

from backend.services.data_service import DataStore
from backend.services.ml_service import ModelService
from backend.services.forecast_service import ForecastService
from backend.services.diagnostic_service import get_interval_reliability_data
from backend.services.report_service import generate_pdf_report, generate_forecasts_csv
from backend.core.config import FORECAST_TIMEZONE

router = APIRouter(prefix="/api/reports", tags=["Reports"])

def _dataset_stem(summary):
    original_name = summary.get("original_filename") or "active_dataset.csv"
    stem = Path(str(original_name)).stem
    return re.sub(r"[^A-Za-z0-9._-]+", "_", stem).strip("._") or "active_dataset"

def _default_target_date(df, date_mode: Literal["future", "historical"]) -> pd.Timestamp:
    latest = pd.Timestamp(df["Date"].max()).normalize()
    if date_mode == "historical":
        return latest + pd.Timedelta(weeks=1)
    today = datetime.now(FORECAST_TIMEZONE).date()
    weeks_until_future = max(1, (today - latest.date()).days // 7 + 1)
    return latest + pd.Timedelta(weeks=weeks_until_future)

def _requested_forecast(
    df,
    model_name: str,
    forecast_date: Optional[str],
    date_mode: Literal["future", "historical"],
    store_id: Optional[int],
):
    try:
        latest_date = pd.Timestamp(df["Date"].max()).normalize()
        target = (
            pd.Timestamp(datetime.strptime(forecast_date, "%Y-%m-%d")).normalize()
            if forecast_date else _default_target_date(df, date_mode)
        )
        horizon_weeks = int((target - latest_date).days // 7)
        if date_mode == "future":
            today = datetime.now(FORECAST_TIMEZONE).date()
            if target.date() <= today:
                raise ValueError("Future Forecast mode requires a target date after today.")
            if horizon_weeks > 52:
                raise ValueError(
                    f"The active dataset ends {latest_date:%Y-%m-%d}; the requested forecast is {horizon_weeks} weeks beyond history. Upload newer sales data or use Historical Next-Week Evaluation mode."
                )
        return ForecastService.generate_forecast_with_model(
            df,
            model_name=model_name,
            store_id=store_id,
            forecast_date=target,
        ), None
    except ValueError as exc:
        return [], str(exc)

@router.get("/pdf")
def download_pdf_report(
    store_id: Optional[int] = None,
    model_name: str = "Random Forest",
    forecast_date: Optional[str] = None,
    date_mode: Literal["future", "historical"] = "future",
):
    """Generates and downloads a publication-grade executive analytics PDF report."""
    try:
        df = DataStore.get_data()
        scoped_df = df if store_id is None else df.loc[df["Store"] == store_id]
        if scoped_df.empty:
            raise HTTPException(status_code=422, detail=f"Store {store_id} is not present in the active dataset.")
        summary = DataStore.get_summary(store_id=store_id)
        try:
            benchmarks = ModelService.get_benchmark_comparison(store_id=store_id)
        except ValueError as exc:
            benchmarks = []
            benchmark_unavailable_reason = str(exc)
        else:
            benchmark_unavailable_reason = None
        forecasts, forecast_unavailable_reason = _requested_forecast(
            df, model_name, forecast_date, date_mode, store_id
        )
        report_forecast_date = forecast_date or _default_target_date(df, date_mode).strftime("%Y-%m-%d")
        try:
            reliability = get_interval_reliability_data(scoped_df)
        except (ValueError, KeyError) as exc:
            reliability = {"workflows": [], "interpretation": f"Reliability analytics unavailable: {exc}"}

        pdf_bytes = generate_pdf_report(
            summary,
            benchmarks,
            forecasts,
            reliability,
            forecast_unavailable_reason=forecast_unavailable_reason or benchmark_unavailable_reason or "",
            scope_context={
                "store_id": store_id,
                "model_name": model_name,
                "forecast_date": report_forecast_date,
                "date_mode": date_mode,
            },
        )
        filename = f"{_dataset_stem(summary)}_Sales_Forecasting_Executive_Report.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-Content-Type-Options": "nosniff",
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/csv")
def download_forecast_csv(
    store_id: Optional[int] = None,
    model_name: str = "Random Forest",
    forecast_date: Optional[str] = None,
    date_mode: Literal["future", "historical"] = "future",
):
    """Generates and downloads a CSV of 1-week-ahead store forecasts and bounds."""
    try:
        df = DataStore.get_data()
        forecasts, unavailable_reason = _requested_forecast(
            df, model_name, forecast_date, date_mode, store_id
        )
        if not forecasts:
            raise HTTPException(
                status_code=422,
                detail=f"No supported forecast is available for CSV export: {unavailable_reason}",
            )
        csv_str = generate_forecasts_csv(forecasts)
        filename = f"{_dataset_stem(DataStore.get_summary(store_id=store_id))}_Store_Sales_Forecasts_{forecasts[0]['Forecast_Date']}.csv"
        return Response(
            content=csv_str,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
