import { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import "./App.css";

// Change this if your backend runs on a different port/host
const API_BASE = "https://network-fault-dashboard.onrender.com";

const SEVERITY_COLORS = {
  Low: "#4ade80",
  Medium: "#fbbf24",
  High: "#fb923c",
  Critical: "#ef4444",
};

const DATE_PRESETS = [
  { label: "All time", days: null },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

function toDateStr(d) {
  return d.toISOString().split("T")[0];
}

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
  const [avgResolution, setAvgResolution] = useState([]);
  const [faults, setFaults] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ device_types: [], locations: [] });

  // Filter state
  const [severityFilter, setSeverityFilter] = useState("");
  const [deviceTypeFilter, setDeviceTypeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [datePreset, setDatePreset] = useState("All time");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load dropdown options once
  useEffect(() => {
    fetch(`${API_BASE}/faults/filter-options`)
      .then((r) => r.json())
      .then(setFilterOptions)
      .catch(() => {});
  }, []);

  // Build the shared query string from current filters (excludes severity,
  // since the table-only severity filter applies separately to /faults)
  function buildParams({ includeSeverity = false } = {}) {
    const params = new URLSearchParams();
    if (includeSeverity && severityFilter) params.set("severity", severityFilter);
    if (deviceTypeFilter) params.set("device_type", deviceTypeFilter);
    if (locationFilter) params.set("location", locationFilter);

    const preset = DATE_PRESETS.find((p) => p.label === datePreset);
    if (preset && preset.days) {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - preset.days);
      params.set("date_from", toDateStr(from));
      params.set("date_to", toDateStr(to));
    }
    return params;
  }

  // Re-fetch everything whenever device/location/date filters change
  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const params = buildParams();
        const qs = params.toString() ? `?${params.toString()}` : "";

        const [summaryRes, severityRes, typeRes, timeRes, avgResRes] = await Promise.all([
          fetch(`${API_BASE}/faults/summary${qs}`),
          fetch(`${API_BASE}/faults/by-severity${qs}`),
          fetch(`${API_BASE}/faults/by-type${qs}`),
          fetch(`${API_BASE}/faults/over-time${qs}`),
          fetch(`${API_BASE}/faults/avg-resolution-by-severity${qs}`),
        ]);
        setSummary(await summaryRes.json());
        setBySeverity(await severityRes.json());
        setByType(await typeRes.json());
        setOverTime(await timeRes.json());
        setAvgResolution(await avgResRes.json());
        setError(null);
      } catch (err) {
        setError("Could not reach the backend. Is it running?");
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceTypeFilter, locationFilter, datePreset]);

  // Re-fetch the table whenever any filter (including severity) changes
  useEffect(() => {
    async function loadFaults() {
      const params = buildParams({ includeSeverity: true });
      params.set("limit", "50");
      const res = await fetch(`${API_BASE}/faults?${params.toString()}`);
      setFaults(await res.json());
    }
    loadFaults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severityFilter, deviceTypeFilter, locationFilter, datePreset]);

  if (loading && !summary) return <div className="centered">Loading dashboard...</div>;
  if (error) return <div className="centered error">{error}</div>;

  return (
    <div className="dashboard">
      <h1>Network Fault Dashboard</h1>

      {/* Global filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>Date Range</label>
          <select value={datePreset} onChange={(e) => setDatePreset(e.target.value)}>
            {DATE_PRESETS.map((p) => (
              <option key={p.label} value={p.label}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Device Type</label>
          <select value={deviceTypeFilter} onChange={(e) => setDeviceTypeFilter(e.target.value)}>
            <option value="">All</option>
            {filterOptions.device_types.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Location</label>
          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="">All</option>
            {filterOptions.locations.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        {(deviceTypeFilter || locationFilter || datePreset !== "All time") && (
          <button
            className="clear-filters"
            onClick={() => {
              setDeviceTypeFilter("");
              setLocationFilter("");
              setDatePreset("All time");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

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

      <div className="charts-row">
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
      </div>

      <div className="charts-row">
        <div className="chart-card full-width">
          <h3>Avg Resolution Time by Severity (minutes)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={avgResolution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="severity" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="avg_minutes">
                {avgResolution.map((entry) => (
                  <Cell key={entry.severity} fill={SEVERITY_COLORS[entry.severity]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
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
            {faults.length === 0 && (
              <tr><td colSpan="7" className="no-results">No faults match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;

