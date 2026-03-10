import { useEffect, useState, useMemo } from "react";
import api from "../../../api/api";
import "./patch.css";

/* ======================================
   SCORE → SEVERITY
====================================== */

const getSeverityFromScore = (score) => {
  if (score >= 90) return "CRITICAL";
  if (score >= 75) return "HIGH";
  if (score >= 60) return "IMPORTANT";
  if (score >= 40) return "MODERATE";
  return "LOW";
};

export default function PatchDashboard() {
  const [patches, setPatches] = useState([]);
  const [cves, setCves] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalData, setModalData] = useState(null);

  const [filters, setFilters] = useState([
    { column: "patch_id", operator: "contains", value: "", logic: "AND" },
  ]);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  /* =============================
     LOAD DATA
  ============================= */

  useEffect(() => {
    const load = async () => {
      try {
        const patchRes = await api.get("/patches");

        const patchData = Array.isArray(patchRes.data)
          ? patchRes.data
          : patchRes.data?.data || [];

        setPatches(patchData);

        const payload = patchData.map((p) => ({
          patch_id: p.patch_id,
          site_name: p.site_name,
        }));

        const cveRes = await api.post("/cves/by-patches", {
          patches: payload,
        });

        setCves(cveRes.data?.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  /* =============================
     PATCH → CVE MAP
  ============================= */

  const patchCveMap = useMemo(() => {
    const map = {};

    cves.forEach((c) => {
      if (!map[c.patch_id]) map[c.patch_id] = [];
      map[c.patch_id].push(c.cve_id);
    });

    return map;
  }, [cves]);

  /* =============================
     PATCH EXPOSURE
  ============================= */

  const patchExposure = useMemo(() => {
    return patches.map((patch) => {
      const cvesForPatch = patchCveMap[patch.patch_id] || [];

      const devices = patch.applicable_computers || [];

      const score = Number(patch.final_score || 0);

      return {
        // THIS LINE STRIPS "BIGFIX-" FROM THE ID
        patch_id: patch.patch_id ? patch.patch_id.replace(/^BIGFIX-/i, "") : "", 
        score,
        severity: getSeverityFromScore(score),
        cve_count: cvesForPatch.length,
        device_count: devices.length,
        cves: cvesForPatch,
        devices,
      };
    });
  }, [patches, patchCveMap]);

  /* =============================
     FILTER LOGIC
  ============================= */

  const applyFilters = (patch) => {
    return filters.reduce((result, filter, index) => {
      let condition = true;

      const search = filter.value.toLowerCase();

      if (filter.column === "patch_id") {
        const field = patch.patch_id.toLowerCase();

        if (filter.operator === "contains") condition = field.includes(search);
        if (filter.operator === "=") condition = field === search;
      }

      if (filter.column === "cve_id") {
        const list = patch.cves || [];

        if (filter.operator === "contains")
          condition = list.some((c) => c.toLowerCase().includes(search));

        if (filter.operator === "=")
          condition = list.some((c) => c.toLowerCase() === search);
      }

      if (filter.column === "device") {
        const list = patch.devices || [];

        if (filter.operator === "contains")
          condition = list.some((d) => d.toLowerCase().includes(search));

        if (filter.operator === "=")
          condition = list.some((d) => d.toLowerCase() === search);
      }

      if (filter.column === "severity") {
        const field = patch.severity.toLowerCase();

        if (filter.operator === "contains") condition = field.includes(search);
        if (filter.operator === "=") condition = field === search;
      }

      if (index === 0) return condition;

      if (filter.logic === "AND") return result && condition;
      if (filter.logic === "OR") return result || condition;

      return result;
    }, true);
  };

  const filteredPatches = patchExposure.filter(applyFilters);

  const totalPages = Math.ceil(filteredPatches.length / rowsPerPage);

  const paginatedPatches = filteredPatches.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  /* =============================
     CSV EXPORT
  ============================= */

  const exportCSV = () => {
    const header = ["Patch ID", "Score", "Severity", "CVEs", "Devices"];

    const rows = filteredPatches.map((p) => [
      p.patch_id,
      p.score,
      p.severity,
      `"${p.cves.join(",")}"`,
      `"${p.devices.join(",")}"`,
    ]);

    const csv =
      header.join(",") + "\n" + rows.map((r) => r.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = "patch_exposure.csv";
    a.click();
  };

  /* =============================
     FILTER FUNCTIONS
  ============================= */

  const updateFilter = (index, key, value) => {
    const updated = [...filters];
    updated[index][key] = value;
    setFilters(updated);
  };

  const addFilterRow = () => {
    setFilters((prev) => [
      ...prev,
      { column: "patch_id", operator: "contains", value: "", logic: "AND" },
    ]);
  };

  const removeFilterRow = (index) => {
    if (filters.length === 1) return;
    setFilters(filters.filter((_, i) => i !== index));
  };

  const resetFilters = () => {
    setFilters([
      { column: "patch_id", operator: "contains", value: "", logic: "AND" },
    ]);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  if (loading) return <div className="patch-loading">Loading patches...</div>;

  return (
    <div className="patch-dashboard">
      <h2 className="patch-dashboard-title">Patch Exposure</h2>

      {/* FILTER HEADER */}

      <div className="patch-filter-header">
        <div className="patch-filter-left">
          {filters.map((filter, index) => (
            <div key={index} className="risk-filter-row">
              {index > 0 && (
                <select
                  value={filter.logic}
                  onChange={(e) => updateFilter(index, "logic", e.target.value)}
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
              )}

              <select
                value={filter.column}
                onChange={(e) => updateFilter(index, "column", e.target.value)}
              >
                <option value="patch_id">Patch ID</option>
                <option value="cve_id">CVE ID</option>
                <option value="device">Device</option>
                <option value="severity">Severity</option>
              </select>

              <select
                value={filter.operator}
                onChange={(e) =>
                  updateFilter(index, "operator", e.target.value)
                }
              >
                <option value="contains">contains</option>
                <option value="=">equals</option>
              </select>

              <input
                value={filter.value}
                onChange={(e) => updateFilter(index, "value", e.target.value)}
                placeholder="Enter value"
              />

              {index === filters.length - 1 && (
                <button onClick={addFilterRow}>+</button>
              )}

              {filters.length > 1 && (
                <button onClick={() => removeFilterRow(index)}>−</button>
              )}
            </div>
          ))}
        </div>

        <div className="patch-filter-right">
          <button className="patch-export-btn" onClick={exportCSV}>
            Export CSV
          </button>
        </div>
      </div>

      <button className="risk-reset-btn" onClick={resetFilters}>
        Reset Filters
      </button>

      {/* TABLE */}

      <div className="patch-table-container">
        <table className="patch-table">
          <thead>
            <tr>
              <th>Patch ID</th>
              <th style={{ textAlign: "center" }}>Score</th>
              <th style={{ textAlign: "center" }}>Severity</th>
              <th style={{ textAlign: "center" }}>CVEs</th>
              <th style={{ textAlign: "center" }}>Devices</th>
            </tr>
          </thead>

          <tbody>
            {paginatedPatches.map((p) => (
              <tr key={p.patch_id}>
                <td>{p.patch_id}</td>

                <td className="patch-count">{p.score}</td>

                <td className="patch-severity">{p.severity}</td>

                <td
                  className="patch-link patch-count"
                  onClick={() =>
                    setModalData({
                      title: "CVEs",
                      items: p.cves,
                    })
                  }
                >
                  {p.cve_count}
                </td>

                <td
                  className="patch-link patch-count"
                  onClick={() =>
                    setModalData({
                      title: "Devices",
                      items: p.devices,
                    })
                  }
                >
                  {p.device_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pagination-container">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </button>

          <span className="pagination-info">
            Page {currentPage} of {totalPages}
          </span>

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {/* MODAL */}

      {modalData && (
        <div className="patch-modal-overlay" onClick={() => setModalData(null)}>
          <div className="patch-modal" onClick={(e) => e.stopPropagation()}>
            <div className="patch-modal-header">
              <h3>
                {modalData.title} ({modalData.items.length})
              </h3>

              <button
                className="patch-modal-close"
                onClick={() => setModalData(null)}
              >
                ✕
              </button>
            </div>

            <div className="patch-modal-body">
              <ul>
                {modalData.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}