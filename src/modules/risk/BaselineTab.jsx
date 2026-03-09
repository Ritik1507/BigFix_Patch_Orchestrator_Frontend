
// import { useState, useEffect } from "react";

// const getPatchKey = (p) => `${p.patch_id}-${p.site_name}`;

// export default function BaselineTab({ baselines = [], pendingPatches = [] }) {

//   const [patches, setPatches] = useState([]);
//   const [baselineName, setBaselineName] = useState("");
//   const [siteType, setSiteType] = useState("Master");
//   const [selectedSite, setSelectedSite] = useState("");

//   const [baselineList, setBaselineList] = useState([]);
//   const [allSites, setAllSites] = useState([]);

//   const [showCVE, setShowCVE] = useState(false);
//   const [cveData, setCveData] = useState([]);

//   const [selectedBaselineId, setSelectedBaselineId] = useState(null);
//   const [baselineDetails, setBaselineDetails] = useState(null);

//   const [creatingBaseline, setCreatingBaseline] = useState(false);

//   const filteredSites = allSites.filter((s) => s.type === siteType);

//   /* =============================
//      Receive patches from PatchTab
//   ============================= */

//   useEffect(() => {
//     if (pendingPatches.length) {
//       setPatches(pendingPatches);
//     }
//   }, [pendingPatches]);

//   /* =============================
//      Load Baselines
//   ============================= */

//   useEffect(() => {

//     fetch("/api/baselines")
//       .then((res) => res.json())
//       .then((data) => {

//         const rows = Array.isArray(data) ? data : data?.data || [];

//         const formatted = rows.map((b) => ({
//           id: b.id,
//           name: b.baseline_name,
//           status: (b.status || "CREATED").toUpperCase(),
//           patches: b.patch_ids || []
//         }));

//         setBaselineList(formatted);

//       })
//       .catch((err) => {
//         console.error("BASELINE LOAD ERROR:", err);
//         alert("Failed to load baselines");
//       });

//   }, []);

//   /* =============================
//      Load Sites
//   ============================= */

//   useEffect(() => {

//     fetch("/api/sites")
//       .then((res) => res.json())
//       .then((data) => setAllSites(data || []))
//       .catch(() => alert("Failed to load sites"));

//   }, []);

//   /* =============================
//      Patch reorder
//   ============================= */

//   const movePatch = (index, direction) => {

//     const newPatches = [...patches];
//     const newIndex = index + direction;

//     if (newIndex < 0 || newIndex >= newPatches.length) return;

//     [newPatches[index], newPatches[newIndex]] =
//     [newPatches[newIndex], newPatches[index]];

//     setPatches(newPatches);
//   };

//   /* =============================
//      Remove patch
//   ============================= */

//   const removePatch = (index) => {
//     const updated = patches.filter((_, i) => i !== index);
//     setPatches(updated);
//   };

//   /* =============================
//      Fetch CVE
//   ============================= */

//   const fetchCVE = async () => {

//     if (!patches.length) {
//       alert("No patches selected");
//       return;
//     }

//     try {

//       const res = await fetch("/api/cves/by-patches?page=1&limit=50", {

//         method: "POST",
//         headers: { "Content-Type": "application/json" },

//         body: JSON.stringify({
//           patches: patches.map((p) => ({
//             patch_id: p.patch_id,
//             site_name: p.site_name
//           }))
//         })

//       });

//       const data = await res.json();

//       if (!res.ok) {
//         alert(data.error || "Failed to fetch CVE");
//         return;
//       }

//       setCveData(data.data || []);
//       setShowCVE(true);

//     } catch (err) {

//       console.error(err);
//       alert("Failed to fetch CVE");

//     }
//   };

//   /* =============================
//      Create baseline
//   ============================= */

//   const createBaseline = async () => {

//     if (creatingBaseline) return;

//     if (!baselineName.trim()) {
//       alert("Baseline name required");
//       return;
//     }

//     if (!patches.length) {
//       alert("No patches selected");
//       return;
//     }

