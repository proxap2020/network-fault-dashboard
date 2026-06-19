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


@app.get("/")
def root():
    return {"message": "Network Fault Dashboard API", "docs": "/docs"}


@app.get("/faults")
def get_faults(
    severity: Optional[str] = Query(None, description="Filter by severity e.g. Critical"),
    status: Optional[str] = None,
    device_type: Optional[str] = None,
    location: Optional[str] = None,
    limit: int = 100,
):
    """Return fault records, optionally filtered."""
    result = df.copy()

    if severity:
        result = result[result["severity"].str.lower() == severity.lower()]
    if status:
        result = result[result["status"].str.lower() == status.lower()]
    if device_type:
        result = result[result["device_type"].str.lower() == device_type.lower()]
    if location:
        result = result[result["location"].str.lower() == location.lower()]

    result = result.sort_values("timestamp", ascending=False).head(limit)
    return df_to_json(result)


@app.get("/faults/summary")
def get_summary():
    """High-level stats for dashboard KPI cards."""
    return {
        "total_faults": int(len(df)),
        "open_faults": int((df["status"] == "Open").sum()),
        "critical_faults": int((df["severity"] == "Critical").sum()),
        "avg_resolution_minutes": round(
            float(df["resolution_time_minutes"].dropna().mean()), 1
        ),
    }


@app.get("/faults/by-severity")
def by_severity():
    counts = df["severity"].value_counts().reindex(
        ["Low", "Medium", "High", "Critical"], fill_value=0
    )
    return [{"severity": k, "count": int(v)} for k, v in counts.items()]


@app.get("/faults/by-type")
def by_type():
    counts = df["fault_type"].value_counts()
    return [{"fault_type": k, "count": int(v)} for k, v in counts.items()]


@app.get("/faults/by-status")
def by_status():
    counts = df["status"].value_counts()
    return [{"status": k, "count": int(v)} for k, v in counts.items()]


@app.get("/faults/over-time")
def over_time():
    """Faults grouped by day, for a time-series chart."""
    daily = df.set_index("timestamp").resample("D").size()
    return [{"date": idx.strftime("%Y-%m-%d"), "count": int(val)} for idx, val in daily.items()]


@app.get("/faults/by-location")
def by_location():
    counts = df["location"].value_counts()
    return [{"location": k, "count": int(v)} for k, v in counts.items()]
