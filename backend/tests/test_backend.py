import pytest
from fastapi.testclient import TestClient
import numpy as np
import pandas as pd

from backend.main import app
from backend.services.data_service import DataStore, load_and_validate_csv
from backend.services.feature_service import make_features, prepare_supervised_data
from backend.services.ml_service import metrics
from backend.services.forecast_service import ForecastService
from backend.services.report_service import generate_pdf_report, generate_forecasts_csv
from backend.services.diagnostic_service import get_interval_reliability_data
from backend.core.config import DATA_PATH, EXPECTED_SHA256

def test_data_integrity():
    df, summary = load_and_validate_csv(DATA_PATH)
    assert summary["total_rows"] == 6435
    assert summary["total_stores"] == 45
    assert summary["weeks_per_store"] == 143
    assert summary["missing_cells"] == 0
    assert summary["duplicate_rows"] == 0
    assert summary["sha256"] == EXPECTED_SHA256

def test_feature_engineering_no_leakage():
    df = DataStore.get_data()
    sup = prepare_supervised_data(df)
    # Warmup of 53 weeks leaves 4,050 supervised rows (45 stores * 90 weeks)
    assert len(sup) == 45 * (143 - 53)
    assert len(sup) == 4050
    assert not sup[["Weekly_Sales"]].isna().any().any()

def test_metrics_function():
    actual = np.array([100.0, 200.0, 300.0])
    pred = np.array([110.0, 190.0, 310.0])
    m = metrics(actual, pred)
    assert np.isclose(m["MAE"], 10.0)
    assert np.isclose(m["RMSE"], 10.0)
    assert np.isclose(m["WAPE (%)"], 100 * 30 / 600)  # 5%
    assert m["R2"] > 0.95

def test_forecast_service():
    df = DataStore.get_data()
    ForecastService.calibrate_and_fit(df)
    forecasts = ForecastService.get_forecasts()
    assert len(forecasts) == 45
    assert forecasts[0]["Forecast_Date"] == "2012-11-02"
    s36 = next(f for f in forecasts if f["Store"] == 36)
    assert "BELOW NOMINAL" in s36["Band_Caution"]

def test_report_generation():
    df = DataStore.get_data()
    summary = DataStore.get_summary()
    ForecastService.calibrate_and_fit(df)
    forecasts = ForecastService.get_forecasts()
    reliability = get_interval_reliability_data()
    
    pdf_bytes = generate_pdf_report(summary, [], forecasts, reliability)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF")

    csv_str = generate_forecasts_csv(forecasts)
    assert "Forecast_Sales" in csv_str
    assert "Lower_Bound" in csv_str

def test_api_endpoints():
    from backend.api.routes_dataset import get_dataset_summary
    from backend.api.routes_analytics import get_sales_analytics
    from backend.api.routes_models import get_benchmarks
    from backend.api.routes_forecast import get_all_store_forecasts

    r_summary = get_dataset_summary()
    assert r_summary["success"] is True
    assert r_summary["data"]["total_rows"] == 6435

    r_sales = get_sales_analytics(store_id=None)
    assert r_sales["success"] is True
    assert "timeline" in r_sales

    r_bench = get_benchmarks()
    assert r_bench["success"] is True
    assert len(r_bench["data"]) >= 5

    r_fc = get_all_store_forecasts(store_id=None)
    assert r_fc["success"] is True
    assert len(r_fc["data"]) == 45
