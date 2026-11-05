from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
import pandas as pd
import io

from backend.services.data_service import DataStore, load_and_validate_csv

router = APIRouter(prefix="/api/dataset", tags=["Dataset"])

@router.get("/summary")
def get_dataset_summary():
    """Returns dataset integrity, dimensions, statistics, and SHA-256 fingerprint."""
    try:
        summary = DataStore.get_summary()
        return {"success": True, "data": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/preview")
def get_dataset_preview(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    store_id: Optional[int] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    """Returns paginated tabular records with optional store and date filters."""
    try:
        df = DataStore.get_data()
        filtered = df.copy()

        if store_id is not None:
            filtered = filtered.loc[filtered["Store"] == store_id]
        if start_date:
            filtered = filtered.loc[filtered["Date"] >= pd.to_datetime(start_date)]
        if end_date:
            filtered = filtered.loc[filtered["Date"] <= pd.to_datetime(end_date)]

        total_matching = len(filtered)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        page_df = filtered.iloc[start_idx:end_idx].copy()
        page_df["Date"] = page_df["Date"].dt.strftime("%Y-%m-%d")

        return {
            "success": True,
            "total": total_matching,
            "page": page,
            "limit": limit,
            "total_pages": (total_matching + limit - 1) // limit,
            "data": page_df.to_dict(orient="records")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """Validates an uploaded CSV against required schema and integrity checks."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    try:
        contents = await file.read()
        df, summary = load_and_validate_csv(io.BytesIO(contents))
        # Store in active memory
        DataStore.set_custom_data(df, summary)
        return {
            "success": True,
            "message": f"Successfully validated and loaded '{file.filename}'.",
            "summary": summary
        }
    except ValueError as ve:
        raise HTTPException(status_code=422, detail=f"Validation error: {str(ve)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload processing error: {str(e)}")

@router.post("/reset")
def reset_dataset():
    """Resets the active dataset back to the canonical Walmart.csv."""
    try:
        summary = DataStore.reset_to_canonical()
        return {"success": True, "message": "Reset to canonical Walmart dataset.", "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

