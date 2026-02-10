// vite-project/src/components/CloneSelector.jsx
import { useState, useEffect, useRef, useCallback } from "react";

const API = window.env?.VITE_API_BASE || "http://localhost:5174";

function getHeaders() {
  return { "Content-Type": "application/json", "x-user-role": sessionStorage.getItem("user_role") || "Admin" };
}
async function getJSON(url) {
  const r = await fetch(`${API}${url}`, { headers: getHeaders() });
  return r.json();
}
async function postJSON(url, body) {
  const r = await fetch(`${API}${url}`, { method: "POST", headers: getHeaders(), body: JSON.stringify(body) });
  return r.json();
}

const FancySelect = ({ label, options, value, onChange, placeholder, disabled, isLoading }) => {
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
    <div className="field" ref={ref} style={{flex:1, minWidth: 200}}>
      {label && <label className="label">{label}</label>}
      <div className={`fx-wrap ${open ? "fx-open" : ""}`} style={{opacity: disabled ? 0.6 : 1}}>
        <button type="button" className="fx-trigger" onClick={() => !disabled && setOpen(!open)} disabled={disabled || isLoading}>
          <span className="fx-value">{isLoading ? "Loading..." : selectedLabel}</span>
          <span className="fx-chevron">▾</span>
        </button>
        {open && (
          <div className="fx-menu">
            {options.length === 0 ? (
              <div className="fx-item empty">No Options Found</div>
            ) : (
              options.map((opt) => (
                <div key={opt.value} className={`fx-item ${value === opt.value ? "active" : ""}`} onClick={() => { onChange(opt.value); setOpen(false); }}>
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

export default function CloneManager({ onClose, groupName: initialGroup, onComplete, environment }) {
  const [activeTab, setActiveTab] = useState("TARGETS");
  const [mode, setMode] = useState(initialGroup ? "GROUP" : "COMPUTER");
  
  // Data
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set()); 
  
  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const [isFetching, setIsFetching] = useState(false);

  // Settings
  const [inventory, setInventory] = useState({ datacenters: [], hosts: [], datastores: [], folders: [], osSpecs: [] });
  const [invLoading, setInvLoading] = useState(false);
  const [globalDest, setGlobalDest] = useState({ datacenter: "", host: "", datastore: "", folder: "", osSpec: "" });
  const [vmConfigs, setVmConfigs] = useState({});
  const [bulkIp, setBulkIp] = useState("10.1.153.138");
  const [bulkSubnet, setBulkSubnet] = useState("255.255.254.0");
  const [bulkGateway, setBulkGateway] = useState("10.1.152.1");
  const [bulkDns, setBulkDns] = useState("10.1.50.2");

  // Execution
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [executions, setExecutions] = useState([]); 

  const observer = useRef();
  const lastElementRef = useCallback(node => {
    if (isFetching) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) setPage(p => p + 1);
    });
    if (node) observer.current.observe(node);
  }, [isFetching, hasMore]);

  // Init
  useEffect(() => {
    async function init() {
      try {
        const gRes = await getJSON("/api/groups/list");
        if (gRes.ok) {
          setGroups(gRes.groups.map((g) => ({ value: g.id, label: g.name })));
          if (initialGroup) {
            const found = gRes.groups.find((g) => g.name === initialGroup);
            if (found) setSelectedGroupId(found.id);
          }
        }
      } catch (e) {}

      setInvLoading(true);
      try {
        const invRes = await getJSON("/api/vcenter/inventory");
        if (invRes.ok && invRes.inventory) {
           const i = invRes.inventory;
           setInventory({
             datacenters: i.datacenters.map(x => ({ value: x.id, label: x.name })),
             hosts: i.hosts.map(x => ({ value: x.id, label: x.name })),
             datastores: i.datastores.map(x => ({ value: x.id, label: `${x.name} (${x.type})` })),
             folders: i.folders.map(x => ({ value: x.id, label: x.name })),
             osSpecs: i.osSpecs.map(x => ({ value: x.name, label: x.name })),
           });
        }
      } catch (e) { console.error(e); } 
      finally { setInvLoading(false); }
    }
    init();
  }, [initialGroup]);

  // Load Computers
  useEffect(() => {
    setItems([]); setPage(1); setHasMore(true); setSelectedIds(new Set());
  }, [mode, selectedGroupId, search]);

  useEffect(() => {
    if (mode === "GROUP" && !selectedGroupId) return;
    const fetchData = async () => {
      setIsFetching(true); setError("");
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
            newItems = res.computers.map(c => ({ ...c, vcId: null, vcStatus: 'pending' }));
            setHasMore(page < res.totalPages);
          }
        }
        if (newItems.length > 0) {
           setItems(prev => {
             const exist = new Set(prev.map(i => i.name));
             return [...prev, ...newItems.filter(i => !exist.has(i.name))];
           });
           resolveBatch(newItems);
        }
      } catch (e) { setError(e.message); } 
      finally { setIsFetching(false); }
    };
    fetchData();
  }, [page, mode, selectedGroupId, search]);

  const resolveBatch = async (batchItems) => {
      const targets = batchItems.map(m => ({ name: m.name, ips: (m.ips || []).map(ip => String(ip).trim()) }));
      if (!targets.length) return;
      setItems(prev => prev.map(i => batchItems.some(b => b.name === i.name) ? { ...i, vcStatus: 'resolving' } : i));
      try {
          const look = await postJSON("/api/vcenter/lookup", { targets });
          const resultMap = new Map();
          (look.matches || []).forEach(m => { if (m.name && m.id) resultMap.set(m.name, m.id); });
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
    setSelectedIds(prev => { const next = new Set(prev); next.has(vcId) ? next.delete(vcId) : next.add(vcId); return next; });
  };

  const toggleAllLoaded = () => {
    if (processing) return;
    const validIds = items.filter((i) => i.vcId).map((i) => i.vcId);
    if (!validIds.length) return;
    const allSelected = validIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => { const next = new Set(prev); validIds.forEach(id => allSelected ? next.delete(id) : next.add(id)); return next; });
  };

  useEffect(() => {
    if (activeTab === "SETTINGS") {
        setVmConfigs(prev => {
            const next = { ...prev };
            selectedIds.forEach(id => {
                if (!next[id]) {
                    const original = items.find(i => i.vcId === id);
                    next[id] = {
                        cloneName: original ? `${original.name}-clone` : "",
                        newIp: "",
                        subnet: bulkSubnet, 
                        gateway: bulkGateway,
                        dns: bulkDns
                    };
                }
            });
            return next;
        });
    }
  }, [activeTab, selectedIds, items]);

  const applyBulkSettings = () => {
    const incrementIp = (ip, add) => {
        const parts = ip.split('.').map(Number);
        if (parts.length !== 4 || parts.some(isNaN)) return ip;
        let val = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
        val = (val + add) >>> 0;
        return [(val >>> 24) & 255, (val >>> 16) & 255, (val >>> 8) & 255, val & 255].join('.');
    };
    setVmConfigs(prev => {
        const next = { ...prev };
        let index = 0;
        const sortedIds = Array.from(selectedIds); 
        sortedIds.forEach(id => {
            if (next[id]) {
                next[id] = { ...next[id], subnet: bulkSubnet, gateway: bulkGateway, dns: bulkDns, newIp: bulkIp ? incrementIp(bulkIp, index) : next[id].newIp };
                index++;
            }
        });
        return next;
    });
  };

  const updateVmConfig = (id, field, value) => {
    setVmConfigs(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleExecute = async () => {
    if (selectedIds.size === 0) return;
    setProcessing(true); setError(""); setActiveTab("EXECUTION");
    const clonesPayload = [];
    selectedIds.forEach(id => {
        const item = items.find(i => i.vcId === id);
        const conf = vmConfigs[id] || {};
        if (item) clonesPayload.push({ id: item.vcId, name: item.name, cloneName: conf.cloneName, newIp: conf.newIp, subnet: conf.subnet, gateway: conf.gateway, dns: conf.dns });
    });
    try {
      const res = await postJSON("/api/vcenter/clone", { global: globalDest, clones: clonesPayload });
      if (!res.ok) throw new Error(res.error);
      
      await refreshHistory(); // Initial fetch
      
      const successCount = res.results?.filter((r) => r.ok).length || 0;
      setProcessing(false);
      if (onComplete) onComplete({ successCount });
    } catch (e) { setError(e.message); setProcessing(false); setActiveTab("SETTINGS"); }
  };

  // --- POLLING LOGIC (FIXED) ---
  const refreshHistory = async () => {
    const res = await getJSON("/api/vcenter/history");
    if (res.ok && Array.isArray(res.history)) {
        // Explicitly filter for Clones to avoid mixing with Snapshots
        const mapped = res.history.filter(h => h.Type === 'Clone').map(h => ({
            id: h.VmId, 
            taskId: h.TaskId,
            name: h.VmName, 
            backupName: h.SnapshotName, 
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
        // 1. Get current list
        const currentList = await refreshHistory();
        
        // 2. Find tasks that are 'queued' or 'running'
        const activeTasks = currentList.filter(x => 
            (x.status === 'queued' || x.status === 'running') && x.taskId
        ).map(x => x.taskId);

        // 3. Ask backend to check status
        if (activeTasks.length > 0) {
            await postJSON("/api/vcenter/tasks", { taskIds: activeTasks });
            // 4. Update UI
            await refreshHistory();
        }
    };

    checkStatus(); // Initial check
    const interval = setInterval(checkStatus, 5000); // Poll every 5s

    return () => clearInterval(interval);
  }, [activeTab]);

  const renderExecStatus = (s) => {
      const st = String(s).toLowerCase();
      if (st === 'completed' || st === 'success') return <span className="pill green">Success</span>;
      if (st === 'running') return <span className="pill blue">Running...</span>;
      if (st === 'queued') return <span className="pill gray">Queued...</span>;
      return <span className="pill red">Failed</span>;
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
           <h2>Clone Manager</h2>
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
            <button className={`tab small ${mode === "GROUP" ? "active" : ""}`} onClick={() => setMode("GROUP")} disabled={processing}>By Group</button>
            <button className={`tab small ${mode === "COMPUTER" ? "active" : ""}`} onClick={() => setMode("COMPUTER")} disabled={processing}>All Servers</button>
          </div>
          <div className="section" style={{overflow:'visible'}}>
            <div className="controls-grid">
              {mode === "GROUP" ? (
                <FancySelect label="Select Group" options={groups} value={selectedGroupId} onChange={setSelectedGroupId} placeholder="-- Select Group --" disabled={processing} />
              ) : (
                <div className="field full"><label className="label">Search</label><input className="control" value={search} onChange={e => setSearch(e.target.value)} /></div>
              )}
            </div>
          </div>
          <div className="section">
            <div className="section-head"><span className="title">Select VMs</span> <span className="pill green">Selected: {selectedIds.size}</span></div>
            <div className="tableWrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table>
                <thead><tr><th style={{width:40, textAlign:'center'}}><input type="checkbox" className="custom-checkbox" onChange={toggleAllLoaded} disabled={!items.length}/></th><th>Hostname</th><th>IP</th><th>Status</th></tr></thead>
                <tbody>
                  {items.map((row, i) => (
                    <tr key={i} ref={items.length === i+1 ? lastElementRef : null} onClick={() => toggleRow(row.vcId)} className={selectedIds.has(row.vcId) ? "selected" : row.vcStatus !== 'ready' ? 'disabled' : ''}>
                      <td style={{textAlign:'center'}}><input type="checkbox" className="custom-checkbox" checked={selectedIds.has(row.vcId)} readOnly /></td>
                      <td>{row.name}</td><td>{row.ips?.join(", ")}</td><td>{renderVcStatus(row.vcStatus, row.vcId)}</td>
                    </tr>
                  ))}
                  {isFetching && <tr><td colSpan={4} style={{textAlign:'center', padding:10}}>Loading...</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="action-bar"><button className="btn pri" onClick={() => setActiveTab("SETTINGS")} disabled={!selectedIds.size}>Next</button></div>
        </>
      )}

      {activeTab === "SETTINGS" && (
        <>
          <div className="section" style={{overflow:'visible'}}>
            <div className="section-head"><span className="title">1. Destination (Global)</span></div>
            <div className="controls-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 15, padding: 15}}>
               <FancySelect label="Datacenter" options={inventory.datacenters} value={globalDest.datacenter} onChange={v=>setGlobalDest(p=>({...p,datacenter:v}))} placeholder="Select DC" isLoading={invLoading} />
               <FancySelect label="Cluster/Host" options={inventory.hosts} value={globalDest.host} onChange={v=>setGlobalDest(p=>({...p,host:v}))} placeholder="Select Host" isLoading={invLoading} />
               <FancySelect label="Datastore" options={inventory.datastores} value={globalDest.datastore} onChange={v=>setGlobalDest(p=>({...p,datastore:v}))} placeholder="Select DS" isLoading={invLoading} />
               <FancySelect label="VM Folder" options={inventory.folders} value={globalDest.folder} onChange={v=>setGlobalDest(p=>({...p,folder:v}))} placeholder="Select Folder" isLoading={invLoading} />
               <FancySelect label="OS Spec" options={inventory.osSpecs} value={globalDest.osSpec} onChange={v=>setGlobalDest(p=>({...p,osSpec:v}))} placeholder="Select Spec" isLoading={invLoading} />
            </div>
          </div>
          <div className="section">
            <div className="section-head"><span className="title">2. Network Configuration</span></div>
            <div style={{background: '#f8fafc', padding: '12px 15px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap'}}>
               <div style={{display:'flex', flexDirection:'column', gap:4, flex:1, minWidth:120}}><span className="label">Start IP</span><input className="control small" value={bulkIp} onChange={e=>setBulkIp(e.target.value)} placeholder="10.1.x.x" /></div>
               <div style={{display:'flex', flexDirection:'column', gap:4, flex:1, minWidth:120}}><span className="label">Subnet</span><input className="control small" value={bulkSubnet} onChange={e=>setBulkSubnet(e.target.value)} /></div>
               <div style={{display:'flex', flexDirection:'column', gap:4, flex:1, minWidth:120}}><span className="label">Gateway</span><input className="control small" value={bulkGateway} onChange={e=>setBulkGateway(e.target.value)} /></div>
               <div style={{display:'flex', flexDirection:'column', gap:4, flex:1, minWidth:120}}><span className="label">DNS</span><input className="control small" value={bulkDns} onChange={e=>setBulkDns(e.target.value)} /></div>
               <button className="btn pri small" onClick={applyBulkSettings} style={{height:32, marginBottom:1}}>Apply to All Rows</button>
            </div>
            <div className="tableWrap" style={{maxHeight: 350, overflowY: 'auto'}}>
              <table>
                <thead><tr><th>Original VM</th><th>Clone Name</th><th>New IP</th><th>Subnet</th><th>Gateway</th><th>DNS</th></tr></thead>
                <tbody>
                  {Array.from(selectedIds).map(id => {
                     const item = items.find(i => i.vcId === id);
                     const conf = vmConfigs[id] || {};
                     if (!item) return null;
                     return (
                       <tr key={id} className="input-row">
                         <td style={{verticalAlign:'middle'}}><b>{item.name}</b></td>
                         <td><input className="table-input" value={conf.cloneName} onChange={e=>updateVmConfig(id,'cloneName',e.target.value)} /></td>
                         <td><input className="table-input" value={conf.newIp} onChange={e=>updateVmConfig(id,'newIp',e.target.value)} style={{borderColor: !conf.newIp ? '#fca5a5' : '#ddd'}} /></td>
                         <td><input className="table-input" value={conf.subnet} onChange={e=>updateVmConfig(id,'subnet',e.target.value)} /></td>
                         <td><input className="table-input" value={conf.gateway} onChange={e=>updateVmConfig(id,'gateway',e.target.value)} /></td>
                         <td><input className="table-input" value={conf.dns} onChange={e=>updateVmConfig(id,'dns',e.target.value)} /></td>
                       </tr>
                     );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {error && <div className="banner error">{error}</div>}
          <div className="action-bar" style={{justifyContent: 'space-between'}}><button className="btn" onClick={() => setActiveTab("TARGETS")} disabled={processing}>Back</button><button className="btn pri" onClick={handleExecute} disabled={processing || !globalDest.datacenter}>{processing ? "Cloning..." : `Start Cloning (${selectedIds.size} VMs)`}</button></div>
        </>
      )}

      {activeTab === "EXECUTION" && (
        <div className="section">
          <div className="section-head"><span className="title">Execution History (Clones)</span><button className="btn small" onClick={() => refreshHistory()}>Refresh</button></div>
          <div className="tableWrap">
            <table>
              <thead><tr><th>Original</th><th>Clone Name</th><th>Time</th><th>Status</th></tr></thead>
              <tbody>{executions.map((x,i) => (<tr key={i}><td>{x.name}</td><td>{x.backupName}</td><td>{x.createdAt}</td><td>{renderExecStatus(x.status)}</td></tr>))}</tbody>
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
        .section{background:#fff;border-radius:8px;margin-bottom:20px;border:1px solid #e5e7eb;overflow:hidden} 
        .section-head{padding:10px 15px;background:#f9fafb;font-weight:bold;display:flex;justify-content:space-between;border-bottom:1px solid #eee;font-size:13px;align-items:center} 
        .controls-grid{padding:20px;display:grid;grid-template-columns:1fr 1fr;gap:20px} 
        .field{display:flex;flex-direction:column;gap:5px} .field.full{grid-column:span 2}
        .label{font-size:11px;font-weight:bold;color:#64748b;text-transform:uppercase} 
        .control{height:40px;padding:0 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px}
        .control.small{height:32px;font-size:13px; padding:0 8px;}
        .tableWrap{max-height:350px;overflow:auto} 
        table{width:100%;border-collapse:collapse;font-size:13px} 
        th{background:#f8f9fa;font-weight:600;color:#666;position:sticky;top:0;z-index:10;box-shadow:0 1px 2px rgba(0,0,0,0.05)} 
        td,th{padding:10px 12px;text-align:left;border-bottom:1px solid #eee} 
        tr{transition:background 0.1s}
        tr:hover:not(.disabled){background:#f1f5f9;cursor:pointer}
        tr.selected{background:#eff6ff}
        .disabled{background:#fafafa;color:#999;cursor:default}
        .btn{padding:8px 16px;border-radius:6px;cursor:pointer;border:1px solid #ccc;background:#fff;font-weight:600} 
        .btn.pri{background:#2563eb;color:#fff;border-color:#1d4ed8}
        .btn.pri:disabled{background:#93c5fd;border-color:#93c5fd;cursor:not-allowed}
        .btn.small{padding:4px 10px; font-size:12px;}
        .banner.error{padding:12px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:6px;margin-bottom:15px;font-size:14px}
        .pill{padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600; display: inline-block;} 
        .pill.green{background:#dcfce7;color:#166534} 
        .pill.red{background:#fee2e2;color:#991b1b}
        .pill.blue{background:#dbeafe;color:#1e40af}
        .pill.gray{background:#f3f4f6;color:#374151}
        .action-bar{display:flex; justify-content:flex-end}
        .table-input { width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; }
        .table-input:focus { border-color: #2563eb; outline: none; }
        input[type="checkbox"].custom-checkbox { appearance: none; width: 18px; height: 18px; border: 2px solid #cbd5e1; border-radius: 4px; background: #fff; display: inline-grid; place-content: center; cursor: pointer; padding: 0 !important; min-width: 18px !important; }
        input[type="checkbox"].custom-checkbox:checked { background: #2563eb; border-color: #2563eb; }
        input[type="checkbox"].custom-checkbox:checked::before { content: ""; width: 10px; height: 10px; box-shadow: inset 1em 1em white; transform-origin: center; clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%); transform: scale(1); }
        .fx-wrap{position:relative} .fx-trigger{width:100%;height:40px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;padding:0 12px;display:flex;align-items:center;justify-content:space-between;cursor:pointer} .fx-menu{position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:6px;margin-top:4px;z-index:100;max-height:200px;overflow-y:auto;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1)} .fx-item{padding:8px 12px;cursor:pointer;font-size:14px} .fx-item:hover{background:#f3f4f6} .fx-item.active{background:#eff6ff;color:#2563eb} .fx-item.empty{color:#9ca3af;padding:12px;text-align:center}
      `}</style>
    </div>
  );
}
