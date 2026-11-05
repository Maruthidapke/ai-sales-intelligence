import hashlib
import io
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
import pandas as pd
import numpy as np

from backend.core.config import (
    DATA_PATH, REQUIRED_COLUMNS, EXPECTED_SHA256,
    TEST_WEEKS
)

def compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def load_and_validate_csv(source: Path | io.BytesIO | str) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Loads CSV, verifies strict schema and integrity constraints, and converts types."""
    if isinstance(source, (str, Path)):
        p = Path(source)
        if not p.is_file():
            raise FileNotFoundError(f"Dataset file not found at {p}")
        raw_bytes = p.read_bytes()
        sha256_hash = compute_sha256(raw_bytes)
        df_raw = pd.read_csv(p)
    elif isinstance(source, io.BytesIO):
        raw_bytes = source.getvalue()
        sha256_hash = compute_sha256(raw_bytes)
        source.seek(0)
        df_raw = pd.read_csv(source)
    else:
        raise ValueError("Unsupported data source")

    # Column existence check
    missing = [c for c in REQUIRED_COLUMNS if c not in df_raw.columns]
    if missing:
        raise ValueError(f"Dataset is missing required columns: {missing}")

    df = df_raw[REQUIRED_COLUMNS].copy()

    # Date parsing: support both %d-%m-%Y and %Y-%m-%d
    try:
        df["Date"] = pd.to_datetime(df["Date"], format="%d-%m-%Y")
    except Exception:
        df["Date"] = pd.to_datetime(df["Date"], errors="raise")

    # Numeric conversion
    for col in set(REQUIRED_COLUMNS) - {"Date"}:
        df[col] = pd.to_numeric(df[col], errors="raise")

    # Integrity assertions
    if df.isna().any().any():
        raise ValueError("Dataset contains unexpected NaN values.")
    if not np.isfinite(df.drop(columns="Date").to_numpy(dtype=float)).all():
        raise ValueError("Dataset contains non-finite numerical values.")
    if df.duplicated(["Store", "Date"]).any():
        raise ValueError("Duplicate store-date records found in dataset.")
    if not (df["Store"] > 0).all() or not (df["Store"] % 1 == 0).all():
        raise ValueError("Store identifiers must be positive integers.")
    if not df["Holiday_Flag"].isin([0, 1]).all():
        raise ValueError("Holiday_Flag must only be 0 or 1.")
    if not (df["Weekly_Sales"] >= 0).all():
        raise ValueError("Weekly_Sales contains negative values.")

    df["Store"] = df["Store"].astype(int)
    df["Holiday_Flag"] = df["Holiday_Flag"].astype(int)
    df = df.sort_values(["Store", "Date"]).reset_index(drop=True)

    all_dates = pd.DatetimeIndex(sorted(df["Date"].unique()))
    diffs = all_dates.to_series().diff().dropna()
    is_consecutive_weekly = diffs.eq(pd.Timedelta(weeks=1)).all() if len(diffs) > 0 else True

    summary = {
        "sha256": sha256_hash,
        "is_canonical": sha256_hash == EXPECTED_SHA256,
        "total_rows": len(df),
        "total_stores": int(df["Store"].nunique()),
        "store_ids": sorted(df["Store"].unique().tolist()),
        "weeks_per_store": int(len(all_dates)),
        "min_date": df["Date"].min().strftime("%Y-%m-%d"),
        "max_date": df["Date"].max().strftime("%Y-%m-%d"),
        "is_consecutive_weekly": bool(is_consecutive_weekly),
        "total_sales": float(df["Weekly_Sales"].sum()),
        "mean_weekly_sales": float(df["Weekly_Sales"].mean()),
        "median_weekly_sales": float(df["Weekly_Sales"].median()),
        "std_weekly_sales": float(df["Weekly_Sales"].std()),
        "max_sales": float(df["Weekly_Sales"].max()),
        "min_sales": float(df["Weekly_Sales"].min()),
        "missing_cells": int(df_raw[REQUIRED_COLUMNS].isna().sum().sum()),
        "duplicate_rows": int(df_raw.duplicated(subset=["Store", "Date"]).sum()),
    }

    return df, summary

class DataStore:
    """Singleton-style store holding active dataset and summary."""
    _active_df: Optional[pd.DataFrame] = None
    _summary: Optional[Dict[str, Any]] = None

    @classmethod
    def get_data(cls) -> pd.DataFrame:
        if cls._active_df is None:
            cls._active_df, cls._summary = load_and_validate_csv(DATA_PATH)
        return cls._active_df

    @classmethod
    def get_summary(cls) -> Dict[str, Any]:
        if cls._summary is None:
            cls.get_data()
        return cls._summary

    @classmethod
    def set_custom_data(cls, df: pd.DataFrame, summary: Dict[str, Any]):
        cls._active_df = df
        cls._summary = summary

    @classmethod
    def reset_to_canonical(cls):
        cls._active_df, cls._summary = load_and_validate_csv(DATA_PATH)
        return cls._summary