//     if (siteType === "Custom" && !selectedSite) {
//       alert("Select site");
//       return;
//     }

//     try {

//       setCreatingBaseline(true);

//       const res = await fetch("/api/baselines/create", {

//         method: "POST",
//         headers: { "Content-Type": "application/json" },

//         body: JSON.stringify({

//           name: baselineName,
//           siteType,
//           site: selectedSite,

//           patches: patches.map((p) => ({
//             patch_id: p.patch_id,
//             site_name: p.site_name
//           }))

//         })
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         alert(data.error || "Baseline creation failed");
//         return;
//       }

//       alert("Baseline created successfully");

//       setBaselineName("");
//       setPatches([]);

//     } catch (err) {

//       console.error(err);
//       alert("Baseline creation failed");

//     } finally {

//       setCreatingBaseline(false);

//     }
//   };

//   /* =============================
//      Fetch Baseline Details
//   ============================= */

//   const fetchBaselineDetails = async (id) => {

//     try {

//       const res = await fetch(`/api/baselines/${id}`);
//       const data = await res.json();

//       if (!res.ok) {
//         alert("Failed to fetch baseline details");
//         return;
//       }

//       setBaselineDetails(data.data?.[0] || null);
//       setSelectedBaselineId(id);

//     } catch (err) {

//       console.error(err);

//     }
//   };

//   /* =============================
//      Delete baseline
//   ============================= */

//   const deleteBaseline = async () => {

//     if (!selectedBaselineId) {
//       alert("Select a baseline first");
//       return;
//     }

//     if (!window.confirm("Delete this baseline?")) return;

//     try {

//       const res = await fetch(`/api/baselines/${selectedBaselineId}`, {
//         method: "DELETE"
//       });

//       if (!res.ok) {
//         alert("Failed to delete baseline");
//         return;
//       }

//       setBaselineDetails(null);
//       setSelectedBaselineId(null);

//       setBaselineList((prev) =>
//         prev.filter((b) => b.id !== selectedBaselineId)
//       );

//     } catch (err) {

//       console.error(err);
//       alert("Delete failed");

//     }
//   };

//   return (
//     <div className="baseline-layout">

//       {/* LEFT PANEL */}

//       <div className="baseline-sidebar">

//         <div className="baseline-sidebar-header">Baselines</div>

//         <table className="baseline-list-table">

//           <thead>
//             <tr>
//               <th>Name</th>
//               <th>Patches</th>
//               <th>Status</th>
//             </tr>
//           </thead>

//           <tbody>

//             {baselineList.map((b) => (

//               <tr
//                 key={b.id}
//                 onClick={() => fetchBaselineDetails(b.id)}
//                 className={
//                   b.id === selectedBaselineId
//                     ? "baseline-row-selected"
//                     : ""
//                 }
//               >

//                 <td>{b.name}</td>
//                 <td>{b.patches?.length || 0}</td>

//                 <td>
//                   <span className="status-draft">{b.status}</span>
//                 </td>

//               </tr>

//             ))}

//           </tbody>

//         </table>

//         <div className="baseline-sidebar-actions">
//           <button
//             className="danger-btn"
//             disabled={!selectedBaselineId}
//             onClick={deleteBaseline}
//           >
//             Delete Baseline
//           </button>
//         </div>

//       </div>

//       {/* RIGHT PANEL */}

//       <div className="baseline-editor">

//         {patches.length > 0 && (

//           <div>

//             {/* BASELINE CONFIG */}

//             <div className="baseline-config">

//               <div className="baseline-field">
//                 <label>Baseline Name</label>

//                 <input
//                   value={baselineName}
//                   onChange={(e) => setBaselineName(e.target.value)}
//                 />
//               </div>

//               <div className="baseline-field">
//                 <label>Site Type</label>

//                 <select
//                   value={siteType}
//                   onChange={(e) => setSiteType(e.target.value)}
//                 >
//                   <option value="Master">Master</option>
//                   <option value="Custom">Custom</option>
//                 </select>
//               </div>

//               {siteType === "Custom" && (

//                 <div className="baseline-field">

