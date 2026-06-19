import { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import "./App.css";

// Change this if your backend runs on a different port/host
const API_BASE = "http://localhost:8000";

const SEVERITY_COLORS = {
  Low: "#4ade80",
  Medium: "#fbbf24",
  High: "#fb923c",
  Critical: "#ef4444",
};

function KpiCard({ label, value }) {
  return (
    <div className="kpi-card">
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

function App() {
  const [summary, setSummary] = useState(null);
  const [bySeverity, setBySeverity] = useState([]);
  const [byType, setByType] = useState([]);
  const [overTime, setOverTime] = useState([]);
  const [faults, setFaults] = useState([]);
  const [severityFilter, setSeverityFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch the data that doesn't depend on filters, once on load
  useEffect(() => {
    async function loadStaticData() {
      try {
        const [summaryRes, severityRes, typeRes, timeRes] = await Promise.all([
          fetch(`${API_BASE}/faults/summary`),
          fetch(`${API_BASE}/faults/by-severity`),
          fetch(`${API_BASE}/faults/by-type`),
          fetch(`${API_BASE}/faults/over-time`),
        ]);
        setSummary(await summaryRes.json());
        setBySeverity(await severityRes.json());
        setByType(await typeRes.json());
        setOverTime(await timeRes.json());
      } catch (err) {
        setError("Could not reach the backend. Is it running on http://localhost:8000?");
      } finally {
        setLoading(false);
      }
    }
    loadStaticData();
  }, []);

  // Re-fetch the table whenever the severity filter changes
  useEffect(() => {
    async function loadFaults() {
      const url = severityFilter
        ? `${API_BASE}/faults?severity=${severityFilter}&limit=50`
        : `${API_BASE}/faults?limit=50`;
      const res = await fetch(url);
      setFaults(await res.json());
    }
    loadFaults();
  }, [severityFilter]);

  if (loading) return <div className="centered">Loading dashboard...</div>;
  if (error) return <div className="centered error">{error}</div>;

  return (
    <div className="dashboard">
      <h1>Network Fault Dashboard</h1>

      {/* KPI row */}
      <div className="kpi-row">
        <KpiCard label="Total Faults" value={summary.total_faults} />
        <KpiCard label="Open" value={summary.open_faults} />
        <KpiCard label="Critical" value={summary.critical_faults} />
        <KpiCard label="Avg Resolution (min)" value={summary.avg_resolution_minutes} />
      </div>

      {/* Charts row */}
      <div className="charts-row">
        <div className="chart-card">
          <h3>By Severity</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={bySeverity}
                dataKey="count"
                nameKey="severity"
                outerRadius={80}
                label={(entry) => `${entry.severity}: ${entry.count}`}
              >
                {bySeverity.map((entry) => (
                  <Cell key={entry.severity} fill={SEVERITY_COLORS[entry.severity]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>By Fault Type</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={byType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fault_type" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={70} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card full-width">
        <h3>Faults Over Time</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={overTime}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Filter + table */}
      <div className="table-section">
        <div className="table-header">
          <h3>Recent Faults</h3>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="">All Severities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Timestamp</th>
              <th>Device</th>
              <th>Fault Type</th>
              <th>Severity</th>
              <th>Location</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {faults.map((f) => (
              <tr key={f.fault_id}>
                <td>{f.fault_id}</td>
                <td>{new Date(f.timestamp).toLocaleString()}</td>
                <td>{f.device_id}</td>
                <td>{f.fault_type}</td>
                <td>
                  <span className="badge" style={{ background: SEVERITY_COLORS[f.severity] }}>
                    {f.severity}
                  </span>
                </td>
                <td>{f.location}</td>
                <td>{f.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
