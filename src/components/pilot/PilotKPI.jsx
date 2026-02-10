// frontend/src/components/pilot/PilotKPI.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";

const API_BASE = window.env.VITE_API_BASE;

/* ------------------------------- helpers ------------------------------- */
function getHeaders() {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "x-user-role": sessionStorage.getItem("user_role") || "Admin",
  };
}

async function getJson(url, signal) {
  const headers = getHeaders();
  delete headers["Content-Type"]; // GET
  const r = await fetch(url, { headers, cache: "no-store", signal });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 400)}`);
  try { return JSON.parse(t); } catch { throw new Error(`Unexpected (not JSON): ${t.slice(0, 400)}`); }
}

async function postJSON(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { throw new Error(`Unexpected response: ${t.slice(0, 400)}`); }
  if (!r.ok || j?.ok === false) throw new Error(j?.error || j?.message || `HTTP ${r.status}`);
  return j;
}

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
function useInView(ref, options = { threshold: 0.2, rootMargin: "0px 0px -20% 0px" }) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([ent]) => setInView(ent.isIntersecting), options);
    io.observe(el);
    return () => io.disconnect();
  }, [ref, options.threshold, options.rootMargin]);
  return inView;
}

const toneForSuccess = (pct, th = 90) => pct >= th ? "green" : pct >= th - 5 ? "amber" : "red";
const toneForCHF = (n) => (n === 0 ? "green" : n <= 3 ? "amber" : "red");
const rebootTone = (n) => (n === 0 ? "green" : "amber");

const escapeHtml = (str) => String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/* --- Export Helpers --- */
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
  if (!rows || !rows.length) return "";
  const header = Object.keys(rows[0]).join(",");
  const escape = (v) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [header];
  for (const r of rows) {
    lines.push(Object.values(r).map(escape).join(","));
  }
  return lines.join("\n");
}

function rowsToHTML(rows, title = "Results") {
  const safeTitle = escapeHtml(title);
  if (!rows || !rows.length) return `<h1>${safeTitle}</h1><p>No Data</p>`;
  const keys = Object.keys(rows[0]);
  
  const head = `
