import hashlib
import io
import csv
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
import pandas as pd
import numpy as np

from backend.core.config import (
    DATA_PATH, REQUIRED_COLUMNS, EXPECTED_SHA256, UPLOADS_DIR, ACTIVE_DATASET_PATH
)

def compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

COLUMN_ALIASES = {
    "store": "Store",
    "store_id": "Store",
    "storeid": "Store",
    "date": "Date",
    "weekly_sales": "Weekly_Sales",
    "weekly sales": "Weekly_Sales",
    "weeklysales": "Weekly_Sales",
    "sales": "Weekly_Sales",
    "holiday_flag": "Holiday_Flag",
    "holiday flag": "Holiday_Flag",
    "holidayflag": "Holiday_Flag",
    "holiday": "Holiday_Flag",
    "temperature": "Temperature",
    "temp": "Temperature",
    "fuel_price": "Fuel_Price",
    "fuel price": "Fuel_Price",
    "fuelprice": "Fuel_Price",
    "cpi": "CPI",
    "unemployment": "Unemployment",
}

def parse_dates_robust(series: pd.Series) -> pd.Series:
    """Robust date parsing across day-first, iso, and common formats."""
    # First try standard Walmart day-first format (%d-%m-%Y)
    try:
        return pd.Series(
            pd.to_datetime(series, format="%d-%m-%Y"), index=series.index
        )
    except Exception:
        pass
    # Try ISO (%Y-%m-%d)
    try:
        return pd.to_datetime(series, format="%Y-%m-%d")
    except Exception:
        pass
    # Fallback to dayfirst=True automatic parsing
    parsed = pd.to_datetime(series, dayfirst=True, errors="coerce")
    if parsed.isna().any():
        # Fallback to general parsing
        parsed = pd.to_datetime(series, errors="coerce")
    return parsed

