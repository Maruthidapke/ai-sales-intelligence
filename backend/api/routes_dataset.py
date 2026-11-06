from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import FileResponse
from pathlib import Path
import pandas as pd
import io

from backend.services.data_service import DataStore, load_and_validate_csv
from backend.core.config import UPLOADS_DIR

router = APIRouter(prefix="/api/dataset", tags=["Dataset"])

@router.get("/summary")
def get_dataset_summary(store_id: Optional[int] = None):
    """Returns dataset integrity, dimensions, statistics, and SHA-256 fingerprint."""
    try:
        summary = DataStore.get_summary(store_id=store_id)
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
    """Validates and persistently stores a CSV, then makes it active."""
    filename = file.filename or ""
    if Path(filename.replace("\\", "/")).suffix.lower() != ".csv":
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=422, detail="The uploaded CSV file is empty.")
        if len(contents) > 50 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="CSV files must be 50 MB or smaller.")
        df, summary = load_and_validate_csv(io.BytesIO(contents))
        metadata = DataStore.save_upload(contents, filename, df, summary)
        return {
            "success": True,
            "message": f"Validated and saved '{metadata['original_filename']}' to {metadata['storage_path']}.",
            "summary": summary,
            "dataset": metadata,
        }
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=422, detail=f"Validation error: {str(ve)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload processing error: {str(e)}")

@router.get("/uploads")
def list_uploaded_datasets():
    try:
        return {"success": True, "data": DataStore.list_uploads()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not list uploaded datasets: {e}")

@router.post("/uploads/{stored_filename}/activate")
def activate_uploaded_dataset(stored_filename: str):
    try:
        summary = DataStore.activate_upload(stored_filename)
        return {"success": True, "summary": summary}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not activate dataset: {e}")

@router.get("/uploads/{stored_filename}/download")
def download_uploaded_dataset(stored_filename: str):
    try:
        uploads = DataStore.list_uploads()
        metadata = next((item for item in uploads if item["stored_filename"] == stored_filename), None)
        if metadata is None:
            raise HTTPException(status_code=404, detail="Uploaded dataset was not found.")
        path = Path(metadata["storage_path"])
        if not path.is_file():
            raise HTTPException(status_code=404, detail="Uploaded CSV is no longer available on disk.")
        return FileResponse(
            path,
            media_type="text/csv",
            filename=metadata["original_filename"],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not download dataset: {e}")

@router.post("/reset")
def reset_dataset():
    """Resets the active dataset back to the canonical Walmart.csv."""
    try:
        summary = DataStore.reset_to_canonical()
        return {"success": True, "message": "Reset to canonical Walmart dataset.", "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
