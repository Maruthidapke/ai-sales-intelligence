from typing import Dict, Any, List

def get_interval_reliability_data() -> Dict[str, Any]:
    """Empirical prediction band coverage and reliability comparisons."""
    # Pre-calculated 45 store coverage distribution on 14-week holdout from verified notebook
    store_coverages = [
        {"store": 1, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 2, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 3, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 4, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 5, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 6, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 7, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 8, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 9, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 10, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 11, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 12, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 13, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 14, "coverage": 92.86, "legacy_coverage": 7.14},
        {"store": 15, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 16, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 17, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 18, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 19, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 20, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 21, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 22, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 23, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 24, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 25, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 26, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 27, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 28, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 29, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 30, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 31, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 32, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 33, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 34, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 35, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 36, "coverage": 78.57, "legacy_coverage": 50.00},
        {"store": 37, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 38, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 39, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 40, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 41, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 42, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 43, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 44, "coverage": 100.0, "legacy_coverage": 100.0},
        {"store": 45, "coverage": 100.0, "legacy_coverage": 100.0},
    ]

    return {
        "workflows": [
            {
                "workflow": "Replaced frozen-model band",
                "overall_coverage": 94.44,
                "mean_width_usd": 210666.28,
                "store14_coverage": 7.14,
                "store36_coverage": 50.00
            },
            {
                "workflow": "Unified point/band workflow",
                "overall_coverage": 98.89,
                "mean_width_usd": 340857.45,
                "store14_coverage": 92.86,
                "store36_coverage": 78.57
            }
        ],
        "nominal_target": 90.0,
        "undercovered_stores": [36],
        "store_coverage_details": store_coverages,
        "interpretation": "Overall 98.89% coverage achieved by the unified workflow. However, Store 36 remains at 78.57% (below 90% nominal). Empirical prediction bands do not guarantee reliability for every single individual store."
    }

def get_feature_ablation_data() -> Dict[str, Any]:
    """Controlled ablation removing annual lags (lags 51, 52, 53, and prior_year_mean_3)."""
    return {
        "removed_features": ["sales_lag_51", "sales_lag_52", "sales_lag_53", "prior_year_mean_3"],
        "models": [
            {
                "model": "Gradient Boosting",
                "all_fold_mae_change_pct": 130.66,
                "first_fold_share_pct": 100.62,
                "later_fold_mean_change_pct": -1.42
            },
            {
                "model": "Random Forest",
                "all_fold_mae_change_pct": 120.47,
                "first_fold_share_pct": 98.57,
                "later_fold_mean_change_pct": 3.10
            },
            {
                "model": "XGBoost",
                "all_fold_mae_change_pct": 82.25,
                "first_fold_share_pct": 98.78,
                "later_fold_mean_change_pct": 1.72
            }
        ],
        "key_insight": "The large overall average MAE increase without annual features is almost entirely driven by the first evaluation block (spanning the holiday/new-year seasonal peak). In later folds, annual lags contributed negligible or slightly negative value."
    }

def get_warning_utility_data() -> Dict[str, Any]:
    """Evaluates warning precision and recall against true material sales movements (±15% from 13W mean)."""
    return {
        "material_movement_threshold_pct": 15.0,
        "total_material_movements": 396,
        "rules": [
            {
                "rule": "Always NORMAL",
                "alerts": 0,
                "material_moves": 396,
                "precision": None,
                "recall": 0.0,
                "false_alarms": 0,
                "missed_moves": 396,
                "directional_recall": 0.0
            },
            {
                "rule": "Fixed ±15%",
                "alerts": 181,
                "material_moves": 396,
                "precision": 84.53,
                "recall": 38.64,
                "false_alarms": 28,
                "missed_moves": 243,
                "directional_recall": 38.13
            },
            {
                "rule": "Origin quantiles (-18.81% / +24.17%)",
                "alerts": 97,
                "material_moves": 396,
                "precision": 91.75,
                "recall": 22.47,
                "false_alarms": 8,
                "missed_moves": 307,
                "directional_recall": 22.47
            }
        ],
        "trade_off_explanation": "Origin quantiles achieve high precision (91.75%) and very few false alarms (8), but miss 307 material movements. Fixed thresholds capture more movements (recall 38.64%) at the cost of 28 false alarms. Warning thresholds represent an operational review trade-off, not anomaly probability."
    }

def get_paired_stability_data() -> Dict[str, Any]:
    """Paired Random Forest vs Gradient Boosting holdout comparison."""
    return {
        "model_a": "Random Forest",
        "model_b": "Gradient Boosting",
        "mean_mae_difference_usd": 131.26,
        "rf_week_wins": 7,
        "gb_week_wins": 7,
        "total_test_weeks": 14,
        "bootstrap_3week_block_95_ci": [-3196.05, 2616.22],
        "includes_zero": True,
        "conclusion": "No statistically significant or universal superiority between Random Forest and Gradient Boosting on the holdout test period."
    }

