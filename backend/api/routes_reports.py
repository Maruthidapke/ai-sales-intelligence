from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from backend.services.data_service import DataStore
from backend.services.ml_service import ModelService
from backend.services.forecast_service import ForecastService
from backend.services.diagnostic_service import get_interval_reliability_data
from backend.services.report_service import generate_pdf_report, generate_forecasts_csv

router = APIRouter(prefix="/api/reports", tags=["Reports"])

@router.get("/pdf")
def download_pdf_report():
    """Generates and downloads a publication-grade executive analytics PDF report."""
    try:
        df = DataStore.get_data()
        summary = DataStore.get_summary()
        benchmarks = ModelService.get_benchmark_comparison()
        ForecastService.calibrate_and_fit(df)
        forecasts = ForecastService.get_forecasts()
        reliability = get_interval_reliability_data()

        pdf_bytes = generate_pdf_report(summary, benchmarks, forecasts, reliability)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="Walmart_Sales_Forecasting_Executive_Report.pdf"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/csv")
def download_forecast_csv():
    """Generates and downloads a CSV of 1-week-ahead store forecasts and bounds."""
    try:
        df = DataStore.get_data()
        ForecastService.calibrate_and_fit(df)
        forecasts = ForecastService.get_forecasts()
        csv_str = generate_forecasts_csv(forecasts)
        return Response(
            content=csv_str,
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="Walmart_Store_Sales_Forecasts_20121102.csv"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

