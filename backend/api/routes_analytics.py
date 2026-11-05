from typing import Optional
from fastapi import APIRouter, HTTPException, Query
import pandas as pd

from backend.services.data_service import DataStore

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@router.get("/sales")
def get_sales_analytics(store_id: Optional[int] = Query(None)):
    """Computes weekly time-series aggregations, holiday comparisons, and monthly patterns."""
    try:
        df = DataStore.get_data()
        work_df = df if store_id is None else df.loc[df["Store"] == store_id]

        # Weekly sales timeline
        weekly = work_df.groupby("Date").agg(
            Weekly_Sales=("Weekly_Sales", "sum"),
            Holiday_Flag=("Holiday_Flag", "max")
        ).reset_index().sort_values("Date")
        weekly["Date_Str"] = weekly["Date"].dt.strftime("%Y-%m-%d")

        # Holiday vs Non-Holiday analysis
        holiday_stats = work_df.groupby("Holiday_Flag")["Weekly_Sales"].agg(["mean", "std", "count", "sum"]).reset_index()
        holiday_dict = {}
        for _, row in holiday_stats.iterrows():
            flag_name = "Holiday" if row["Holiday_Flag"] == 1 else "Non-Holiday"
            holiday_dict[flag_name] = {
                "mean": float(row["mean"]),
                "std": float(row["std"]),
                "count": int(row["count"]),
                "total": float(row["sum"])
            }
        
        # Calculate holiday sales lift %
        non_hol_mean = holiday_dict.get("Non-Holiday", {}).get("mean", 1)
        hol_mean = holiday_dict.get("Holiday", {}).get("mean", 1)
        lift_pct = ((hol_mean - non_hol_mean) / non_hol_mean) * 100 if non_hol_mean else 0

        # Monthly seasonality aggregation
        work_df_month = work_df.copy()
        work_df_month["Month_Name"] = work_df_month["Date"].dt.strftime("%b")
        work_df_month["Month_Num"] = work_df_month["Date"].dt.month
        month_order = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        monthly = work_df_month.groupby(["Month_Num", "Month_Name"])["Weekly_Sales"].mean().reset_index().sort_values("Month_Num")

        return {
            "success": True,
            "store_id": store_id,
            "timeline": weekly[["Date_Str", "Weekly_Sales", "Holiday_Flag"]].to_dict(orient="records"),
            "holiday_comparison": {
                **holiday_dict,
                "sales_lift_pct": float(lift_pct)
            },
            "monthly_seasonality": [
                {"month": r["Month_Name"], "avg_sales": float(r["Weekly_Sales"])}
                for _, r in monthly.iterrows()
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stores")
def get_store_rankings():
    """Returns store-level performance statistics, top/bottom rankings, and sales variance."""
    try:
        df = DataStore.get_data()
        store_stats = df.groupby("Store").agg(
            Total_Sales=("Weekly_Sales", "sum"),
            Avg_Weekly_Sales=("Weekly_Sales", "mean"),
            Min_Weekly_Sales=("Weekly_Sales", "min"),
            Max_Weekly_Sales=("Weekly_Sales", "max"),
            Std_Sales=("Weekly_Sales", "std"),
            Observations=("Weekly_Sales", "count")
        ).reset_index().sort_values("Avg_Weekly_Sales", ascending=False)

        top_5 = store_stats.head(5).to_dict(orient="records")
        bottom_5 = store_stats.tail(5).sort_values("Avg_Weekly_Sales").to_dict(orient="records")

        return {
            "success": True,
            "all_stores": store_stats.to_dict(orient="records"),
            "top_stores": top_5,
            "bottom_stores": bottom_5
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

