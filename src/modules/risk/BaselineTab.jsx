import { useState, useEffect } from "react";

export default function BaselineTab({ baselines = [], pendingPatches = [] }) {
  const [patches, setPatches] = useState([]);
  const [baselineName, setBaselineName] = useState("");
  const [siteType, setSiteType] = useState("Master");
  const [selectedSite, setSelectedSite] = useState("");

  const [baselineList, setBaselineList] = useState([]); // added missing state
  const [allSites, setAllSites] = useState([]);

  const [showCVE, setShowCVE] = useState(false);
  const [cveData, setCveData] = useState([]);

  const [selectedBaselineId, setSelectedBaselineId] = useState(null);

  const [creatingBaseline, setCreatingBaseline] = useState(false); // spinner state

  const filteredSites = allSites.filter((site) => site.type === siteType);
  const [baselineDetails, setBaselineDetails] = useState(null);
  // Load patches from PatchTab
  useEffect(() => {
    if (pendingPatches.length) {
      setPatches(pendingPatches);
    }
  }, [pendingPatches]);

  useEffect(() => {
    fetch("http://localhost:5000/api/baselines")
      .then((res) => res.json())
      .then((data) => {
        const formatted = (data.data || []).map((b) => ({
          id: b.id,
          name: b.baseline_name,
          status: b.status.toUpperCase(),
          patches: b.patch_ids.map((id) => ({
            patch_id: `BIGFIX-${id}`,
          })),
        }));

        setBaselineList(formatted);
      })
      .catch(() => alert("Failed to load baselines"));
  }, []);

  // Load sites
  useEffect(() => {
    fetch("http://localhost:5000/api/sites")
      .then((res) => res.json())
      .then((data) => setAllSites(data))
      .catch(() => alert("Failed to load sites"));
  }, []);

  // =============================
  // Patch reorder
  // =============================

  const movePatch = (index, direction) => {
    const newPatches = [...patches];
    const newIndex = index + direction;

    if (newIndex < 0 || newIndex >= newPatches.length) return;

    [newPatches[index], newPatches[newIndex]] = [
      newPatches[newIndex],
      newPatches[index],
    ];

    setPatches(newPatches);
  };

  // =============================
  // Remove patch
  // =============================

  const removePatch = (index) => {
    const updated = patches.filter((_, i) => i !== index);
    setPatches(updated);
  };

  // =============================
  // Fetch CVE
  // =============================

  const fetchCVE = async () => {
    if (!patches.length) {
      alert("No patches selected");
      return;
    }

    try {
      const res = await fetch(
        "http://localhost:5000/api/cves/by-patches?page=1&limit=50",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },

          body: JSON.stringify({
            patches: patches.map((p) => ({
              patch_id: p.patch_id,
              site_name: p.site_name,
            })),
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to fetch CVE");
        return;
      }

      setCveData(data.data || []);
      setShowCVE(true);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch CVE");
    }
  };

  // =============================
  // Create baseline
  // =============================

  const createBaseline = async () => {
    if (creatingBaseline) return;

    if (!baselineName.trim()) {
      alert("Baseline name required");
      return;
    }

    if (!patches.length) {
      alert("No patches selected");
      return;
    }

    if (siteType === "Custom" && !selectedSite) {
      alert("Select site");
      return;
    }

    try {
      setCreatingBaseline(true);

      const res = await fetch("http://localhost:5000/api/baselines/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({
          name: baselineName,
          siteType,
          site: selectedSite,
          patches: patches.map((p) => ({
            patch_id: p.patch_id,
            site_name: p.site_name,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Baseline creation failed");
        return;
      }

      alert("Baseline created successfully");

      setBaselineName("");
      setPatches([]);
    } catch (err) {
      console.error(err);
      alert("Baseline creation failed");
    } finally {
      setCreatingBaseline(false);
    }
  };

  // fetch baseline

  const fetchBaselineDetails = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/baselines/${id}`);
      const data = await res.json();

      if (!res.ok) {
        alert("Failed to fetch baseline details");
        return;
      }

      setBaselineDetails(data.data[0]);
      setSelectedBaselineId(id);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteBaseline = async () => {
    if (!selectedBaselineId) {
      alert("Select a baseline first");
      return;
    }

    if (!window.confirm("Delete this baseline?")) return;

    try {
      const res = await fetch(
        `http://localhost:5000/api/baselines/${selectedBaselineId}`,
        { method: "DELETE" },
      );

      if (!res.ok) {
        alert("Failed to delete baseline");
        return;
      }

      setBaselineDetails(null);
      setSelectedBaselineId(null);

      const updated = baselineList.filter((b) => b.id !== selectedBaselineId);
      setBaselineList(updated);
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  };
  // =============================
  // UI
  // =============================

  return (
    <div className="baseline-layout">
      {/* LEFT PANEL */}

      <div className="baseline-sidebar">
        <div className="baseline-sidebar-header">Baselines</div>

        <table className="baseline-list-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Patches</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {baselineList.map((b) => (
              <tr
                key={b.id}
                onClick={() => fetchBaselineDetails(b.id)}
                className={
                  b.id === selectedBaselineId ? "baseline-row-selected" : ""
                }
              >
                <td>{b.name}</td>

                <td>{b.patches?.length || 0}</td>

                <td>
                  <span
                    className={
                      b.status === "APPROVED"
                        ? "status-approved"
                        : "status-draft"
                    }
                  >
                    {b.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="baseline-sidebar-actions">
          <button
            className="danger-btn"
            disabled={!selectedBaselineId}
            onClick={deleteBaseline}
          >
            Delete Baseline
          </button>
        </div>
      </div>

      {/* RIGHT PANEL */}

      <div className="baseline-editor">
        {baselineDetails && (
          <div className="baseline-details">
            <div className="baseline-details-header">
              <h3>{baselineDetails.baseline_name}</h3>

              <button
                className="close-btn"
                onClick={() => setBaselineDetails(null)}
              >
                ✕
              </button>
            </div>

            <p>BigFix ID: {baselineDetails.bigfix_baseline_id}</p>

            <p>Patches: {baselineDetails.patch_ids.length}</p>

            <div className="patch-order-container">
              {baselineDetails.patch_ids.map((p, i) => (
                <div key={p} className="patch-order-item">
                  {i + 1}. BIGFIX-{p}
                </div>
              ))}
            </div>
          </div>
        )}

        {patches.length > 0 && (
          <div>
            <div className="baseline-config">
              <div className="baseline-field">
                <label>Baseline Name</label>

                <input
                  value={baselineName}
                  onChange={(e) => setBaselineName(e.target.value)}
                />
              </div>

              <div className="baseline-field">
                <label>Site Type</label>

                <select
                  value={siteType}
                  onChange={(e) => setSiteType(e.target.value)}
                >
                  <option value="Master">Master</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>

              {siteType === "Custom" && (
                <div className="baseline-field">
                  <label>Site</label>

                  <select
                    value={selectedSite}
                    onChange={(e) => setSelectedSite(e.target.value)}
                  >
                    <option value="">Select Site</option>

                    {filteredSites.map((site) => (
                      <option key={site.name} value={site.name}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* PATCH ORDER */}

            <div className="patch-order-section">
              <div className="section-title">Patch Order</div>

              <div className="patch-order-container">
                {patches.map((p, index) => (
                  <div key={p.patch_id} className="patch-order-item">
                    <div>
                      <strong>
                        {index + 1}. {p.patch_id}
                      </strong>

                      <div className="patch-order-name">{p.patch_name}</div>
                    </div>

                    <div>
                      <button
                        className="small-btn"
                        onClick={() => movePatch(index, -1)}
                      >
                        ↑
                      </button>

                      <button
                        className="small-btn"
                        onClick={() => movePatch(index, 1)}
                      >
                        ↓
                      </button>

                      <button
                        className="small-btn danger"
                        onClick={() => removePatch(index)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CVE */}

            <div className="baseline-cve-section">
              {!showCVE && (
                <button className="primary-btn" onClick={fetchCVE}>
                  View CVE Details
                </button>
              )}

              {showCVE && (
                <>
                  <div className="cve-header">
                    <span className="section-title">
                      CVE Details ({cveData.length})
                    </span>

                    <button
                      className="secondary-btn"
                      onClick={() => setShowCVE(false)}
                    >
                      Hide
                    </button>
                  </div>

                  <div className="cve-table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>CVE</th>
                          <th>Severity</th>
                          <th>CVSS</th>
                          <th>EPSS</th>
                          <th>KEV</th>
                        </tr>
                      </thead>

                      <tbody>
                        {cveData.map((cve) => {
                          const severityClass =
                            cve.cvss_severity?.toLowerCase() || "low";

                          return (
                            <tr key={cve.cve_id}>
                              <td className="cve-id-cell">{cve.cve_id}</td>

                              <td>
                                <span
                                  className={`severity-badge severity-${severityClass}`}
                                >
                                  {cve.cvss_severity}
                                </span>
                              </td>

                              <td>{cve.cvss_base_score}</td>
                              <td>{cve.epss_score}</td>

                              <td>
                                <span
                                  className={
                                    cve.is_kev
                                      ? "kev-yes-badge"
                                      : "kev-no-badge"
                                  }
                                >
                                  {cve.is_kev ? "Yes" : "No"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="baseline-actions">
              <button
                className="primary-btn"
                onClick={createBaseline}
                disabled={creatingBaseline}
              >
                {creatingBaseline ? "Creating Baseline..." : "Create Baseline"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
