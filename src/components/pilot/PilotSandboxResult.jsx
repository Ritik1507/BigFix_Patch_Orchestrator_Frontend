import { useEffect, useMemo, useState, useRef, useCallback } from "react";

const API_BASE = window.env.VITE_API_BASE;

/* ------------------------------- helpers ------------------------------- */
async function getJson(url, signal) {
  const r = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store", signal });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 400)}`);
  return JSON.parse(t);
}

const fmtTime = (s) => {
  if (!s || s === "N/A") return "—";
  const m = s.match(/\b(\d{2}:\d{2}:\d{2})\b/);
  return m ? m[1] : s;
};

const escapeHtml = (str) =>
  String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/* ---------------------------- Canonical buckets ---------------------------- */
const BUCKETS = [
  "Success", "Pending Restart", "Pending Client Restart", "Pending Message", "Pending Login",
  "Not Relevant", "Running", "Evaluating", "Waiting", "Pending Downloads", "Pending Offer Acceptance",
  "Failed", "Cancelled", "Download Failed", "Locked", "Constrained", "Postponed", "Invalid Signature",
  "Offers Disabled", "Disk Limited", "Disk Free Limited", "Hash Mismatch", "Transcoding", "Error", "Not Reported",
];

const ORDER = [
  "Success", "Running", "Evaluating", "Pending Restart", "Pending Client Restart", "Pending Message",
  "Pending Login", "Waiting", "Pending Downloads", "Pending Offer Acceptance", "Failed", "Cancelled",
  "Download Failed", "Locked", "Constrained", "Postponed", "Invalid Signature", "Offers Disabled",
  "Disk Limited", "Disk Free Limited", "Hash Mismatch", "Transcoding", "Not Relevant", "Error", "Not Reported",
];

const COLOR = {
  Success: "#10b981", Failed: "#ef4444", "Download Failed": "#dc2626", Running: "#2563eb",
  Evaluating: "#06b6d4", Waiting: "#8b5cf6", "Pending Restart": "#f59e0b", "Pending Client Restart": "#f59e0b",
  "Pending Message": "#f59e0b", "Pending Login": "#f59e0b", "Pending Downloads": "#f59e0b",
  "Pending Offer Acceptance": "#f59e0b", Cancelled: "#6b7280", Locked: "#6b7280", Constrained: "#6b7280",
  Postponed: "#6b7280", "Invalid Signature": "#6b7280", "Offers Disabled": "#6b7280", "Disk Limited": "#fb7185",
  "Disk Free Limited": "#f97316", "Hash Mismatch": "#a855f7", Transcoding: "#f97316", "Not Relevant": "#64748b",
  Error: "#b91c1c", "Not Reported": "#94a3b8",
};

const EXTRA = ["#10b981", "#f97316", "#e11d48", "#84cc16", "#14b8a6", "#8b5cf6", "#f43f5e"];
function pickColor(label) {
  if (COLOR[label]) return COLOR[label];
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return EXTRA[h % EXTRA.length];
}

function classify(raw) {
  const s = String(raw || "").trim();
  if (!s) return "Not Reported";
  const L = s.toLowerCase();

  if (/^fixed$/i.test(s) || /^completed$/i.test(s) || /executed successfully/i.test(L)) return "Success";
  if (/^pending restart$/i.test(s) || /waiting for restart/i.test(L)) return "Pending Restart";
  if (/^running$/i.test(s) || /is currently running/i.test(L)) return "Running";
  if (/^failed$/i.test(s) || /\baction failed\b/i.test(L)) return "Failed";
  if (/^not reported$/i.test(s)) return "Not Reported";
  
  if (/success/i.test(L)) return "Success";
  if (/fail|error/i.test(L)) return "Failed";
  if (/wait|pending/i.test(L)) return "Waiting";
  
  return s; 
}

function countsFromRows(rows) {
  const map = new Map();
  for (const r of rows || []) {
    const raw = r?.status ?? r?.Status ?? r?.clientState ?? r?.result;
    const bucket = classify(raw);
    map.set(bucket, (map.get(bucket) || 0) + 1);
  }
  return map;
}

