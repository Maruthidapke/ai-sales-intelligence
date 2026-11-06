from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd

from backend.core.config import ALL_FEATURES, REMOVED_FEATURES, SEED
from backend.services.feature_service import make_features, prepare_supervised_data, get_train_test_split
from backend.services.ml_service import (
    ModelService, get_base_estimators, pipeline_for, SELECTED_BENCHMARK_PARAMS, metrics,
)
from sklearn.base import clone

def get_interval_reliability_data(df: Optional[pd.DataFrame] = None) -> Dict[str, Any]:
    """Fits on chronological development data, calibrates before holdout, and measures holdout coverage."""
    if df is None:
        from backend.services.data_service import DataStore
        df = DataStore.get_data()
    supervised = prepare_supervised_data(df)
    if len(supervised) < 50:
        return {
            "workflows": [],
            "nominal_target": 90.0,
            "undercovered_stores": [],
            "store_coverage_details": [],
            "interpretation": (
                f"Intervals are unavailable: only {len(supervised)} supervised rows remain after "
                "the 53-week feature warm-up; at least 50 are required."
            ),
        }

    dev, test = get_train_test_split(supervised)
    dev_dates = pd.DatetimeIndex(sorted(dev["Date"].unique()))
    if len(dev_dates) < 3 or dev.empty or test.empty:
        return {
            "workflows": [],
            "nominal_target": 90.0,
            "undercovered_stores": [],
            "store_coverage_details": [],
            "interpretation": "There are not enough chronological development and holdout dates to calibrate and independently test intervals.",
        }
    calibration_weeks = min(16, max(2, len(dev_dates) // 3))
    calibration_start = dev_dates[-calibration_weeks]
    fit_rows = dev.loc[dev["Date"] < calibration_start]
    calibration = dev.loc[dev["Date"] >= calibration_start]
    if len(fit_rows) < 50 or calibration.empty or test.empty:
        return {
            "workflows": [],
            "nominal_target": 90.0,
            "undercovered_stores": [],
            "store_coverage_details": [],
            "interpretation": "There is not enough chronological history to fit, calibrate, and independently test prediction intervals.",
        }

    model = pipeline_for(clone(get_base_estimators()["Random Forest"]))
    model.fit(fit_rows[ALL_FEATURES], fit_rows["Weekly_Sales"])
    calibration_predictions = model.predict(calibration[ALL_FEATURES])
    scales = np.maximum(calibration["rolling_mean_13"].to_numpy(dtype=float), 1.0)
    scores = np.abs(calibration["Weekly_Sales"].to_numpy(dtype=float) - calibration_predictions) / scales
    rank = min(len(scores), max(1, int(np.ceil((len(scores) + 1) * 0.90))))
    global_q = float(np.sort(scores)[rank - 1])

    predictions = model.predict(test[ALL_FEATURES])
    test_scales = np.maximum(test["rolling_mean_13"].to_numpy(dtype=float), 1.0)
    lower = np.maximum(0.0, predictions - global_q * test_scales)
    upper = predictions + global_q * test_scales
    covered = (
        (test["Weekly_Sales"].to_numpy(dtype=float) >= lower)
        & (test["Weekly_Sales"].to_numpy(dtype=float) <= upper)
    )
    evaluated = test[["Store"]].copy()
    evaluated["covered"] = covered
    store_details = [
        {
            "store": int(store),
            "coverage": float(group["covered"].mean() * 100),
            "legacy_coverage": None,
        }
        for store, group in evaluated.groupby("Store")
    ]
    overall_coverage = float(covered.mean() * 100)
    undercovered = [row["store"] for row in store_details if row["coverage"] < 90.0]
    width = float(np.mean(upper - lower))
    return {
        "workflows": [{
            "workflow": "Chronological calibrated Random Forest",
            "overall_coverage": overall_coverage,
            "mean_width_usd": width,
            "store14_coverage": next((row["coverage"] for row in store_details if row["store"] == 14), None),
            "store36_coverage": next((row["coverage"] for row in store_details if row["store"] == 36), None),
            "evaluated_records": int(len(test)),
            "calibration_records": int(len(calibration)),
        }],
        "nominal_target": 90.0,
        "undercovered_stores": undercovered,
        "store_coverage_details": store_details,
        "interpretation": (
            f"Runtime holdout coverage was {overall_coverage:.2f}% on {len(test)} observations. "
            f"The interval was calibrated on {len(calibration)} earlier observations and evaluated on a later holdout; "
            "this empirical result does not guarantee future or per-store coverage."
        ),
    }

def get_feature_ablation_data(df: Optional[pd.DataFrame] = None) -> Dict[str, Any]:
    """Compares annual-lag features on the active dataset's chronological holdout."""
    if df is None:
        from backend.services.data_service import DataStore
        df = DataStore.get_data()
    supervised = prepare_supervised_data(df)
    if len(supervised) < 50:
        return {
            "removed_features": REMOVED_FEATURES,
            "models": [],
            "key_insight": f"Ablation unavailable: only {len(supervised)} supervised rows remain after feature warm-up.",
        }
    train, test = get_train_test_split(supervised)
    if len(train) < 50 or test.empty:
        return {
            "removed_features": REMOVED_FEATURES,
            "models": [],
            "key_insight": "Ablation unavailable: there is not enough chronological training and holdout data.",
        }
    reduced_features = [name for name in ALL_FEATURES if name not in REMOVED_FEATURES]
    results = []
    for name, estimator in get_base_estimators().items():
        full = pipeline_for(clone(estimator).set_params(**SELECTED_BENCHMARK_PARAMS[name]))
        reduced = pipeline_for(
            clone(estimator).set_params(**SELECTED_BENCHMARK_PARAMS[name]),
            feature_columns=reduced_features,
        )
        full.fit(train[ALL_FEATURES], train["Weekly_Sales"])
        reduced.fit(train[reduced_features], train["Weekly_Sales"])
        full_mae = float(np.mean(np.abs(test["Weekly_Sales"].to_numpy() - full.predict(test[ALL_FEATURES]))))
        reduced_mae = float(np.mean(np.abs(test["Weekly_Sales"].to_numpy() - reduced.predict(test[reduced_features]))))
        change = ((reduced_mae - full_mae) / full_mae * 100) if full_mae else 0.0
        results.append({
            "model": name,
            "all_fold_mae_change_pct": float(change),
            "first_fold_share_pct": None,
            "later_fold_mean_change_pct": None,
            "evaluated_records": int(len(test)),
            "full_feature_mae": full_mae,
            "reduced_feature_mae": reduced_mae,
        })
    return {
        "removed_features": REMOVED_FEATURES,
        "models": results,
        "key_insight": (
            "This is a single chronological holdout ablation. A positive change means removing the annual lags "
            "increased MAE; fold attribution is not available from a single split."
        ),
    }

def get_warning_utility_data(df: Optional[pd.DataFrame] = None) -> Dict[str, Any]:
    """Evaluates warning precision and recall on a later holdout using earlier-only thresholds."""
    if df is None:
        from backend.services.data_service import DataStore
        df = DataStore.get_data()
    ordered = df.sort_values(["Store", "Date"]).copy()
    groups = ordered.groupby("Store", sort=False)["Weekly_Sales"]
    ordered["prior_mean"] = groups.transform(lambda values: values.shift(1).rolling(13, min_periods=13).mean())
    ordered["prior_week_sales"] = groups.shift(1)
    ordered["actual_deviation"] = (ordered["Weekly_Sales"] / ordered["prior_mean"] - 1) * 100
    ordered["predicted_deviation"] = (ordered["prior_week_sales"] / ordered["prior_mean"] - 1) * 100
    valid = ordered.loc[
        np.isfinite(ordered["actual_deviation"])
        & np.isfinite(ordered["predicted_deviation"])
    ].copy()
    dates = pd.DatetimeIndex(sorted(valid["Date"].unique()))
    if len(dates) < 5:
        return {
            "material_movement_threshold_pct": 15.0,
            "total_material_movements": 0,
            "rules": [],
            "trade_off_explanation": "Warning utility is unavailable until sufficient past-only 13-week rolling history exists.",
        }
    split = max(1, int(np.floor(len(dates) * 0.7)))
    calibration_dates = dates[:split]
    test = valid.loc[valid["Date"].isin(dates[split:])]
    calibration_deviation = valid.loc[
        valid["Date"].isin(calibration_dates), "predicted_deviation"
    ]
    low, high = calibration_deviation.quantile([0.05, 0.95]).to_numpy()
    predicted = test["predicted_deviation"].to_numpy(dtype=float)
    actual = test["actual_deviation"].to_numpy(dtype=float)
    material = np.abs(actual) >= 15.0
    strategies = [
        ("Always NORMAL", np.zeros(len(test), dtype=bool), np.zeros(len(test), dtype=int)),
        ("Fixed ±15%", np.abs(predicted) >= 15.0, np.sign(predicted).astype(int)),
        (
            f"Earlier-data quantiles ({low:.1f}% / +{high:.1f}%)",
            (predicted <= low) | (predicted >= high),
            np.where(predicted <= low, -1, np.where(predicted >= high, 1, 0)),
        ),
    ]
    rules = []
    total_moves = int(material.sum())
    for name, alerts, direction in strategies:
        true_positives = int((alerts & material).sum())
        alert_count = int(alerts.sum())
        false_alarms = alert_count - true_positives
        correct_direction = int((alerts & material & (direction == np.sign(actual))).sum())
        rules.append({
            "rule": name,
            "alerts": alert_count,
            "material_moves": total_moves,
            "precision": float(true_positives / alert_count * 100) if alert_count else None,
            "recall": float(true_positives / total_moves * 100) if total_moves else 0.0,
            "false_alarms": false_alarms,
            "missed_moves": total_moves - true_positives,
            "directional_recall": float(correct_direction / total_moves * 100) if total_moves else 0.0,
        })
    return {
        "material_movement_threshold_pct": 15.0,
        "total_material_movements": total_moves,
        "rules": rules,
        "calibration_start": calibration_dates[0].strftime("%Y-%m-%d"),
        "calibration_end": calibration_dates[-1].strftime("%Y-%m-%d"),
        "test_start": dates[split].strftime("%Y-%m-%d"),
        "test_end": dates[-1].strftime("%Y-%m-%d"),
        "trade_off_explanation": (
            f"Prediction thresholds were set using {len(calibration_dates)} earlier dates; alerts use prior-week forecasts and were evaluated against "
            f"{len(dates) - split} later dates ({total_moves} material movements)."
        ),
    }

def get_paired_stability_data(
    df: Optional[pd.DataFrame] = None, store_id: Optional[int] = None
) -> Dict[str, Any]:
    """Compares RF and GB on identical expanding-window chronological folds."""
    if df is None:
        from backend.services.data_service import DataStore
        df = DataStore.get_data()
    scoped = df if store_id is None else df.loc[df["Store"] == store_id]
    if scoped.empty:
        raise ValueError(f"Store {store_id} is not present in the active dataset.")
    supervised = prepare_supervised_data(scoped)
    if len(supervised) < 50:
        raise ValueError(
            f"Paired stability analysis requires at least 50 supervised records; "
            f"{len(supervised)} are available after the 53-week feature warm-up."
        )

    dates = pd.DatetimeIndex(sorted(supervised["Date"].unique()))
    holdout_dates = dates[int(np.floor(len(dates) * 0.6)):]
    windows = [window for window in np.array_split(holdout_dates, 4) if len(window)]
    estimators = get_base_estimators()
    required_models = {"Random Forest", "Gradient Boosting"}
    if not required_models.issubset(estimators):
        raise ValueError("Paired stability requires both Random Forest and Gradient Boosting.")
    fold_results = []
    for fold_number, test_dates in enumerate(windows, start=1):
        train = supervised.loc[supervised["Date"] < test_dates[0]]
        test = supervised.loc[supervised["Date"].isin(test_dates)]
        if len(train) < 50 or test.empty:
            continue
        fold = {
            "fold": fold_number,
            "train_end": train["Date"].max().strftime("%Y-%m-%d"),
            "test_start": pd.Timestamp(test_dates[0]).strftime("%Y-%m-%d"),
            "test_end": pd.Timestamp(test_dates[-1]).strftime("%Y-%m-%d"),
            "test_weeks": int(test["Date"].nunique()),
            "records": int(len(test)),
        }
        for model_name in ("Random Forest", "Gradient Boosting"):
            model = pipeline_for(
                clone(estimators[model_name]).set_params(**SELECTED_BENCHMARK_PARAMS[model_name])
            )
            model.fit(train[ALL_FEATURES], train["Weekly_Sales"])
            prediction = model.predict(test[ALL_FEATURES])
            score = metrics(test["Weekly_Sales"], prediction)
            errors = np.asarray(prediction, dtype=float) - test["Weekly_Sales"].to_numpy(dtype=float)
            fold[f"{model_name}_mae_usd"] = score["MAE"]
            fold[f"{model_name}_rmse_usd"] = score["RMSE"]
            fold[f"{model_name}_wape_pct"] = score["WAPE (%)"]
            fold[f"{model_name}_error_std_usd"] = float(np.std(errors, ddof=1)) if len(errors) > 1 else 0.0
        fold["mae_difference_usd"] = fold["Random Forest_mae_usd"] - fold["Gradient Boosting_mae_usd"]
        fold_results.append(fold)

    if not fold_results:
        raise ValueError("No paired expanding-window folds had enough chronological training data.")
    differences = np.asarray([fold["mae_difference_usd"] for fold in fold_results], dtype=float)
    rng = np.random.default_rng(SEED)
    block_size = min(2, len(differences))
    samples = []
    for _ in range(1000):
        indices = []
        while len(indices) < len(differences):
            start = int(rng.integers(0, len(differences)))
            indices.extend((start + offset) % len(differences) for offset in range(block_size))
        samples.append(float(np.mean(differences[np.asarray(indices[:len(differences)])])))
    interval = np.quantile(samples, [0.025, 0.975]).tolist()
    mean_diff = float(np.mean(differences))
    total_weeks = sum(fold["test_weeks"] for fold in fold_results)
    return {
        "model_a": "Random Forest",
        "model_b": "Gradient Boosting",
        "mean_mae_difference_usd": mean_diff,
        "mae_difference_std_usd": float(np.std(differences, ddof=1)) if len(differences) > 1 else 0.0,
        "mean_rf_rmse_usd": float(np.mean([fold["Random Forest_rmse_usd"] for fold in fold_results])),
        "mean_gb_rmse_usd": float(np.mean([fold["Gradient Boosting_rmse_usd"] for fold in fold_results])),
        "mean_rf_wape_pct": float(np.mean([fold["Random Forest_wape_pct"] for fold in fold_results])),
        "mean_gb_wape_pct": float(np.mean([fold["Gradient Boosting_wape_pct"] for fold in fold_results])),
        "rf_week_wins": int(np.sum(differences < 0)),
        "gb_week_wins": int(np.sum(differences > 0)),
        "total_test_weeks": int(total_weeks),
        "evaluated_folds": len(fold_results),
        "folds": fold_results,
        "bootstrap_2fold_block_95_ci": [float(interval[0]), float(interval[1])],
        "includes_zero": bool(interval[0] <= 0 <= interval[1]),
        "conclusion": (
            "Difference is inconclusive across these chronological folds."
            if interval[0] <= 0 <= interval[1]
            else "Observed difference excludes zero in this block bootstrap interval; it is not a guarantee of future superiority."
        ),
    }

def get_leakage_audit(df: pd.DataFrame) -> Dict[str, Any]:
    """Runs data-dependent checks for temporal ordering and past-only feature behavior."""
    checks: List[Dict[str, Any]] = []

    def record(name: str, passed: bool, details: str):
        checks.append({"name": name, "passed": bool(passed), "details": details})

    supervised = prepare_supervised_data(df)
    if supervised.empty:
        dev = supervised.copy()
        test = supervised.copy()
        test_start = None
    else:
        dev, test = get_train_test_split(supervised)
        test_start = test["Date"].min() if not test.empty else None

    split_ok = (
        not dev.empty and not test.empty
        and dev["Date"].max() < test["Date"].min()
        and set(dev["Date"]).isdisjoint(set(test["Date"]))
    )
    record(
        "Chronological train/test split",
        split_ok,
        (
            f"Train {dev['Date'].min():%Y-%m-%d}–{dev['Date'].max():%Y-%m-%d}; "
            f"test {test['Date'].min():%Y-%m-%d}–{test['Date'].max():%Y-%m-%d}."
            if split_ok else "Insufficient supervised rows for non-overlapping chronological train and test partitions."
        ),
    )
    record(
        "Target excluded from model features",
        "Weekly_Sales" not in ALL_FEATURES,
        f"Model feature list contains {len(ALL_FEATURES)} columns; Weekly_Sales is excluded.",
    )

    lag_ok = True
    ordered = df.sort_values(["Store", "Date"])
    grouped_sales = ordered.groupby("Store", sort=False)["Weekly_Sales"]
    engineered = make_features(ordered)
    for lag in (1, 2, 3, 4, 13, 26, 51, 52, 53):
        expected = grouped_sales.shift(lag).to_numpy(dtype=float)
        actual = engineered[f"sales_lag_{lag}"].to_numpy(dtype=float)
        if not np.allclose(actual, expected, equal_nan=True):
            lag_ok = False
            break
    record("Lag features use prior store sales only", lag_ok, "Compared every configured lag to grouped, chronological shift values.")

    rolling_ok = True
    grouped = ordered.groupby("Store", sort=False)["Weekly_Sales"]
    for window in (4, 8, 13):
        expected = grouped.transform(lambda values: values.shift(1).rolling(window, min_periods=window).mean())
        if not np.allclose(
            engineered[f"rolling_mean_{window}"].to_numpy(dtype=float),
            expected.to_numpy(dtype=float),
            equal_nan=True,
        ):
            rolling_ok = False
            break
    record("Rolling features are shifted before aggregation", rolling_ok, "Recomputed rolling means from each store's previous observations.")

    future_independent = False
    if test_start is not None:
        perturbed = df.copy()
        future_mask = perturbed["Date"] >= test_start
        perturbed.loc[future_mask, "Weekly_Sales"] = (
            perturbed.loc[future_mask, "Weekly_Sales"] + 987654.321
        )
        original_past = make_features(df).loc[lambda frame: frame["Date"] < test_start, ALL_FEATURES]
        changed_past = make_features(perturbed).loc[lambda frame: frame["Date"] < test_start, ALL_FEATURES]
        future_independent = np.allclose(
            original_past.to_numpy(dtype=float),
            changed_past.to_numpy(dtype=float),
            equal_nan=True,
        )
    record(
        "Future targets cannot change earlier features",
        future_independent,
        "Perturbed all targets at and after the test boundary and compared every earlier model feature."
        if test_start is not None else "No test boundary could be established.",
    )

    finite_features = bool(
        not supervised.empty
        and np.isfinite(supervised[ALL_FEATURES].to_numpy(dtype=float)).all()
    )
    record(
        "Training features contain no missing or infinite values",
        finite_features,
        f"Checked {len(supervised)} supervised rows across {len(ALL_FEATURES)} features.",
    )

    preprocessing_ok = False
    preprocessing_details = "Insufficient train/test rows to execute a fit-boundary check."
    if len(dev) >= 50 and not test.empty:
        try:
            audit_model = pipeline_for(clone(get_base_estimators()["Random Forest"]).set_params(n_estimators=1))
            audit_model.fit(dev[ALL_FEATURES], dev["Weekly_Sales"])
            encoder = audit_model.named_steps["preprocess"].named_transformers_["store"]
            fitted_categories = encoder.categories_[0].copy()
            test_matrix = audit_model.named_steps["preprocess"].transform(test[ALL_FEATURES])
            preprocessing_ok = (
                np.array_equal(fitted_categories, np.sort(dev["Store"].unique()))
                and len(test_matrix) == len(test)
                and np.isfinite(test_matrix).all()
                and np.array_equal(fitted_categories, encoder.categories_[0])
            )
            preprocessing_details = (
                f"Fitted the complete preprocessing pipeline on {len(dev)} training rows only; "
                f"transformed {len(test)} held-out rows without updating fitted categories."
            )
        except Exception as e:
            preprocessing_details = f"Training-only preprocessing check raised: {e}"
    record("Preprocessing is fitted on training data only", preprocessing_ok, preprocessing_details)

    try:
        backtest_results = ModelService.get_nested_backtest_results(df)
        evaluated_records = max(
            (int(result.get("Evaluated_Records", 0)) for result in backtest_results),
            default=0,
        )
        backtest_folds = backtest_results[0].get("Folds", []) if backtest_results else []
        folds_chronological = bool(backtest_folds) and all(
            fold["train_end"] < fold["test_start"] <= fold["test_end"]
            for fold in backtest_folds
        )
        backtest_ok = bool(backtest_results) and evaluated_records > 0 and folds_chronological
        backtest_details = (
            f"Ran {len(backtest_folds)} expanding-window folds on the active dataset; "
            f"{evaluated_records} holdout predictions were evaluated."
            if backtest_ok else
            "The runtime backtest returned no usable chronological holdout results."
        )
    except Exception as exc:
        backtest_ok = False
        backtest_details = f"Runtime backtest could not be completed: {exc}"
    record("Runtime backtest uses active-data chronological folds", backtest_ok, backtest_details)

    passed = sum(1 for check in checks if check["passed"])
    return {
        "passed": passed,
        "failed": len(checks) - passed,
        "total": len(checks),
        "checks": checks,
        "training": {
            "start_date": dev["Date"].min().strftime("%Y-%m-%d") if not dev.empty else None,
            "end_date": dev["Date"].max().strftime("%Y-%m-%d") if not dev.empty else None,
            "records": int(len(dev)),
        },
        "test": {
            "start_date": test["Date"].min().strftime("%Y-%m-%d") if not test.empty else None,
            "end_date": test["Date"].max().strftime("%Y-%m-%d") if not test.empty else None,
            "records": int(len(test)),
        },
        "features": list(ALL_FEATURES),
    }
