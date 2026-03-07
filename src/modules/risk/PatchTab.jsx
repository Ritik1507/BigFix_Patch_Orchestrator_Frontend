import { useEffect, useState, useMemo } from "react";
import api from "../../api/api";

export default function PatchTab({ addBaseline }) {
  const [patches, setPatches] = useState([]);
  const [cves, setCves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalData, setModalData] = useState(null);

  const [selectedMap, setSelectedMap] = useState({});

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  const [filters, setFilters] = useState([
    { column: "patch_id", operator: "contains", value: "", logic: "AND" },
  ]);

  // =====================================================
  // FETCH PATCHES + CVEs
  // =====================================================

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const patchRes = await api.get("/patches");
        const patchData = patchRes.data;
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
        console.error("PatchTab load failed:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // =====================================================
  // PATCH → CVE MAP
  // =====================================================

  const patchCveMap = useMemo(() => {
    const map = {};
    cves.forEach((c) => {
      if (!map[c.patch_id]) map[c.patch_id] = [];
      map[c.patch_id].push(c.cve_id);
    });
    return map;
  }, [cves]);

  // =====================================================
  // SEVERITY LOGIC (UNCHANGED)
  // =====================================================

  const getSeverityFromScore = (score) => {
    if (score >= 90) return "CRITICAL";
    if (score >= 75) return "HIGH";
    if (score >= 60) return "IMPORTANT";
    if (score >= 40) return "MODERATE";
    return "LOW";
  };

  // =====================================================
  // SELECTION LOGIC (UNCHANGED)
  // =====================================================

  const toggleSelect = (patch) => {
    setSelectedMap((prev) => {
      const updated = { ...prev };
      if (updated[patch.patch_id]) {
        delete updated[patch.patch_id];
      } else {
        updated[patch.patch_id] = patch;
      }
      return updated;
    });
  };

  const toggleSelectAll = (visiblePatches) => {
    setSelectedMap((prev) => {
      const updated = { ...prev };
      const allSelected = visiblePatches.every((p) => updated[p.patch_id]);

      if (allSelected) {
        visiblePatches.forEach((p) => delete updated[p.patch_id]);
      } else {
        visiblePatches.forEach((p) => {
          updated[p.patch_id] = p;
        });
      }

      return updated;
    });
  };

  const selectedCount = Object.keys(selectedMap).length;

  // =====================================================
  // FILTER LOGIC (UPDATED)
  // =====================================================

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

  const applyFilters = (patch) => {
    return filters.reduce((result, filter, index) => {
      let condition = true;

      if (filter.column === "final_score") {
        const score = Number(patch.final_score || 0);
        const val = Number(filter.value);

        if (!isNaN(val)) {
          if (filter.operator === ">") condition = score > val;
          else if (filter.operator === "<") condition = score < val;
          else if (filter.operator === ">=") condition = score >= val;
          else if (filter.operator === "<=") condition = score <= val;
        }
      } else if (filter.column === "cve_id") {
        const cveList = patchCveMap[patch.patch_id] || [];
        const searchValue = filter.value.toLowerCase();

        if (filter.operator === "contains") {
          condition = cveList.some((cve) =>
            cve.toLowerCase().includes(searchValue),
          );
        } else if (filter.operator === "=") {
          condition = cveList.some((cve) => cve.toLowerCase() === searchValue);
        } else if (filter.operator === "does not contain") {
          condition = !cveList.some((cve) =>
            cve.toLowerCase().includes(searchValue),
          );
        }
      } else if (filter.column === "computer_name") {
        const computers = patch.applicable_computers || [];
        const searchValue = filter.value.toLowerCase();

        if (filter.operator === "contains") {
          condition = computers.some((c) =>
            c.toLowerCase().includes(searchValue),
          );
        } else if (filter.operator === "=") {
          condition = computers.some((c) => c.toLowerCase() === searchValue);
        } else if (filter.operator === "does not contain") {
          condition = !computers.some((c) =>
            c.toLowerCase().includes(searchValue),
          );
        }
      } else {
        const fieldValue = String(patch[filter.column] || "").toLowerCase();
        const searchValue = filter.value.toLowerCase();

        if (filter.operator === "contains") {
          condition = fieldValue.includes(searchValue);
        } else if (filter.operator === "=") {
          condition = fieldValue === searchValue;
        } else if (filter.operator === "does not contain") {
          condition = !fieldValue.includes(searchValue);
        }
      }

      if (index === 0) return condition;
      if (filter.logic === "AND") return result && condition;
      if (filter.logic === "OR") return result || condition;
      return result;
    }, true);
  };

  // =====================================================
  // SORTING
  // =====================================================

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

  const filteredPatches = patches.filter(applyFilters).sort((a, b) => {
    if (!sortConfig.key) {
      if (a.has_kev && !b.has_kev) return -1;
      if (!a.has_kev && b.has_kev) return 1;
      return (b.final_score || 0) - (a.final_score || 0);
    }

    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];

    if (sortConfig.key === "applicable_count") {
      aVal = a.applicable_count || 0;
      bVal = b.applicable_count || 0;
    }

    if (sortConfig.key === "cve_count") {
      aVal = patchCveMap[a.patch_id]?.length || 0;
      bVal = patchCveMap[b.patch_id]?.length || 0;
    }

    if (typeof aVal === "string") aVal = aVal.toLowerCase();
    if (typeof bVal === "string") bVal = bVal.toLowerCase();

    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;

    return 0;
  });

  const totalCount = patches.length;

  // =====================================================
  // BASELINE LOGIC (UNCHANGED)
  // =====================================================

  const approvePatches = () => {
    if (selectedCount === 0) return;

    addBaseline({
      patches: Object.values(selectedMap),
    });
    setSelectedMap({});
  };

  // =====================================================
  // COLUMN RESIZE LOGIC
  // =====================================================

  const initResize = (e) => {
    e.stopPropagation();

    const th = e.target.parentElement;
    const startX = e.clientX;
    const startWidth = th.offsetWidth;

    const onMouseMove = (moveEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      th.style.width = newWidth + "px";
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // =====================================================
  // RENDER
  // =====================================================

  if (loading) return <div>Loading...</div>;

  return (
    <div>
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
            <option value="computer_name">Computer Name</option>
          </select>

          {filter.column === "final_score" ? (
            <select
              value={filter.operator}
              onChange={(e) => updateFilter(index, "operator", e.target.value)}
            >
              <option value=">">greater than</option>
              <option value="<">less than</option>
              <option value=">=">greater or equal</option>
              <option value="<=">less or equal</option>
            </select>
          ) : (
            <select
              value={filter.operator}
              onChange={(e) => updateFilter(index, "operator", e.target.value)}
            >
              <option value="contains">contains</option>
              <option value="=">equal</option>
              <option value="does not contain">does not contain</option>
            </select>
          )}

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

              <th
                onClick={() => handleSort("patch_id")}
                style={{ position: "relative", width: 160 }}
              >
                Patch ID
                <span className="sort-arrow">{getSortArrow("patch_id")}</span>
                <div
                  className="column-resizer"
                  onMouseDown={(e) => initResize(e)}
                />
              </th>

              <th
                onClick={() => handleSort("patch_name")}
                style={{ position: "relative", width: 420 }}
              >
                Name
                <span className="sort-arrow">{getSortArrow("patch_name")}</span>
                <div
                  className="column-resizer"
                  onMouseDown={(e) => initResize(e)}
                />
              </th>

              <th
                onClick={() => handleSort("applicable_count")}
                style={{
                  position: "relative",
                  width: 100,
                  textAlign: "center",
                }}
              >
                Applicable
                <span className="sort-arrow">
                  {getSortArrow("applicable_count")}
                </span>
                <div
                  className="column-resizer"
                  onMouseDown={(e) => initResize(e)}
                />
              </th>

              <th
                onClick={() => handleSort("cve_count")}
                style={{ position: "relative", width: 80, textAlign: "center" }}
              >
                CVEs
                <span className="sort-arrow">{getSortArrow("cve_count")}</span>
                <div
                  className="column-resizer"
                  onMouseDown={(e) => initResize(e)}
                />
              </th>

              <th style={{ width: 120, textAlign: "center" }}>Severity</th>

              <th
                onClick={() => handleSort("final_score")}
                style={{ position: "relative", width: 100, textAlign: "right" }}
              >
                Score
                <span className="sort-arrow">
                  {getSortArrow("final_score")}
                </span>
                <div
                  className="column-resizer"
                  onMouseDown={(e) => initResize(e)}
                />
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredPatches.map((p) => {
              const isSelected = !!selectedMap[p.patch_id];
              const score = Number(p.final_score || 0);
              const derivedSeverity = getSeverityFromScore(score);

              return (
                <tr
                  key={p.patch_id}
                  className={isSelected ? "selected-row" : ""}
                >
                  <td style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(p)}
                    />
                  </td>

                  <td style={{ width: 160 }}>
                    {p.patch_id}
                    {p.has_kev && <span className="kev-badge">KEV</span>}
                  </td>

                  <td style={{ width: 420 }}>{p.patch_name}</td>

                  <td style={{ width: 100, textAlign: "center" }}>
                    <span
                      style={{ cursor: "pointer", color: "#3b82f6" }}
                      onClick={() =>
                        setModalData({
                          title: "Applicable Computers",
                          items: p.applicable_computers || [],
                        })
                      }
                    >
                      {p.applicable_count || 0}
                    </span>
                  </td>

                  <td style={{ width: 80, textAlign: "center" }}>
                    <span
                      style={{ cursor: "pointer", color: "#3b82f6" }}
                      onClick={() =>
                        setModalData({
                          title: "CVE IDs",
                          items: patchCveMap[p.patch_id] || [],
                        })
                      }
                    >
                      {patchCveMap[p.patch_id]?.length || 0}
                    </span>
                  </td>

                  <td style={{ width: 120, textAlign: "center" }}>
                    <span
                      className={`severity-badge severity-${derivedSeverity.toLowerCase()}`}
                    >
                      {derivedSeverity}
                    </span>
                  </td>

                  <td style={{ width: 100, textAlign: "right" }}>
                    {score.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalData && (
        <div className="risk-modal-overlay" onClick={() => setModalData(null)}>
          <div className="risk-modal" onClick={(e) => e.stopPropagation()}>
            <div className="risk-modal-header">
              <h3>
                {modalData.title} ({modalData.items.length})
              </h3>
              <button
                className="risk-modal-close"
                onClick={() => setModalData(null)}
              >
                ✕
              </button>
            </div>

            <div className="risk-modal-body">
              {modalData.items.length === 0 ? (
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