//                   <label>Site</label>

//                   <select
//                     value={selectedSite}
//                     onChange={(e) => setSelectedSite(e.target.value)}
//                   >

//                     <option value="">Select Site</option>

//                     {filteredSites.map((site) => (
//                       <option key={site.name} value={site.name}>
//                         {site.name}
//                       </option>
//                     ))}

//                   </select>

//                 </div>

//               )}

//             </div>

//             {/* PATCH ORDER TABLE */}

//             <div className="patch-order-section">

//               <div className="section-title">Patch Order</div>

//               <div className="patch-order-container">

//                 {patches.map((p, index) => (

//                   <div key={getPatchKey(p)} className="patch-order-item">

//                     <div>

//                       <strong>
//                         {index + 1}. {p.patch_id}
//                       </strong>

//                       <div className="patch-order-name">
//                         {p.patch_name}
//                       </div>

//                     </div>

//                     <div>

//                       <button
//                         className="small-btn"
//                         onClick={() => movePatch(index, -1)}
//                       >
//                         ↑
//                       </button>

//                       <button
//                         className="small-btn"
//                         onClick={() => movePatch(index, 1)}
//                       >
//                         ↓
//                       </button>

//                       <button
//                         className="small-btn danger"
//                         onClick={() => removePatch(index)}
//                       >
//                         ✕
//                       </button>

//                     </div>

//                   </div>

//                 ))}

//               </div>

//             </div>

//             {/* CVE SECTION */}

//             <div className="baseline-cve-section">

//               {!showCVE && (
//                 <button className="primary-btn" onClick={fetchCVE}>
//                   View CVE Details
//                 </button>
//               )}

//               {showCVE && (

//                 <div className="cve-table-container">

//                   <table>

//                     <thead>
//                       <tr>
//                         <th>CVE</th>
//                         <th>Severity</th>
//                         <th>CVSS</th>
//                         <th>EPSS</th>
//                         <th>KEV</th>
//                       </tr>
//                     </thead>

//                     <tbody>

//                       {cveData.map((cve) => (

//                         <tr key={cve.cve_id}>

//                           <td>{cve.cve_id}</td>
//                           <td>{cve.cvss_severity}</td>
//                           <td>{cve.cvss_base_score}</td>
//                           <td>{cve.epss_score}</td>

//                           <td>
//                             {cve.is_kev ? "Yes" : "No"}
//                           </td>

//                         </tr>

//                       ))}

//                     </tbody>

//                   </table>

//                 </div>

//               )}

//             </div>

//             <div className="baseline-actions">

//               <button
//                 className="primary-btn"
//                 onClick={createBaseline}
//                 disabled={creatingBaseline}
//               >
//                 {creatingBaseline
//                   ? "Creating Baseline..."
//                   : "Create Baseline"}
//               </button>

//             </div>

//           </div>

//         )}

//       </div>

//     </div>
//   );
// }


import { useState, useEffect, useRef } from "react";
import api from "../../api/api";

