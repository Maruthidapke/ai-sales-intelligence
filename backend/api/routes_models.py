from fastapi import APIRouter, HTTPException

from backend.services.data_service import DataStore
from backend.services.feature_service import prepare_supervised_data, get_train_test_split
from backend.services.ml_service import ModelService
from backend.services.diagnostic_service import (
    get_interval_reliability_data,
    get_feature_ablation_data,
    get_warning_utility_data,
    get_paired_stability_data
)

router = APIRouter(prefix="/api/models", tags=["Models"])

@router.get("/benchmarks")
def get_benchmarks():
    """Returns benchmark comparison across all 5 models."""
    try:
        benchmarks = ModelService.get_benchmark_comparison()
        return {"success": True, "data": benchmarks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/backtest")
def get_nested_backtest():
    """Returns the 4-period nested backtest results."""
    try:
        results = ModelService.get_nested_backtest_results()
        return {"success": True, "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stability")
def get_model_stability():
    """Returns paired RF vs GB error stability and circular block bootstrap 95% CI."""
    try:
        data = get_paired_stability_data()
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/diagnostics")
def get_model_diagnostics():
    """Returns prediction interval coverage, feature ablation, and alert precision/recall."""
    try:
        reliability = get_interval_reliability_data()
        ablation = get_feature_ablation_data()
        utility = get_warning_utility_data()
        return {
            "success": True,
            "prediction_intervals": reliability,
            "feature_ablation": ablation,
            "warning_utility": utility
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/residuals")
def get_model_residuals():
    """Returns detailed prediction error analysis, residual distribution, and outliers."""
    try:
        data = ModelService.get_residuals_analysis()
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/store-errors")
def get_store_errors():
    """Returns store-level error breakdown on the holdout evaluation."""
    try:
        errors = ModelService.get_store_level_errors()
        return {"success": True, "data": errors}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