function countsFromObj(obj) {
  const sc = obj?.statusCounts || obj?.StatusCounts;
  if (sc && typeof sc === "object") {
    const m = new Map();
    for (const [raw, v] of Object.entries(sc)) {
      const bucket = classify(raw);
      m.set(bucket, (m.get(bucket) || 0) + Number(v || 0));
    }
    return m;
  }
  return new Map();
}

function arcPath(cx, cy, r, startDeg, endDeg, innerR = 0) {
  const sweep = endDeg - startDeg;
  const toRad = (d) => (d - 90) * (Math.PI / 180);
  if (sweep >= 359.999) return null;
  const large = sweep > 180 ? 1 : 0;
  const sx = cx + r * Math.cos(toRad(startDeg));
  const sy = cy + r * Math.sin(toRad(startDeg));
  const ex = cx + r * Math.cos(toRad(endDeg));
  const ey = cy + r * Math.sin(toRad(endDeg));
  if (!innerR) return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey} Z`;
  const six = cx + innerR * Math.cos(toRad(endDeg));
  const siy = cy + innerR * Math.sin(toRad(endDeg));
  const eix = cx + innerR * Math.cos(toRad(startDeg));
  const eiy = cy + innerR * Math.sin(toRad(startDeg));
  return [`M ${sx} ${sy}`, `A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`, `L ${six} ${siy}`, `A ${innerR} ${innerR} 0 ${large} 0 ${eix} ${eiy}`, "Z"].join(" ");
}
function fullRingPaths(cx, cy, r, innerR) {
  const p1 = arcPath(cx, cy, r, 0, 180, innerR);
  const p2 = arcPath(cx, cy, r, 180, 360, innerR);
  return [p1, p2];
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function rowsToCSV(rows) {
  const header = ["Server Name", "Patch Name", "Start Time", "End Time", "Status", "Issuer"];
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([r.server, r.patch, fmtTime(r.start), fmtTime(r.end), r.status, r.issuer].map(escape).join(","));
  }
  return lines.join("\n");
}

function rowsToHTML(rows, title = "Results") {
  const safeTitle = escapeHtml(title);
  const head = `<meta charset="utf-8"/><title>${safeTitle}</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:16px;color:#111827}h1{font-size:18px;margin:0 0 12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e5e7eb;padding:8px 10px;font-size:14px}thead th{background:#f8fafc;text-align:left}.status-pill { padding: 4px 8px; border-radius: 99px; font-size: 12px; font-weight: 600; display: inline-block; }.status-green { background: #dcfce7; color: #166534; }.status-red { background: #fee2e2; color: #991b1b; }.status-blue { background: #dbeafe; color: #1e40af; }.status-amber { background: #fef3c7; color: #92400e; }</style>`;
  const rowsHtml = (rows || []).map(r => {
    const s = classify(r.status);
    const cls = s === 'Success' ? 'status-green' : (s === 'Failed' || s === 'Error') ? 'status-red' : (s === 'Running') ? 'status-blue' : 'status-amber';
    return `<tr><td>${escapeHtml(r.server ?? "—")}</td><td>${escapeHtml(r.patch ?? "—")}</td><td>${escapeHtml(fmtTime(r.start))}</td><td>${escapeHtml(fmtTime(r.end))}</td><td><span class="status-pill ${cls}">${escapeHtml(s)}</span></td><td>${escapeHtml(r.issuer ?? "—")}</td></tr>`;
  }).join("");
  return `<!doctype html><html><head>${head}</head><body><h1>${safeTitle}</h1><table><thead><tr><th>Server Name</th><th>Patch Name</th><th>Start Time</th><th>End Time</th><th>Status</th><th>Issuer</th></tr></thead><tbody>${rowsHtml || `<tr><td colspan="6">No rows.</td></tr>`}</tbody></table></body></html>`;
}