const RiskDropdown = ({ options, value, onChange, width = "160px" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOpt = options.find((o) => o.value === value);

  return (
    <div className={`fx-wrap ${open ? "fx-open" : ""}`} ref={ref} style={{ width, flexShrink: 0 }}>
      <button type="button" className="fx-trigger" onClick={() => setOpen(!open)}>
        <span className="fx-value">{selectedOpt ? selectedOpt.label : value}</span>
        <span className="fx-chevron">▾</span>
      </button>
      {open && (
        <div className="fx-menu">
          <div className="fx-menu-inner">
            {options.map((opt) => (
              <div 
                key={opt.value} 
                className={`fx-item ${value === opt.value ? "active" : ""}`} 
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                onClick={() => { onChange(opt.value); setOpen(false); }}
              >
                <span className="fx-label">{opt.label}</span>
                {value === opt.value && <span className="fx-tick">✓</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function BaselineTab({ baselines = [], pendingPatches = [] }) {
  const [patches, setPatches] = useState([]);
  const [baselineName, setBaselineName] = useState("");
  const [siteType, setSiteType] = useState("Master");
  const [selectedSite, setSelectedSite] = useState("");

  const [baselineList, setBaselineList] = useState([]); 
  const [allSites, setAllSites] = useState([]);

  const [showCVE, setShowCVE] = useState(false);
  const [cveData, setCveData] = useState([]);

  const [selectedBaselineId, setSelectedBaselineId] = useState(null);
  const [creatingBaseline, setCreatingBaseline] = useState(false); 

  // SAFEGUARD: Ensure allSites is an array before filtering
  const filteredSites = Array.isArray(allSites) 
    ? allSites.filter((site) => site.type === siteType) 
    : [];

  const [baselineDetails, setBaselineDetails] = useState(null);

  // Load patches from PatchTab
  useEffect(() => {
    if (pendingPatches.length) {
      setPatches(pendingPatches);
    }
  }, [pendingPatches]);

  // Load baselines
  useEffect(() => {
    api.get("/baselines")
      .then((res) => {
        const data = res.data;
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

  // Load sites safely
  useEffect(() => {
    api.get("/sites")
      .then((res) => {
        const data = res.data;
        if (Array.isArray(data)) {
          setAllSites(data);
        } else if (data && Array.isArray(data.data)) {
          setAllSites(data.data);
        } else {
          setAllSites([]); // Fallback to empty array if response is strange
        }
      })
      .catch((err) => {
        console.error("Failed to load sites:", err);
        setAllSites([]);
      });
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
      const res = await api.post("/cves/by-patches?page=1&limit=50", {
        patches: patches.map((p) => ({
          patch_id: p.patch_id,
          site_name: p.site_name,
        })),
      });

      setCveData(res.data?.data || []);
      setShowCVE(true);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to fetch CVE");
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

      await api.post("/baselines/create", {
        name: baselineName,
        siteType,
        site: selectedSite,
        patches: patches.map((p) => ({
          patch_id: p.patch_id,
          site_name: p.site_name,
        })),
      });

      alert("Baseline created successfully");
      setBaselineName("");
      setPatches([]);
      
      // Refresh baseline list
      const res = await api.get("/baselines");
      const formatted = (res.data?.data || []).map((b) => ({
        id: b.id,
        name: b.baseline_name,
        status: b.status.toUpperCase(),
        patches: b.patch_ids.map((id) => ({
          patch_id: `BIGFIX-${id}`,
        })),
      }));
      setBaselineList(formatted);
      
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Baseline creation failed");
    } finally {
      setCreatingBaseline(false);
    }
  };

  // =============================
  // Fetch baseline details
  // =============================
  const fetchBaselineDetails = async (id) => {
    try {
      const res = await api.get(`/baselines/${id}`);
      setBaselineDetails(res.data?.data?.[0]);
      setSelectedBaselineId(id);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch baseline details");
    }
  };

  // =============================
  // Delete baseline
  // =============================
  const deleteBaseline = async () => {
    if (!selectedBaselineId) {
      alert("Select a baseline first");
      return;
    }

    if (!window.confirm("Delete this baseline?")) return;

    try {
      await api.delete(`/baselines/${selectedBaselineId}`);

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
                className={b.id === selectedBaselineId ? "baseline-row-selected" : ""}
              >
                <td>{b.name}</td>
                <td>{b.patches?.length || 0}</td>
                <td>
                  <span className={b.status === "APPROVED" ? "status-approved" : "status-draft"}>
                    {b.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="baseline-sidebar-actions" style={{ padding: "16px", marginTop: "auto", borderTop: "1px solid var(--border)" }}>
          <button className="btn danger" disabled={!selectedBaselineId} onClick={deleteBaseline} style={{ width: "100%" }}>
            Delete Baseline
          </button>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="baseline-editor">
        {baselineDetails && (
          <div className="baseline-details" style={{ marginBottom: "24px" }}>
            <div className="baseline-details-header">
              <h3 style={{ margin: 0, fontSize: "18px", color: "var(--text)" }}>{baselineDetails.baseline_name}</h3>
              <button className="close-btn" onClick={() => setBaselineDetails(null)}>✕</button>
            </div>

            <p style={{ margin: "4px 0", color: "var(--muted)", fontSize: "14px" }}>BigFix ID: {baselineDetails.bigfix_baseline_id}</p>
            <p style={{ margin: "4px 0", color: "var(--muted)", fontSize: "14px" }}>Patches: {baselineDetails.patch_ids.length}</p>

            <div className="patch-order-container" style={{ marginTop: "12px" }}>
              {baselineDetails.patch_ids.map((p, i) => (
                <div key={p} className="patch-order-item" style={{ fontSize: "14px" }}>
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
                  className="control"
                  value={baselineName}
                  onChange={(e) => setBaselineName(e.target.value)}
                  placeholder="Enter Baseline Name"
                />
              </div>

              <div className="baseline-field">
                <label>Site Type</label>
                <RiskDropdown
                  width="100%"
                  value={siteType}
                  onChange={(val) => {
                    setSiteType(val);
                    setSelectedSite(""); // Reset site when changing type
                  }}
                  options={[
                    { value: "Master", label: "Master" },
                    { value: "Custom", label: "Custom" }
                  ]}
                />
              </div>

              {siteType === "Custom" && (
                <div className="baseline-field">
                  <label>Site</label>
                  <RiskDropdown
                    width="100%"
                    value={selectedSite}
                    onChange={(val) => setSelectedSite(val)}
                    options={[
                      { value: "", label: "Select Site" },
                      ...filteredSites.map((site) => ({ value: site.name, label: site.name }))
                    ]}
                  />
                </div>
              )}
            </div>

            {/* PATCH ORDER */}
            <div className="patch-order-section">
              <div className="section-title" style={{ fontWeight: 600, color: "var(--text)", marginBottom: "8px" }}>Patch Order</div>

              <div className="patch-order-container">
                {patches.map((p, index) => (
                  <div key={p.patch_id} className="patch-order-item">
                    <div>
                      <strong style={{ display: "block", marginBottom: "4px", color: "var(--primary)" }}>
                        {index + 1}. {p.patch_id}
                      </strong>
                      <div className="patch-order-name" style={{ color: "var(--muted)", fontSize: "13px" }}>{p.patch_name}</div>
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button className="btn ghost small" style={{ padding: "0 8px", height: "28px" }} onClick={() => movePatch(index, -1)}>↑</button>
                      <button className="btn ghost small" style={{ padding: "0 8px", height: "28px" }} onClick={() => movePatch(index, 1)}>↓</button>
                      <button className="btn danger small" style={{ padding: "0 8px", height: "28px" }} onClick={() => removePatch(index)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CVE */}
            <div className="baseline-cve-section">
              {!showCVE && (
                <button className="btn pri" onClick={fetchCVE}>
                  View CVE Details
                </button>
              )}

              {showCVE && (
                <>
                  <div className="cve-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span className="section-title" style={{ fontWeight: 600, color: "var(--text)" }}>
                      CVE Details ({cveData.length})
                    </span>
                    <button className="btn ghost" onClick={() => setShowCVE(false)}>
                      Hide
                    </button>
                  </div>

                  <div className="cve-table-container">
                    <table className="cve-table">
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
                          const severityClass = cve.cvss_severity?.toLowerCase() || "low";
                          return (
                            <tr key={cve.cve_id}>
                              <td className="cve-id-cell">{cve.cve_id}</td>
                              <td>
                                <span className={`severity-badge severity-${severityClass}`}>
                                  {cve.cvss_severity}
                                </span>
                              </td>
                              <td>{cve.cvss_base_score}</td>
                              <td>{cve.epss_score}</td>
                              <td>
                                <span className={cve.is_kev ? "kev-yes-badge" : "kev-no-badge"}>
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

            <div className="baseline-actions" style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
              <button className="btn pri" onClick={createBaseline} disabled={creatingBaseline}>
                {creatingBaseline ? "Creating Baseline..." : "Create Baseline"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}