import { useState, useMemo } from "react";
import api from "../../api/api";

const getPatchKey = (p) => `${p.patch_id}-${p.site_name}`;

export default function PatchTab({ patches, patchLoading, addBaseline }) {
  const [cves, setCves] = useState([]);
  const [modalData, setModalData] = useState(null);

  const [selectedMap, setSelectedMap] = useState({});

  const [cveLoading, setCveLoading] = useState(false);

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  const [filters, setFilters] = useState([
    { column: "patch_id", operator: "contains", value: "", logic: "AND" },
  ]);

  /* =======================================================
     PATCH → CVE MAP
  ======================================================= */

  const patchCveMap = useMemo(() => {
    const map = {};

    cves.forEach((c) => {
      const key = `${c.patch_id}-${c.site_name}`;

      if (!map[key]) map[key] = [];

      map[key].push(c.cve_id);
    });

    return map;
  }, [cves]);

  if (patchLoading) return <div>Loading patches...</div>;

  /* =======================================================
     LAZY CVE LOADER
  ======================================================= */

  const loadPatchCves = async (patch) => {
    const key = getPatchKey(patch);

    if (patchCveMap[key]) return;

    setCveLoading(true);

    try {
      const res = await api.post("/cves/by-patches", {
        patches: [
          {
            patch_id: patch.patch_id,
            site_name: patch.site_name,
          },
        ],
      });

      const data = res.data?.data || [];

      setCves((prev) => [...prev, ...data]);
    } catch (err) {
      console.error("CVE fetch failed", err);
    } finally {
      setCveLoading(false);
    }
  };

  /* =======================================================
     SEVERITY
  ======================================================= */

  const getSeverityFromScore = (score) => {
    if (score >= 90) return "CRITICAL";
    if (score >= 75) return "HIGH";
    if (score >= 60) return "IMPORTANT";
    if (score >= 40) return "MODERATE";
    return "LOW";
  };

  /* =======================================================
     SELECTION
  ======================================================= */

  const toggleSelect = (patch) => {
    setSelectedMap((prev) => {
      const updated = { ...prev };
      const key = getPatchKey(patch);

      if (updated[key]) delete updated[key];
      else updated[key] = patch;

      return updated;
    });
  };

  const toggleSelectAll = (visible) => {
    setSelectedMap((prev) => {
      const updated = { ...prev };

      const allSelected = visible.every((p) => updated[getPatchKey(p)]);

      if (allSelected) {
        visible.forEach((p) => delete updated[getPatchKey(p)]);
      } else {
        visible.forEach((p) => (updated[getPatchKey(p)] = p));
      }

      return updated;
    });
  };

  const selectedCount = Object.keys(selectedMap).length;

  /* =======================================================
     FILTERS
  ======================================================= */

  const updateFilter = (index, key, value) => {
    const updated = [...filters];
    updated[index][key] = value;

    if (key === "column" && value === "final_score") {
      updated[index].operator = ">";
    }

    if (key === "column" && value !== "final_score") {
      updated[index].operator = "contains";
    }

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

  const applyFilters = (patch) => {
    return filters.reduce((result, filter, index) => {
      let condition = true;

      if (filter.column === "cve_id") {
        const list = patchCveMap[getPatchKey(patch)] || [];
        const val = filter.value.toLowerCase();

        condition = list.some((cve) => cve.toLowerCase().includes(val));
      } else if (filter.column === "final_score") {
        const field = Number(patch.final_score || 0);
        const val = Number(filter.value);

        if (isNaN(val)) return result;

        if (filter.operator === ">") condition = field > val;
        else if (filter.operator === "<") condition = field < val;
        else if (filter.operator === "=") condition = field === val;
        else if (filter.operator === ">=") condition = field >= val;
        else if (filter.operator === "<=") condition = field <= val;
      } else {
        let field = String(patch[filter.column] || "").toLowerCase();
        let val = filter.value.toLowerCase();

        /* PATCH ID NORMALIZATION */
        if (filter.column === "patch_id") {
          field = field.replace(/^bigfix-/, "");

          if (!val.startsWith("bigfix-")) {
            val = val;
          }
        }

        if (filter.operator === "contains") condition = field.includes(val);
        else if (filter.operator === "=") condition = field === val;
        else if (filter.operator === "does not contain")
          condition = !field.includes(val);
      }

      if (index === 0) return condition;

      if (filter.logic === "AND") return result && condition;
      if (filter.logic === "OR") return result || condition;

      return result;
    }, true);
  };

  /* =======================================================
     SORT
  ======================================================= */

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getSortArrow = (key) => {
    if (sortConfig.key !== key) return "";
    return sortConfig.direction === "asc" ? " ↑" : " ↓";
  };

  const filteredPatches = [...patches].filter(applyFilters).sort((a, b) => {
    if (!sortConfig.key) return 0;

    let aVal;
    let bVal;

    /* PATCH ID SORT */
    if (sortConfig.key === "patch_id") {
      aVal = String(a.patch_id || "")
        .replace(/^BIGFIX-/, "")
        .toLowerCase();
      bVal = String(b.patch_id || "")
        .replace(/^BIGFIX-/, "")
        .toLowerCase();
    } else if (sortConfig.key === "final_score") {
      /* SCORE SORT */
      aVal = Number(a.final_score || 0);
      bVal = Number(b.final_score || 0);
    } else if (sortConfig.key === "applicable_count") {
      /* APPLICABLE COMPUTERS SORT */
      aVal = Number(a.applicable_count || 0);
      bVal = Number(b.applicable_count || 0);
    } else if (sortConfig.key === "cve_count") {
      /* CVE COUNT SORT */
      const keyA = getPatchKey(a);
      const keyB = getPatchKey(b);

      aVal = a.cve_count ?? (patchCveMap[keyA]?.length || 0);
      bVal = b.cve_count ?? (patchCveMap[keyB]?.length || 0);
    } else {
      /* DEFAULT STRING SORT */
      aVal = String(a[sortConfig.key] || "").toLowerCase();
      bVal = String(b[sortConfig.key] || "").toLowerCase();
    }

    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;

    return 0;
  });

  const totalCount = patches.length;

  /* =======================================================
     BASELINE
  ======================================================= */

  const approvePatches = () => {
    if (selectedCount === 0) return;

    addBaseline({
      patches: Object.values(selectedMap),
    });

    setSelectedMap({});
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div>
      {/* FILTERS */}

      <div className="risk-filter-container">
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
              <option value="patch_name">Patch Name</option>
              <option value="severity">Severity</option>
              <option value="vendor">Vendor</option>
              <option value="final_score">Score</option>
              <option value="cve_id">CVE ID</option>
            </select>

            <select
              value={filter.operator}
              onChange={(e) => updateFilter(index, "operator", e.target.value)}
            >
              {filter.column === "final_score" ? (
                <>
                  <option value=">">greater than</option>
                  <option value="<">less than</option>
                  <option value="=">equals</option>
                  <option value=">=">greater or equal</option>
                  <option value="<=">less or equal</option>
                </>
              ) : (
                <>
                  <option value="contains">contains</option>
                  <option value="=">equals</option>
                  <option value="does not contain">does not contain</option>
                </>
              )}
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

        <button className="risk-reset-btn" onClick={resetFilters}>
          Reset Filters
        </button>
      </div>

      {/* APPROVE */}

      <div className="risk-header-info">
        Selected: {selectedCount} / {totalCount} Total Patches
      </div>

      <div className="risk-approve-container">
        <button
          className="risk-approve-btn"
          disabled={selectedCount === 0}
          onClick={approvePatches}
        >
          Approve Patches ({selectedCount})
        </button>
      </div>

      {/* TABLE */}

      <div className="risk-table">
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  onChange={() => toggleSelectAll(filteredPatches)}
                />
              </th>

              <th onClick={() => handleSort("patch_id")}>
                <span className="risk-th-content">
                  Patch ID
                  <span className="risk-sort-arrow">
                    {getSortArrow("patch_id")}
                  </span>
                </span>
              </th>

              <th onClick={() => handleSort("patch_name")}>
                <span className="risk-th-content">
                  Name
                  <span className="risk-sort-arrow">
                    {getSortArrow("patch_name")}
                  </span>
                </span>
              </th>

              <th onClick={() => handleSort("applicable_count")}>
                <span className="risk-th-content">
                  Applicable
                  <span className="risk-sort-arrow">
                    {getSortArrow("applicable_count")}
                  </span>
                </span>
              </th>

              <th onClick={() => handleSort("cve_count")}>
                <span className="risk-th-content">
                  CVEs
                  <span className="risk-sort-arrow">
                    {getSortArrow("cve_count")}
                  </span>
                </span>
              </th>

              <th>Severity</th>

              <th onClick={() => handleSort("final_score")}>
                <span className="risk-th-content">
                  Score
                  <span className="risk-sort-arrow">
                    {getSortArrow("final_score")}
                  </span>
                </span>
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredPatches.map((p) => {
              const isSelected = !!selectedMap[getPatchKey(p)];
              const score = Number(p.final_score || 0);
              const derivedSeverity = getSeverityFromScore(score);

              return (
                <tr
                  key={getPatchKey(p)}
                  className={isSelected ? "selected-row" : ""}
                  onClick={() => toggleSelect(p)}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelect(p)}
                    />
                  </td>

                  <td>
                    {p.patch_id?.replace(/^BIGFIX-/, "")}

                    {p.has_kev && <span className="kev-badge">KEV</span>}
                  </td>

                  <td>{p.patch_name}</td>

                  <td>
                    <span
                      style={{ cursor: "pointer", color: "#3b82f6" }}
                      onClick={(e) => {
                        e.stopPropagation();

                        setModalData({
                          title: "Applicable Computers",
                          items: p.applicable_computers || [],
                        });
                      }}
                    >
                      {p.applicable_count || 0}
                    </span>
                  </td>

                  <td>
                    <span
                      style={{ cursor: "pointer", color: "#3b82f6" }}
                      onClick={(e) => {
                        e.stopPropagation();

                        setCveLoading(true);

                        const key = getPatchKey(p);

                        setModalData({
                          title: "CVE IDs",
                          key: key,
                        });

                        loadPatchCves(p);
                      }}
                    >
                      {p.cve_count ?? patchCveMap[getPatchKey(p)]?.length ?? 0}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`severity-badge severity-${derivedSeverity.toLowerCase()}`}
                    >
                      {derivedSeverity}
                    </span>
                  </td>

                  <td style={{ textAlign: "right" }}>{score.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL */}

      {modalData && (
        <div className="risk-modal-overlay" onClick={() => setModalData(null)}>
          <div className="risk-modal" onClick={(e) => e.stopPropagation()}>
            <div className="risk-modal-header">
              <h3>{modalData.title}</h3>

              <button
                className="risk-modal-close"
                onClick={() => setModalData(null)}
              >
                ✕
              </button>
            </div>

            <div className="risk-modal-body">
              {/* CVE MODAL */}
              {modalData.key ? (
                (() => {
                  const cveList = patchCveMap[modalData.key] || [];

                  if (cveLoading && cveList.length === 0) {
                    return <div className="risk-spinner"></div>;
                  }

                  if (cveList.length === 0) {
                    return (
                      <div className="risk-modal-empty">No CVEs found</div>
                    );
                  }

                  return (
                    <ul>
                      {cveList.map((cve, i) => (
                        <li key={i}>{cve}</li>
                      ))}
                    </ul>
                  );
                })()
              ) : /* APPLICABLE COMPUTERS MODAL */

              !modalData.items || modalData.items.length === 0 ? (
                <div className="risk-modal-empty">No data available</div>
              ) : (
                <ul>
                  {modalData.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
