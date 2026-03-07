import { useEffect, useState, useMemo } from "react";
import api from "../../../api/api";
import "./baseline.css";

export default function BaselineDashboard() {

  const [baselines, setBaselines] = useState([]);
  const [patches, setPatches] = useState([]);
  const [cves, setCves] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalData, setModalData] = useState(null);

  const [filters, setFilters] = useState([
    { column: "baseline_name", operator: "contains", value: "", logic: "AND" }
  ]);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  /* =============================
     LOAD DATA
  ============================= */

  useEffect(() => {

    const load = async () => {

      try {

        const baselineRes = await api.get("/baselines");

        const baselineData = Array.isArray(baselineRes.data)
          ? baselineRes.data
          : baselineRes.data?.data || [];

        setBaselines(baselineData);

        const patchRes = await api.get("/patches");

        const patchData = Array.isArray(patchRes.data)
          ? patchRes.data
          : patchRes.data?.data || [];

        setPatches(patchData);

        const payload = patchData.map((p) => ({
          patch_id: p.patch_id,
          site_name: p.site_name
        }));

        const cveRes = await api.post("/cves/by-patches", {
          patches: payload
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
     BASELINE EXPOSURE
  ============================= */

  const baselineExposure = useMemo(() => {

    return baselines.map((b) => {

      const patchIds = b.patch_ids || [];

      const cveSet = new Set();

      patchIds.forEach((patchId) => {

        const patchKey = `BIGFIX-${patchId}`;

        const cvesForPatch = patchCveMap[patchKey] || [];

        cvesForPatch.forEach((c) => cveSet.add(c));

      });

      return {

        baseline_name: b.baseline_name,

        patch_count: patchIds.length,

        cve_count: cveSet.size,

        patches: patchIds.map((id) => `BIGFIX-${id}`),

        cves: Array.from(cveSet)

      };

    });

  }, [baselines, patchCveMap]);

  /* =============================
     FILTER
  ============================= */

  const applyFilters = (baseline) => {

    return filters.reduce((result, filter, index) => {

      let condition = true;

      const search = filter.value.toLowerCase();

      if (filter.column === "baseline_name") {

        const field = baseline.baseline_name.toLowerCase();

        if (filter.operator === "contains") condition = field.includes(search);
        if (filter.operator === "=") condition = field === search;

      }

      if (filter.column === "patch_id") {

        condition = baseline.patches.some((p) =>
          p.toLowerCase().includes(search)
        );

      }

      if (filter.column === "cve_id") {

        condition = baseline.cves.some((c) =>
          c.toLowerCase().includes(search)
        );

      }

      if (index === 0) return condition;

      if (filter.logic === "AND") return result && condition;

      if (filter.logic === "OR") return result || condition;

      return result;

    }, true);

  };

  const filteredBaselines = baselineExposure.filter(applyFilters);

  const totalPages = Math.ceil(filteredBaselines.length / rowsPerPage);

  const paginatedBaselines = filteredBaselines.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  /* =============================
     CSV EXPORT
  ============================= */

  const exportCSV = () => {

    const header = ["Baseline", "Patch IDs", "CVE IDs"];

    const rows = filteredBaselines.map((b) => {

      const patchList = `[${b.patches.join(",")}]`;
      const cveList = `[${b.cves.join(",")}]`;

      return [
        b.baseline_name,
        `"${patchList}"`,
        `"${cveList}"`
      ];

    });

    const csv =
      header.join(",") +
      "\n" +
      rows.map((r) => r.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = "baseline_exposure.csv";

    a.click();

  };

  /* =============================
     FILTER HELPERS
  ============================= */

  const updateFilter = (index, key, value) => {

    const updated = [...filters];

    updated[index][key] = value;

    setFilters(updated);

  };

  const addFilterRow = () => {

    setFilters((prev) => [
      ...prev,
      { column: "baseline_name", operator: "contains", value: "", logic: "AND" }
    ]);

  };

  const removeFilterRow = (index) => {

    if (filters.length === 1) return;

    setFilters(filters.filter((_, i) => i !== index));

  };

  const resetFilters = () => {

    setFilters([
      { column: "baseline_name", operator: "contains", value: "", logic: "AND" }
    ]);

  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  if (loading) return <div className="baseline-loading">Loading baselines...</div>;

  return (

    <div className="baseline-dashboard">

      <h2 className="baseline-dashboard-title">Baseline Exposure</h2>

      {/* FILTER HEADER */}

      <div className="baseline-filter-header">

        <div className="baseline-filter-left">

          {filters.map((filter, index) => (

            <div key={index} className="risk-filter-row">

              {index > 0 && (
                <select
                  value={filter.logic}
                  onChange={(e) =>
                    updateFilter(index, "logic", e.target.value)
                  }
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
              )}

              <select
                value={filter.column}
                onChange={(e) =>
                  updateFilter(index, "column", e.target.value)
                }
              >
                <option value="baseline_name">Baseline</option>
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
                onChange={(e) =>
                  updateFilter(index, "value", e.target.value)
                }
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

        <div className="baseline-filter-right">

          <button
            className="baseline-export-btn"
            onClick={exportCSV}
          >
            Export CSV
          </button>

        </div>

      </div>

      <button
        className="risk-reset-btn"
        onClick={resetFilters}
      >
        Reset Filters
      </button>

      {/* TABLE */}

      <div className="baseline-table-container">

        <table className="baseline-table">

          <thead>

            <tr>

              <th>Baseline</th>

              <th style={{ textAlign:"center" }}>Patches</th>

              <th style={{ textAlign:"center" }}>CVEs</th>

            </tr>

          </thead>

          <tbody>

            {paginatedBaselines.map((b) => (

              <tr key={b.baseline_name}>

                <td>{b.baseline_name}</td>

                <td
                  className="baseline-link baseline-count"
                  onClick={() =>
                    setModalData({
                      title:"Patches",
                      items:b.patches
                    })
                  }
                >
                  {b.patch_count}
                </td>

                <td
                  className="baseline-link baseline-count"
                  onClick={() =>
                    setModalData({
                      title:"CVEs",
                      items:b.cves
                    })
                  }
                >
                  {b.cve_count}
                </td>

              </tr>

            ))}

          </tbody>

        </table>

        {/* PAGINATION */}

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
          className="baseline-modal-overlay"
          onClick={() => setModalData(null)}
        >

          <div
            className="baseline-modal"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="baseline-modal-header">

              <h3>
                {modalData.title} ({modalData.items.length})
              </h3>

              <button
                className="baseline-modal-close"
                onClick={() => setModalData(null)}
              >
                ✕
              </button>

            </div>

            <div className="baseline-modal-body">

              <ul>
                {modalData.items.map((item,i)=>(
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