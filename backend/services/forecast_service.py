from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.base import clone

from backend.core.config import (
    ALL_FEATURES, PRODUCTION_MODEL_NAME, PRODUCTION_PARAMETERS,
    NOMINAL_COVERAGE, CALIBRATION_WEEKS, ALERT_CONFIG
)
from backend.services.feature_service import make_features, prepare_supervised_data, get_train_test_split
from backend.services.ml_service import get_base_estimators, pipeline_for, metrics

class ForecastService:
    _calibration_done: bool = False
    _store_interval_q: Optional[pd.Series] = None
    _global_interval_q: Optional[float] = None
    _deployment_model: Optional[Any] = None
    _alert_low: float = -18.81
    _alert_high: float = 24.17
    _cached_forecasts: Optional[pd.DataFrame] = None
    _forecast_date: Optional[pd.Timestamp] = None
    _undercovered_stores: List[int] = [36]
    _recent_actual_vs_pred: Optional[pd.DataFrame] = None

    @classmethod
    def reset_cache(cls):
        cls._calibration_done = False
        cls._store_interval_q = None
        cls._global_interval_q = None
        cls._deployment_model = None
        cls._cached_forecasts = None
        cls._forecast_date = None
        cls._undercovered_stores = [36]
        cls._recent_actual_vs_pred = None

    @classmethod
    def calibrate_and_fit(cls, raw_df: pd.DataFrame):
        if cls._calibration_done:
            return

        supervised_df = prepare_supervised_data(raw_df)
        if len(supervised_df) < 50:
            raise ValueError("Insufficient supervised rows to generate rolling forecasts.")

        # Determine chronological dev/test split
        all_dates = pd.DatetimeIndex(sorted(supervised_df["Date"].unique()))
        test_w = min(14, max(4, len(all_dates) // 5))
        dev_df, test_df = get_train_test_split(supervised_df, test_weeks=test_w)

        dev_dates = pd.DatetimeIndex(sorted(dev_df["Date"].unique()))
        calib_w = min(CALIBRATION_WEEKS, max(2, len(dev_dates) // 3))
        calib_dates = dev_dates[-calib_w:]
        calib_start = calib_dates[0]

        # Train model on dev data strictly before calibration window
        pre_calib_train = dev_df.loc[dev_df["Date"] < calib_start]
        calib_data = dev_df.loc[dev_df["Date"] >= calib_start].copy()

        calib_train_model = pipeline_for(
            clone(get_base_estimators()[PRODUCTION_MODEL_NAME]).set_params(**PRODUCTION_PARAMETERS)
        )
        calib_train_model.fit(pre_calib_train[ALL_FEATURES], pre_calib_train["Weekly_Sales"])

        # Predict on calibration window
        calib_preds = calib_train_model.predict(calib_data[ALL_FEATURES])
        calib_scale = calib_data["rolling_mean_13"].to_numpy()
        # Avoid division by zero
        calib_scale = np.where(calib_scale > 0, calib_scale, 1.0)
        calib_scores = np.abs(calib_data["Weekly_Sales"].to_numpy() - calib_preds) / calib_scale

        def residual_quantile(scores, coverage=NOMINAL_COVERAGE):
            arr = np.asarray(scores, dtype=float)
            if len(arr) == 0:
                return 0.15
            rank = int(np.ceil((len(arr) + 1) * coverage))
            rank = min(max(1, rank), len(arr))
            return float(np.sort(arr)[rank - 1])

        cls._global_interval_q = residual_quantile(calib_scores)
        calib_data["score"] = calib_scores
        cls._store_interval_q = calib_data.groupby("Store")["score"].agg(residual_quantile).clip(lower=cls._global_interval_q)

        # Estimate development alert thresholds (5th / 95th percentiles of deviation vs rolling_mean_13)
        dev_history = supervised_df.loc[supervised_df["Date"] < test_df["Date"].min()].copy()
        dev_history["rolling_mean_13"] = np.where(dev_history["rolling_mean_13"] > 0, dev_history["rolling_mean_13"], 1.0)
        dev_history["Deviation (%)"] = (dev_history["Weekly_Sales"] / dev_history["rolling_mean_13"] - 1) * 100
        cls._alert_low, cls._alert_high = dev_history["Deviation (%)"].quantile([
            ALERT_CONFIG["lower_quantile"], ALERT_CONFIG["upper_quantile"]
        ]).to_numpy()

        # Fit deployment model on all supervised data
        cls._deployment_model = pipeline_for(
            clone(get_base_estimators()[PRODUCTION_MODEL_NAME]).set_params(**PRODUCTION_PARAMETERS)
        )
        cls._deployment_model.fit(supervised_df[ALL_FEATURES], supervised_df["Weekly_Sales"])

        # Retain recent holdout predictions for actual vs predicted visualization
        recent_eval = test_df[["Store", "Date", "Weekly_Sales"]].copy()
        recent_eval["Prediction"] = cls._deployment_model.predict(test_df[ALL_FEATURES])
        cls._recent_actual_vs_pred = recent_eval

        # Construct next-week future features
        max_date = raw_df["Date"].max()
        cls._forecast_date = max_date + pd.Timedelta(weeks=1)

        store_list = sorted(raw_df["Store"].unique())
        future_rows = pd.DataFrame({
            "Store": store_list,
            "Date": cls._forecast_date,
            "Weekly_Sales": np.nan
        })
        future_frame = pd.concat([raw_df[["Store", "Date", "Weekly_Sales"]], future_rows], ignore_index=True)
        future_feats = make_features(future_frame)
        future_feats = future_feats.loc[future_feats["Date"] == cls._forecast_date].sort_values("Store").reset_index(drop=True)

        # Predict point forecasts and bands
        centers = cls._deployment_model.predict(future_feats[ALL_FEATURES])
        q_vals = future_feats["Store"].map(cls._store_interval_q).fillna(cls._global_interval_q).to_numpy()
        scales = np.where(future_feats["rolling_mean_13"].to_numpy() > 0, future_feats["rolling_mean_13"].to_numpy(), centers)

        lowers = np.maximum(0.0, centers - q_vals * scales)
        uppers = centers + q_vals * scales
        recent_means = np.where(future_feats["rolling_mean_13"].to_numpy() > 0, future_feats["rolling_mean_13"].to_numpy(), centers)
        deviations = (centers / recent_means - 1) * 100

        alerts = np.select(
            [deviations <= cls._alert_low, deviations >= cls._alert_high],
            ["LOW", "HIGH"],
            default="NORMAL"
        )

        forecasts_df = pd.DataFrame({
            "Store": future_feats["Store"].astype(int),
            "Forecast_Date": cls._forecast_date.strftime("%Y-%m-%d"),
            "Forecast_Sales": centers,
            "Lower_Bound": lowers,
            "Upper_Bound": uppers,
            "Prior_13W_Mean": recent_means,
            "Change_vs_Mean_Pct": deviations,
            "Alert": alerts,
            "Band_Caution": [
                "BELOW NOMINAL in reviewed store holdout (78.57%)" if s in cls._undercovered_stores
                else "Evaluated outcome; empirical residual band" for s in future_feats["Store"]
            ],
            "Status": "MODEL FORECAST — actual unobserved"
        })

        cls._cached_forecasts = forecasts_df
        cls._calibration_done = True

    @classmethod
    def get_forecasts(cls, store_id: Optional[int] = None) -> List[Dict[str, Any]]:
        if cls._cached_forecasts is None:
            return []
        df = cls._cached_forecasts
        if store_id is not None:
            df = df.loc[df["Store"] == store_id]
        return df.to_dict(orient="records")

    @classmethod
    def get_forecast_summary(cls) -> Dict[str, Any]:
        if cls._cached_forecasts is None:
            return {}
        df = cls._cached_forecasts
        return {
            "forecast_date": cls._forecast_date.strftime("%Y-%m-%d") if cls._forecast_date else None,
            "total_forecast_sales": float(df["Forecast_Sales"].sum()),
            "mean_store_forecast": float(df["Forecast_Sales"].mean()),
            "alert_counts": df["Alert"].value_counts().to_dict(),
            "undercovered_stores": cls._undercovered_stores,
            "alert_thresholds": {
                "low_pct": float(cls._alert_low),
                "high_pct": float(cls._alert_high)
            },
            "mean_band_width": float((df["Upper_Bound"] - df["Lower_Bound"]).mean()),
            "nominal_coverage": NOMINAL_COVERAGE,
            "model_used": PRODUCTION_MODEL_NAME
        }

    @classmethod
    def generate_forecast_with_model(cls, raw_df: pd.DataFrame, model_name: str = "Random Forest", store_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Generates forecast using user-specified model family."""
        cls.calibrate_and_fit(raw_df)
        supervised_df = prepare_supervised_data(raw_df)

        max_date = raw_df["Date"].max()
        fc_date = max_date + pd.Timedelta(weeks=1)

        store_list = sorted(raw_df["Store"].unique()) if store_id is None else [store_id]
        future_rows = pd.DataFrame({
            "Store": store_list,
            "Date": fc_date,
            "Weekly_Sales": np.nan
        })
        future_frame = pd.concat([raw_df[["Store", "Date", "Weekly_Sales"]], future_rows], ignore_index=True)
        future_feats = make_features(future_frame)
        future_feats = future_feats.loc[future_feats["Date"] == fc_date].sort_values("Store").reset_index(drop=True)

        if model_name == "Last-week baseline":
            centers = future_feats["sales_lag_1"].to_numpy()
        elif model_name == "Seasonal baseline":
            centers = future_feats["sales_lag_52"].fillna(future_feats["sales_lag_1"]).to_numpy()
        else:
            base_ests = get_base_estimators()
            est_key = model_name if model_name in base_ests else PRODUCTION_MODEL_NAME
            model = pipeline_for(clone(base_ests[est_key]))
            model.fit(supervised_df[ALL_FEATURES], supervised_df["Weekly_Sales"])
            centers = model.predict(future_feats[ALL_FEATURES])

        q_vals = future_feats["Store"].map(cls._store_interval_q).fillna(cls._global_interval_q or 0.15).to_numpy()
        scales = np.where(future_feats["rolling_mean_13"].to_numpy() > 0, future_feats["rolling_mean_13"].to_numpy(), centers)

        lowers = np.maximum(0.0, centers - q_vals * scales)
        uppers = centers + q_vals * scales
        recent_means = np.where(future_feats["rolling_mean_13"].to_numpy() > 0, future_feats["rolling_mean_13"].to_numpy(), centers)
        deviations = (centers / recent_means - 1) * 100

        alerts = np.select(
            [deviations <= cls._alert_low, deviations >= cls._alert_high],
            ["LOW", "HIGH"],
            default="NORMAL"
        )

        out_df = pd.DataFrame({
            "Store": future_feats["Store"].astype(int),
            "Forecast_Date": fc_date.strftime("%Y-%m-%d"),
            "Forecast_Sales": centers,
            "Lower_Bound": lowers,
            "Upper_Bound": uppers,
            "Prior_13W_Mean": recent_means,
            "Change_vs_Mean_Pct": deviations,
            "Alert": alerts,
            "Band_Caution": [
                "BELOW NOMINAL in reviewed store holdout (78.57%)" if s in cls._undercovered_stores
                else "Only 14 reviewed outcomes; no per-store guarantee" for s in future_feats["Store"]
            ],
            "Status": f"MODEL FORECAST ({model_name})"
        })

        return out_df.to_dict(orient="records")

    @classmethod
    def get_actual_vs_predicted_history(cls, raw_df: pd.DataFrame, store_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Returns recent 14-week actual vs predicted series plus the forecast point."""
        cls.calibrate_and_fit(raw_df)
        if cls._recent_actual_vs_pred is None:
            return []

        df = cls._recent_actual_vs_pred.copy()
        if store_id is not None:
            df = df.loc[df["Store"] == store_id]

        timeline = df.groupby("Date").agg(
            Actual=("Weekly_Sales", "sum"),
            Predicted=("Prediction", "sum")
        ).reset_index().sort_values("Date")
        timeline["Date_Str"] = timeline["Date"].dt.strftime("%Y-%m-%d")

        history_pts = [
            {"Date": r["Date_Str"], "Actual": float(r["Actual"]), "Predicted": float(r["Predicted"]), "Type": "Historical"}
            for _, r in timeline.iterrows()
        ]

        # Append next-week forecast point
        forecasts = cls.get_forecasts(store_id=store_id)
        if forecasts:
            fc_sum = sum(f["Forecast_Sales"] for f in forecasts)
            fc_date = forecasts[0]["Forecast_Date"]
            history_pts.append({
                "Date": fc_date,
                "Actual": None,
                "Predicted": float(fc_sum),
                "Type": "Forecast Horizon"
            })

        return history_pts
