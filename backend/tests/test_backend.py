import pytest
from fastapi.testclient import TestClient
import numpy as np
import pandas as pd
import io
from pathlib import Path

from backend.main import app
from backend.services.data_service import DataStore, load_and_validate_csv
from backend.services.feature_service import make_features, prepare_supervised_data
from backend.services.ml_service import ModelService, metrics
from backend.services.forecast_service import ForecastService
from backend.services.report_service import generate_pdf_report, generate_forecasts_csv
from backend.services.diagnostic_service import get_interval_reliability_data
from backend.core.config import DATA_PATH, EXPECTED_SHA256
from backend.api.routes_reports import download_pdf_report

def test_data_integrity():
    df, summary = load_and_validate_csv(DATA_PATH)
    assert summary["total_rows"] == 6435
    assert summary["total_stores"] == 45
    assert summary["weeks_per_store"] == 143
    assert summary["missing_cells"] == 0
    assert summary["duplicate_rows"] == 0
    assert summary["sha256"] == EXPECTED_SHA256

def test_feature_engineering_no_leakage():
    df, _ = load_and_validate_csv(DATA_PATH)
    sup = prepare_supervised_data(df)
    # Warmup of 53 weeks leaves 4,050 supervised rows (45 stores * 90 weeks)
    assert len(sup) == 45 * (143 - 53)
    assert len(sup) == 4050
    assert not sup[["Weekly_Sales"]].isna().any().any()

def test_short_history_has_no_complete_53_week_supervised_rows():
    df, _ = load_and_validate_csv(io.BytesIO(_small_csv_bytes()))
    features = make_features(df)
    supervised = prepare_supervised_data(df)

    assert len(df) == 50
    assert features["sales_lag_1"].notna().sum() == 45
    assert features["rolling_mean_4"].notna().sum() == 30
    assert features["sales_lag_53"].notna().sum() == 0
    assert supervised.empty

def test_metrics_function():
    actual = np.array([100.0, 200.0, 300.0])
    pred = np.array([110.0, 190.0, 310.0])
    m = metrics(actual, pred)
    assert np.isclose(m["MAE"], 10.0)
    assert np.isclose(m["RMSE"], 10.0)
    assert np.isclose(m["WAPE (%)"], 100 * 30 / 600)  # 5%
    assert m["R2"] > 0.95

def test_forecast_service():
    df, _ = load_and_validate_csv(DATA_PATH)
    ForecastService.reset_cache()
    ForecastService.calibrate_and_fit(df)
    forecasts = ForecastService.get_forecasts()
    assert len(forecasts) == 45
    assert forecasts[0]["Forecast_Date"] == "2012-11-02"
    assert all(f["Lower_Bound"] <= f["Forecast_Sales"] <= f["Upper_Bound"] for f in forecasts)
    assert all("holdout" in f["Band_Caution"].lower() for f in forecasts)

def test_report_generation():
    df, summary = load_and_validate_csv(DATA_PATH)
    ForecastService.reset_cache()
    ForecastService.calibrate_and_fit(df)
    forecasts = ForecastService.get_forecasts()
    reliability = get_interval_reliability_data(df)
    
    pdf_bytes = generate_pdf_report(summary, [], forecasts, reliability)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF")

    csv_str = generate_forecasts_csv(forecasts)
    assert "Forecast_Sales" in csv_str
    assert "Lower_Bound" in csv_str

    unavailable_pdf = generate_pdf_report(
        summary,
        [],
        [],
        {"workflows": [], "interpretation": "Insufficient history for model evaluation."},
        forecast_unavailable_reason="The active dataset has limited history.",
    )
    assert unavailable_pdf.startswith(b"%PDF-")
    assert unavailable_pdf.rstrip().endswith(b"%%EOF")

