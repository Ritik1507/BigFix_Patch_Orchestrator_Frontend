// vite-project/src/components/SnapshotSelector.jsx
import { useState, useEffect, useRef, useCallback } from "react";
const API = window.env?.VITE_API_BASE || "http://localhost:5174";

// --- HELPERS ---
function getHeaders() {
  return {
    "Content-Type": "application/json",
    "x-user-role": sessionStorage.getItem("user_role") || "Admin",
  };
}
async function getJSON(url) {
  const r = await fetch(`${API}${url}`, { headers: getHeaders() });
  return r.json();
}
async function postJSON(url, body) {
  const r = await fetch(`${API}${url}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  return r.json();
}

// --- FANCY DROPDOWN ---
const FancyDropdown = ({ options, value, onChange, placeholder, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label || placeholder;

  return (
    <div className="field" ref={ref}>
      <label className="label">Select Group</label>
      <div className={`fx-wrap ${open ? "fx-open" : ""}`}>
        <button
          type="button"
          className="fx-trigger"
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
        >
          <span className="fx-value">{selectedLabel}</span>
          <span className="fx-chevron">▾</span>
        </button>
        {open && (
          <div className="fx-menu">
            {options.length === 0 ? (
              <div className="fx-item empty">No Groups Found</div>
            ) : (
              options.map((opt) => (
                <div
                  key={opt.value}
                  className={`fx-item ${value === opt.value ? "active" : ""}`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default function SnapshotManager({
  onClose,
  groupName: initialGroup,
  onComplete,
  environment 
}) {
  const [activeTab, setActiveTab] = useState("TARGETS");
  const [mode, setMode] = useState(initialGroup ? "GROUP" : "COMPUTER");

  // --- Pagination State ---
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  
  // Data State
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set()); 
  
  // UI State
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  // Snapshot Config
  const [snapName, setSnapName] = useState(`Patching_${new Date().toISOString().slice(0, 10)}`);
  const [description, setDescription] = useState("Automated Patching Snapshot");
  const [includeMemory, setIncludeMemory] = useState(false);
  const [quiesce, setQuiesce] = useState(false);

  // Execution History
  const [executions, setExecutions] = useState([]); 

  // Observer for Infinite Scroll
  const observer = useRef();
  const lastElementRef = useCallback(node => {
    if (isFetching) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [isFetching, hasMore]);


  // 1. Init Groups & Environment
  useEffect(() => {
    async function init() {
      try {
        const envRes = await getJSON("/api/env");
        if (envRes.values?.SNAPSHOT_DEFAULT_NAME)
          setSnapName(envRes.values.SNAPSHOT_DEFAULT_NAME.replace("{Date}", new Date().toISOString().slice(0, 10)));

        const gRes = await getJSON("/api/groups/list");
        if (gRes.ok) {
          setGroups(gRes.groups.map((g) => ({ value: g.id, label: g.name })));
          if (initialGroup) {
            const found = gRes.groups.find((g) => g.name === initialGroup);
            if (found) setSelectedGroupId(found.id);
          }
        }
      } catch (e) { console.error(e); }
    }
    init();
  }, [initialGroup]);

  // 2. Fetch Computers (Paginated & Lazy)
  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    setSelectedIds(new Set());
  }, [mode, selectedGroupId, search]);

  useEffect(() => {
    if (mode === "GROUP" && !selectedGroupId) return;

    const fetchData = async () => {
      setIsFetching(true);
      setError("");
      try {
        let newItems = [];
        
        if (mode === "GROUP") {
          if (page === 1) { 
              const g = groups.find((x) => x.value === selectedGroupId);
              if (g) {
                  const res = await getJSON(`/api/groups/${encodeURIComponent(g.label)}/members`);
                  newItems = res.members || [];
                  setHasMore(false); 
              }
          }
        } else {
          const res = await getJSON(`/api/groups/metadata/computers?page=${page}&limit=20&search=${encodeURIComponent(search)}`);
          if (res.ok) {
            newItems = res.computers.map(c => ({
              ...c,
              vcId: null,      
              vcStatus: 'pending' 
            }));
            setHasMore(page < res.totalPages);
          }
        }

        if (newItems.length > 0) {
           setItems(prev => {
             const existIds = new Set(prev.map(i => i.name));
             const unique = newItems.filter(i => !existIds.has(i.name));
             return [...prev, ...unique];
           });
           resolveBatch(newItems);
        }

      } catch (e) {
        setError(e.message);
      } finally {
        setIsFetching(false);
      }
    };

    fetchData();
  }, [page, mode, selectedGroupId, search]);

  // 3. Lazy Resolve Helper
  const resolveBatch = async (batchItems) => {
      const targets = batchItems.map(m => ({
          name: m.name,
          ips: (m.ips || []).map(ip => String(ip).trim())
      }));
      if (targets.length === 0) return;

      setItems(prev => prev.map(i => {
          if (batchItems.some(b => b.name === i.name)) return { ...i, vcStatus: 'resolving' };
          return i;
      }));

      try {
          const look = await postJSON("/api/vcenter/lookup", { targets });
          const resultMap = new Map();
          (look.matches || []).forEach(m => {
             if (m.name && m.id) resultMap.set(m.name, m.id);
          });

          setItems(prev => prev.map(i => {
             if (batchItems.some(b => b.name === i.name)) {
                 const vcId = resultMap.get(i.name);
                 return { ...i, vcId: vcId || null, vcStatus: vcId ? 'ready' : 'not_found' };
             }
             return i;
          }));
      } catch (e) {}
  };

  const toggleRow = (vcId) => {
    if (!vcId || processing) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(vcId)) next.delete(vcId);
      else next.add(vcId);
      return next;
    });
  };

  const toggleAllLoaded = () => {
    if (processing) return;
    const validIds = items.filter((i) => i.vcId).map((i) => i.vcId);
    if (validIds.length === 0) return;
    const allLoadedSelected = validIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
        const next = new Set(prev);
        validIds.forEach(id => allLoadedSelected ? next.delete(id) : next.add(id));
        return next;
    });
  };

  const handleExecute = async () => {
    if (selectedIds.size === 0) return;
    setProcessing(true);
    setError("");
    setActiveTab("EXECUTION");

    const vmNames = {};
    items.forEach(i => { if (i.vcId) vmNames[i.vcId] = i.name; });

    try {
      const res = await postJSON("/api/vcenter/snapshot", {
        vmIds: Array.from(selectedIds),
        snapshotName: snapName,
        description,
        includeMemory,
        quiesce,
        vmNames
      });

      if (!res.ok) throw new Error(res.error);
      
      await refreshHistory(); // Initial fetch
      
      const successCount = res.results?.filter((r) => r.ok).length || 0;
      setProcessing(false);
      
      if (onComplete) onComplete({ successCount });
    } catch (e) {
      setError(e.message);
      setProcessing(false);
      setActiveTab("SETTINGS");
    }
  };

  // --- AUTO POLLING LOGIC (FIXED) ---
  const refreshHistory = async () => {
    const res = await getJSON("/api/vcenter/history");
    if (res.ok && Array.isArray(res.history)) {
        // Filter specifically for Snapshots to avoid clutter from Clones
        const mapped = res.history.filter(h => h.Type === 'Snapshot').map(h => ({
            id: h.VmId,
            name: h.VmName,
            snapName: h.SnapshotName,
            taskId: h.TaskId,
            status: h.Status,
            error: h.Error,
            createdAt: new Date(h.CreatedAt).toLocaleString()
        }));
        setExecutions(mapped);
        return mapped;
    }
    return [];
  };

  useEffect(() => {
    if (activeTab !== "EXECUTION") return;

    const checkStatus = async () => {
        // 1. Get current list from DB
        const currentList = await refreshHistory();
        
        // 2. Find tasks that are 'queued' or 'running' and have a valid Task ID
        const activeTasks = currentList.filter(x => 
            (x.status === 'queued' || x.status === 'running') && x.taskId
        ).map(x => x.taskId);

        // 3. If any are active, ask backend to update them from vCenter
        if (activeTasks.length > 0) {
            await postJSON("/api/vcenter/tasks", { taskIds: activeTasks });
            // 4. Fetch updated DB state to update UI
            await refreshHistory();
        }
    };

    checkStatus(); // Immediate check
    const interval = setInterval(checkStatus, 5000); // Poll every 5s

    return () => clearInterval(interval);
  }, [activeTab]);

  const renderExecStatus = (s) => {
      const st = String(s || "").toLowerCase();
      if (st === 'completed' || st === 'success') return <span className="pill green">Success</span>;
      if (st === 'running') return <span className="pill blue">Running...</span>;
      if (st === 'queued') return <span className="pill gray">Queued...</span>;
      if (st === 'failed' || st === 'error') return <span className="pill red">Failed</span>;
      return <span className="pill gray">{st}</span>;
  };

  const renderVcStatus = (status, vcId) => {
      if (status === 'ready') return <span className="pill green">Ready ({vcId})</span>;
      if (status === 'not_found') return <span className="pill red">Not Found</span>;
      if (status === 'resolving') return <span className="pill blue">Resolving...</span>;
      return <span className="pill gray">Waiting...</span>;
  };

  return (
    <div className="mgmt">
      <div className="topbar">
        <div style={{display:'flex', gap: 10, alignItems:'center'}}>
           <h2>Take Snapshot</h2>
           {environment && <span className="pill gray">{environment.toUpperCase()}</span>}
        </div>
        <button className="btn" onClick={onClose}>Close</button>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === "TARGETS" ? "active" : ""}`} onClick={() => setActiveTab("TARGETS")}>1. Targets</button>
        <button className={`tab ${activeTab === "SETTINGS" ? "active" : ""}`} onClick={() => setActiveTab("SETTINGS")}>2. Settings</button>
        <button className={`tab ${activeTab === "EXECUTION" ? "active" : ""}`} onClick={() => setActiveTab("EXECUTION")}>3. Execution</button>
      </div>

      {activeTab === "TARGETS" && (
        <>
          <div className="tabs sub">
            <button className={`tab small ${mode === "GROUP" ? "active" : ""}`} onClick={() => setMode("GROUP")} disabled={processing}>By Groups</button>
            <button className={`tab small ${mode === "COMPUTER" ? "active" : ""}`} onClick={() => setMode("COMPUTER")} disabled={processing}>By Computers</button>
          </div>

          <div className="section">
            <div className="controls-grid">
              {mode === "GROUP" ? (
                <FancyDropdown
                  options={groups}
                  value={selectedGroupId}
                  onChange={setSelectedGroupId}
                  placeholder="-- Select Group --"
                  disabled={processing}
                />
              ) : (
                <div className="field full">
                   <input className="control" placeholder="Search Servers..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              )}
            </div>
          </div>

          <div className="section">
            <div className="section-head">
              <span className="title">Select VMs</span>
              <span className="pill green">Selected: {selectedIds.size}</span>
            </div>
            <div className="tableWrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: "center" }}>
                      <input type="checkbox" className="custom-checkbox" onChange={toggleAllLoaded} disabled={items.length === 0 || processing} />
                    </th>
                    <th>Hostname</th>
                    <th>IP Address</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, i) => {
                      const isLast = items.length === i + 1;
                      const isReady = row.vcStatus === 'ready';
                      return (
                          <tr key={i} ref={isLast ? lastElementRef : null} className={!isReady ? "disabled" : selectedIds.has(row.vcId) ? "selected" : ""} onClick={() => toggleRow(row.vcId)}>
                            <td style={{ textAlign: "center" }}>
                              <input type="checkbox" className="custom-checkbox" checked={selectedIds.has(row.vcId)} disabled={!isReady || processing} readOnly />
                            </td>
                            <td>{row.name}</td>
                            <td>{row.ips?.join(", ") || "-"}</td>
                            <td>{renderVcStatus(row.vcStatus, row.vcId)}</td>
                          </tr>
                      );
                  })}
                  {isFetching && <tr><td colSpan={4} style={{textAlign:'center', padding: 10}}>Loading...</td></tr>}
                  {!isFetching && items.length === 0 && <tr><td colSpan={4} style={{textAlign:'center', padding: 20}}>No computers found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="action-bar">
             <button className="btn pri" onClick={() => setActiveTab("SETTINGS")} disabled={selectedIds.size === 0}>Next: Settings</button>
          </div>
        </>
      )}

      {activeTab === "SETTINGS" && (
        <>
          <div className="section">
            <div className="section-head"><span className="title">Snapshot Configuration</span></div>
            <div className="controls-grid">
              <div className="field">
                <label className="label">Snapshot Name</label>
                <input className="control" value={snapName} onChange={(e) => setSnapName(e.target.value)} disabled={processing} />
              </div>
              <div className="field">
                <label className="label">Description</label>
                <input className="control" value={description} onChange={(e) => setDescription(e.target.value)} disabled={processing} />
              </div>
              <div className="field full" style={{ display: "flex", gap: 20, marginTop: 10 }}>
                <label className="checkbox-label">
                  <input type="checkbox" className="custom-checkbox" checked={includeMemory} onChange={(e) => setIncludeMemory(e.target.checked)} disabled={processing} />
                  Include Memory
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" className="custom-checkbox" checked={quiesce} onChange={(e) => setQuiesce(e.target.checked)} disabled={processing} />
                  Quiesce Filesystem
                </label>
              </div>
            </div>
          </div>
          {error && <div className="banner error">{error}</div>}
          <div className="action-bar" style={{ display: 'flex', justifyContent: 'space-between' }}>
             <button className="btn" onClick={() => setActiveTab("TARGETS")} disabled={processing}>Back</button>
             <button className="btn pri" onClick={handleExecute} disabled={processing || selectedIds.size === 0}>{processing ? "Starting..." : "Take Snapshot"}</button>
          </div>
        </>
      )}

      {activeTab === "EXECUTION" && (
        <div className="section">
          <div className="section-head">
            <span className="title">Execution History (Snapshots)</span>
            <button className="btn small" onClick={refreshHistory} disabled={processing}>Refresh</button>
          </div>
          <div className="tableWrap">
            <table>
              <thead><tr><th>Server Name</th><th>Snapshot Name</th><th>Task ID</th><th>Started</th><th>Status</th></tr></thead>
              <tbody>
                {executions.length === 0 ? (<tr><td colSpan={5} style={{textAlign:'center', padding:20}}>No snapshots found.</td></tr>) : (
                  executions.map((ex, i) => (
                    <tr key={i}>
                      <td>{ex.name}</td><td>{ex.snapName}</td><td>{ex.taskId || "-"}</td><td>{ex.createdAt}</td>
                      <td>{renderExecStatus(ex.status)} {ex.error && <small style={{color:'red', display:'block'}}>{ex.error}</small>}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .mgmt{padding:20px;height:100%;background:#f4f5f7;overflow-y:auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;} 
        .topbar{display:flex;justify-content:space-between;margin-bottom:15px;align-items:center} 
        .tabs{display:flex;gap:10px;margin-bottom:15px;border-bottom:1px solid #ddd;padding-bottom:1px}
        .tabs.sub{margin-bottom:10px; border-bottom: none;}
        .tab{padding:8px 16px;background:none;border:none;border-bottom:3px solid transparent;cursor:pointer;font-weight:600;color:#666;font-size:14px}
        .tab.active{border-bottom-color:#2563eb;}
        .tab.small{font-size:12px; padding: 5px 10px; border: 1px solid #ddd; border-radius: 4px; border-bottom: 1px solid #ddd; }
        .tab.small.active{background: #eff6ff; border-color: #2563eb; color: #2563eb;}
        .section{background:#fff;border-radius:8px;margin-bottom:20px;border:1px solid #e5e7eb;overflow:visible} 
        .section-head{padding:10px 15px;background:#f9fafb;font-weight:bold;display:flex;justify-content:space-between;border-bottom:1px solid #eee;font-size:13px;align-items:center} 
        .controls-grid{padding:20px;display:grid;grid-template-columns:1fr 1fr;gap:20px} 
        .field{display:flex;flex-direction:column;gap:5px} .field.full{grid-column:span 2}
        .label{font-size:11px;font-weight:bold;color:#64748b;text-transform:uppercase} 
        .control{height:40px;padding:0 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px}
        .tableWrap{max-height:350px;overflow:auto} 
        table{width:100%;border-collapse:collapse;font-size:13px} 
        th{background:#f8f9fa;font-weight:600;color:#666;position:sticky;top:0;z-index:10;box-shadow:0 1px 2px rgba(0,0,0,0.05)} 
        td,th{padding:12px 15px;text-align:left;border-bottom:1px solid #eee} 
        tr{transition:background 0.1s}
        tr:hover:not(.disabled){background:#f1f5f9;cursor:pointer}
        tr.selected{background:#eff6ff}
        .disabled{background:#fafafa;color:#999;cursor:default}
        .btn{padding:8px 16px;border-radius:6px;cursor:pointer;border:1px solid #ccc;background:#fff;font-weight:600} 
        .btn.pri{background:#2563eb;color:#fff;border-color:#1d4ed8}
        .btn.pri:disabled{background:#93c5fd;border-color:#93c5fd;cursor:not-allowed}
        .banner.error{padding:12px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:6px;margin-bottom:15px;font-size:14px}
        .pill{padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600; display: inline-block;} 
        .pill.green{background:#dcfce7;color:#166534} 
        .pill.red{background:#fee2e2;color:#991b1b}
        .pill.blue{background:#dbeafe;color:#1e40af}
        .pill.gray{background:#f3f4f6;color:#374151}
        .checkbox-label{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500;cursor:pointer}
        .action-bar{text-align:right}
        input[type="checkbox"].custom-checkbox { appearance: none; width: 18px; height: 18px; border: 2px solid #cbd5e1; border-radius: 4px; background: #fff; display: inline-grid; place-content: center; cursor: pointer; padding: 0 !important; min-width: 18px !important; }
        input[type="checkbox"].custom-checkbox:checked { background: #2563eb; border-color: #2563eb; }
        input[type="checkbox"].custom-checkbox:checked::before { content: ""; width: 10px; height: 10px; box-shadow: inset 1em 1em white; transform-origin: center; clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%); transform: scale(1); }
        .fx-wrap{position:relative} .fx-trigger{width:100%;height:40px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;padding:0 12px;display:flex;align-items:center;justify-content:space-between;cursor:pointer} .fx-menu{position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:6px;margin-top:4px;z-index:100;max-height:200px;overflow-y:auto;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1)} .fx-item{padding:8px 12px;cursor:pointer;font-size:14px} .fx-item:hover{background:#f3f4f6} .fx-item.active{background:#eff6ff;color:#2563eb} .fx-item.empty{color:#9ca3af;padding:12px;text-align:center}
      `}</style>
    </div>
  );
}