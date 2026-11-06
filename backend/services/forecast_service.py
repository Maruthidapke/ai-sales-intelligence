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
    _undercovered_stores: List[int] = []
    _recent_actual_vs_pred: Optional[pd.DataFrame] = None

    @classmethod
    def reset_cache(cls):
        cls._calibration_done = False
        cls._store_interval_q = None
        cls._global_interval_q = None
        cls._deployment_model = None
        cls._cached_forecasts = None
        cls._forecast_date = None
        cls._undercovered_stores = []
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

        # Keep the calibrated model frozen so its calibration residuals remain applicable.
        cls._deployment_model = calib_train_model

        # Evaluate the later holdout with that same model; never fit it on holdout targets.
        recent_eval = test_df[["Store", "Date", "Weekly_Sales"]].copy()
        recent_eval["Prediction"] = cls._deployment_model.predict(test_df[ALL_FEATURES])
        cls._recent_actual_vs_pred = recent_eval
        holdout_scales = np.maximum(test_df["rolling_mean_13"].to_numpy(dtype=float), 1.0)
        holdout_q = test_df["Store"].map(cls._store_interval_q).fillna(cls._global_interval_q).to_numpy(dtype=float)
        holdout_lower = np.maximum(0.0, recent_eval["Prediction"].to_numpy(dtype=float) - holdout_q * holdout_scales)
        holdout_upper = recent_eval["Prediction"].to_numpy(dtype=float) + holdout_q * holdout_scales
        covered = (
            (test_df["Weekly_Sales"].to_numpy(dtype=float) >= holdout_lower)
            & (test_df["Weekly_Sales"].to_numpy(dtype=float) <= holdout_upper)
        )
        coverage_by_store = pd.DataFrame({
            "Store": test_df["Store"].to_numpy(),
            "covered": covered,
        }).groupby("Store")["covered"].mean()
        cls._undercovered_stores = [
            int(store) for store, coverage in coverage_by_store.items() if coverage < NOMINAL_COVERAGE
        ]

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
                f"BELOW NOMINAL coverage on holdout ({NOMINAL_COVERAGE:.0%} target)"
                if s in cls._undercovered_stores
                else "Empirical residual interval; holdout coverage reviewed"
                for s in future_feats["Store"]
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
    def generate_forecast_with_model(
        cls,
        raw_df: pd.DataFrame,
        model_name: str = "Random Forest",
        store_id: Optional[int] = None,
        forecast_date: Optional[pd.Timestamp] = None,
    ) -> List[Dict[str, Any]]:
        """Generates recursive weekly forecasts without substituting unavailable models."""
        supported = {
            "Random Forest", "Gradient Boosting", "XGBoost",
            "Last-week baseline", "Seasonal baseline",
        }
        if model_name not in supported:
            raise ValueError(f"Unsupported forecasting model: {model_name}")
        if raw_df.empty or raw_df["Date"].isna().any():
            raise ValueError("A valid dataset with parsed dates is required to forecast.")

        latest_date = pd.Timestamp(raw_df["Date"].max()).normalize()
        fc_date = pd.Timestamp(forecast_date).normalize() if forecast_date is not None else latest_date + pd.Timedelta(weeks=1)
        if fc_date <= latest_date:
            raise ValueError(f"Forecast date must be after the latest historical date ({latest_date:%Y-%m-%d}).")
        delta_days = (fc_date - latest_date).days
        if delta_days % 7:
            raise ValueError(
                f"Forecast date must align with the weekly data cadence; choose a date in 7-day increments after {latest_date:%Y-%m-%d}."
            )
        horizon = delta_days // 7
        if horizon > 52:
            raise ValueError(
                f"The requested date is {horizon} weeks beyond the latest historical data. "
                "Forecast horizons are limited to 52 weeks; choose a nearer date or upload newer history."
            )
        if model_name == "Last-week baseline" and horizon != 1:
            raise ValueError(
                "Last-week baseline supports a one-week forecast only. For longer horizons, select a trained model or Seasonal baseline with 52 weeks of history."
            )

        store_list = sorted(int(store) for store in raw_df["Store"].unique())
        if store_id is not None:
            if store_id not in store_list:
                raise ValueError(f"Store {store_id} is not present in the active dataset.")
            store_list = [store_id]
        history_lengths = raw_df.groupby("Store")["Weekly_Sales"].count()
        for store in store_list:
            required_history = (
                52 if model_name == "Seasonal baseline"
                else 1 if model_name == "Last-week baseline"
                else 2
            )
            if int(history_lengths.get(store, 0)) < required_history:
                raise ValueError(
                    f"{model_name} requires at least {required_history} historical weeks "
                    f"for Store {store}; only {int(history_lengths.get(store, 0))} are available."
                )
            store_dates = pd.DatetimeIndex(
                raw_df.loc[raw_df["Store"] == store, "Date"].sort_values()
            )
            if store_dates.max().normalize() != latest_date:
                raise ValueError(
                    f"Store {store} has no observation on the latest dataset date "
                    f"({latest_date:%Y-%m-%d}); aligned store histories are required."
                )
            if len(store_dates) > 1 and not store_dates.to_series().diff().dropna().eq(pd.Timedelta(weeks=1)).all():
                raise ValueError(f"Store {store} does not have consecutive weekly history; a weekly forecast cannot be generated.")

        feature_df = prepare_supervised_data(raw_df)
        model = None
        if model_name in {"Random Forest", "Gradient Boosting", "XGBoost"}:
            missing_stores = [
                store for store in store_list
                if int((feature_df["Store"] == store).sum()) == 0
            ]
            if len(feature_df) < 50 or missing_stores:
                raise ValueError(
                    f"{model_name} needs at least 50 supervised records and 54 weekly "
                    "observations per forecasted store. The active dataset provides "
                    f"{len(feature_df)} supervised records; insufficient history for "
                    f"stores: {missing_stores or store_list}."
                )
            estimators = get_base_estimators()
            if model_name not in estimators:
                raise ValueError(f"{model_name} is unavailable because its optional dependency is not installed.")
            use_calibrated_model = (
                model_name == PRODUCTION_MODEL_NAME
                and horizon == 1
                and feature_df["Date"].nunique() >= 20
            )
            if use_calibrated_model:
                if not cls._calibration_done:
                    cls.calibrate_and_fit(raw_df)
                model = cls._deployment_model
                if model is None:
                    raise ValueError("The calibrated production model could not be loaded.")
            else:
                model = pipeline_for(clone(estimators[model_name]))
                model.fit(feature_df[ALL_FEATURES], feature_df["Weekly_Sales"])

        working_history = raw_df[["Store", "Date", "Weekly_Sales"]].copy()
        last_predictions: Dict[int, Dict[str, float]] = {}
        for step in range(1, horizon + 1):
            step_date = fc_date if step == horizon else latest_date + pd.Timedelta(weeks=step)
            future_rows = pd.DataFrame({
                "Store": store_list,
                "Date": step_date,
                "Weekly_Sales": np.nan,
            })
            future_features = make_features(
                pd.concat([working_history, future_rows], ignore_index=True)
            )
            future_features = future_features.loc[
                (future_features["Date"] == step_date)
                & future_features["Store"].isin(store_list)
            ].sort_values("Store").reset_index(drop=True)

            if model_name == "Last-week baseline":
                centers = future_features["sales_lag_1"].to_numpy(dtype=float)
            elif model_name == "Seasonal baseline":
                centers = future_features["sales_lag_52"].to_numpy(dtype=float)
            else:
                if model is None:
                    raise ValueError(f"{model_name} was not initialized.")
                centers = model.predict(future_features[ALL_FEATURES])

            if len(centers) != len(store_list) or not np.isfinite(centers).all():
                raise ValueError("Forecast model produced missing or non-finite predictions.")
            centers = np.maximum(centers.astype(float), 0.0)
            for store, center in zip(future_features["Store"], centers):
                last_predictions[int(store)] = {
                    "forecast": float(center),
                    "prior_mean": float(future_features.loc[future_features["Store"] == store, "rolling_mean_13"].iloc[0])
                    if pd.notna(future_features.loc[future_features["Store"] == store, "rolling_mean_13"].iloc[0])
                    else None,
                }
            working_history = pd.concat([
                working_history,
                pd.DataFrame({
                    "Store": future_features["Store"].astype(int),
                    "Date": step_date,
                    "Weekly_Sales": centers,
                }),
            ], ignore_index=True)

        output = []
        calibrated = (
            model_name == PRODUCTION_MODEL_NAME
            and horizon == 1
            and cls._global_interval_q is not None
            and cls._store_interval_q is not None
        )
        if calibrated:
            assert cls._global_interval_q is not None and cls._store_interval_q is not None
        for store in store_list:
            values = last_predictions[store]
            center = values["forecast"]
            scale = values["prior_mean"] if values["prior_mean"] is not None and values["prior_mean"] > 0 else None
            q = (
                float(cls._store_interval_q.get(store, cls._global_interval_q))
                if calibrated else None
            )
            lower = max(0.0, center - q * scale) if q is not None else None
            upper = center + q * scale if q is not None else None
            deviation = (center / scale - 1) * 100 if scale else None
            alert = (
                "LOW" if deviation <= cls._alert_low else
                "HIGH" if deviation >= cls._alert_high else "NORMAL"
            ) if deviation is not None and cls._calibration_done else "UNAVAILABLE"
            output.append({
                "Store": store,
                "Forecast_Date": fc_date.strftime("%Y-%m-%d"),
                "Forecast_Sales": center,
                "Lower_Bound": lower,
                "Upper_Bound": upper,
                "Prior_13W_Mean": float(scale) if scale is not None else None,
                "Change_vs_Mean_Pct": float(deviation) if deviation is not None else None,
                "Alert": alert,
                "Band_Caution": (
                    (
                        "BELOW NOMINAL coverage on holdout"
                        if store in cls._undercovered_stores
                        else "Empirical residual interval; not a per-store guarantee"
                    )
                    if calibrated else "Prediction interval unavailable: no valid model-specific calibration"
                ),
                "Status": f"MODEL FORECAST ({model_name}); horizon {horizon} week(s)",
            })
        return output

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
