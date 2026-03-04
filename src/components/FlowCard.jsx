// src/components/FlowCard.jsx
import { useEffect, useState, useCallback, useMemo, useRef } from "react";

export const Stage = {
  CONFIG: "CONFIG",
  SANDBOX: "SANDBOX",
  PILOT: "PILOT",
  PRODUCTION: "PRODUCTION",
  FinalResult: "FINAL RESULT",
};

const API = window.env.VITE_API_BASE;

/* ------------------------------- Helpers ------------------------------- */

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

// Status Classifier for consistent colors
function classify(raw) {
  const s = String(raw || "").trim();
  if (!s) return "Not Reported";
  const L = s.toLowerCase();

  if (/^fixed$/i.test(s) || /^completed$/i.test(s) || /executed successfully/i.test(L)) return "Success";
  if (/^pending restart$/i.test(s) || /waiting for restart/i.test(L)) return "Pending Restart";
  if (/^running$/i.test(s) || /is currently running/i.test(L)) return "Running";
  if (/^failed$/i.test(s) || /\baction failed\b/i.test(L)) return "Failed";
  if (/^not reported$/i.test(s)) return "Not Reported";
  
  // Generic fallbacks
  if (/success/i.test(L)) return "Success";
  if (/fail|error/i.test(L)) return "Failed";
  if (/wait|pending/i.test(L)) return "Waiting";
  
  return s; 
}

function StepChip({ label, stage, activeStage, completedSet, onClick, canGotoStage }) {
  const disabled = canGotoStage ? !canGotoStage(stage) : false;
  const isHold = stage === activeStage;
  const isPass = completedSet.has(stage);

  let cls = "step";
  if (!disabled) cls += " clickable";
  if (isHold) cls += " hold";
  if (isPass) cls += " pass";
  if (disabled) cls += " disabled";

  const handle = useCallback(() => { if (!disabled) onClick?.(stage); }, [disabled, onClick, stage]);

  return (
    <div
      className={cls}
      onClick={handle}
      role={disabled ? "presentation" : "button"}
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled ? "true" : "false"}
      title={disabled ? "Complete earlier stages to proceed" : ""}
      style={disabled ? { cursor: "not-allowed", opacity: 0.55 } : {}}
    >
      <span className="dot" />
      <span style={{ fontWeight: 800 }}>{label}</span>
    </div>
  );
}

