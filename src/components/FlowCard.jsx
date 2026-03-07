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

async function getJson(url, signal) {
  const r = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store", signal });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 400)}`);
  return JSON.parse(t);
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

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]); 

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
    </>
  );
}

function ActionResultsModal({ open, onClose, action, loading, rows, error }) {
    const [filter, setFilter] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: "status", dir: "asc" });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const title = action?.name || "Action Details";

    useEffect(() => setPage(1), [filter, pageSize, rows]);

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
            <div className="box action-modal-box" onClick={e => e.stopPropagation()}>
                <div className="action-modal-header">
                    <h3>{title}</h3>
                    <button className="btn" onClick={onClose}>Close</button>
                </div>
                <div className="action-modal-search">
                    <input className="control action-modal-search-input" placeholder="Search..." value={filter} onChange={e => setFilter(e.target.value)} />
                </div>
                <div className="tableWrap action-modal-body">
                    {loading ? <div className="action-modal-loading">Loading...</div> : (
                        <table className="action-modal-table">
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('server')}>Server</th>
                                    <th onClick={() => handleSort('status')}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map((r, i) => (
                                    <tr key={i}>
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
                <div className="action-modal-footer">
                    <span>Page {page} of {totalPages || 1}</span>
                    <div className="action-modal-nav">
                        <button className="btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                        <button className="btn action-modal-btn-next" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}