def test_api_endpoints(monkeypatch):
    canonical_df, canonical_summary = load_and_validate_csv(DATA_PATH)
    canonical_summary.update({
        "original_filename": DATA_PATH.name,
        "stored_filename": DATA_PATH.name,
        "storage_path": str(DATA_PATH.resolve()),
        "storage_status": "Persistent",
        "storage_verified": DATA_PATH.is_file(),
        "columns": list(canonical_df.columns),
    })
    monkeypatch.setattr(DataStore, "_active_df", canonical_df)
    monkeypatch.setattr(DataStore, "_summary", canonical_summary)
    monkeypatch.setattr(DataStore, "_active_metadata", None)
    ForecastService.reset_cache()
    ModelService.reset_cache()

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

    target_date = (DataStore.get_data()["Date"].max() + pd.Timedelta(weeks=1)).strftime("%Y-%m-%d")
    client = TestClient(app)
    live_forecast = client.post(
        "/api/forecast/generate",
        json={"model_name": "Random Forest", "store_id": None, "forecast_date": target_date, "date_mode": "historical"},
    )
    assert live_forecast.status_code == 200
    payload = live_forecast.json()
    assert payload["model_selected"] == "Random Forest"
    assert payload["forecast_date"] == target_date
    assert payload["horizon_weeks"] == 1
    assert payload["stores_forecasted"] == 45
    assert len(payload["forecasts"]) == 45
    assert all(np.isfinite(row["Forecast_Sales"]) for row in payload["forecasts"])

    pdf_response = client.get("/api/reports/pdf")
    assert pdf_response.status_code == 200
    assert pdf_response.headers["content-type"] == "application/pdf"
    assert ".pdf" in pdf_response.headers["content-disposition"]
    assert pdf_response.content.startswith(b"%PDF-")
    assert pdf_response.content.rstrip().endswith(b"%%EOF")

def _small_csv_bytes(weeks=10):
    rows = []
    start = pd.Timestamp("2024-01-05")
    for store in range(1, 6):
        for week in range(weeks):
            rows.append({
                "Store": store,
                "Date": start + pd.Timedelta(weeks=week),
                "Weekly_Sales": float(store * 1000 + week * 25),
                "Holiday_Flag": 0,
                "Temperature": 60.0,
                "Fuel_Price": 3.0,
                "CPI": 200.0,
                "Unemployment": 5.0,
            })
    buffer = io.StringIO()
    pd.DataFrame(rows).to_csv(buffer, index=False)
    return buffer.getvalue().encode("utf-8")

def test_seasonal_baseline_needs_exactly_52_prior_weeks():
    df, _ = load_and_validate_csv(io.BytesIO(_small_csv_bytes(weeks=52)))
    target_date = df["Date"].max() + pd.Timedelta(weeks=1)
    forecasts = ForecastService.generate_forecast_with_model(
        df,
        model_name="Seasonal baseline",
        forecast_date=target_date,
    )
    expected = df.sort_values(["Store", "Date"]).groupby("Store").first()["Weekly_Sales"]
    assert len(forecasts) == 5
    for forecast in forecasts:
        assert forecast["Forecast_Sales"] == expected.loc[forecast["Store"]]

def test_last_week_baseline_uses_one_real_observation():
    df, _ = load_and_validate_csv(io.BytesIO(_small_csv_bytes(weeks=1)))
    forecasts = ForecastService.generate_forecast_with_model(
        df,
        model_name="Last-week baseline",
        forecast_date=df["Date"].max() + pd.Timedelta(weeks=1),
    )
    expected = df.set_index("Store")["Weekly_Sales"]
    assert len(forecasts) == 5
    for forecast in forecasts:
        assert forecast["Forecast_Sales"] == expected.loc[forecast["Store"]]

