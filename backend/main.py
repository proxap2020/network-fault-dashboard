"""
FastAPI backend for Network Fault Dashboard.
Reads fault_data.xlsx once at startup, serves it via JSON API.

Run locally:
    pip install -r requirements.txt
    uvicorn main:app --reload

Then visit http://localhost:8000/docs to explore the API interactively.
"""
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import pandas as pd
import numpy as np

app = FastAPI(title="Network Fault Dashboard API")

# Allow the React frontend (running on a different port) to call this API.
# In production, replace "*" with your actual frontend domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Load data once at startup ---
df = pd.read_excel("fault_data.xlsx")
df["timestamp"] = pd.to_datetime(df["timestamp"])


def df_to_json(frame: pd.DataFrame):
    """Convert a DataFrame to JSON-safe records (handles NaT/NaN)."""
    return frame.replace({np.nan: None}).to_dict(orient="records")


def apply_filters(
    frame: pd.DataFrame,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    device_type: Optional[str] = None,
    location: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> pd.DataFrame:
    """Shared filter logic used across every endpoint, so charts and KPIs
    stay consistent with whatever the user has selected on the dashboard."""
    result = frame

    if severity:
        result = result[result["severity"].str.lower() == severity.lower()]
    if status:
        result = result[result["status"].str.lower() == status.lower()]
    if device_type:
        result = result[result["device_type"].str.lower() == device_type.lower()]
    if location:
        result = result[result["location"].str.lower() == location.lower()]
    if date_from:
        result = result[result["timestamp"] >= pd.to_datetime(date_from)]
    if date_to:
        # include the entire end day
        result = result[result["timestamp"] < pd.to_datetime(date_to) + pd.Timedelta(days=1)]

    return result


# Common query parameters, reused across endpoints via FastAPI's dependency-style defaults.
FilterParams = dict(
    severity=Query(None, description="e.g. Critical"),
    status=Query(None, description="e.g. Open"),
    device_type=Query(None, description="e.g. Router"),
    location=Query(None, description="e.g. Frankfurt-DC1"),
    date_from=Query(None, description="YYYY-MM-DD, inclusive"),
    date_to=Query(None, description="YYYY-MM-DD, inclusive"),
)


@app.get("/")
def root():
    return {"message": "Network Fault Dashboard API", "docs": "/docs"}


@app.get("/faults")
def get_faults(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    device_type: Optional[str] = None,
    location: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 100,
):
    """Return fault records, optionally filtered."""
    result = apply_filters(df, severity, status, device_type, location, date_from, date_to)
    result = result.sort_values("timestamp", ascending=False).head(limit)
    return df_to_json(result)


@app.get("/faults/summary")
def get_summary(
    device_type: Optional[str] = None,
    location: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    """High-level stats for dashboard KPI cards."""
    result = apply_filters(df, device_type=device_type, location=location,
                            date_from=date_from, date_to=date_to)
    return {
        "total_faults": int(len(result)),
        "open_faults": int((result["status"] == "Open").sum()),
        "critical_faults": int((result["severity"] == "Critical").sum()),
        "avg_resolution_minutes": round(
            float(result["resolution_time_minutes"].dropna().mean()), 1
        ) if result["resolution_time_minutes"].notna().any() else 0,
    }


@app.get("/faults/by-severity")
def by_severity(
    device_type: Optional[str] = None,
    location: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    result = apply_filters(df, device_type=device_type, location=location,
                            date_from=date_from, date_to=date_to)
    counts = result["severity"].value_counts().reindex(
        ["Low", "Medium", "High", "Critical"], fill_value=0
    )
    return [{"severity": k, "count": int(v)} for k, v in counts.items()]


@app.get("/faults/by-type")
def by_type(
    device_type: Optional[str] = None,
    location: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    result = apply_filters(df, device_type=device_type, location=location,
                            date_from=date_from, date_to=date_to)
    counts = result["fault_type"].value_counts()
    return [{"fault_type": k, "count": int(v)} for k, v in counts.items()]


@app.get("/faults/by-status")
def by_status(
    device_type: Optional[str] = None,
    location: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    result = apply_filters(df, device_type=device_type, location=location,
                            date_from=date_from, date_to=date_to)
    counts = result["status"].value_counts()
    return [{"status": k, "count": int(v)} for k, v in counts.items()]


@app.get("/faults/over-time")
def over_time(
    device_type: Optional[str] = None,
    location: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    """Faults grouped by day, for a time-series chart."""
    result = apply_filters(df, device_type=device_type, location=location,
                            date_from=date_from, date_to=date_to)
    daily = result.set_index("timestamp").resample("D").size()
    return [{"date": idx.strftime("%Y-%m-%d"), "count": int(val)} for idx, val in daily.items()]


@app.get("/faults/by-location")
def by_location(
    device_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    result = apply_filters(df, device_type=device_type, date_from=date_from, date_to=date_to)
    counts = result["location"].value_counts()
    return [{"location": k, "count": int(v)} for k, v in counts.items()]


@app.get("/faults/avg-resolution-by-severity")
def avg_resolution_by_severity(
    device_type: Optional[str] = None,
    location: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    """Average resolution time in minutes, grouped by severity (resolved faults only)."""
    result = apply_filters(df, device_type=device_type, location=location,
                            date_from=date_from, date_to=date_to)
    resolved = result.dropna(subset=["resolution_time_minutes"])
    avg = resolved.groupby("severity")["resolution_time_minutes"].mean()
    avg = avg.reindex(["Low", "Medium", "High", "Critical"])
    return [
        {"severity": k, "avg_minutes": round(float(v), 1) if pd.notna(v) else 0}
        for k, v in avg.items()
    ]


@app.get("/faults/filter-options")
def filter_options():
    """Distinct values for populating filter dropdowns on the frontend."""
    return {
        "device_types": sorted(df["device_type"].dropna().unique().tolist()),
        "locations": sorted(df["location"].dropna().unique().tolist()),
    }

