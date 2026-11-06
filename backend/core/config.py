from pathlib import Path
from zoneinfo import ZoneInfo
import pandas as pd

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_PATH = BASE_DIR / "data" / "Walmart.csv"
CACHE_DIR = BASE_DIR / "backend" / "reports_cache"
MODELS_DIR = BASE_DIR / "backend" / "reports_cache" / "saved_models"
UPLOADS_DIR = BASE_DIR / "backend" / "uploads"
ACTIVE_DATASET_PATH = UPLOADS_DIR / "active_dataset.json"
FORECAST_TIMEZONE = ZoneInfo("Asia/Kolkata")

# Dataset Specs
REQUIRED_COLUMNS = [
    "Store", "Date", "Weekly_Sales", "Holiday_Flag",
    "Temperature", "Fuel_Price", "CPI", "Unemployment"
]
EXPECTED_SHA256 = "0846b6941217dd938ceba6ae04650ccbbd01f4877a5f88bfa4dbecda54806c8f"

# Time boundaries and evaluation
SEED = 42
TEST_WEEKS = 14
CALIBRATION_WEEKS = 16
NOMINAL_COVERAGE = 0.90
ALERT_EVENT_PCT = 15.0

ALERT_CONFIG = {
    "lower_quantile": 0.05,
    "upper_quantile": 0.95,
    "fixed_reference_pct": 15.0
}

HOLIDAY_DATES = pd.to_datetime([
    "2010-02-12", "2010-09-10", "2010-11-26", "2010-12-31",
    "2011-02-11", "2011-09-09", "2011-11-25", "2011-12-30",
    "2012-02-10", "2012-09-07", "2012-11-23", "2012-12-28",
])

LAGS = [1, 2, 3, 4, 13, 26, 51, 52, 53]
ROLL_WINDOWS = [4, 8, 13]
CALENDAR_START = pd.Timestamp("2010-01-01")
CALENDAR_END = pd.Timestamp("2012-12-31")

BASE_FEATURES = [
    "Store", "month", "week_of_year", "year", "time_index",
    "week_sin", "week_cos", "planned_holiday"
]
LAG_FEATURES = [f"sales_lag_{lag}" for lag in LAGS]
ROLL_FEATURES = [f"rolling_mean_{w}" for w in ROLL_WINDOWS] + ["rolling_std_4", "prior_year_mean_3"]
ALL_FEATURES = BASE_FEATURES + LAG_FEATURES + ROLL_FEATURES

REMOVED_FEATURES = ["sales_lag_51", "sales_lag_52", "sales_lag_53", "prior_year_mean_3"]
REDUCED_FEATURES = [c for c in ALL_FEATURES if c not in REMOVED_FEATURES]

BACKTEST_PERIODS = [
    ("2011 late summer", "2011-08-05", "2011-09-30"),
    ("2011 shopping peak", "2011-10-07", "2011-12-30"),
    ("2012 winter/spring", "2012-01-06", "2012-03-30"),
    ("2012 spring/summer", "2012-04-06", "2012-07-20"),
]

# Production model configuration; evaluation metrics are calculated from active data at runtime.
PRODUCTION_MODEL_NAME = "Random Forest"
PRODUCTION_PARAMETERS = {"max_depth": None, "min_samples_leaf": 1}