def test_pdf_route_succeeds_when_forecast_is_unavailable(monkeypatch):
    irregular = pd.read_csv(io.BytesIO(_small_csv_bytes(weeks=2)))
    irregular["Date"] = pd.to_datetime(irregular["Date"])
    irregular.loc[irregular["Date"] == pd.Timestamp("2024-01-12"), "Date"] += pd.Timedelta(weeks=1)
    csv_buffer = io.StringIO()
    irregular.to_csv(csv_buffer, index=False)
    df, summary = load_and_validate_csv(io.BytesIO(csv_buffer.getvalue().encode("utf-8")))
    summary["original_filename"] = "one-week.csv"
    monkeypatch.setattr(DataStore, "_active_df", df)
    monkeypatch.setattr(DataStore, "_summary", summary)
    monkeypatch.setattr(DataStore, "_active_metadata", None)
    ForecastService.reset_cache()
    ModelService.reset_cache()

    response = TestClient(app).get("/api/reports/pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"].endswith(".pdf\"")
    assert response.content.startswith(b"%PDF-")
    assert response.content.rstrip().endswith(b"%%EOF")

def test_upload_persistence_restart_and_small_dataset_forecast(monkeypatch, tmp_path):
    import backend.services.data_service as data_service

    uploads_dir = tmp_path / "uploads"
    active_pointer = uploads_dir / "active_dataset.json"
    monkeypatch.setattr(data_service, "UPLOADS_DIR", uploads_dir)
    monkeypatch.setattr(data_service, "ACTIVE_DATASET_PATH", active_pointer)
    monkeypatch.setattr(DataStore, "_active_df", None)
    monkeypatch.setattr(DataStore, "_summary", None)
    monkeypatch.setattr(DataStore, "_active_metadata", None)
    ForecastService.reset_cache()

    client = TestClient(app)
    original = _small_csv_bytes()
    response = client.post(
        "/api/dataset/upload",
        files={"file": ("vortex_ai_test_duplicate.csv", original, "text/csv")},
    )
    assert response.status_code == 200
    metadata = response.json()["dataset"]
    stored_path = Path(metadata["storage_path"])
    assert stored_path.is_file()
    assert stored_path.read_bytes() == original
    assert metadata["original_filename"] == "vortex_ai_test_duplicate.csv"
    assert metadata["file_size"] == len(original)
    assert metadata["sha256"] == __import__("hashlib").sha256(original).hexdigest()
    assert response.json()["summary"]["storage_status"] == "Persistent"

    DataStore._active_df = None
    DataStore._summary = None
    DataStore._active_metadata = None
    reloaded = DataStore.get_data()
    assert len(reloaded) == 50
    assert DataStore.get_summary()["original_filename"] == "vortex_ai_test_duplicate.csv"

    target_date = reloaded["Date"].max() + pd.Timedelta(weeks=1)
    forecast_response = client.post(
        "/api/forecast/generate",
        json={
            "model_name": "Last-week baseline",
            "store_id": None,
            "forecast_date": target_date.strftime("%Y-%m-%d"),
            "date_mode": "historical",
        },
    )
    assert forecast_response.status_code == 200
    payload = forecast_response.json()
    assert payload["model_selected"] == "Last-week baseline"
    assert payload["forecast_date"] == target_date.strftime("%Y-%m-%d")
    assert payload["horizon_weeks"] == 1
    assert payload["stores_forecasted"] == 5
    forecasts = payload["forecasts"]
    assert len(forecasts) == 5
    assert all(np.isfinite(row["Forecast_Sales"]) for row in forecasts)
    assert all(row["Lower_Bound"] is None and row["Upper_Bound"] is None for row in forecasts)
    assert all("Last-week baseline" in row["Status"] for row in forecasts)
    latest_actuals = reloaded.loc[reloaded["Date"] == reloaded["Date"].max()].set_index("Store")["Weekly_Sales"]
    assert all(row["Forecast_Sales"] == latest_actuals.loc[row["Store"]] for row in forecasts)
    assert all(row["Alert"] == "UNAVAILABLE" for row in forecasts)
    assert all(row["Prior_13W_Mean"] is None and row["Change_vs_Mean_Pct"] is None for row in forecasts)

    store_response = client.post(
        "/api/forecast/generate",
        json={
            "model_name": "Last-week baseline",
            "store_id": 3,
            "forecast_date": target_date.strftime("%Y-%m-%d"),
            "date_mode": "historical",
        },
    )
    assert store_response.status_code == 200
    assert len(store_response.json()["forecasts"]) == 1
    assert store_response.json()["forecasts"][0]["Store"] == 3

    baseline_history = client.get(
        "/api/forecast/actual-vs-predicted",
        params={"model_name": "Last-week baseline"},
    )
    assert baseline_history.status_code == 200
    history_points = baseline_history.json()["data"]
    expected_holdout_dates = sorted(reloaded["Date"].unique())[-2:]
    assert [point["Date"] for point in history_points] == [
        pd.Timestamp(date).strftime("%Y-%m-%d") for date in expected_holdout_dates
    ]
    for point in history_points:
        date = pd.Timestamp(point["Date"])
        current = reloaded.loc[reloaded["Date"] == date, "Weekly_Sales"].sum()
        previous = reloaded.loc[reloaded["Date"] == date - pd.Timedelta(weeks=1), "Weekly_Sales"].sum()
        assert point["Actual"] == current
        assert point["Predicted"] == previous

    insufficient = client.post(
        "/api/forecast/generate",
        json={
            "model_name": "Random Forest",
            "forecast_date": target_date.strftime("%Y-%m-%d"),
            "date_mode": "historical",
        },
    )
    assert insufficient.status_code == 422
    assert "0 supervised records" in insufficient.json()["detail"]
    assert "54 weekly observations" in insufficient.json()["detail"]

    seasonal_insufficient = client.post(
        "/api/forecast/generate",
        json={"model_name": "Seasonal baseline", "forecast_date": target_date.strftime("%Y-%m-%d"), "date_mode": "historical"},
    )
    assert seasonal_insufficient.status_code == 422
    assert "at least 52 historical weeks" in seasonal_insufficient.json()["detail"]

    multiweek_last_week = client.post(
        "/api/forecast/generate",
        json={
            "model_name": "Last-week baseline",
            "forecast_date": (target_date + pd.Timedelta(weeks=1)).strftime("%Y-%m-%d"),
            "date_mode": "historical",
        },
    )
    assert multiweek_last_week.status_code == 422
    assert "one-week forecast only" in multiweek_last_week.json()["detail"]

    pdf_response = client.get("/api/reports/pdf")
    assert pdf_response.status_code == 200
    assert pdf_response.headers["content-type"] == "application/pdf"
    assert ".pdf" in pdf_response.headers["content-disposition"]
    assert pdf_response.content.startswith(b"%PDF-")
    assert pdf_response.content.rstrip().endswith(b"%%EOF")

    scoped_pdf = client.get(
        "/api/reports/pdf",
        params={
            "store_id": 3,
            "model_name": "Last-week baseline",
            "forecast_date": target_date.strftime("%Y-%m-%d"),
            "date_mode": "historical",
        },
    )
    assert scoped_pdf.status_code == 200
    assert scoped_pdf.headers["content-type"] == "application/pdf"
    assert scoped_pdf.content.startswith(b"%PDF-")
    assert scoped_pdf.content.rstrip().endswith(b"%%EOF")

    scoped_summary = client.get("/api/dataset/summary", params={"store_id": 3})
    assert scoped_summary.status_code == 200
    assert scoped_summary.json()["data"]["total_rows"] == 10
    assert scoped_summary.json()["data"]["total_stores"] == 1
    assert scoped_summary.json()["data"]["summary_scope_store_id"] == 3

