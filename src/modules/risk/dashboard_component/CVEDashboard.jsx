import { useEffect, useState, useMemo } from "react";
import api from "../../../api/api";
import "./cve.css";

export default function CveDashboard() {
  const [patches, setPatches] = useState([]);
  const [cves, setCves] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalData, setModalData] = useState(null);

  const [filters, setFilters] = useState([
    { column: "cve_id", operator: "contains", value: "", logic: "AND" },
  ]);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // =============================
  // LOAD DATA
  // =============================

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

  // =============================
  // PATCH → DEVICE MAP
  // =============================

  const patchDeviceMap = useMemo(() => {
    const map = {};

    patches.forEach((p) => {
      map[p.patch_id] = p.applicable_computers || [];
    });

    return map;
  }, [patches]);

  // =============================
  // CVE EXPOSURE MAP
  // =============================

  const cveExposure = useMemo(() => {
    const map = {};

    cves.forEach((c) => {
      if (!map[c.cve_id]) {
        map[c.cve_id] = {
          cve_id: c.cve_id,
          patches: new Set(),
          devices: new Set(),
          severity: c.cvss_severity || "UNKNOWN",
        };
      }

      map[c.cve_id].patches.add(c.patch_id);

      const devices = patchDeviceMap[c.patch_id] || [];

      devices.forEach((d) => {
        map[c.cve_id].devices.add(d);
      });
    });

    return Object.values(map).map((c) => ({
      cve_id: c.cve_id,
      severity: c.severity,
      patch_count: c.patches.size,
      device_count: c.devices.size,
      patches: Array.from(c.patches),
      devices: Array.from(c.devices),
    }));
  }, [cves, patchDeviceMap]);

  // =============================
  // FILTER LOGIC
  // =============================

  const applyFilters = (cve) => {
    return filters.reduce((result, filter, index) => {
      let condition = true;

      const search = filter.value.toLowerCase();

      if (filter.column === "cve_id") {
        const field = cve.cve_id.toLowerCase();

        if (filter.operator === "contains") condition = field.includes(search);
        if (filter.operator === "=") condition = field === search;
      }

      if (filter.column === "patch_id") {
        const list = cve.patches || [];

        if (filter.operator === "contains")
          condition = list.some((p) => p.toLowerCase().includes(search));

        if (filter.operator === "=")
          condition = list.some((p) => p.toLowerCase() === search);
      }

      if (filter.column === "device_name") {
        const list = cve.devices || [];

        if (filter.operator === "contains")
          condition = list.some((d) => d.toLowerCase().includes(search));

        if (filter.operator === "=")
          condition = list.some((d) => d.toLowerCase() === search);
      }

      if (index === 0) return condition;

      if (filter.logic === "AND") return result && condition;
      if (filter.logic === "OR") return result || condition;

      return result;
    }, true);
  };

  const filteredCVEs = cveExposure.filter(applyFilters);

  const totalPages = Math.ceil(filteredCVEs.length / rowsPerPage);

  const paginatedCVEs = filteredCVEs.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  // =============================
  // CSV EXPORT
  // =============================

  const exportCSV = () => {
    const header = ["CVE", "Patch IDs", "Devices"];

    const rows = filteredCVEs.map((c) => {
      const patchList = `[${c.patches.join(",")}]`;
      const deviceList = `[${c.devices.join(",")}]`;

      return [c.cve_id, `"${patchList}"`, `"${deviceList}"`];
    });

    const csv =
      header.join(",") + "\n" + rows.map((r) => r.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = "cve_exposure.csv";

    a.click();
  };

  // =============================
  // FILTER FUNCTIONS
  // =============================

  const updateFilter = (index, key, value) => {
    const updated = [...filters];
    updated[index][key] = value;
    setFilters(updated);
  };

  const addFilterRow = () => {
    setFilters((prev) => [
      ...prev,
      { column: "cve_id", operator: "contains", value: "", logic: "AND" },
    ]);
  };

  const removeFilterRow = (index) => {
    if (filters.length === 1) return;
    setFilters(filters.filter((_, i) => i !== index));
  };

  const resetFilters = () => {
    setFilters([
      { column: "cve_id", operator: "contains", value: "", logic: "AND" },
    ]);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  if (loading) return <div className="cve-loading">Loading CVEs...</div>;

  return (
    <div className="cve-dashboard">
      <h2 className="cve-dashboard-title">CVE Exposure</h2>

      {/* FILTER HEADER */}

      <div className="cve-filter-header">
        <div className="cve-filter-left">
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
                <option value="cve_id">CVE ID</option>
                <option value="patch_id">Patch ID</option>
                <option value="device_name">Device</option>
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

        <div className="cve-filter-right">
          <button className="cve-export-btn" onClick={exportCSV}>
            Export CSV
          </button>
        </div>
      </div>

      <button className="risk-reset-btn" onClick={resetFilters}>
        Reset Filters
      </button>

      {/* TABLE */}

      <div className="cve-table-container">
        <table className="cve-table">
          <thead>
            <tr>
              <th>CVE</th>
              <th style={{ textAlign: "center" }}>Patches</th>
              <th style={{ textAlign: "center" }}>Devices</th>
            </tr>
          </thead>

          <tbody>
            {paginatedCVEs.map((c) => (
              <tr key={c.cve_id}>
                <td>{c.cve_id}</td>

                <td
                  className="cve-link cve-count"
                  onClick={() =>
                    setModalData({
                      title: "Patches",
                      items: c.patches,
                    })
                  }
                >
                  {c.patch_count}
                </td>

                <td
                  className="cve-link cve-count"
                  onClick={() =>
                    setModalData({
                      title: "Devices",
                      items: c.devices,
                    })
                  }
                >
                  {c.device_count}
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

      {modalData && (
        <div className="cve-modal-overlay" onClick={() => setModalData(null)}>
          <div className="cve-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cve-modal-header">
              <h3>
                {modalData.title} ({modalData.items.length})
              </h3>

              <button
                className="cve-modal-close"
                onClick={() => setModalData(null)}
              >
                ✕
              </button>
            </div>

            <div className="cve-modal-body">
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