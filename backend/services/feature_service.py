from typing import List, Tuple
import numpy as np
import pandas as pd

from backend.core.config import (
    HOLIDAY_DATES, LAGS, ROLL_WINDOWS, CALENDAR_START, CALENDAR_END,
    ALL_FEATURES
)

def make_features(frame: pd.DataFrame) -> pd.DataFrame:
    """Compute store-wise, past-only lag features and rolling aggregations.
    Guarantees no look-ahead leakage.
    """
    out = frame.copy().sort_values(["Store", "Date"]).reset_index(drop=True)
    time_origin = out["Date"].min()

    out["month"] = out["Date"].dt.month
    out["week_of_year"] = out["Date"].dt.isocalendar().week.astype(int)
    out["year"] = out["Date"].dt.year
    out["time_index"] = (out["Date"] - time_origin).dt.days // 7
    out["week_sin"] = np.sin(2 * np.pi * out["week_of_year"] / 52.1775)
    out["week_cos"] = np.cos(2 * np.pi * out["week_of_year"] / 52.1775)
    out["planned_holiday"] = out["Date"].isin(HOLIDAY_DATES).astype(int)

    grouped = out.groupby("Store", sort=False)["Weekly_Sales"]
    for lag in LAGS:
        out[f"sales_lag_{lag}"] = grouped.shift(lag)

    for window in ROLL_WINDOWS:
        out[f"rolling_mean_{window}"] = grouped.transform(
            lambda s: s.shift(1).rolling(window, min_periods=window).mean()
        )

    out["rolling_std_4"] = grouped.transform(
        lambda s: s.shift(1).rolling(4).std()
    )

    out["prior_year_mean_3"] = out[["sales_lag_51", "sales_lag_52", "sales_lag_53"]].mean(axis=1, skipna=False)

    return out

def prepare_supervised_data(df: pd.DataFrame) -> pd.DataFrame:
    """Computes features and drops warmup weeks (first 53 weeks) with missing lags."""
    feat_df = make_features(df)
    supervised = feat_df.dropna(subset=ALL_FEATURES + ["Weekly_Sales"]).sort_values(["Date", "Store"]).reset_index(drop=True)
    return supervised

def get_train_test_split(supervised_df: pd.DataFrame, test_weeks: int = 14) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Chronologically splits supervised data into development and test holdout."""
    all_dates = pd.DatetimeIndex(sorted(supervised_df["Date"].unique()))
    test_dates = all_dates[-test_weeks:]
    test_start = test_dates[0]

    dev = supervised_df.loc[supervised_df["Date"] < test_start].copy().reset_index(drop=True)
    test = supervised_df.loc[supervised_df["Date"] >= test_start].copy().reset_index(drop=True)
    return dev, test