def load_and_validate_csv(source: Path | io.BytesIO | str) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Loads CSV with robust encoding, delimiter detection, column normalization, and validation."""
    if isinstance(source, (str, Path)):
        p = Path(source)
        if not p.is_file():
            raise FileNotFoundError(f"Dataset file not found at {p}")
        raw_bytes = p.read_bytes()
    elif isinstance(source, io.BytesIO):
        raw_bytes = source.getvalue()
    else:
        raise ValueError("Unsupported data source")

    sha256_hash = compute_sha256(raw_bytes)

    # 1. Decode with encodings fallback
    text: Optional[str] = None
    for enc in ["utf-8-sig", "utf-8", "latin1", "cp1252"]:
        try:
            text = raw_bytes.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        text = raw_bytes.decode("utf-8", errors="replace")

    # 2. Delimiter detection
    first_lines = "\n".join([line for line in text.splitlines()[:10] if line.strip()])
    try:
        dialect = csv.Sniffer().sniff(first_lines, delimiters=",\t;|")
        delimiter = dialect.delimiter
    except Exception:
        delimiter = ","

    # 3. Read into pandas DataFrame
    try:
        df_raw = pd.read_csv(io.StringIO(text), sep=delimiter)
    except Exception as e:
        raise ValueError(f"Failed to parse CSV file structure: {str(e)}")

    if df_raw.empty:
        raise ValueError("The uploaded CSV dataset is empty.")

    # 4. Clean column headers: strip whitespace, BOM, quotes
    clean_cols = {}
    for col in df_raw.columns:
        norm = str(col).replace("\ufeff", "").strip().strip('"').strip("'")
        clean_cols[col] = norm
    df_raw = df_raw.rename(columns=clean_cols)

    # 5. Map column aliases case-insensitively
    rename_map = {}
    for col in df_raw.columns:
        cleaned_key = str(col).lower().replace(" ", "_").strip()
        if cleaned_key in COLUMN_ALIASES:
            rename_map[col] = COLUMN_ALIASES[cleaned_key]
    df_raw = df_raw.rename(columns=rename_map)

    # 6. Check required columns
    missing = [c for c in REQUIRED_COLUMNS if c not in df_raw.columns]
    if missing:
        found_cols = list(df_raw.columns)
        raise ValueError(
            f"Dataset is missing required columns: {missing}. Found columns in file: {found_cols}"
        )

    df = df_raw[REQUIRED_COLUMNS].copy()

    # 7. Clean and parse Date column
    df["Date"] = df["Date"].astype(str).str.strip()
    parsed_dates = parse_dates_robust(df["Date"])
    if parsed_dates.isna().any():
        bad_idx = parsed_dates.isna().idxmax()
        bad_val = df.loc[bad_idx, "Date"]
        raise ValueError(f"Could not parse valid date value '{bad_val}' at row {bad_idx + 1}.")
    df["Date"] = parsed_dates

    # 8. Clean and convert numeric columns
    for col in set(REQUIRED_COLUMNS) - {"Date"}:
        if df[col].dtype == object:
            df[col] = (
                df[col]
                .astype(str)
                .str.replace("$", "", regex=False)
                .str.replace(",", "", regex=False)
                .str.replace("%", "", regex=False)
                .str.strip()
            )
        df[col] = pd.to_numeric(df[col], errors="coerce")
        if df[col].isna().any():
            bad_idx = df[col].isna().idxmax()
            raise ValueError(f"Column '{col}' contains non-numeric data at row {bad_idx + 1}.")

    # 9. Integrity assertions & data quality
    if df.isna().any().any():
        raise ValueError("Dataset contains unexpected NaN values.")
    if not np.isfinite(df.drop(columns="Date").to_numpy(dtype=float)).all():
        raise ValueError("Dataset contains non-finite numerical values.")
    if df.duplicated(["Store", "Date"]).any():
        dup_count = int(df.duplicated(["Store", "Date"]).sum())
        raise ValueError(f"Duplicate store-date records found in dataset ({dup_count} duplicate rows).")
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
    global_weekly = diffs.eq(pd.Timedelta(weeks=1)).all() if len(diffs) > 0 else True
    store_weekly = all(
        group["Date"].sort_values().diff().dropna().eq(pd.Timedelta(weeks=1)).all()
        for _, group in df.groupby("Store")
    )
    is_consecutive_weekly = bool(global_weekly and store_weekly)

    # Identify highest-performing store and best sales week
    store_totals = df.groupby("Store")["Weekly_Sales"].sum()
    highest_store_id = int(store_totals.idxmax()) if not store_totals.empty else 1
    highest_store_sales = float(store_totals.max()) if not store_totals.empty else 0.0

    weekly_totals = df.groupby("Date")["Weekly_Sales"].sum()
    best_date_ts = weekly_totals.idxmax() if not weekly_totals.empty else df["Date"].max()
    best_date_str = best_date_ts.strftime("%Y-%m-%d") if pd.notna(best_date_ts) else ""
    best_week_sales = float(weekly_totals.max()) if not weekly_totals.empty else 0.0

    summary = {
        "sha256": sha256_hash,
        "is_canonical": sha256_hash == EXPECTED_SHA256,
        "total_rows": len(df),
        "total_stores": int(df["Store"].nunique()),
        "store_ids": sorted(df["Store"].unique().tolist()),
        "weeks_per_store": int(df.groupby("Store").size().min()),
        "min_date": df["Date"].min().strftime("%Y-%m-%d"),
        "max_date": df["Date"].max().strftime("%Y-%m-%d"),
        "is_consecutive_weekly": bool(is_consecutive_weekly),
        "total_sales": float(df["Weekly_Sales"].sum()),
        "mean_weekly_sales": float(df["Weekly_Sales"].mean()),
        "median_weekly_sales": float(df["Weekly_Sales"].median()),
        "std_weekly_sales": float(df["Weekly_Sales"].std()),
        "max_sales": float(df["Weekly_Sales"].max()),
        "min_sales": float(df["Weekly_Sales"].min()),
        "highest_performing_store": {
            "store_id": highest_store_id,
            "total_sales": highest_store_sales
        },
        "best_sales_week": {
            "date": best_date_str,
            "total_sales": best_week_sales
        },
        "missing_cells": 0,
        "duplicate_rows": 0,
    }

    return df, summary

class DataStore:
    """Singleton-style store holding active dataset and summary with cache invalidation."""
    _active_df: Optional[pd.DataFrame] = None
    _summary: Optional[Dict[str, Any]] = None
    _active_metadata: Optional[Dict[str, Any]] = None

    @classmethod
    def get_data(cls) -> pd.DataFrame:
        if cls._active_df is None:
            if ACTIVE_DATASET_PATH.is_file():
                pointer = json.loads(ACTIVE_DATASET_PATH.read_text(encoding="utf-8"))
                metadata_path = UPLOADS_DIR / pointer["metadata_file"]
                metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
                stored_path = Path(metadata["storage_path"])
                if not stored_path.is_file():
                    raise FileNotFoundError(
                        f"Active uploaded dataset is missing from storage: {stored_path}"
                    )
                cls._active_df, cls._summary = load_and_validate_csv(stored_path)
                cls._active_metadata = metadata
                cls._summary.update(metadata)
                cls._summary["storage_status"] = "Persistent"
                cls._summary["storage_verified"] = True
            else:
                cls._active_df, cls._summary = load_and_validate_csv(DATA_PATH)
                cls._summary.update({
                    "original_filename": DATA_PATH.name,
                    "stored_filename": DATA_PATH.name,
                    "uploaded_at": None,
                    "file_size": DATA_PATH.stat().st_size,
                    "storage_path": str(DATA_PATH.resolve()),
                    "storage_status": "Persistent" if DATA_PATH.is_file() else "In-memory",
                    "storage_verified": DATA_PATH.is_file(),
                    "columns": list(cls._active_df.columns),
                })
        return cls._active_df

    @classmethod
    def get_summary(cls, store_id: Optional[int] = None) -> Dict[str, Any]:
        if cls._summary is None:
            cls.get_data()
        if store_id is None:
            return cls._summary

        df = cls.get_data()
        scoped = df.loc[df["Store"] == store_id]
        if scoped.empty:
            raise ValueError(f"Store {store_id} is not present in the active dataset.")
        summary = dict(cls._summary)
        weekly = scoped.groupby("Date")["Weekly_Sales"].sum().sort_index()
        store_sales = float(scoped["Weekly_Sales"].sum())
        summary.update({
            "summary_scope_store_id": int(store_id),
            "total_rows": int(len(scoped)),
            "total_stores": 1,
            "store_ids": [int(store_id)],
            "weeks_per_store": int(scoped["Date"].nunique()),
            "min_date": scoped["Date"].min().strftime("%Y-%m-%d"),
            "max_date": scoped["Date"].max().strftime("%Y-%m-%d"),
            "is_consecutive_weekly": bool(
                scoped["Date"].sort_values().diff().dropna().eq(pd.Timedelta(weeks=1)).all()
            ),
            "total_sales": store_sales,
            "mean_weekly_sales": float(scoped["Weekly_Sales"].mean()),
            "median_weekly_sales": float(scoped["Weekly_Sales"].median()),
            "std_weekly_sales": float(scoped["Weekly_Sales"].std()) if len(scoped) > 1 else 0.0,
            "max_sales": float(scoped["Weekly_Sales"].max()),
            "min_sales": float(scoped["Weekly_Sales"].min()),
            "highest_performing_store": {"store_id": int(store_id), "total_sales": store_sales},
            "best_sales_week": {
                "date": weekly.idxmax().strftime("%Y-%m-%d"),
                "total_sales": float(weekly.max()),
            },
        })
        return summary

    @classmethod
    def save_upload(cls, raw_bytes: bytes, original_filename: str, df: pd.DataFrame, summary: Dict[str, Any]):
        UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        stored_filename = f"{uuid.uuid4().hex}.csv"
        metadata_filename = f"{uuid.uuid4().hex}.json"
        storage_path = (UPLOADS_DIR / stored_filename).resolve()
        metadata_path = UPLOADS_DIR / metadata_filename
        metadata = {
            "original_filename": Path(original_filename.replace("\\", "/")).name,
            "stored_filename": stored_filename,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "file_size": len(raw_bytes),
            "sha256": compute_sha256(raw_bytes),
            "total_rows": int(len(df)),
            "total_stores": int(df["Store"].nunique()),
            "columns": list(df.columns),
            "storage_path": str(storage_path),
        }

        storage_path.write_bytes(raw_bytes)
        try:
            if not storage_path.is_file():
                raise OSError(f"Uploaded CSV was not persisted at {storage_path}")
            metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
            temp_pointer = ACTIVE_DATASET_PATH.with_suffix(".tmp")
            temp_pointer.write_text(
                json.dumps({"metadata_file": metadata_filename}), encoding="utf-8"
            )
            os.replace(temp_pointer, ACTIVE_DATASET_PATH)
        except Exception:
            storage_path.unlink(missing_ok=True)
            metadata_path.unlink(missing_ok=True)
            raise

        summary.update(metadata)
        summary["storage_verified"] = storage_path.is_file()
        summary["storage_status"] = "Persistent" if summary["storage_verified"] else "In-memory"
        cls._active_df = df
        cls._summary = summary
        cls._active_metadata = metadata
        cls._invalidate_caches()
        return metadata

    @classmethod
    def list_uploads(cls):
        cls.get_data()
        UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        uploads = []
        for metadata_path in UPLOADS_DIR.glob("*.json"):
            if metadata_path.name == ACTIVE_DATASET_PATH.name:
                continue
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            stored_path = Path(metadata["storage_path"])
            metadata["storage_status"] = "Persistent" if stored_path.is_file() else "In-memory"
            metadata["storage_verified"] = stored_path.is_file()
            metadata["active"] = (
                cls._active_metadata is not None
                and metadata.get("stored_filename") == cls._active_metadata.get("stored_filename")
            )
            uploads.append(metadata)
        return sorted(uploads, key=lambda item: item["uploaded_at"], reverse=True)

    @classmethod
    def activate_upload(cls, stored_filename: str):
        metadata_path = next(
            (p for p in UPLOADS_DIR.glob("*.json")
             if json.loads(p.read_text(encoding="utf-8")).get("stored_filename") == stored_filename),
            None,
        )
        if metadata_path is None:
            raise FileNotFoundError(f"Uploaded dataset '{stored_filename}' was not found.")
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        path = Path(metadata["storage_path"])
        if not path.is_file():
            raise FileNotFoundError(f"Uploaded CSV is missing from disk: {path}")
        df, summary = load_and_validate_csv(path)
        temp_pointer = ACTIVE_DATASET_PATH.with_suffix(".tmp")
        temp_pointer.write_text(json.dumps({"metadata_file": metadata_path.name}), encoding="utf-8")
        os.replace(temp_pointer, ACTIVE_DATASET_PATH)
        summary.update(metadata)
        summary["storage_status"] = "Persistent"
        summary["storage_verified"] = True
        cls._active_df, cls._summary, cls._active_metadata = df, summary, metadata
        cls._invalidate_caches()
        return summary

    @classmethod
    def _invalidate_caches(cls):
        from backend.services.ml_service import ModelService
        from backend.services.forecast_service import ForecastService
        ModelService.reset_cache()
        ForecastService.reset_cache()

    @classmethod
    def set_custom_data(cls, df: pd.DataFrame, summary: Dict[str, Any]):
        cls._active_df = df
        cls._summary = summary
        cls._active_metadata = None
        cls._invalidate_caches()

    @classmethod
    def reset_to_canonical(cls):
        if ACTIVE_DATASET_PATH.exists():
            ACTIVE_DATASET_PATH.unlink()
        cls._active_df, cls._summary = load_and_validate_csv(DATA_PATH)
        cls._active_metadata = None
        cls._invalidate_caches()
        cls._summary.update({
            "original_filename": DATA_PATH.name,
            "stored_filename": DATA_PATH.name,
            "uploaded_at": None,
            "file_size": DATA_PATH.stat().st_size,
            "storage_path": str(DATA_PATH.resolve()),
            "storage_status": "Persistent" if DATA_PATH.is_file() else "In-memory",
            "storage_verified": DATA_PATH.is_file(),
            "columns": list(cls._active_df.columns),
        })
        return cls._summary
