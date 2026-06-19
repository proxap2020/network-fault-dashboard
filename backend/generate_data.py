"""
Generates a synthetic network fault dataset and saves it as fault_data.xlsx
Replace this file with your own Excel export later — just match the column names below.
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

random.seed(42)
np.random.seed(42)

N = 500

fault_types = ["Link Down", "High Latency", "Packet Loss", "Hardware Failure",
               "Configuration Error", "Power Outage", "DNS Failure", "BGP Flap"]
severities = ["Low", "Medium", "High", "Critical"]
severity_weights = [0.35, 0.30, 0.25, 0.10]
statuses = ["Resolved", "Open", "In Progress", "Escalated"]
status_weights = [0.55, 0.20, 0.15, 0.10]
locations = ["Frankfurt-DC1", "Amsterdam-DC2", "Dublin-DC1", "Paris-DC3",
             "London-DC1", "Berlin-DC2", "Madrid-DC1", "Milan-DC2"]
device_types = ["Router", "Switch", "Firewall", "Load Balancer", "Server"]

start_date = datetime(2025, 1, 1)
end_date = datetime(2026, 6, 19)
date_range_seconds = int((end_date - start_date).total_seconds())

rows = []
for i in range(N):
    ts = start_date + timedelta(seconds=random.randint(0, date_range_seconds))
    severity = random.choices(severities, weights=severity_weights)[0]
    status = random.choices(statuses, weights=status_weights)[0]
    device_type = random.choice(device_types)
    device_id = f"{device_type[:3].upper()}-{random.randint(1000,9999)}"

    # resolution time correlated loosely with severity
    base_minutes = {"Low": 30, "Medium": 90, "High": 240, "Critical": 480}[severity]
    resolution_minutes = None
    if status == "Resolved":
        resolution_minutes = max(5, int(np.random.normal(base_minutes, base_minutes * 0.4)))

    rows.append({
        "fault_id": f"FLT-{10000 + i}",
        "timestamp": ts,
        "device_id": device_id,
        "device_type": device_type,
        "fault_type": random.choice(fault_types),
        "severity": severity,
        "location": random.choice(locations),
        "status": status,
        "resolution_time_minutes": resolution_minutes,
    })

df = pd.DataFrame(rows).sort_values("timestamp").reset_index(drop=True)
df.to_excel("fault_data.xlsx", index=False)
print(f"Generated {len(df)} rows -> fault_data.xlsx")
print(df.head())
