// src/components/BaselineManager.jsx
import { useState, useEffect, useMemo, useRef } from "react";

const API = window.env?.VITE_API_BASE || "http://localhost:5174";

function getHeaders() {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "x-user-role": sessionStorage.getItem("user_role") || "Admin",
  };
}

async function getJSON(endpoint) {
  const headers = getHeaders();
  delete headers["Content-Type"]; 
  const r = await fetch(`${API}${endpoint}`, { headers });
  const j = await r.json();
  if (!r.ok || j.ok === false) throw new Error(j.error || "Request failed");
  return j;
}

async function postJSON(endpoint, body) {
  const r = await fetch(`${API}${endpoint}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok || j.ok === false) throw new Error(j.error || "Request failed");
  return j;
}

const FancySelect = ({ label, options, value, onChange, disabled, placeholder, isLoading, multiSelect }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  let displayText = placeholder;
  let isPlaceholder = true;

  if (multiSelect) {
    if (Array.isArray(value) && value.length > 0) {
      isPlaceholder = false;
      displayText = value.length <= 2 ? value.join(", ") : `${value.length} selected`;
    }
  } else {
    const selectedOption = options.find((o) => o === value);
    if (selectedOption) {
      displayText = selectedOption;
      isPlaceholder = false;
    }
  }

  const handleOptionClick = (opt, e) => {
    if (multiSelect) {
      e.stopPropagation();
      const current = Array.isArray(value) ? value : [];
      const newSet = new Set(current);
      if (newSet.has(opt)) newSet.delete(opt);
      else newSet.add(opt);
      onChange(Array.from(newSet));
    } else {
      onChange(opt);
      setOpen(false);
    }
  };

  return (
    <div className="field" style={{ minWidth: 0, flex: 1 }}>
      <span className="label">{label}</span>
      {isLoading && <div className="sub" style={{ marginBottom: 4 }}>Loading...</div>}
      <div
        className={`fx-wrap ${open ? "fx-open" : ""}`}
        ref={wrapperRef}
        style={{
          pointerEvents: disabled || isLoading ? "none" : "auto",
          opacity: disabled || isLoading ? 0.6 : 1,
        }}
      >
        <button type="button" className="fx-trigger" onClick={() => setOpen(!open)}>
          <span className={`fx-value ${isPlaceholder ? "fx-placeholder" : ""}`} title={!isPlaceholder ? displayText : ""}>
            {displayText}
          </span>
          <span className="fx-chevron">▾</span>
        </button>

        {open && (
          <div className="fx-menu">
            <div className="fx-menu-inner">
              {options.length === 0 ? (
                <div className="fx-item fx-empty">No options</div>
              ) : (
                options.map((opt) => {
                  const isSelected = multiSelect ? (value || []).includes(opt) : value === opt;
                  return (
                    <div
                      key={opt}
                      className={`fx-item ${isSelected ? "fx-active" : ""}`}
                      onClick={(e) => handleOptionClick(opt, e)}
                    >
                      {multiSelect && (
                        <input 
                          type="checkbox" 
                          className="custom-checkbox" 
                          checked={isSelected} 
                          readOnly 
                          style={{ marginRight: 10, pointerEvents: "none" }} 
                        />
                      )}
                      <span className="fx-label">{opt}</span>
                      {!multiSelect && isSelected && <span className="fx-tick">✓</span>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function BaselineManager({ onClose }) {
  const [sites, setSites] = useState([]);
  const [selectedSites, setSelectedSites] = useState([]);
  const [selectedSeverities, setSelectedSeverities] = useState([]);
  const [allPatches, setAllPatches] = useState([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [loadingPatches, setLoadingPatches] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [selectedPatchKeys, setSelectedPatchKeys] = useState(() => new Set());

  // Creation State
  const [targetSites, setTargetSites] = useState([]);
  const [selectedTargetSite, setSelectedTargetSite] = useState("");
  const [baselineName, setBaselineName] = useState("");
  const [creating, setCreating] = useState(false);

  // --- Clear Messages Logic ---
  const clearMessages = () => {
    if (error) setError("");
    if (successMsg) setSuccessMsg("");
  };

  // 1. Fetch source & target sites
  useEffect(() => {
    async function init() {
      setLoadingSites(true);
      try {
        const [jSrc, jTgt] = await Promise.all([
          getJSON("/api/baseline/sites"),
          getJSON("/api/baseline/custom-sites"),
        ]);
        
        if (jSrc.ok) {
            let sourceSites = jSrc.sites || [];
            // UPDATE: EUC Role Filter (Only show Windows sites)
            const role = sessionStorage.getItem("user_role");
            if (role === 'EUC') {
                sourceSites = sourceSites.filter(s => s.toLowerCase().includes('windows'));
            }
            setSites(sourceSites);
        }

        if (jTgt.ok) {
          const tSites = jTgt.sites || [];
          setTargetSites(tSites);
          if (tSites.length > 0) setSelectedTargetSite(tSites[0]);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoadingSites(false);
      }
    }
    init();
  }, []);

  // 2. Fetch patches
  useEffect(() => {
    clearMessages();
    setSelectedSeverities([]);
    setAllPatches([]);
    setSelectedPatchKeys(new Set());

    if (selectedSites.length === 0) return;

    async function fetchPatches() {
      setLoadingPatches(true);
      try {
        let combined = [];
        for (const site of selectedSites) {
          const j = await getJSON(`/api/baseline/patches?site=${encodeURIComponent(site)}`);
          if (j.ok && Array.isArray(j.patches)) {
            combined = combined.concat(j.patches.map((p) => ({ ...p, site: p.site || site, key: `${p.id}||${p.site || site}` })));
          }
        }
        setAllPatches(combined);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoadingPatches(false);
      }
    }
    fetchPatches();
  }, [selectedSites]);

  const availableSeverities = useMemo(() => {
    if (allPatches.length === 0) return [];
    const s = new Set(allPatches.map((p) => p.severity || "Unspecified"));
    return Array.from(s).sort();
  }, [allPatches]);

  const filteredPatches = useMemo(() => {
    if (selectedSites.length === 0 || selectedSeverities.length === 0) return [];
    return allPatches.filter((p) => selectedSeverities.includes(p.severity || "Unspecified"));
  }, [allPatches, selectedSeverities, selectedSites]);

  const togglePatch = (key) => {
    clearMessages();
    const next = new Set(selectedPatchKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedPatchKeys(next);
  };

  const toggleAll = () => {
    clearMessages();
    const allKeys = filteredPatches.map((p) => p.key);
    const allSelected = allKeys.length > 0 && allKeys.every((k) => selectedPatchKeys.has(k));
    const next = new Set(selectedPatchKeys);
    if (allSelected) allKeys.forEach((k) => next.delete(k));
    else allKeys.forEach((k) => next.add(k));
    setSelectedPatchKeys(next);
  };

  const handleCreate = async () => {
    setError("");
    setSuccessMsg("");
    const localName = baselineName.trim();

    if (!localName) { setError("Please enter a Baseline Name."); return; }
    if (!selectedTargetSite) { setError("Please select a Target Site."); return; }
    if (selectedPatchKeys.size === 0) { setError("Please select at least one patch."); return; }

    setCreating(true);
    try {
      const payload = {
        baselineName: localName,
        targetSite: selectedTargetSite,
        patchKeys: Array.from(selectedPatchKeys),
      };
      const j = await postJSON("/api/baseline/create", payload);
      if (j.ok) {
        setSuccessMsg(`Baseline "${j.baselineName || localName}" created successfully.`);
        setBaselineName("");
        setSelectedPatchKeys(new Set()); 
      } else {
        throw new Error(j.error || "Failed to create baseline");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const isAllSelected = filteredPatches.length > 0 && filteredPatches.every((p) => selectedPatchKeys.has(p.key));
  const isIndeterminate = filteredPatches.some((p) => selectedPatchKeys.has(p.key)) && !isAllSelected;

  return (
    <div className="mgmt">
      <div className="topbar">
        <div className="left"><h2>Create Baseline</h2></div>
        <div className="right"><button className="btn" onClick={onClose}>Close</button></div>
      </div>

      <div className="section">
        <div className="section-head"><span className="title">1. Filter Patches</span></div>
        <div className="controls-grid">
          <FancySelect label="Select Source Site(s)" options={sites} value={selectedSites} onChange={setSelectedSites} placeholder="— Select Site(s) —" isLoading={loadingSites} disabled={loadingSites} multiSelect={true} />
          <FancySelect label="Select Severity" options={availableSeverities} value={selectedSeverities} onChange={(v) => { setSelectedSeverities(v); clearMessages(); }} placeholder="— Select Severity —" isLoading={loadingPatches} disabled={selectedSites.length === 0} multiSelect={true} />
        </div>
      </div>

      {selectedSites.length > 0 && selectedSeverities.length > 0 && (
        <div className="section">
          <div className="section-head">
            <span className="title">2. Select Patches</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
              <span className="pill soft">Selected: {selectedPatchKeys.size}</span>
              <span className="pill green">Total: {filteredPatches.length}</span>
            </div>
          </div>
          <div className="tableWrap">
            {filteredPatches.length === 0 ? (
              <div className="sub" style={{ padding: "40px", textAlign: "center", fontStyle: "italic" }}>No patches found.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "40px", textAlign: "center" }}>
                      <input type="checkbox" className="custom-checkbox" checked={isAllSelected} ref={(el) => el && (el.indeterminate = isIndeterminate)} onChange={toggleAll} />
                    </th>
                    <th style={{ width: "10%" }}>ID</th>
                    <th style={{ width: "20%" }}>Severity</th>
                    <th style={{ width: "20%" }}>Site</th>
                    <th>Name</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatches.map((p) => (
                    <tr key={p.key} onClick={() => togglePatch(p.key)} className={selectedPatchKeys.has(p.key) ? "selected-row" : ""}>
                      <td style={{ textAlign: "center" }}>
                        <input 
                          type="checkbox" 
                          className="custom-checkbox" 
                          checked={selectedPatchKeys.has(p.key)} 
                          readOnly
                          style={{ pointerEvents: 'none' }} // Pass clicks to TR
                        />
                      </td>
                      <td>{p.id}</td>
                      <td><span className={`rowchip ${/critical/i.test(p.severity) ? "hf" : "succ"}`}>{p.severity}</span></td>
                      <td>{p.site}</td>
                      <td>{p.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ padding: "0 20px 20px" }}>
        {error && <div className="banner error">{error}</div>}
        {successMsg && (
          <div className="banner success">
            <svg className="banner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {selectedPatchKeys.size > 0 && (
        <div className="section">
          <div className="section-head"><span className="title">3. Finalize & Create</span></div>
          <div className="controls-grid">
            <div className="field" style={{ flexGrow: 1 }}>
              <span className="label">Baseline Name</span>
              <input type="text" className="control" placeholder="e.g., Nov 2025 Security Updates" value={baselineName} onChange={(e) => { setBaselineName(e.target.value); clearMessages(); }} disabled={creating} />
            </div>
            <div style={{ flexGrow: 1 }}>
              <FancySelect label="Target Custom Site" options={targetSites} value={selectedTargetSite} onChange={(v) => { setSelectedTargetSite(v); clearMessages(); }} placeholder="— Select Target Site —" isLoading={loadingSites} disabled={creating} />
            </div>
          </div>
          <div className="action-bar">
            <div className="spacer"></div>
            <button className="btn pri" onClick={handleCreate} disabled={creating} style={{ height: "44px", minWidth: "160px" }}>
              {creating ? "Creating..." : "Create Baseline"}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .mgmt { padding: 20px; height: 100%; }
        .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
        .section { 
          background: var(--panel); 
          border: 1px solid var(--border); 
          border-radius: var(--radius); 
          margin-bottom: 20px; 
          overflow: visible; 
        }
        .section-head { padding: 12px 16px; background: var(--panel-2); border-bottom: 1px solid var(--border); font-weight: 700; display: flex; align-items: center; }
        .controls-grid { padding: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; align-items: flex-start; }
        .action-bar { padding: 12px 20px; border-top: 1px solid var(--border); background: var(--panel-2); display: flex; align-items: center; justify-content: flex-end; }
        .spacer { flex: 1; }
        .field { display: flex; flex-direction: column; gap: 8px; position: relative; z-index: 2; width: 100%; }
        .label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
        input.control { height: 44px; width: 100%; border: 1px solid var(--border); border-radius: 12px; background: var(--panel); color: var(--text); padding: 0 12px; font-size: 14px; outline: none; transition: all 160ms; }
        input.control:focus { border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 20%, transparent); }
        .fx-wrap { position: relative; width: 100%; }
        .fx-trigger { height: 44px; width: 100%; border: 1px solid var(--border); border-radius: 12px; background: var(--panel); color: var(--text); font-size: 14px; text-align: left; display: grid; grid-template-columns: 1fr auto; align-items: center; padding: 0 12px; gap: 8px; cursor: pointer; outline: none; box-shadow: 0 1px 0 rgba(0,0,0,.02) inset, 0 4px 12px rgba(0,0,0,.06); transition: all 160ms; }
        .fx-trigger:hover { transform: translateY(-1px); box-shadow: var(--shadow); }
        .fx-wrap.fx-open .fx-trigger { border-color: var(--primary); }
        .fx-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fx-value.fx-placeholder { color: var(--muted); opacity: 0.8; }
        .fx-chevron { font-size: 12px; color: var(--muted); transition: transform 160ms; }
        .fx-wrap.fx-open .fx-chevron { transform: rotate(180deg); }
        .fx-menu { position: absolute; left: 0; right: 0; top: 100%; margin-top: 5px; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; max-height: 250px; overflow: hidden; z-index: 9999; box-shadow: var(--shadow); }
        .fx-menu-inner { max-height: 250px; overflow-y: auto; padding: 6px; }
        .fx-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 13px; margin: 1px 0; transition: background 120ms; }
        .fx-item:hover { background: color-mix(in srgb, var(--primary) 14%, transparent); }
        .fx-item.fx-active { background: color-mix(in srgb, var(--primary) 22%, transparent); font-weight: 600; }
        .fx-tick { color: var(--primary); font-weight: 800; font-size: 11px; margin-left: auto; }
        .fx-item.fx-empty { justify-content: center; color: var(--muted); font-style: italic; cursor: default; }
        .tableWrap { max-height: 500px; overflow: auto; position: relative; z-index: 1; }
        tr.selected-row { background: color-mix(in srgb, var(--primary) 8%, transparent); }
        tr:hover { background: var(--panel-2); cursor: pointer; }
        input[type="checkbox"].custom-checkbox { appearance: none; width: 18px; height: 18px; border: 2px solid var(--muted); border-radius: 4px; background: var(--panel); display: inline-grid; place-content: center; cursor: pointer; padding: 0 !important; min-width: 18px !important; }
        input[type="checkbox"].custom-checkbox:checked { background: var(--primary); border-color: var(--primary); }
        input[type="checkbox"].custom-checkbox:checked::before { content: ""; width: 10px; height: 10px; box-shadow: inset 1em 1em white; transform-origin: center; clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%); transform: scale(0); transition: 120ms transform ease-in-out; }
        input[type="checkbox"].custom-checkbox:checked::before { transform: scale(1); }
        .banner { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 12px; margin-bottom: 20px; font-size: 14px; font-weight: 600; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .banner-icon { width: 20px; height: 20px; flex-shrink: 0; }
        .banner.success { background: #ecfdf5; border: 1px solid #a7f3d0; color: #064e3b; }
        .banner.error { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
        .btn-icon-sm { background: none; border: none; color: var(--danger); cursor: pointer; font-weight: bold; padding: 4px 8px; border-radius: 4px; }
        .btn-icon-sm:hover { background: color-mix(in srgb, var(--danger) 10%, transparent); }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
      `}</style>
    </div>
  );
}