export default function PilotSandboxResult({ title = "Sandbox Result", detailTitle, actionId }) {
  // Removed explicit EUC return null check so App.jsx can control visibility
  const [lockedId, setLockedId] = useState(null);
  const [summary, setSummary] = useState({ success: 0, total: 0 });
  const [counts, setCounts] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [statusBanner, setStatusBanner] = useState(null);
  const [hoverKey, setHoverKey] = useState(null);
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [rowsLoading, setRowsLoading] = useState(false);
  const refreshAbortRef = useRef(null);

  useEffect(() => {
    if (actionId != null && actionId !== "") setLockedId(String(actionId));
  }, [actionId]);

  const refresh = useCallback(async (abortSignal) => {
    setLoading(true);
    setErr("");
    try {
      let idToUse = lockedId;
      if (!idToUse) {
        const last = await getJson(`${API_BASE}/api/actions/last`, abortSignal);
        idToUse = last?.actionId ? String(last.actionId) : null;
        if (!lockedId) setLockedId(idToUse);
      }
      if (!idToUse) {
        setSummary({ success: 0, total: 0 });
        setCounts(new Map());
        setStatusBanner(null);
        return;
      }
      const res = await getJson(`${API_BASE}/api/actions/${idToUse}/results`, abortSignal);
      const cm = Array.isArray(res?.rows) && res.rows.length ? countsFromRows(res.rows) : countsFromObj(res);
      const totalFromCounts = Array.from(cm.values()).reduce((a, b) => a + b, 0);
      const total = Number(res?.total ?? (Array.isArray(res?.rows) ? res.rows.length : totalFromCounts) ?? 0);
      const success = Number(res?.success ?? res?.Fixed ?? (cm.has("Success") ? cm.get("Success") : 0)) || 0;
      setCounts(cm);
      setSummary({ success, total });
      try {
        const statusRes = await getJson(`${API_BASE}/api/actions/${idToUse}/status`, abortSignal);
        const s = String(statusRes?.state || "").toLowerCase();
        if (s === 'open' || s === 'running') setStatusBanner({ msg: "Action is running", type: 'running' });
        else if (s === 'expired' || s === 'stopped') setStatusBanner({ msg: "Action completed", type: 'completed' });
        else setStatusBanner({ msg: `Status: ${s}`, type: 'info' });
      } catch { setStatusBanner({ msg: "Status Unknown", type: 'info' }); }
    } catch (e) {
      if (e.name !== "AbortError") setErr(e.message);
    } finally {
      if (!abortSignal || !abortSignal.aborted) setLoading(false);
    }
  }, [lockedId]);

  useEffect(() => {
    refreshAbortRef.current?.abort();
    const ab = new AbortController();
    refreshAbortRef.current = ab;
    refresh(ab.signal);
    const interval = setInterval(() => { if (!loading) refresh(ab.signal); }, 300000);
    return () => { ab.abort(); clearInterval(interval); };
  }, [lockedId, refresh]);

  async function openDetails() {
    if (!lockedId) return;
    setOpen(true);
    setRowsLoading(true);
    try {
      const res = await getJson(`${API_BASE}/api/actions/${lockedId}/results`);
      setRows(Array.isArray(res?.rows) ? res.rows : []);
    } catch {
      setRows([]);
    } finally {
      setRowsLoading(false);
    }
  }

  const donut = useMemo(() => {
    const entries = BUCKETS.map((b) => [b, counts.get(b) || 0]).filter(([, v]) => v > 0);
    const ordered = [
      ...entries.filter(([k]) => ORDER.includes(k)).sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0])),
      ...entries.filter(([k]) => !ORDER.includes(k)).sort((a, b) => a[0].localeCompare(b[0])),
    ];
    const total = Math.max(1, ordered.reduce((a, [, v]) => a + v, 0));
    let acc = 0;
    return ordered.map(([key, val]) => {
      const start = (acc / total) * 360;
      const end = ((acc + val) / total) * 360;
      acc += val;
      return { key, start, end, fill: pickColor(key), val, pct: Math.round((val / total) * 100) };
    });
  }, [counts]);

  const center = useMemo(() => {
    if (hoverKey && counts.has(hoverKey)) {
      const total = Math.max(1, summary.total);
      return { pct: Math.round(((counts.get(hoverKey) || 0) / total) * 100), label: hoverKey };
    }
    const pct = summary.total > 0 ? Math.round((summary.success / summary.total) * 100) : 0;
    return { pct, label: "Success" };
  }, [hoverKey, counts, summary]);

  return (
    <>
      <section className="card reveal" data-reveal>
        <div className="row" style={{alignItems:'center'}}>
          <h2>{title}</h2>
          <span className="spacer"></span>
          <button className="btn" onClick={() => refresh(null)} disabled={loading}>{loading ? "..." : "Refresh"}</button>
        </div>
        {err ? <div className="sub error">{err}</div> : !lockedId ? <div className="sub">No data</div> : (
          <>
            <div className="toolbar-mini">
              <span className="pill">{`Success: ${summary.success}/${summary.total}`}</span>
              <span className="count">ID: {lockedId}</span>
              <span className="spacer"></span>
              <a className="link" onClick={openDetails}>View Details</a>
            </div>
            {statusBanner && (<div className={`status-banner ${statusBanner.type}`}>{statusBanner.type === 'running' && <span className="pulse-dot"></span>}{statusBanner.msg}</div>)}
            <div className="donut-wrap">
              <div className="donut-cell">
                <svg viewBox="0 0 120 120" role="img" className="donut-svg">
                  <g transform="translate(60,60)">
                    {donut.map((s, i) => {
                      const mid = (s.start + s.end) / 2;
                      const rad = ((mid - 90) * Math.PI) / 180;
                      const explode = hoverKey === s.key ? 3 : 0;
                      const dx = explode * Math.cos(rad);
                      const dy = explode * Math.sin(rad);
                      const d = arcPath(0, 0, 48, s.start, s.end, 30);
                      const isFull = d === null;
                      if (isFull) { return ( <g key={i} transform={`translate(${dx},${dy})`} style={{ transition: "transform 0.2s" }}> {fullRingPaths(0, 0, 48, 30).map((pd, idx) => ( <path key={idx} d={pd} fill={s.fill} stroke="var(--panel-1)" strokeWidth="0.2" /> ))} </g> ); }
                      return ( <path key={i} d={d} fill={s.fill} stroke="var(--panel-1)" strokeWidth="0.2" transform={`translate(${dx},${dy})`} onMouseEnter={() => setHoverKey(s.key)} onMouseLeave={() => setHoverKey(null)} style={{ transition: "transform 0.2s, filter 0.2s", filter: hoverKey === s.key ? "brightness(1.06)" : "none", cursor: "pointer" }} /> );
                    })}
                    <text x="0" y="-4" textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--text)">{center.pct}%</text>
                    <text x="0" y="10" textAnchor="middle" fontSize="7" fill="var(--muted)">{center.label}</text>
                  </g>
                </svg>
              </div>
              <div className="legend-cell" onMouseLeave={() => setHoverKey(null)}>
                {donut.map(l => ( <div key={l.key} className="legend-row" onMouseEnter={() => setHoverKey(l.key)}> <span className="legend-dot" style={{ background: l.fill }} /> <span className="legend-label">{l.key} ({l.val})</span> </div> ))}
                {donut.length === 0 && <div className="legend-row"><span className="legend-label">No Data</span></div>}
              </div>
            </div>
          </>
        )}
      </section>
      {open && <DetailsModal open={open} onClose={() => setOpen(false)} title={detailTitle || `${title} Details`} rows={rows} loading={rowsLoading} />}
      <style>{`
        .donut-wrap { display: grid; grid-template-columns: 220px 1fr; padding-top: 20px; align-items: center; width: 100%; margin-top: 10px; }
        .donut-cell { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; }
        .donut-svg { width: 160px; height: 160px; display: block; }
        .legend-cell { display: flex; flex-direction: column; gap: 8px; min-width: 140px; }
        .legend-row { display: flex; align-items: center; gap: 10px; font-size: 13px; cursor: pointer; transition: opacity 0.2s; }
        .legend-dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; flex-shrink: 0; }
        .legend-label { color: var(--text); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .status-banner { margin: 10px 0; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
        .status-banner.running { background: rgba(37,99,235,0.1); color: var(--primary); }
        .status-banner.completed { background: rgba(16,185,129,0.1); color: var(--success); }
        .pulse-dot { width: 6px; height: 6px; background: currentColor; border-radius: 50%; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% {opacity:0.5; transform:scale(0.8)} 50% {opacity:1; transform:scale(1.2)} 100% {opacity:0.5; transform:scale(0.8)} }
        @media (max-width: 900px) { .donut-wrap { grid-template-columns: 1fr; justify-items: center; gap: 20px; } }
        .dropdown { position: relative; display: inline-block; }
        .dropdown .menu { position: absolute; top: 110%; right: 0; min-width: 160px; background: var(--panel); border: 1px solid var(--border); box-shadow: 0 8px 24px rgba(0,0,0,.15); border-radius: 10px; padding: 6px; z-index: 50; }
        .dropdown .item { display: block; width: 100%; text-align: left; background: transparent; border: 0; padding: 8px 10px; border-radius: 8px; color: var(--text); font-weight: 600; cursor: pointer; }
        .dropdown .item:hover { background: var(--panel-2); }
      `}</style>
    </>
  );
}

