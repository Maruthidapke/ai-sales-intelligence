from typing import Optional
from fastapi import APIRouter, HTTPException

from backend.services.data_service import DataStore
from backend.services.feature_service import prepare_supervised_data, get_train_test_split
from backend.services.ml_service import ModelService
from backend.services.diagnostic_service import (
    get_interval_reliability_data,
    get_feature_ablation_data,
    get_warning_utility_data,
    get_paired_stability_data,
    get_leakage_audit,
)

router = APIRouter(prefix="/api/models", tags=["Models"])

@router.get("/benchmarks")
def get_benchmarks(store_id: Optional[int] = None):
    """Returns benchmark comparison across all 5 models."""
    try:
        benchmarks = ModelService.get_benchmark_comparison(store_id=store_id)
        return {"success": True, "data": benchmarks}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/backtest")
def get_nested_backtest(store_id: Optional[int] = None):
    """Returns the 4-period nested backtest results."""
    try:
        results = ModelService.get_nested_backtest_results(store_id=store_id)
        return {"success": True, "data": results}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stability")
def get_model_stability(store_id: Optional[int] = None):
    """Returns paired RF vs GB error stability and circular block bootstrap 95% CI."""
    try:
        data = get_paired_stability_data(store_id=store_id)
        return {"success": True, "data": data}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/diagnostics")
def get_model_diagnostics(store_id: Optional[int] = None):
    """Returns prediction interval coverage, feature ablation, and alert precision/recall."""
    try:
        df = DataStore.get_data()
        if store_id is not None:
            df = df.loc[df["Store"] == store_id]
            if df.empty:
                raise ValueError(f"Store {store_id} is not present in the active dataset.")
        reliability = get_interval_reliability_data(df)
        ablation = get_feature_ablation_data(df)
        utility = get_warning_utility_data(df)
        return {
            "success": True,
            "prediction_intervals": reliability,
            "feature_ablation": ablation,
            "warning_utility": utility
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/leakage-audit")
def get_zero_leakage_audit(store_id: Optional[int] = None):
    try:
        df = DataStore.get_data()
        if store_id is not None:
            df = df.loc[df["Store"] == store_id]
            if df.empty:
                raise ValueError(f"Store {store_id} is not present in the active dataset.")
        return {"success": True, "data": get_leakage_audit(df)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Leakage audit failed: {e}")

@router.get("/residuals")
def get_model_residuals():
    """Returns detailed prediction error analysis, residual distribution, and outliers."""
    try:
        data = ModelService.get_residuals_analysis()
        return {"success": True, "data": data}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/store-errors")
def get_store_errors():
    """Returns store-level error breakdown on the holdout evaluation."""
    try:
        errors = ModelService.get_store_level_errors()
        return {"success": True, "data": errors}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