export default function FlowCard({
  activeStage,
  gotoStage,
  completedStages = [],
  canGotoStage,
  onJumpTo,
  role,
  enableSandbox = true,
  enablePilot = true
}) {
  const [revealed, setRevealed] = useState(false);
  const [activeTab, setActiveTab] = useState("flow");

  // deployment modal state
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]); 

  // Action Result Modal state
  const [detailAction, setDetailAction] = useState(null); 
  const [detailResults, setDetailResults] = useState({ loading: false, rows: [], error: null });

  const isEUC = role === 'EUC';

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 40);
    return () => clearTimeout(t);
  }, []);

  const completedSet = new Set(completedStages || []);

  const divider = (
    <svg width="34" height="6" viewBox="0 0 34 6" aria-hidden="true">
      <path d="M2 3h30" stroke="currentColor" opacity=".35" />
    </svg>
  );

  const openDeployments = async () => {
    setOpen(true);
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`${API}/api/deployments/bps`, { headers: { Accept: "application/json" } });
      const t = await r.text();
      if (!r.ok) throw new Error(t);
      const j = JSON.parse(t);
      setItems(Array.isArray(j?.items) ? j.items : []);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const openActionDetails = async (action) => {
    if (!action || !action.id) return;
    setDetailAction(action); 
    setDetailResults({ loading: true, rows: [], error: null });
    try {
      const res = await getJson(`${API}/api/actions/${action.id}/results`);
      setDetailResults({
        loading: false,
        rows: Array.isArray(res?.rows) ? res.rows : [],
        error: null,
      });
    } catch (e) {
      setDetailResults({
        loading: false,
        rows: [],
        error: e.message || "Failed to load action results.",
      });
    }
  };

  return (
    <>
      <section className={`card ${revealed ? "reveal" : ""}`}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2>Orchestration Flow</h2>
            <div className="sub">
              {isEUC 
                ? "Configuration → Production. Direct path active for EUC." 
                : "Sandbox → Pilot → Production. Promotions only after Evaluate."}
            </div>
          </div>

          <div className="timeline" id="timeline">
            {/* Deployment trigger */}
            <div
              className="step clickable"
              role="button"
              tabIndex={0}
              aria-label="Deployment"
              title="View recent BPS actions"
              onClick={openDeployments}
            >
              <span className="dot" />
              <span style={{ fontWeight: 800 }}>Deployment History</span>
            </div>

            <StepChip label="Configuration" stage={Stage.CONFIG}
              activeStage={activeStage} completedSet={completedSet}
              onClick={gotoStage} canGotoStage={canGotoStage} />
            
            {divider}

            {/* FIX: Hide Sandbox/Pilot if disabled in Config OR if role is EUC */}
            {!isEUC && (
              <>
                {enableSandbox && (
                    <>
                        <StepChip label="Sandbox" stage={Stage.SANDBOX}
                        activeStage={activeStage} completedSet={completedSet}
                        onClick={gotoStage} canGotoStage={canGotoStage} />
                        {divider}
                    </>
                )}
                {enablePilot && (
                    <>
                        <StepChip label="Pilot" stage={Stage.PILOT}
                        activeStage={activeStage} completedSet={completedSet}
                        onClick={gotoStage} canGotoStage={canGotoStage} />
                        {divider}
                    </>
                )}
              </>
            )}

            <StepChip label="Production" stage={Stage.PRODUCTION}
              activeStage={activeStage} completedSet={completedSet}
              onClick={gotoStage} canGotoStage={canGotoStage} />
            {divider}
            <StepChip label="FINAL RESULT" stage={Stage.FinalResult}
              activeStage={activeStage} completedSet={completedSet}
              onClick={gotoStage} canGotoStage={canGotoStage} />
          </div>
        </div>

        <div className="sep" />

        <div className="tabs">
          <button className={`tab ${activeTab === "flow" ? "active" : ""}`} onClick={() => setActiveTab("flow")}>Flow</button>
          <button className={`tab ${activeTab === "gates" ? "active" : ""}`} onClick={() => setActiveTab("gates")}>Gates &amp; Decisions</button>
          <button className={`tab ${activeTab === "reporting" ? "active" : ""}`} onClick={() => setActiveTab("reporting")}>Reporting</button>
          <button className={`tab ${activeTab === "patchinfo" ? "active" : ""}`} onClick={() => setActiveTab("patchinfo")}>Patch Info</button>
          <div className="spacer" />
        </div>

        <div className={`tabpanel ${activeTab === "flow" ? "active" : ""}`}>
          <div className="sub">
            Current Stage: <strong>{activeStage}</strong>
            <br />
            {isEUC ? "Direct deployment mode enabled." : "Sandbox (Lab/UAT) → Pilot (canary ring) → Production."}
          </div>
        </div>

        <div className={`tabpanel ${activeTab === "gates" ? "active" : ""}`}>
          <div className="sub">
            <strong>Gates enabled:</strong> PASS if <strong>Success ≥ Threshold</strong> and <strong>Critical Health Failures ≤ Limit</strong>.
          </div>
        </div>

        <div className={`tabpanel ${activeTab === "reporting" ? "active" : ""}`}>
          <div className="sub">
            <strong>Reporting:</strong> Wire Web Reports/webhooks for telemetry &amp; audit.
          </div>
        </div>

        <div className={`tabpanel ${activeTab === "patchinfo" ? "active" : ""}`}>
          <div className="sub">
            <strong>Patch Info:</strong>Patching Deployment is being done on UTC TimeZone
          </div>
        </div>

        {/* Modal with BPS actions */}
        {open && (
          <div className="modal show" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
            <div className="box" style={{ maxWidth: 920 }} onClick={(e) => e.stopPropagation()}>
              <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                <h3>BPS Actions List</h3>
                <button className="btn" onClick={() => setOpen(false)}>Close</button>
              </div>

              {loading && <div className="sub">Loading…</div>}
              {err && !loading && <div className="sub" style={{ color: "var(--danger)" }}>{err}</div>}
              {!loading && !err && (
                <div className="table-wrap" style={{ overflow: "auto", maxHeight: 420 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: "46%" }}>Name</th>
                        <th>ID</th>
                        <th>State</th>
                        <th>Issued</th>
                        <th>Stopped</th>
                        <th>Issuer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 && (
                        <tr><td colSpan="6" className="sub">No BPS actions found.</td></tr>
                      )}
                      {items.map((it) => (
                        <tr
                          key={it.id}
                          onClick={() => openActionDetails(it)}
                          tabIndex={0}
                          style={{ cursor: 'pointer' }}
                          title={`Click to view results for Action ${it.id}`}
                        >
                          <td>
                            <button className="name-link" onClick={(e) => { e.stopPropagation(); openActionDetails(it); }}>
                              {it.name}
                            </button>
                          </td>
                          <td>{it.id}</td>
                          <td>{it.state}</td>
                          <td>{it.issued}</td>
                          <td>{it.stopped}</td>
                          <td>{it.issuer}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Detail Modal */}
      {detailAction && (
        <ActionResultsModal
            open={!!detailAction}
            onClose={() => setDetailAction(null)}
            action={detailAction}
            loading={detailResults.loading}
            rows={detailResults.rows}
            error={detailResults.error}
        />
      )}

      <style>{`
        .mini-chip{ padding:4px 8px; border:1px solid var(--line); border-radius:10px; background:var(--panel); }
        .table{ width:100%; border-collapse:collapse; }
        .table th, .table td{ border-bottom:1px solid var(--line); padding:8px 10px; text-align:left; }
        .table tr:hover{ background:var(--panel-weak); }
        .table-wrap{ margin-top:8px; }

        .name-link{ all: unset; cursor: pointer; color: var(--primary, #2563eb); font-weight: 700; line-height: 1.2; display: inline-flex; align-items: center; }
        .name-link::after{ content: "↗"; font-size: 11px; margin-left: 6px; opacity: .7; }
        .name-link:hover, tr:focus .name-link{ text-decoration: underline; }

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
      `}</style>
    </>
  );
}

function ActionResultsModal({ open, onClose, action, loading, rows, error }) {
    const [filter, setFilter] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: "status", dir: "asc" });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [showMenu, setShowMenu] = useState(false);
    const btnRef = useRef(null);
    const title = action?.name || "Action Details";

    useEffect(() => setPage(1), [filter, pageSize, rows]);
    useEffect(() => {
        function onDocClick(e) {
            if (showMenu && btnRef.current && !btnRef.current.contains(e.target)) setShowMenu(false);
        }
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [showMenu]);

    const filtered = useMemo(() => {
        if (!filter) return rows;
        const q = filter.toLowerCase();
        return rows.filter(r => 
            (r.server && r.server.toLowerCase().includes(q)) || 
            (r.patch && r.patch.toLowerCase().includes(q)) ||
            (r.status && r.status.toLowerCase().includes(q))
        );
    }, [rows, filter]);

    const sorted = useMemo(() => {
        if (!sortConfig.key) return filtered;
        return [...filtered].sort((a, b) => {
            const valA = sortConfig.key === 'status' ? classify(a.status).toLowerCase() : String(a[sortConfig.key] || "").toLowerCase();
            const valB = sortConfig.key === 'status' ? classify(b.status).toLowerCase() : String(b[sortConfig.key] || "").toLowerCase();
            if (valA < valB) return sortConfig.dir === "asc" ? -1 : 1;
            if (valA > valB) return sortConfig.dir === "asc" ? 1 : -1;
            return 0;
        });
    }, [filtered, sortConfig]);

    const totalPages = Math.ceil(sorted.length / pageSize);
    const paginated = useMemo(() => {
        const start = (page - 1) * pageSize;
        return sorted.slice(start, start + pageSize);
    }, [sorted, page, pageSize]);

    const handleSort = (key) => setSortConfig(c => ({ key, dir: c.key === key && c.dir === "asc" ? "desc" : "asc" }));
    
    if (!open) return null;

    return (
        <div className="modal show" onClick={onClose}>
            <div className="box" onClick={e => e.stopPropagation()} style={{ maxWidth: 960, height: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3>{title}</h3>
                    <button className="btn" onClick={onClose}>Close</button>
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    <input className="control" placeholder="Search..." value={filter} onChange={e => setFilter(e.target.value)} style={{ flex: 1 }} />
                </div>
                <div className="tableWrap" style={{ flex: 1, overflow: 'auto' }}>
                    {loading ? <div style={{ padding: 20 }}>Loading...</div> : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('server')} style={{ cursor: 'pointer' }}>Server</th>
                                    <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map((r, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                        <td>{r.server}</td>
                                        <td><span className={`status-pill ${
                                            classify(r.status)==='Success'?'status-green':
                                            classify(r.status)==='Failed'?'status-red':
                                            classify(r.status)==='Running'?'status-blue':'status-amber'
                                        }`}>{classify(r.status)}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Page {page} of {totalPages || 1}</span>
                    <div>
                        <button className="btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                        <button className="btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ marginLeft: 8 }}>Next</button>
                    </div>
                </div>
            </div>
            <style>{`
            .status-pill { padding: 4px 8px; border-radius: 99px; font-size: 12px; font-weight: 600; display: inline-block; }
            .status-green { background: #dcfce7; color: #166534; }
            .status-red { background: #fee2e2; color: #991b1b; }
            .status-blue { background: #dbeafe; color: #1e40af; }
            .status-amber { background: #fef3c7; color: #92400e; }
            `}</style>
        </div>
    );
}