def test_future_target_mode_flags_old_dataset(monkeypatch):
    df, summary = load_and_validate_csv(io.BytesIO(_small_csv_bytes()))
    monkeypatch.setattr(DataStore, "_active_df", df)
    monkeypatch.setattr(DataStore, "_summary", summary)
    monkeypatch.setattr(DataStore, "_active_metadata", None)
    client = TestClient(app)

    target_response = client.get("/api/forecast/target-date", params={"mode": "future"})
    assert target_response.status_code == 200
    target = target_response.json()
    assert target["mode"] == "future"
    assert target["default_target_date"] > target["today"]
    assert target["minimum_target_date"] == "2024-03-15"

    forecast_response = client.post(
        "/api/forecast/generate",
        json={
            "model_name": "Last-week baseline",
            "forecast_date": target["default_target_date"],
            "date_mode": "future",
        },
    )
    assert forecast_response.status_code == 422
    assert "Upload newer sales data" in forecast_response.json()["detail"]

def test_walmart_all_available_models_and_store_scope():
    from backend.services.ml_service import get_base_estimators

    df, _ = load_and_validate_csv(DATA_PATH)
    target_date = df["Date"].max() + pd.Timedelta(weeks=1)
    model_names = [
        "Random Forest",
        "Gradient Boosting",
        "Last-week baseline",
        "Seasonal baseline",
    ]
    if "XGBoost" in get_base_estimators():
        model_names.append("XGBoost")

    for model_name in model_names:
        ForecastService.reset_cache()
        all_store_forecasts = ForecastService.generate_forecast_with_model(
            df,
            model_name=model_name,
            forecast_date=target_date,
        )
        assert len(all_store_forecasts) == 45
        assert all(row["Forecast_Date"] == target_date.strftime("%Y-%m-%d") for row in all_store_forecasts)
        assert all(np.isfinite(row["Forecast_Sales"]) for row in all_store_forecasts)

    ForecastService.reset_cache()
    one_store_model = ForecastService.generate_forecast_with_model(
        df,
        model_name="Random Forest",
        store_id=1,
        forecast_date=target_date,
    )
    assert len(one_store_model) == 1
    assert one_store_model[0]["Store"] == 1
    assert np.isfinite(one_store_model[0]["Forecast_Sales"])

    one_store_baseline = ForecastService.generate_forecast_with_model(
        df,
        model_name="Last-week baseline",
        store_id=2,
        forecast_date=target_date,
    )
    assert len(one_store_baseline) == 1
    assert one_store_baseline[0]["Store"] == 2
    actual_last_week = df.loc[
        (df["Store"] == 2) & (df["Date"] == df["Date"].max()), "Weekly_Sales"
    ].iloc[0]
    assert one_store_baseline[0]["Forecast_Sales"] == actual_last_week