function DetailsModal({ open, onClose, title, rows, loading }) {
  const [filter, setFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "status", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showMenu, setShowMenu] = useState(false);
  const btnRef = useRef(null);

  useEffect(() => setPage(1), [filter, pageSize]);
  useEffect(() => {
    function onDocClick(e) { if (!showMenu) return; if (btnRef.current && !btnRef.current.contains(e.target)) setShowMenu(false); }
    document.addEventListener("mousedown", onDocClick); return () => document.removeEventListener("mousedown", onDocClick);
  }, [showMenu]);

  const filtered = useMemo(() => { if (!filter) return rows; const q = filter.toLowerCase(); return rows.filter(r => (r.server && r.server.toLowerCase().includes(q)) || (r.patch && r.patch.toLowerCase().includes(q)) || (r.status && r.status.toLowerCase().includes(q))); }, [rows, filter]);
  const sorted = useMemo(() => { if (!sortConfig.key) return filtered; return [...filtered].sort((a, b) => { const valA = sortConfig.key === 'status' ? classify(a.status).toLowerCase() : String(a[sortConfig.key] || "").toLowerCase(); const valB = sortConfig.key === 'status' ? classify(b.status).toLowerCase() : String(b[sortConfig.key] || "").toLowerCase(); if (valA < valB) return sortConfig.dir === "asc" ? -1 : 1; if (valA > valB) return sortConfig.dir === "asc" ? 1 : -1; return 0; }); }, [filtered, sortConfig]);
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = useMemo(() => { const start = (page - 1) * pageSize; return sorted.slice(start, start + pageSize); }, [sorted, page, pageSize]);
  const handleSort = (key) => { setSortConfig(current => ({ key, dir: current.key === key && current.dir === "asc" ? "desc" : "asc" })); };
  const getSortIcon = (key) => { if (sortConfig.key !== key) return <span style={{opacity:0.3, marginLeft: 4}}>↕</span>; return <span style={{marginLeft: 4}}>{sortConfig.dir === "asc" ? "↑" : "↓"}</span>; };
  const doExport = (type) => { setShowMenu(false); const safeTitle = (title || "Report").replace(/[^\w.-]+/g, "_"); if (type === 'csv') { const csv = rowsToCSV(sorted); downloadBlob(new Blob([csv], { type: "text/csv" }), `${safeTitle}.csv`); } else if (type === 'html') { const html = rowsToHTML(sorted, title); downloadBlob(new Blob([html], { type: "text/html" }), `${safeTitle}.html`); } else if (type === 'pdf') { const html = rowsToHTML(sorted, title); const blob = new Blob([html], { type: "text/html" }); const url = URL.createObjectURL(blob); const iframe = document.createElement("iframe"); iframe.style.position = "fixed"; iframe.style.right = "0"; iframe.style.bottom = "0"; iframe.style.width = "0"; iframe.style.height = "0"; iframe.style.border = "0"; iframe.src = url; iframe.onload = () => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {} setTimeout(() => { URL.revokeObjectURL(url); iframe.remove(); }, 2000); }; document.body.appendChild(iframe); } };

  if (!open) return null;
  return (
    <div className="modal show" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="box" style={{ maxWidth: '960px', width: '95%', height: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><h3>{title}</h3><button className="btn" onClick={onClose}>Close</button></div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <input type="text" className="control" placeholder="Search Server, Patch, or Status..." value={filter} onChange={e => setFilter(e.target.value)} style={{ flex: 1, minWidth: '240px' }} />
          <div className="dropdown" ref={btnRef}><button className="btn" onClick={() => setShowMenu(s => !s)}>Export<svg width="14" height="14" viewBox="0 0 24 24" style={{ marginLeft: 6 }}><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" /></svg></button>{showMenu && (<div className="menu"><button className="item" onClick={() => doExport('csv')}>Export to CSV</button><button className="item" onClick={() => doExport('pdf')}>Export to PDF</button><button className="item" onClick={() => doExport('html')}>Export to HTML</button></div>)}</div>
        </div>
        <div className="tableWrap" style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {loading ? (<div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading records...</div>) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--panel-2)' }}>
                <tr><th onClick={() => handleSort('server')} style={{ cursor: 'pointer', width: '20%' }}>Server {getSortIcon('server')}</th><th onClick={() => handleSort('patch')} style={{ cursor: 'pointer', width: '30%' }}>Patch {getSortIcon('patch')}</th><th onClick={() => handleSort('start')} style={{ cursor: 'pointer', width: '10%' }}>Start {getSortIcon('start')}</th><th onClick={() => handleSort('end')} style={{ cursor: 'pointer', width: '10%' }}>End {getSortIcon('end')}</th><th onClick={() => handleSort('status')} style={{ cursor: 'pointer', width: '15%' }}>Status {getSortIcon('status')}</th><th style={{ width: '15%' }}>Issuer</th></tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (<tr><td colSpan={6} style={{ padding: 20, textAlign: 'center' }}>No results found.</td></tr>) : (paginated.map((r, i) => { const shortStatus = classify(r.status); const isSuccess = shortStatus === 'Success'; const isFail = shortStatus === 'Failed' || shortStatus === 'Download Failed' || shortStatus === 'Error'; const isRunning = shortStatus === 'Running'; return (<tr key={i} style={{ borderBottom: '1px solid var(--border)' }}><td>{r.server}</td><td>{r.patch}</td><td style={{ whiteSpace: 'nowrap' }}>{fmtTime(r.start)}</td><td style={{ whiteSpace: 'nowrap' }}>{fmtTime(r.end)}</td><td><span className={`pill ${isSuccess ? 'green' : isFail ? 'red' : isRunning ? 'primary' : 'amber'}`} style={{ fontSize: '11px', display: 'inline-block', maxWidth: '100%' }} title={r.status}>{shortStatus}</span></td><td>{r.issuer}</td></tr>); }))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: '13px' }}>
          <div style={{ color: 'var(--muted)' }}>Showing {sorted.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, sorted.length)} of {sorted.length} entries</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="control" style={{ height: '32px', padding: '0 8px', width: 'auto', minWidth: 'auto' }}><option value={10}>10 / page</option><option value={25}>25 / page</option><option value={50}>50 / page</option><option value={100}>100 / page</option></select><button className="btn" disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{height: '32px', padding: '0 10px'}}>Prev</button><span style={{ fontWeight: 600 }}>Page {page} of {totalPages || 1}</span><button className="btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{height: '32px', padding: '0 10px'}}>Next</button></div>
        </div>
      </div>
    </div>
  );
}