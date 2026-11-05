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
        ("store", OneHotEncoder(handle_unknown="ignore", sparse_output=False), ["Store"]),
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
    def reset_cache(cls):
        cls._models = {}
        cls._is_trained = False
        cls._test_eval_df = None
        cls._benchmark_scores = None

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

        # Rank by MAE
        scores = sorted(scores, key=lambda x: x["MAE"])
        cls._benchmark_scores = scores

        # Build detailed evaluation dataframe for Random Forest
        eval_df = test_df[["Store", "Date", "Weekly_Sales", "Holiday_Flag"]].copy()
        eval_df["Prediction"] = test_preds["Random Forest"]
        eval_df["Error"] = eval_df["Prediction"] - eval_df["Weekly_Sales"]
        eval_df["Abs_Error"] = np.abs(eval_df["Error"])
        cls._test_eval_df = eval_df
        cls._is_trained = True

    @classmethod
    def get_benchmark_comparison(cls) -> List[Dict[str, Any]]:
        from backend.services.data_service import DataStore
        summary = DataStore.get_summary()

        # If canonical and not trained yet, return exact verified reference
        if summary.get("is_canonical", True) and cls._benchmark_scores is None:
            return [
                {"Model": k, **v, "Type": "Machine Learning" if k in ["Random Forest", "Gradient Boosting", "XGBoost"] else "Baseline"}
                for k, v in ORIGINAL_BENCHMARK_REFERENCE.items()
            ]

        # If custom dataset or trained
        if cls._benchmark_scores is None:
            from backend.services.feature_service import prepare_supervised_data, get_train_test_split
            df = DataStore.get_data()
            sup_df = prepare_supervised_data(df)
            dev, test = get_train_test_split(sup_df)
            cls.train_or_load(dev, test)

        return cls._benchmark_scores or []

    @classmethod
    def get_nested_backtest_results(cls) -> List[Dict[str, Any]]:
        return NESTED_BACKTEST_REFERENCE

    @classmethod
    def get_store_level_errors(cls) -> List[Dict[str, Any]]:
        if cls._test_eval_df is None:
            from backend.services.data_service import DataStore
            from backend.services.feature_service import prepare_supervised_data, get_train_test_split
            df = DataStore.get_data()
            sup_df = prepare_supervised_data(df)
            dev, test = get_train_test_split(sup_df)
            cls.train_or_load(dev, test)

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
                "Relative_Bias (%)": float(100 * g["Error"].sum() / g["Weekly_Sales"].sum() if g["Weekly_Sales"].sum() else 0)
            })
        return sorted(out, key=lambda x: x["WAPE (%)"], reverse=True)

    @classmethod
    def get_residuals_analysis(cls) -> Dict[str, Any]:
        """Provides actual vs predicted series, residual distribution, and outliers."""
        if cls._test_eval_df is None:
            from backend.services.data_service import DataStore
            from backend.services.feature_service import prepare_supervised_data, get_train_test_split
            df = DataStore.get_data()
            sup_df = prepare_supervised_data(df)
            dev, test = get_train_test_split(sup_df)
            cls.train_or_load(dev, test)

        if cls._test_eval_df is None:
            return {}

        df = cls._test_eval_df.copy()
        errors = df["Error"].to_numpy()
        abs_errors = df["Abs_Error"].to_numpy()
        mean_err = float(np.mean(errors))
        std_err = float(np.std(errors)) if len(errors) > 1 else 1.0

        # Outlier detection: records with |error| > 2.5 * std
        outlier_mask = np.abs(errors - mean_err) > 2.5 * std_err
        outlier_df = df[outlier_mask].sort_values("Abs_Error", ascending=False)
        outliers = []
        for _, row in outlier_df.head(10).iterrows():
            outliers.append({
                "Store": int(row["Store"]),
                "Date": row["Date"].strftime("%Y-%m-%d"),
                "Actual": float(row["Weekly_Sales"]),
                "Predicted": float(row["Prediction"]),
                "Error": float(row["Error"]),
                "Abs_Error": float(row["Abs_Error"]),
                "Std_Deviations": round(float(abs(row["Error"] - mean_err) / std_err), 2)
            })

        # Residual distribution histogram bins (15 bins)
        hist, bin_edges = np.histogram(errors, bins=15)
        residual_distribution = []
        for i in range(len(hist)):
            label = f"${(bin_edges[i]/1e3):.0f}K to ${(bin_edges[i+1]/1e3):.0f}K"
            residual_distribution.append({
                "bin": label,
                "count": int(hist[i]),
                "range_min": float(bin_edges[i]),
                "range_max": float(bin_edges[i+1]),
            })

        # Sample actual vs predicted points for holdout timeline
        timeline_grouped = df.groupby("Date").agg(
            Actual_Sales=("Weekly_Sales", "sum"),
            Predicted_Sales=("Prediction", "sum")
        ).reset_index().sort_values("Date")
        timeline_grouped["Date_Str"] = timeline_grouped["Date"].dt.strftime("%Y-%m-%d")

        return {
            "mean_error": mean_err,
            "std_error": std_err,
            "outliers_count": int(outlier_mask.sum()),
            "outliers": outliers,
            "residual_distribution": residual_distribution,
            "actual_vs_predicted_timeline": timeline_grouped[["Date_Str", "Actual_Sales", "Predicted_Sales"]].to_dict(orient="records"),
            "total_eval_points": len(df)
        }