def test_paired_stability_reports_runtime_chronological_folds():
    from backend.services.diagnostic_service import get_paired_stability_data

    df, _ = load_and_validate_csv(DATA_PATH)
    stability = get_paired_stability_data(df)
    assert stability["evaluated_folds"] == 4
    assert len(stability["folds"]) == 4
    assert stability["rf_week_wins"] + stability["gb_week_wins"] <= 4
    assert len(stability["bootstrap_2fold_block_95_ci"]) == 2
    assert all(
        fold["train_end"] < fold["test_start"] <= fold["test_end"]
        for fold in stability["folds"]
    )
    assert all(
        np.isfinite(fold["Random Forest_mae_usd"])
        and np.isfinite(fold["Gradient Boosting_mae_usd"])
        for fold in stability["folds"]
    )

def test_short_dataset_leakage_audit_reports_real_limitations():
    from backend.services.diagnostic_service import get_leakage_audit

    df, _ = load_and_validate_csv(io.BytesIO(_small_csv_bytes()))
    audit = get_leakage_audit(df)
    checks = {check["name"]: check for check in audit["checks"]}
    assert audit["total"] == len(audit["checks"])
    assert audit["passed"] + audit["failed"] == audit["total"]
    assert checks["Lag features use prior store sales only"]["passed"] is True
    assert checks["Rolling features are shifted before aggregation"]["passed"] is True
    assert checks["Chronological train/test split"]["passed"] is False
    assert audit["failed"] > 0
