// vite-project/src/components/GroupManager.jsx
import { useState, useEffect, useRef, useMemo, useCallback } from "react";

const API = window.env.VITE_API_BASE;

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
    body: JSON.stringify(body)
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
    const selectedOption = options.find(o => o === value);
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
      {isLoading && <div className="sub" style={{marginBottom: 4, fontSize: 10}}>Loading...</div>}
      <div 
        className={`fx-wrap ${open ? "fx-open" : ""}`} 
        ref={wrapperRef}
        style={{ pointerEvents: (disabled || isLoading) ? "none" : "auto", opacity: (disabled || isLoading) ? 0.6 : 1 }}
      >
        <button type="button" className="fx-trigger" onClick={() => setOpen(!open)}>
          <span className={`fx-value ${isPlaceholder ? "fx-placeholder" : ""}`} title={!isPlaceholder ? displayText : ""}>{displayText}</span>
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
                    <div key={opt} className={`fx-item ${isSelected ? "fx-active" : ""}`} onClick={(e) => handleOptionClick(opt, e)}>
                      {multiSelect && <input type="checkbox" className="custom-checkbox" checked={isSelected} readOnly style={{marginRight: 10, pointerEvents:'none'}} />}
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

export default function GroupManager({ onClose }) {
  const [groupType, setGroupType] = useState("Automatic");
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [operators] = useState(["Contains", "Equals", "Starts With"]);
  const [selectedOperator, setSelectedOperator] = useState("Contains");
  const [valueInput, setValueInput] = useState("");
  const [conditions, setConditions] = useState([]); 
  const [loadingProps, setLoadingProps] = useState(false);
  
  const [customSites, setCustomSites] = useState([]);
  const [selectedTargetSite, setSelectedTargetSite] = useState("");
  const [loadingSites, setLoadingSites] = useState(false);

  // --- PAGINATION STATE ---
  const [allComputers, setAllComputers] = useState([]);
  const [osList, setOsList] = useState([]); 
  const [selectedOSs, setSelectedOSs] = useState([]); 
  const [selectedCompIds, setSelectedCompIds] = useState(new Set()); 
  
  const [compPage, setCompPage] = useState(1);
  const [compSearch, setCompSearch] = useState("");
  const [hasMoreComp, setHasMoreComp] = useState(true);
  const [fetchingComp, setFetchingComp] = useState(false);

  useEffect(() => {
    setError("");
    setSuccessMsg("");
  }, []);

  const clearMessages = () => {
    if (error) setError("");
    if (successMsg) setSuccessMsg("");
  };

  // --- Load Automatic Group Meta ---
  useEffect(() => {
    clearMessages();
    if (groupType === "Automatic") {
      if (properties.length === 0) {
        setLoadingProps(true);
        getJSON("/api/groups/metadata/properties")
          .then(data => setProperties(data.properties || []))
          .catch(e => setError(e.message))
          .finally(() => setLoadingProps(false));
      }
      if (customSites.length === 0) {
        setLoadingSites(true);
        getJSON("/api/baseline/custom-sites")
          .then(data => {
             const sites = data.sites || [];
             setCustomSites(sites);
             if (sites.length > 0) setSelectedTargetSite(sites[0]);
          })
          .catch(e => console.error(e))
          .finally(() => setLoadingSites(false));
      }
    }
  }, [groupType]);

  // --- Load Computers (Paginated) ---
  useEffect(() => {
    if (groupType === "Manual") {
      fetchComputers();
    } else {
      setAllComputers([]);
      setCompPage(1);
    }
  }, [groupType, compPage, compSearch]);

  const fetchComputers = async () => {
    if (fetchingComp) return;
    
    setFetchingComp(true);
    try {
      const url = `/api/groups/metadata/computers?page=${compPage}&limit=20&search=${encodeURIComponent(compSearch)}`;
      const data = await getJSON(url);
      
      if (data.ok) {
        const newComps = data.computers || [];
        
        if (compPage === 1) {
          setAllComputers(newComps);
          const osSet = new Set(newComps.map(c => c.os).filter(o => o && o !== "Unknown"));
          setOsList(Array.from(osSet).sort());
        } else {
          setAllComputers(prev => {
            const existingIds = new Set(prev.map(c => c.id));
            const unique = newComps.filter(c => !existingIds.has(c.id));
            return [...prev, ...unique];
          });
          setOsList(prev => {
             const next = new Set(prev);
             newComps.forEach(c => { if(c.os && c.os !== "Unknown") next.add(c.os); });
             return Array.from(next).sort();
          });
        }
        setHasMoreComp(compPage < data.totalPages);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setFetchingComp(false);
    }
  };

  const observer = useRef();
  const lastCompRef = useCallback(node => {
    if (fetchingComp) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreComp) {
        setCompPage(prev => prev + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [fetchingComp, hasMoreComp]);

  // Filter visible list based on loaded items + OS filter
  const visibleComputers = useMemo(() => {
    let list = allComputers;
    
    // UPDATE: Filter out Servers for EUC Role
    const role = sessionStorage.getItem("user_role");
    if (role === 'EUC') {
        list = list.filter(c => {
            const os = (c.os || "").toLowerCase();
            return !os.includes("server"); // Exclude anything with "Server" in OS name
        });
    }

    if (selectedOSs.length > 0) {
      list = list.filter(c => selectedOSs.includes(c.os));
    }
    return list;
  }, [allComputers, selectedOSs]);


  const addCondition = () => {
    clearMessages();
    setError("");
    if (!selectedProperty || !valueInput.trim()) {
      setError("Please select a property and enter a value.");
      return;
    }
    const newCond = {
      id: Date.now(),
      property: selectedProperty,
      operator: selectedOperator,
      value: valueInput
    };
    setConditions([...conditions, newCond]);
    setValueInput(""); 
  };

  const removeCondition = (id) => {
    clearMessages();
    setConditions(conditions.filter(c => c.id !== id));
  };

  const toggleComputer = (id) => {
    clearMessages();
    const next = new Set(selectedCompIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCompIds(next);
  };

  const toggleAllVisible = () => {
    clearMessages();
    const next = new Set(selectedCompIds);
    const allVisibleIds = visibleComputers.map(c => c.id);
    const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => next.has(id));
    if (allSelected) allVisibleIds.forEach(id => next.delete(id));
    else allVisibleIds.forEach(id => next.add(id));
    setSelectedCompIds(next);
  };

  const handleCreate = async () => {
    setError(""); setSuccessMsg("");
    if (!groupName.trim()) { setError("Group Name is required."); return; }

    const payload = { name: groupName, type: groupType };

    if (groupType === "Automatic") {
      if (conditions.length === 0) { setError("Please add at least one condition."); return; }
      if (!selectedTargetSite) { setError("Please select a target site."); return; }
      payload.targetSite = selectedTargetSite;
      payload.conditions = conditions;
    } else {
      if (selectedCompIds.size === 0) { setError("Please select at least one computer."); return; }
      payload.computerIds = Array.from(selectedCompIds);
    }

    setCreating(true);
    try {
      await postJSON("/api/groups/create", payload);
      setSuccessMsg(`${groupType} Group "${groupName}" created successfully!`);
      setGroupName("");
      setConditions([]);
      setSelectedCompIds(new Set());
      setSelectedOSs([]);
      setCompSearch("");
      setCompPage(1);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mgmt">
      <div className="topbar">
        <div className="left"><h2>Create Computer Group</h2></div>
        <div className="right"><button className="btn" onClick={onClose}>Close</button></div>
      </div>

      <div className="section" style={{ overflow: 'visible' }}>
        <div className="section-head"><span className="title">1. Group Settings</span></div>
        <div className="controls-grid" style={{ gridTemplateColumns: 'auto 1fr', alignItems: 'center' }}>
          <div className="field" style={{ minWidth: 200 }}>
            <span className="label">Group Type</span>
            <div className="toggle-bg">
              <button className={`toggle-btn ${groupType === "Automatic" ? "active" : ""}`} onClick={() => setGroupType("Automatic")}>Automatic</button>
              <button className={`toggle-btn ${groupType === "Manual" ? "active" : ""}`} onClick={() => setGroupType("Manual")}>Manual</button>
            </div>
          </div>
          <div className="field">
            <span className="label">Group Name</span>
            <input type="text" className="control" placeholder="e.g., Windows 10 Patch Group" value={groupName} onChange={(e) => { setGroupName(e.target.value); clearMessages(); }} disabled={creating} />
          </div>
        </div>
      </div>

      {groupType === "Automatic" && (
        <div className="section" style={{ overflow: 'visible' }}>
          <div className="section-head"><span className="title">2. Define Property Criteria</span></div>
          
          <div className="flex-row" style={{ alignItems: 'flex-end', padding: 20, gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <FancySelect label="Property" options={properties} value={selectedProperty} onChange={setSelectedProperty} placeholder="— Select Property —" isLoading={loadingProps} />
            </div>
            <div style={{ flex: 0.7, minWidth: 140 }}>
              <FancySelect label="Comparison" options={operators} value={selectedOperator} onChange={setSelectedOperator} placeholder="Contains" />
            </div>
            <div className="field" style={{ flex: 1.5, minWidth: 200 }}>
              <span className="label">Search Text</span>
              <input type="text" className="control" placeholder="e.g., rhel" value={valueInput} onChange={(e) => setValueInput(e.target.value)} />
            </div>
            <div style={{ paddingBottom: 0 }}>
              <button className="btn pri" onClick={addCondition} style={{ height: 44, padding: '0 24px' }}>Add</button>
            </div>
          </div>
          
          <div className="flex-row" style={{ padding: '0 20px 20px' }}>
             <div style={{ flex: 1 }}>
                <FancySelect label="Target Site (Custom)" options={customSites} value={selectedTargetSite} onChange={setSelectedTargetSite} placeholder="— Select Target Site —" isLoading={loadingSites} />
             </div>
          </div>

          {conditions.length > 0 && (
            <div className="tableWrap" style={{ borderTop: '1px solid var(--border)' }}>
              <table>
                <thead><tr><th>Property</th><th>Comparison</th><th>Value</th><th>Target Site</th><th style={{textAlign:'right'}}>Action</th></tr></thead>
                <tbody>
                  {conditions.map(c => (
                    <tr key={c.id}>
                      <td><b>{c.property}</b></td>
                      <td><span className="rowchip succ">{c.operator}</span></td>
                      <td>{c.value}</td>
                      <td className="muted-text">{selectedTargetSite || "—"}</td>
                      <td style={{textAlign:'right'}}><button className="btn-icon-sm" onClick={() => removeCondition(c.id)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {groupType === "Manual" && (
        <div className="section" style={{ overflow: 'visible' }}>
          <div className="section-head"><span className="title">2. Select Computers</span></div>
          
          <div className="flex-row" style={{ alignItems: 'flex-end', padding: "20px 20px 10px 20px", gap: 16 }}>
            {/* Search Input */}
            <div className="field" style={{ flex: 1.5 }}>
               <span className="label">Search Computers</span>
               <input 
                 type="text" 
                 className="control" 
                 placeholder="Search by Name or IP..." 
                 value={compSearch} 
                 onChange={e => {
                   setCompSearch(e.target.value);
                   setCompPage(1);
                   setAllComputers([]); 
                 }}
               />
            </div>
            {/* OS Filter */}
            <div style={{ flex: 1 }}>
              <FancySelect label="Filter Loaded OS" options={osList} value={selectedOSs} onChange={setSelectedOSs} placeholder="— Show All —" multiSelect={true} />
            </div>
          </div>
          
          <div style={{ padding: "0 20px 10px", display:"flex", justifyContent:"space-between" }}>
              <span className="sub" style={{fontSize:12}}>Loaded: {allComputers.length} {hasMoreComp ? "(Scroll for more)" : "(All loaded)"}</span>
              <span className="pill green">Selected: {selectedCompIds.size}</span>
          </div>

          <div className="tableWrap" style={{ maxHeight: '400px', borderTop: '1px solid var(--border)', overflowY:'auto' }}>
            <table style={{width: '100%'}}>
                <thead>
                  <tr>
                    <th style={{width: 40, textAlign:'center'}}>
                      <input type="checkbox" className="custom-checkbox" onChange={toggleAllVisible} checked={visibleComputers.length > 0 && visibleComputers.every(c => selectedCompIds.has(c.id))} />
                    </th>
                    <th>Computer Name</th>
                    <th>Operating System</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleComputers.map((c, index) => {
                    const isLast = index === visibleComputers.length - 1;
                    return (
                      <tr 
                        key={c.id} 
                        ref={isLast ? lastCompRef : null}
                        onClick={() => toggleComputer(c.id)} 
                        className={selectedCompIds.has(c.id) ? "selected-row" : ""}
                      >
                        <td style={{textAlign:'center'}}>
                          <input type="checkbox" className="custom-checkbox" checked={selectedCompIds.has(c.id)} readOnly />
                        </td>
                        <td>{c.name}</td>
                        <td>{c.os}</td>
                        <td className="muted-text">{c.ips?.[0] || "-"}</td>
                      </tr>
                    );
                  })}
                  
                  {fetchingComp && (
                    <tr><td colSpan={4} style={{textAlign:'center', padding:15, color:'var(--muted)'}}>Loading more...</td></tr>
                  )}
                  
                  {!fetchingComp && visibleComputers.length === 0 && (
                     <tr><td colSpan={4} style={{textAlign:'center', padding: 30, color:'var(--muted)'}}>No computers found.</td></tr>
                  )}
                </tbody>
              </table>
          </div>
        </div>
      )}

      <div style={{ padding: "0 20px 10px 20px" }}>
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

      <div className="action-bar">
        <div className="spacer"></div>
        <button 
          className="btn pri" onClick={handleCreate} 
          disabled={creating || !groupName || (groupType==='Automatic' && !conditions.length) || (groupType==='Manual' && !selectedCompIds.size)}
          style={{ height: '44px', minWidth: '160px' }}
        >
          {creating ? "Creating..." : "Create Group"}
        </button>
      </div>

      <style>{`
        .mgmt { padding: 20px; height: 100%; overflow-y: auto; }
        .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
        .section { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 20px; overflow: hidden; }
        .section-head { padding: 12px 16px; background: var(--panel-2); border-bottom: 1px solid var(--border); font-weight: 700; display: flex; align-items: center; }
        .controls-grid { padding: 20px; display: grid; gap: 20px; }
        .flex-row { display: flex; }
        .field { display: flex; flex-direction: column; gap: 8px; width: 100%; }
        .label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
        input.control { height: 44px; width: 100%; border: 1px solid var(--border); border-radius: 12px; background: var(--panel); color: var(--text); padding: 0 12px; font-size: 14px; outline: none; }
        input.control:focus { border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 20%, transparent); }
        .toggle-bg { background: var(--panel-2); border: 1px solid var(--border); border-radius: 12px; padding: 4px; display: flex; gap: 4px; width: fit-content; }
        .toggle-btn { padding: 8px 24px; border: none; background: transparent; color: var(--muted); font-weight: 600; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
        .toggle-btn.active { background: var(--panel); color: var(--primary); box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .action-bar { padding: 12px 20px; border-top: 1px solid var(--border); background: var(--panel-2); display: flex; align-items: center; justify-content: flex-end; }
        .fx-wrap { position: relative; width: 100%; }
        .fx-trigger { height: 44px; width: 100%; border: 1px solid var(--border); border-radius: 12px; background: var(--panel); color: var(--text); font-size: 14px; text-align: left; display: grid; grid-template-columns: 1fr auto; align-items: center; padding: 0 12px; cursor: pointer; outline: none; }
        .fx-menu { position: absolute; left: 0; right: 0; top: 100%; margin-top: 5px; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; max-height: 250px; overflow: hidden; z-index: 9999; box-shadow: var(--shadow); }
        .fx-menu-inner { max-height: 250px; overflow-y: auto; padding: 6px; }
        .fx-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 13px; margin: 1px 0; }
        .fx-item:hover { background: color-mix(in srgb, var(--primary) 14%, transparent); }
        .fx-item.fx-active { background: color-mix(in srgb, var(--primary) 22%, transparent); font-weight: 600; }
        .fx-tick { color: var(--primary); font-weight: 800; font-size: 11px; margin-left: auto; }
        .tableWrap { overflow: auto; }
        tr.selected-row { background: color-mix(in srgb, var(--primary) 8%, transparent); }
        tr:hover { background: var(--panel-2); cursor: pointer; }
        input[type="checkbox"].custom-checkbox { appearance: none; width: 18px; height: 18px; border: 2px solid var(--muted); border-radius: 4px; background: var(--panel); display: inline-grid; place-content: center; cursor: pointer; padding: 0 !important; min-width: 18px !important; }
        input[type="checkbox"].custom-checkbox:checked { background: var(--primary); border-color: var(--primary); }
        input[type="checkbox"].custom-checkbox:checked::before { content: ""; width: 10px; height: 10px; box-shadow: inset 1em 1em white; transform-origin: center; clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%); }
        .banner { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 12px; margin-bottom: 20px; font-size: 14px; font-weight: 600; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .banner-icon { width: 20px; height: 20px; flex-shrink: 0; }
        .banner.success { background: #ecfdf5; border: 1px solid #a7f3d0; color: #064e3b; }
        .banner.error { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
        .btn-icon-sm { background: none; border: none; color: var(--danger); cursor: pointer; font-weight: bold; padding: 4px 8px; border-radius: 4px; }
        .btn-icon-sm:hover { background: color-mix(in srgb, var(--danger) 10%, transparent); }
      `}</style>
    </div>
  );
}