<meta charset="utf-8"/>
<title>${safeTitle}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;padding:16px;color:#111827}
  h1{font-size:18px;margin:0 0 12px}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #e5e7eb;padding:8px 10px;font-size:14px}
  thead th{background:#f8fafc;text-align:left}
</style>`;

  const ths = keys.map(k => `<th>${escapeHtml(k)}</th>`).join("");
  const trs = rows.map(r => `<tr>${keys.map(k => `<td>${escapeHtml(r[k])}</td>`).join("")}</tr>`).join("");

  return `<!doctype html><html><head>${head}</head><body><h1>${safeTitle}</h1><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></body></html>`;
}

/* ------------------------------- Enhanced Modal Component ------------------------------- */
function EnhancedModal({ open, onClose, title, rows, loading, error, renderRows, csvFilter, extraToolbar }) {
  const [filter, setFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showPageMenu, setShowPageMenu] = useState(false);
  
  const exportBtnRef = useRef(null);
  const pageBtnRef = useRef(null);

  useEffect(() => setPage(1), [filter, pageSize, rows]);

  useEffect(() => {
    function onDocClick(e) {
      if (showExportMenu && exportBtnRef.current && !exportBtnRef.current.contains(e.target)) setShowExportMenu(false);
      if (showPageMenu && pageBtnRef.current && !pageBtnRef.current.contains(e.target)) setShowPageMenu(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showExportMenu, showPageMenu]);

  // 1. Filter
  const filtered = useMemo(() => {
    if (!filter) return rows;
    const q = filter.toLowerCase();
    return rows.filter(r => 
      Object.values(r).some(v => String(v).toLowerCase().includes(q))
    );
  }, [rows, filter]);

  // 2. Sort
  const sorted = useMemo(() => {
    if (!sortConfig.key) return filtered;
    return [...filtered].sort((a, b) => {
      const valA = String(a[sortConfig.key] || "").toLowerCase();
      const valB = String(b[sortConfig.key] || "").toLowerCase();
      if (valA < valB) return sortConfig.dir === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortConfig]);

  // 3. Paginate
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      dir: current.key === key && current.dir === "asc" ? "desc" : "asc"
    }));
  };

  const doExport = (type) => {
    setShowExportMenu(false);
    const dataToExport = csvFilter ? sorted.map(csvFilter) : sorted;
    const safeTitle = title.replace(/[^\w.-]+/g, "_");
    
    if (type === 'csv') {
      const csv = rowsToCSV(dataToExport);
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${safeTitle}.csv`);
    } else if (type === 'html') {
      const html = rowsToHTML(dataToExport, title);
      downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${safeTitle}.html`);
    } else if (type === 'pdf') {
      const html = rowsToHTML(dataToExport, title);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed"; iframe.style.right = "0"; iframe.style.bottom = "0"; iframe.style.width = "0"; iframe.style.height = "0"; iframe.style.border = "0";
      iframe.src = url;
      iframe.onload = () => {
        try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {}
        setTimeout(() => { URL.revokeObjectURL(url); iframe.remove(); }, 2000);
      };
      document.body.appendChild(iframe);
    }
  };

  if (!open) return null;

  return (
    <div className="modal show" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="box" style={{ maxWidth: '1100px', width: '95%', height: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3>{title}</h3>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input 
            type="text" 
            className="control" 
            placeholder="Search..." 
            value={filter} 
            onChange={e => setFilter(e.target.value)}
            style={{ flex: 1, minWidth: '240px' }}
          />
          
          {extraToolbar}

          <div className="dropdown" ref={exportBtnRef}>
            <button className="btn" onClick={() => setShowExportMenu(s => !s)}>
              Export
              <svg width="14" height="14" viewBox="0 0 24 24" style={{ marginLeft: 6 }}>
                <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
            {showExportMenu && (
              <div className="menu">
                <button className="item" onClick={() => doExport('csv')}>Export to CSV</button>
                <button className="item" onClick={() => doExport('pdf')}>Export to PDF</button>
                <button className="item" onClick={() => doExport('html')}>Export to HTML</button>
              </div>
            )}
          </div>
        </div>

        <div className="tableWrap" style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading...</div>
          ) : error ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              {renderRows(paginated, handleSort, sortConfig)}
            </table>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: '13px' }}>
          <div style={{ color: 'var(--muted)' }}>
            Showing {sorted.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, sorted.length)} of {sorted.length} entries
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            
            {/* Custom Page Size Dropdown */}
            <div className="dropdown" ref={pageBtnRef} style={{ marginRight: 8 }}>
               <button className="btn" style={{ height: '32px', padding: '0 10px', fontSize: 13, minWidth: '90px', justifyContent: 'space-between' }} onClick={() => setShowPageMenu(!showPageMenu)}>
                 <span>{pageSize} / page</span>
                 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{transform: showPageMenu ? 'rotate(180deg)' : 'none', transition: '0.2s'}}>
                    <path d="M6 9l6 6 6-6"/>
                 </svg>
               </button>
               {showPageMenu && (
                 <div className="menu" style={{ bottom: '100%', top: 'auto', marginBottom: 4 }}>
                    {[10, 25, 50, 100].map(opt => (
                       <button key={opt} className="item" onClick={() => { setPageSize(opt); setShowPageMenu(false); }}>
                          {opt} / page
                       </button>
                    ))}
                 </div>
               )}
            </div>

            <button className="btn" disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{height: '32px', padding: '0 10px'}}>Prev</button>
            <span style={{ fontWeight: 600 }}>Page {page} of {totalPages || 1}</span>
            <button className="btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{height: '32px', padding: '0 10px'}}>Next</button>
          </div>
        </div>
      </div>
      <style>{`
        .dropdown { position: relative; display: inline-block; }
        .dropdown .menu {
          position: absolute; top: 110%; right: 0; min-width: 160px;
          background: var(--panel); border: 1px solid var(--border);
          box-shadow: 0 8px 24px rgba(0,0,0,.15); border-radius: 10px; padding: 6px; z-index: 50;
        }
        .dropdown .item {
          display: block; width: 100%; text-align: left; background: transparent; border: 0;
          padding: 8px 10px; border-radius: 8px; color: var(--text); font-weight: 600; cursor: pointer;
        }
        .dropdown .item:hover { background: var(--panel-2); }

        input[type="checkbox"].custom-checkbox { appearance: none; width: 18px; height: 18px; border: 2px solid var(--muted); border-radius: 4px; background: var(--panel); display: inline-grid; place-content: center; cursor: pointer; padding: 0 !important; min-width: 18px !important; }
        input[type="checkbox"].custom-checkbox:checked { background: var(--primary); border-color: var(--primary); }
        input[type="checkbox"].custom-checkbox:checked::before { content: ""; width: 10px; height: 10px; box-shadow: inset 1em 1em white; transform-origin: center; clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%); }

      `}</style>
    </div>
  );
}

function MetricTile({ label, value, tone, delay = 0, onClick }) {
  return (
    <div
      className={`kpi ${onClick ? "clickable" : ""}`}
      onClick={onClick}
      style={{
        transform: "translateY(8px) scale(0.98)",
        opacity: 0,
        animation: `kpi-pop 420ms cubic-bezier(.2,.8,.2,1) ${delay}ms forwards`,
        minWidth: 140, // Ensure decent size on flex wrap
        flex: 1
      }}
    >
      <span className="label" style={{ fontWeight: 800 }}>{label}</span>
      <span className="value">
        <span className={`pill click ${tone}`} style={{ fontWeight: 900 }}>{value}</span>
      </span>
    </div>
  );
}

function arcPath(cx, cy, r, startDeg, endDeg, innerR = 0) {
  const sweep = endDeg - startDeg;
  if (sweep >= 359.99) return null; 
  const toRad = (d) => (d - 90) * (Math.PI / 180);
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
  return [
    `M ${sx} ${sy}`,
    `A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`,
    `L ${six} ${siy}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${eix} ${eiy}`,
    "Z",
  ].join(" ");
}
function fullRingPaths(cx, cy, r, innerR) {
  const p1 = arcPath(cx, cy, r, 0, 180, innerR);
  const p2 = arcPath(cx, cy, r, 180, 360, innerR);
  return [p1, p2];
}

function DonutChart({ donut, center, hoverKey, setHoverKey }) {
  return (
    <div className="chart">
      <svg viewBox="0 0 120 64" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Pilot distribution">
        <g transform="translate(0,0)">
          {donut.map((s, i) => {
            const mid = (s.start + s.end) / 2;
            const rad = ((mid - 90) * Math.PI) / 180;
            const explode = hoverKey === s.key ? 3 : 0;
            const dx = explode * Math.cos(rad);
            const dy = explode * Math.sin(rad);
            const d = arcPath(30, 32, 26, s.start, s.end, 16);
            if (d === null) {
                return (
                    <g key={i} transform={`translate(${dx},${dy})`}
                       onMouseEnter={() => setHoverKey(s.key)} onMouseLeave={() => setHoverKey(null)}
                       style={{ cursor: "pointer", transition: "transform 180ms ease, filter 180ms ease", filter: hoverKey === s.key ? "brightness(1.05)" : "none" }}>
                       {fullRingPaths(30, 32, 26, 16).map((path, idx) => (
                           <path key={idx} d={path} fill={s.fill} stroke="var(--panel-1)" strokeWidth="0.2" />
                       ))}
                    </g>
                );
            }
            return (
              <path key={i} d={d} fill={s.fill} stroke="var(--panel-1)" strokeWidth="0.2" transform={`translate(${dx},${dy})`}
                style={{ transition: "transform 180ms ease, filter 180ms ease", filter: hoverKey === s.key ? "brightness(1.05)" : "none", cursor: "pointer" }}
                onMouseEnter={() => setHoverKey(s.key)} onMouseLeave={() => setHoverKey(null)} />
            );
          })}
          <text x="30" y="29" textAnchor="middle" fontSize="7" fontWeight="600" fill="var(--text)">{center.pct}%</text>
          <text x="30" y="38" textAnchor="middle" fontSize="5" fill="var(--muted)">{center.label}</text>
        </g>
        <g transform="translate(64,10)" fontSize="6">
          {[{ key: "Success", fill: "var(--success)", y: 7 }, { key: "Reboot", fill: "var(--warn)", y: 18 }, { key: "Health", fill: "var(--danger)", y: 30 }].map((l) => (
            <g key={l.key} transform={`translate(6,${l.y})`} onMouseEnter={() => setHoverKey(l.key)} onMouseLeave={() => setHoverKey(null)}
              style={{ cursor: "pointer", opacity: hoverKey && hoverKey !== l.key ? 0.7 : 1, transition: "opacity 160ms ease" }}>
              <circle cx="4" cy="4" r="3" fill={l.fill} />
              <text x="12" y="6">{l.key}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

function ConfirmationModal({ open, title, children, onClose, onConfirm, busy = false }) {
  if (!open) return null;
  return (
    <div className="modal show" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="box" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ color: "var(--primary, #2563eb)" }}>{title || "Confirm Action"}</h3>
        <div className="sub" style={{ fontSize: 14, lineHeight: 1.6, margin: "16px 0" }}>{children}</div>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn pri" onClick={onConfirm} disabled={busy}>{busy ? "Processing..." : "Confirm"}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Main KPI Component ------------------------------- */
export default function PilotKPI({ title = "Pilot KPI", lastActions = {} }) {
  const mode = /production/i.test(title) ? "production" : "pilot";
  const getPinnedActionId = useCallback(() => {
    try {
      const la = lastActions || {};
      if (mode === "production") return la?.PILOT?.id ?? null;
      return la?.SANDBOX?.id ?? null;
    } catch {
      return null;
    }
  }, [lastActions, mode]);

  const [kpi, setKpi] = useState({ rebootPending: 0, critHealthFails: 0, successRate: 0, successCount: 0, totalCount: 0 });
  const [totalComputers, setTotalComputers] = useState(0);
  
  const [rebootRows, setRebootRows] = useState([]);
  const [openReboot, setOpenReboot] = useState(false);
  const [rebootLoading, setRebootLoading] = useState(false);
  // New State for Bulk Reboot
  const [selectedReboots, setSelectedReboots] = useState(new Set());
  const [confirmBulkReboot, setConfirmBulkReboot] = useState(false);
  const [bulkRebootStatus, setBulkRebootStatus] = useState("");

  const [openSuccess, setOpenSuccess] = useState(false);
  const [successRows, setSuccessRows] = useState([]);
  const [successLoading, setSuccessLoading] = useState(false);

  const [openHealth, setOpenHealth] = useState(false);
  const [healthRows, setHealthRows] = useState([]);
  const [healthLoading, setHealthLoading] = useState(false);

  const [confirmRestart, setConfirmRestart] = useState(null);
  const [confirmService, setConfirmService] = useState(null);
  const [actionStatus, setActionStatus] = useState({});
  const [globalError, setGlobalError] = useState("");

  // -- Role Check --
  const userRole = sessionStorage.getItem("user_role") || "Admin";
  const isEUC = userRole === "EUC";

   useEffect(() => {
    function onSandbox(e) {
      const { success = 0, total = 0 } = e.detail || {};
      const rate = total > 0 ? Math.round((Number(success) / Number(total)) * 100) : 0;
      setKpi((p) => ({ ...p, successRate: rate, successCount: Number(success) || 0, totalCount: Number(total) || 0 }));
    }
    function onHealth(e) {
      const { count = 0 } = e.detail || {};
      setKpi((p) => ({ ...p, critHealthFails: Number(count || 0) }));
    }
    function onTotals(e) {
      const { totalComputers: tc = 0 } = e.detail || {};
      setTotalComputers(Number(tc) || 0);
    }

    window.addEventListener("pilot:sandboxResultsUpdated", onSandbox);
    window.addEventListener("pilot:criticalHealthUpdated", onHealth);
    window.addEventListener("pilot:totalsUpdated", onTotals);

    if (window.__pilotCache?.sandboxResults) onSandbox({ detail: window.__pilotCache.sandboxResults });
    if (window.__pilotCache?.criticalHealth) onHealth({ detail: window.__pilotCache.criticalHealth });
    if (window.__pilotCache?.totals?.computers) setTotalComputers(Number(window.__pilotCache.totals.computers) || 0);

    (async () => {
      try {
        const data = await getJson(`${API_BASE}/api/infra/total-computers`);
        if (typeof data?.total === "number") setTotalComputers(Number(data.total) || 0);
      } catch {}
    })();

    return () => {
      window.removeEventListener("pilot:sandboxResultsUpdated", onSandbox);
      window.removeEventListener("pilot:criticalHealthUpdated", onHealth);
      window.removeEventListener("pilot:totalsUpdated", onTotals);
    };
  }, []);

  const rootRef = useRef(null);
  useInView(rootRef);

  const donut = useMemo(() => {
    const R = kpi.rebootPending || 0;
    const H = kpi.critHealthFails || 0;
    const S_action = kpi.successCount || 0;
    const T_action = kpi.totalCount || 0;
    const O_action = Math.max(0, T_action - S_action);

    const partsCombined = [
      { key: "Success", val: S_action, fill: "var(--success)" },
      { key: "Reboot", val: R, fill: "var(--warn)" },
      { key: "Health", val: H + O_action, fill: "var(--danger)" },
    ];
    const total = partsCombined.reduce((a, b) => a + b.val, 0) || 1;
    let acc = 0;
    return partsCombined.map((p) => {
      const start = (acc / total) * 360;
      const end = ((acc + p.val) / total) * 360;
      acc += p.val;
      return { ...p, start, end, pct: Math.round((p.val / total) * 100) };
    });
  }, [kpi.rebootPending, kpi.critHealthFails, kpi.successCount, kpi.totalCount]);

  const [hoverKey, setHoverKey] = useState(null);
  const center = useMemo(() => {
    const R = kpi.rebootPending || 0;
    const H = kpi.critHealthFails || 0;
    const S_action = kpi.successCount || 0;
    const T_action = kpi.totalCount || 0;
    const O_action = Math.max(0, T_action - S_action);
    const T_donut = S_action + R + H + O_action;
    const asPct = (val, total) => clamp(Math.round((val / (total > 0 ? total : 1)) * 100), 0, 100);

    const pctFor = (key) => {
      switch (key) {
        case "Success": return asPct(S_action, T_donut);
        case "Reboot": return asPct(R, T_donut);
        case "Health": return asPct(H + O_action, T_donut);
        default: return asPct(S_action, T_donut);
      }
    };
    const key = hoverKey || "Success";
    if (key === "Success") return { pct: kpi.successRate || 0, label: "success" };
    return { pct: pctFor(key), label: key.toLowerCase() };
  }, [hoverKey, kpi.successRate, kpi.rebootPending, kpi.critHealthFails, kpi.successCount, kpi.totalCount]);

  async function openSuccessModal() {
    setOpenSuccess(true);
    const id = getPinnedActionId();
    if (!id) { setSuccessRows([]); setSuccessLoading(false); return; }
    try {
      setSuccessLoading(true);
      const res = await getJson(`${API_BASE}/api/actions/${id}/results`);
      const allRows = Array.isArray(res?.rows) ? res.rows : [];
      setSuccessRows(allRows.filter((r) => /success/i.test(r?.status || "")));
    } catch { setSuccessRows([]); } finally { setSuccessLoading(false); }
  }

  async function openHealthModal() {
    setOpenHealth(true);
    setGlobalError("");
    try {
      setHealthLoading(true);
      const data = await getJson(`${API_BASE}/api/health/critical`);
      setHealthRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch { setHealthRows([]); } finally { setHealthLoading(false); }
  }

  async function openRebootModal() {
    setOpenReboot(true);
    setGlobalError("");
    setSelectedReboots(new Set()); // Reset selections on open
    try {
      setRebootLoading(true);
      const data = await getJson(`${API_BASE}/api/health/reboot-pending`);
      setRebootRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch { setRebootRows([]); } finally { setRebootLoading(false); }
  }

  // --- Checkbox Handlers ---
  const toggleRebootSelection = (serverName) => {
    const next = new Set(selectedReboots);
    if (next.has(serverName)) next.delete(serverName);
    else next.add(serverName);
    setSelectedReboots(next);
  };

  const toggleAllReboots = () => {
    if (selectedReboots.size === rebootRows.length) {
      setSelectedReboots(new Set());
    } else {
      setSelectedReboots(new Set(rebootRows.map(r => r.server)));
    }
  };

  // --- Single Restart ---
  async function executeRestart() {
    const serverName = confirmRestart;
    if (!serverName) return;
    setActionStatus((p) => ({ ...p, [serverName]: "loading" }));
    setConfirmRestart(null);
    setGlobalError("");
    try {
      const result = await postJSON(`${API_BASE}/api/actions/restart`, { computerName: serverName });
      setActionStatus((p) => ({ ...p, [serverName]: "success", [`__id_${serverName}`]: result.actionId }));
    } catch (e) {
      const errorMsg = e.message || "Failed to trigger restart.";
      setActionStatus((p) => ({ ...p, [serverName]: "error", [`__msg_${serverName}`]: errorMsg }));
      setGlobalError(`Failed to restart ${serverName}: ${errorMsg}`);
    }
  }

  // --- Bulk Restart ---
  async function executeBulkRestart() {
    if (selectedReboots.size === 0) return;
    setBulkRebootStatus("Triggering...");
    setConfirmBulkReboot(false);
    
    try {
      const names = Array.from(selectedReboots);
      const result = await postJSON(`${API_BASE}/api/actions/restart-bulk`, { computerNames: names });
      
      const newStatus = { ...actionStatus };
      names.forEach(name => {
          newStatus[name] = "success";
          newStatus[`__id_${name}`] = result.actionId;
      });
      setActionStatus(newStatus);
      
      setBulkRebootStatus(`Success! Action ID: ${result.actionId}`);
      setSelectedReboots(new Set()); 
      
    } catch (e) {
      setBulkRebootStatus("Failed.");
      setGlobalError(`Bulk restart failed: ${e.message}`);
    }
  }

  async function executeServiceRestart() {
    const serverName = confirmService;
    if (!serverName) return;
    const key = `svc_${serverName}`;
    setActionStatus((p) => ({ ...p, [key]: "loading" }));
    setConfirmService(null);
    setGlobalError("");
    try {
      const result = await postJSON(`${API_BASE}/api/actions/service-restart`, { computerName: serverName });
      setActionStatus((p) => ({ ...p, [key]: "success", [`__id_${key}`]: result.actionId }));
    } catch (e) {
      const errorMsg = e.message || "Failed to trigger service restart.";
      setActionStatus((p) => ({ ...p, [key]: "error", [`__msg_${key}`]: errorMsg }));
      setGlobalError(`Failed to restart service on ${serverName}: ${errorMsg}`);
    }
  }

  useEffect(() => {
    let timer;
    const ab = new AbortController();
    async function tick() {
      try {
        let actionId = getPinnedActionId();
        if (actionId) {
          const res = await getJson(`${API_BASE}/api/actions/${actionId}/results`, ab.signal);
          const rows = Array.isArray(res?.rows) ? res.rows : [];
          const success = Number(res?.success ?? rows.filter((r) => /success/i.test(r?.status || "")).length);
          const total = Number(res?.total ?? rows.length);
          const rate = total > 0 ? Math.round((success / total) * 100) : 0;
          setKpi((p) => ({ ...p, successRate: rate, successCount: success, totalCount: total }));
          const payload = { actionId, success, total, rows };
          window.__pilotCache = window.__pilotCache || {};
          window.__pilotCache.sandboxResults = payload;
          window.dispatchEvent(new CustomEvent("pilot:sandboxResultsUpdated", { detail: payload }));
        } else {
          setKpi((p) => ({ ...p, successRate: 0, successCount: 0, totalCount: 0 }));
          window.dispatchEvent(new CustomEvent("pilot:sandboxResultsUpdated", { detail: { actionId: null, success: 0, total: 0, rows: [] } }));
        }

        const ch = await getJson(`${API_BASE}/api/health/critical`, ab.signal);
        const healthPayload = { count: Number(ch?.count || 0), rows: Array.isArray(ch?.rows) ? ch.rows : [] };
        setKpi((p) => ({ ...p, critHealthFails: healthPayload.count }));
        window.dispatchEvent(new CustomEvent("pilot:criticalHealthUpdated", { detail: healthPayload }));

        try {
          const rp = await getJson(`${API_BASE}/api/health/reboot-pending`, ab.signal);
          const rpRows = Array.isArray(rp?.rows) ? rp.rows : [];
          const rpCount = Number(rp?.count ?? (rpRows.length || 0));
          setKpi((p) => ({ ...p, rebootPending: rpCount }));
          setRebootRows(rpRows);
          window.dispatchEvent(new CustomEvent("pilot:rebootPendingUpdated", { detail: { count: rpCount, rows: rpRows } }));
        } catch (e) {}

        try {
          const tot = await getJson(`${API_BASE}/api/infra/total-computers`, ab.signal);
          if (typeof tot?.total === "number") {
            setTotalComputers(Number(tot.total) || 0);
            window.dispatchEvent(new CustomEvent("pilot:totalsUpdated", { detail: { totalComputers: Number(tot.total) || 0 } }));
          }
        } catch {}
        window.dispatchEvent(new CustomEvent("pilot:kpiRefreshed", { detail: { ts: Date.now() } }));
      } catch (err) {
        if (err.name !== "AbortError") console.warn("PilotKPI refresh failed:", err?.message || err);
      }
    }
    tick();
    timer = setInterval(tick, 10000);
    return () => { clearInterval(timer); ab.abort(); };
  }, [mode, getPinnedActionId]);

  return (
    <section ref={rootRef} className="card reveal" data-reveal>
      <h2>{title}</h2>
      <div className="row" style={{ gap: 16, alignItems: "center", display: "flex", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="kpis" style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            
            {/* HIDE SUCCESS RATE IF EUC */}
            {!isEUC && (
              <MetricTile label="Success Rate" value={`${kpi.successRate}%`} tone={toneForSuccess(kpi.successRate)} onClick={openSuccessModal} />
            )}

            <MetricTile label="Critical Health Failures" value={kpi.critHealthFails} tone={toneForCHF(kpi.critHealthFails)} delay={80} onClick={openHealthModal} />
            <MetricTile label="Reboot Pending" value={kpi.rebootPending} tone={rebootTone(kpi.rebootPending)} delay={140} onClick={openRebootModal} />
          </div>
          <div className="sep"></div>
          <DonutChart donut={donut} center={center} hoverKey={hoverKey} setHoverKey={setHoverKey} />
        </div>
      </div>

      <EnhancedModal 
        open={openSuccess} onClose={() => setOpenSuccess(false)} title={`${title.replace("KPI", "Success Details")}`} 
        rows={successRows} loading={successLoading} 
        renderRows={(rows, handleSort, sortConfig) => (
          <>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--panel-2)' }}>
              <tr>
                <th onClick={() => handleSort('server')} style={{cursor:'pointer'}}>Server {sortConfig.key==='server'? (sortConfig.dir==='asc'?'↑':'↓') : ''}</th>
                <th onClick={() => handleSort('status')} style={{cursor:'pointer'}}>Status {sortConfig.key==='status'? (sortConfig.dir==='asc'?'↑':'↓') : ''}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (<tr><td colSpan={2} className="sub">No success rows.</td></tr>) : (rows.map((r, i) => (<tr key={i}><td>{r.server || "—"}</td><td>Success</td></tr>)))}
            </tbody>
          </>
        )}
      />

      <EnhancedModal
        open={openHealth} onClose={() => setOpenHealth(false)} title={`${title.replace("KPI", "Critical Health")}`}
        rows={healthRows} loading={healthLoading} error={globalError}
        renderRows={(rows, handleSort, sortConfig) => {
          const role = sessionStorage.getItem("user_role") || "Admin";
          const showService = role !== "Linux"; 
          return (
            <>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--panel-2)' }}>
                <tr>
                  <th onClick={() => handleSort('server')} style={{cursor:'pointer'}}>Server {sortConfig.key==='server'?(sortConfig.dir==='asc'?'↑':'↓'):''}</th>
                  <th onClick={() => handleSort('issues')} style={{cursor:'pointer'}}>Issue</th>
                  {showService && <th>Service Name</th>}
                  {showService && <th>Service Status</th>}
                  <th>Last Report</th>
                  {showService && <th style={{ width: 120, textAlign: 'center' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (<tr><td colSpan={showService ? 6 : 3} className="sub">No critical failures.</td></tr>) : (
                  rows.map((r, i) => {
                    const svcKey = `svc_${r.server}`;
                    const status = actionStatus[svcKey];
                    
                    // FIX: Strict check for Windows OS
                    const isWindows = String(r.os || "").toLowerCase().includes("win");
                    
                    // FIX: Ensure button only shows if Windows + Valid State
                    const canRestart = isWindows && r.serviceStatus 
                        && r.serviceStatus.toLowerCase() !== "running" 
                        && r.serviceStatus !== "N/A"
                        && r.serviceStatus !== "Not Applicable";

                    return (
                      <tr key={i}>
                        <td>{r.server || "N/A"}</td>
                        <td>{(r.issues || []).map((issue, idx) => (<span key={idx} className="pill red" style={{ marginRight: 4, fontSize: 11 }}>{issue}</span>))}</td>
                        
                        {/* Service Name: Only show for Windows */}
                        {showService && <td>{isWindows ? "Window Update" : "—"}</td>}
                        
                        {/* Service Status: Only show for Windows */}
                        {showService && <td>{isWindows ? (r.serviceStatus || "N/A") : "—"}</td>}
                        
                        <td>{r.lastReportTime}</td>
                        {showService && (
                          <td style={{ textAlign: "center" }}>
                            {canRestart && (
                              <button className="btn pri" style={{ height: 32, padding: "0 10px", fontSize: 11 }} onClick={() => setConfirmService(r.server)} disabled={!!status}>
                                {status === "loading" ? "..." : status === "success" ? "Sent" : "Restart"}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </>
          );
        }}
      />

      <EnhancedModal
        open={openReboot} onClose={() => setOpenReboot(false)} title={`${title.replace("KPI", "Reboot Pending")}`}
        rows={rebootRows} loading={rebootLoading} error={globalError}
        extraToolbar={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
             {selectedReboots.size > 0 && (
                <>
                  <span className="pill amber">{selectedReboots.size} selected</span>
                  <button 
                    className="btn pri" 
                    style={{ height: 32, padding: '0 12px', fontSize: 12 }}
                    onClick={() => setConfirmBulkReboot(true)}
                  >
                    Restart Selected
                  </button>
                </>
             )}
             {bulkRebootStatus && <span style={{ fontSize: 12, color: 'var(--success)' }}>{bulkRebootStatus}</span>}
          </div>
        }
        renderRows={(rows, handleSort, sortConfig) => (
          <>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--panel-2)' }}>
              <tr>
                <th style={{ width: 40, textAlign: 'center' }}>
                   <input type="checkbox" className="custom-checkbox" onChange={toggleAllReboots} checked={rebootRows.length > 0 && selectedReboots.size === rebootRows.length} />
                </th>
                <th onClick={() => handleSort('server')} style={{cursor:'pointer'}}>Server {sortConfig.key==='server'?(sortConfig.dir==='asc'?'↑':'↓'):''}</th>
                <th>Pending Restart</th>
                <th>IP</th>
                <th>UpTime</th>
                <th>BES Relay</th>
                <th style={{ width: 140, textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (<tr><td colSpan={7} className="sub">No computers require reboot.</td></tr>) : (
                rows.map((r, i) => {
                  const status = actionStatus[r.server];
                  return (
                    <tr key={i} onClick={() => toggleRebootSelection(r.server)} style={{ cursor: 'pointer', background: selectedReboots.has(r.server) ? 'var(--panel-2)' : 'transparent' }}>
                      <td style={{ textAlign: 'center' }}>
                         <input type="checkbox" className="custom-checkbox" checked={selectedReboots.has(r.server)} readOnly />
                      </td>
                      <td>{r.server || "N/A"}</td>
                      <td>{String(r.pendingRestart ?? r.pending ?? r.restart ?? "N/A")}</td>
                      <td>{r.ip || "N/A"}</td>
                      <td>{r.uptime || "N/A"}</td>
                      <td>{r.besRelay || "N/A"}</td>
                      <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                        <button className="btn pri" style={{ height: 32, padding: "0 10px", fontSize: 11 }} onClick={() => setConfirmRestart(r.server)} disabled={!!status}>
                          {status === "loading" ? "..." : status === "success" ? "Sent" : "Restart"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </>
        )}
      />

      {confirmRestart && (
        <ConfirmationModal open={!!confirmRestart} title="Confirm Server Restart" onClose={() => setConfirmRestart(null)} onConfirm={executeRestart} busy={actionStatus[confirmRestart] === "loading"}>
          Are you sure you want to restart the server: <strong>{confirmRestart}</strong>?
        </ConfirmationModal>
      )}

      {confirmService && (
        <ConfirmationModal open={!!confirmService} title="Confirm Service Restart" onClose={() => setConfirmService(null)} onConfirm={executeServiceRestart} busy={actionStatus[`svc_${confirmService}`] === "loading"}>
          Are you sure you want to restart "Window Update" service on: <strong>{confirmService}</strong>?
        </ConfirmationModal>
      )}

      {confirmBulkReboot && (
        <ConfirmationModal 
           open={confirmBulkReboot} 
           title={`Confirm Bulk Restart (${selectedReboots.size})`} 
           onClose={() => setConfirmBulkReboot(false)} 
           onConfirm={executeBulkRestart} 
           busy={bulkRebootStatus === "Triggering..."}
        >
           Are you sure you want to restart <strong>{selectedReboots.size}</strong> selected servers immediately?
           <div style={{ maxHeight: 100, overflowY: 'auto', background: 'var(--panel-2)', padding: 8, borderRadius: 6, marginTop: 10, fontSize: 12 }}>
              {Array.from(selectedReboots).join(", ")}
           </div>
        </ConfirmationModal>
      )}

      <style>{`@keyframes kpi-pop { 0%{transform:translateY(10px) scale(.98);opacity:0} 60%{transform:translateY(0) scale(1.01);opacity:1} 100%{transform:translateY(0) scale(1);opacity:1} }`}</style>
    </section>
  );
}