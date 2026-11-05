from typing import Dict, Any, List, Optional
import json
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor

from backend.core.config import (
    SEED, ALL_FEATURES, PRODUCTION_MODEL_NAME, PRODUCTION_PARAMETERS,
    ORIGINAL_BENCHMARK_REFERENCE, NESTED_BACKTEST_REFERENCE
)

def metrics(y_true, y_pred) -> Dict[str, float]:
    actual = np.asarray(y_true, dtype=float)
    pred = np.asarray(y_pred, dtype=float)
    assert actual.shape == pred.shape and np.isfinite(pred).all()
    denominator = np.abs(actual).sum()
    return {
        "MAE": float(mean_absolute_error(actual, pred)),
        "RMSE": float(np.sqrt(mean_squared_error(actual, pred))),
        "WAPE (%)": float(100 * np.abs(actual - pred).sum() / denominator if denominator else np.nan),
        "R2": float(r2_score(actual, pred) if len(actual) > 1 else np.nan)
    }

def pipeline_for(estimator, feature_columns=None) -> Pipeline:
    columns = ALL_FEATURES if feature_columns is None else list(feature_columns)
    numeric_columns = [c for c in columns if c != "Store"]
    preprocessing = ColumnTransformer([
        ("store", OneHotEncoder(handle_unknown="error", sparse_output=False), ["Store"]),
        ("numeric", "passthrough", numeric_columns),
    ], verbose_feature_names_out=True)
    return Pipeline([("preprocess", preprocessing), ("model", estimator)])

def get_base_estimators() -> Dict[str, Any]:
    return {
        "Random Forest": RandomForestRegressor(n_estimators=160, random_state=SEED, n_jobs=1),
        "Gradient Boosting": GradientBoostingRegressor(n_estimators=180, learning_rate=0.05, loss="squared_error", random_state=SEED),
        "XGBoost": XGBRegressor(objective="reg:squarederror", tree_method="hist", n_estimators=250,
                               learning_rate=0.05, subsample=1.0, colsample_bytree=1.0, random_state=SEED, n_jobs=1),
    }

SELECTED_BENCHMARK_PARAMS = {
    "Random Forest": {"max_depth": None, "min_samples_leaf": 1},
    "Gradient Boosting": {"max_depth": 4, "min_samples_leaf": 5},
    "XGBoost": {"max_depth": 3, "min_child_weight": 5, "reg_lambda": 5}
}

class ModelService:
    _models: Dict[str, Pipeline] = {}
    _is_trained: bool = False
    _test_eval_df: Optional[pd.DataFrame] = None
    _benchmark_scores: Optional[List[Dict[str, Any]]] = None

    @classmethod
    def train_or_load(cls, dev_df: pd.DataFrame, test_df: pd.DataFrame):
        if cls._is_trained:
            return

        estimators = get_base_estimators()
        X_dev, y_dev = dev_df[ALL_FEATURES], dev_df["Weekly_Sales"]
        X_test, y_test = test_df[ALL_FEATURES], test_df["Weekly_Sales"]

        test_preds = {}
        # Train ML models
        for name, est in estimators.items():
            pipe = pipeline_for(clone(est).set_params(**SELECTED_BENCHMARK_PARAMS[name]))
            pipe.fit(X_dev, y_dev)
            cls._models[name] = pipe
            test_preds[name] = pipe.predict(X_test)

        # Baseline predictions
        test_preds["Last-week baseline"] = X_test["sales_lag_1"].to_numpy()
        test_preds["Seasonal baseline"] = X_test["sales_lag_52"].to_numpy()

        # Compute metrics
        scores = []
        for name, pred in test_preds.items():
            m = metrics(y_test, pred)
            scores.append({
                "Model": name,
                "MAE": m["MAE"],
                "RMSE": m["RMSE"],
                "WAPE (%)": m["WAPE (%)"],
                "R2": m["R2"],
                "Type": "Machine Learning" if name in estimators else "Baseline"
            })

        cls._benchmark_scores = scores

        # Build detailed evaluation dataframe for Random Forest (selected production model)
        eval_df = test_df[["Store", "Date", "Weekly_Sales", "Holiday_Flag"]].copy()
        eval_df["Prediction"] = test_preds["Random Forest"]
        eval_df["Error"] = eval_df["Prediction"] - eval_df["Weekly_Sales"]
        eval_df["Abs_Error"] = np.abs(eval_df["Error"])
        cls._test_eval_df = eval_df
        cls._is_trained = True

    @classmethod
    def get_benchmark_comparison(cls) -> List[Dict[str, Any]]:
        if not cls._is_trained:
            # Return verified reference benchmark scores if not explicitly fitted yet
            return [
                {"Model": k, **v, "Type": "Machine Learning" if k in ["Random Forest", "Gradient Boosting", "XGBoost"] else "Baseline"}
                for k, v in ORIGINAL_BENCHMARK_REFERENCE.items()
            ]
        return cls._benchmark_scores

    @classmethod
    def get_nested_backtest_results(cls) -> List[Dict[str, Any]]:
        return NESTED_BACKTEST_REFERENCE

    @classmethod
    def get_store_level_errors(cls) -> List[Dict[str, Any]]:
        if cls._test_eval_df is None:
            return []
        grouped = cls._test_eval_df.groupby("Store")
        out = []
        for store, g in grouped:
            m = metrics(g["Weekly_Sales"], g["Prediction"])
            out.append({
                "Store": int(store),
                "Observations": len(g),
                "Total_Sales": float(g["Weekly_Sales"].sum()),
                "MAE": m["MAE"],
                "RMSE": m["RMSE"],
                "WAPE (%)": m["WAPE (%)"],
                "Mean_Signed_Error": float(g["Error"].mean()),
                "Relative_Bias (%)": float(100 * g["Error"].sum() / g["Weekly_Sales"].sum())
            })
        return sorted(out, key=lambda x: x["WAPE (%)"], reverse=True)
