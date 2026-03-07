import { useEffect, useState, useMemo } from "react";
import api from "../../../api/api";
import "./computer.css";

export default function ComputerDashboard() {
  const [patches, setPatches] = useState([]);
  const [cves, setCves] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalData, setModalData] = useState(null);

  const [filters, setFilters] = useState([
    { column: "device_name", operator: "contains", value: "", logic: "AND" },
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
  // PATCH → CVE MAP
  // =============================

  const patchCveMap = useMemo(() => {
    const map = {};

    cves.forEach((c) => {
      if (!map[c.patch_id]) map[c.patch_id] = [];
      map[c.patch_id].push(c.cve_id);
    });

    return map;
  }, [cves]);

  // =============================
  // DEVICE EXPOSURE MAP
  // =============================

  const deviceExposure = useMemo(() => {
    const map = {};

    patches.forEach((patch) => {
      const devices = patch.applicable_computers || [];
      const cvesForPatch = patchCveMap[patch.patch_id] || [];

      devices.forEach((device) => {
        if (!map[device]) {
          map[device] = {
            device_name: device,
            patches: new Set(),
            cves: new Set(),
          };
        }

        map[device].patches.add(patch.patch_id);

        cvesForPatch.forEach((cve) => {
          map[device].cves.add(cve);
        });
      });
    });

    return Object.values(map).map((d) => ({
      device_name: d.device_name,
      patch_count: d.patches.size,
      cve_count: d.cves.size,
      patches: Array.from(d.patches),
      cves: Array.from(d.cves),
    }));
  }, [patches, patchCveMap]);

  // =============================
  // FILTER LOGIC
  // =============================

  const applyFilters = (device) => {
    return filters.reduce((result, filter, index) => {
      let condition = true;

      const search = filter.value.toLowerCase();

      if (filter.column === "device_name") {
        const field = device.device_name.toLowerCase();

        if (filter.operator === "contains") condition = field.includes(search);
        if (filter.operator === "=") condition = field === search;
      }

      if (filter.column === "patch_id") {
        const list = device.patches || [];

        if (filter.operator === "contains")
          condition = list.some((p) => p.toLowerCase().includes(search));

        if (filter.operator === "=")
          condition = list.some((p) => p.toLowerCase() === search);
      }

      if (filter.column === "cve_id") {
        const list = device.cves || [];

        if (filter.operator === "contains")
          condition = list.some((c) => c.toLowerCase().includes(search));

        if (filter.operator === "=")
          condition = list.some((c) => c.toLowerCase() === search);
      }

      if (index === 0) return condition;

      if (filter.logic === "AND") return result && condition;
      if (filter.logic === "OR") return result || condition;

      return result;
    }, true);
  };

  const filteredDevices = deviceExposure.filter(applyFilters);

  const totalPages = Math.ceil(filteredDevices.length / rowsPerPage);

  const paginatedDevices = filteredDevices.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  // =============================
  // CSV EXPORT (FULL LIST)
  // =============================

  const exportCSV = () => {
    const header = ["Device", "Patch IDs", "CVE IDs"];

    const rows = filteredDevices.map((d) => {
      const patchList = `[${d.patches.join(",")}]`;

      const cveList = `[${d.cves.join(",")}]`;

      return [d.device_name, `"${patchList}"`, `"${cveList}"`];
    });

    const csv =
      header.join(",") + "\n" + rows.map((r) => r.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = "device_exposure.csv";

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
      { column: "device_name", operator: "contains", value: "", logic: "AND" },
    ]);
  };

  const removeFilterRow = (index) => {
    if (filters.length === 1) return;
    setFilters(filters.filter((_, i) => i !== index));
  };

  const resetFilters = () => {
    setFilters([
      { column: "device_name", operator: "contains", value: "", logic: "AND" },
    ]);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  if (loading) return <div className="device-loading">Loading devices...</div>;

  return (
    <div className="computer-dashboard">
      <h2 className="device-dashboard-title">Device Exposure</h2>

      {/* FILTER + EXPORT ROW */}

      <div className="device-filter-header">
        <div className="device-filter-left">
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
                <option value="device_name">Device Name</option>
                <option value="patch_id">Patch ID</option>
                <option value="cve_id">CVE ID</option>
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

        <div className="device-filter-right">
          <button className="device-export-btn" onClick={exportCSV}>
            Export CSV
          </button>
        </div>
      </div>

      <button className="risk-reset-btn" onClick={resetFilters}>
        Reset Filters
      </button>

      {/* TABLE */}

      <div className="device-table-container">
        <table className="device-table">
          <thead>
            <tr>
              <th>Device</th>
              <th style={{ textAlign: "center" }}>Patches</th>
              <th style={{ textAlign: "center" }}>CVEs</th>
            </tr>
          </thead>

          <tbody>
            {paginatedDevices.map((d) => (
              <tr key={d.device_name}>
                <td>{d.device_name}</td>

                <td
                  className="device-link device-count"
                  onClick={() =>
                    setModalData({
                      title: "Patches",
                      items: d.patches,
                    })
                  }
                >
                  {d.patch_count}
                </td>

                <td
                  className="device-link device-count"
                  onClick={() =>
                    setModalData({
                      title: "CVEs",
                      items: d.cves,
                    })
                  }
                >
                  {d.cve_count}
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
        <div
          className="device-modal-overlay"
          onClick={() => setModalData(null)}
        >
          <div className="device-modal" onClick={(e) => e.stopPropagation()}>
            <div className="device-modal-header">
              <h3>
                {modalData.title} ({modalData.items.length})
              </h3>

              <button
                className="device-modal-close"
                onClick={() => setModalData(null)}
              >
                ✕
              </button>
            </div>

            <div className="device-modal-body">
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
