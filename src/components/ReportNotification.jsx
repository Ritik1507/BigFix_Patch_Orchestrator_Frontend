// ReportNotification.jsx
import { useEffect, useState, useCallback } from "react";

const LS_KEY = "orchestrator:v1";

function fmt(ts) {
  try {
    const d = new Date(ts);
    return isNaN(d) ? "" : d.toLocaleString();
  } catch { return ""; }
}

export default function ReportNotification() {
  const [feed, setFeed] = useState([]);

  const push = useCallback((kind, msg) => {
    setFeed((prev) => [{ ts: Date.now(), kind, msg }, ...prev].slice(0, 300));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s?.currentStage) push("note", `Loaded state: ${s.currentStage}`);
    } catch {}
  }, [push]);

  useEffect(() => {
    window.reportNotify = { log: (msg, kind = "note") => push(kind, msg) };
    return () => { if (window.reportNotify) delete window.reportNotify; };
  }, [push]);

  useEffect(() => {
    const on = (ev, fn) => (window.addEventListener(ev, fn), () => window.removeEventListener(ev, fn));

    const off1 = on("pilot:kpiRefreshed", () => push("kpi", "KPIs refreshed."));
    const off2 = on("pilot:sandboxResultsUpdated", (e) => {
      const d = e?.detail || {};
      if (Number.isFinite(d.total) && d.total > 0) {
        const pct = Math.round(((d.success || 0) / d.total) * 100);
        push("kpi", `Sandbox results: ${pct}% (${d.success}/${d.total})${d.actionId ? ` • Action #${d.actionId}` : ""}.`);
      } else {
        push("kpi", "Sandbox results updated.");
      }
    });
    const off3 = on("pilot:criticalHealthUpdated", (e) => {
      const c = Number(e?.detail?.count || 0);
      push(c > 0 ? "warn" : "ok", `Critical health failures: ${c}.`);
    });
    const off4 = on("pilot:kpiCountsUpdated", (e) => {
      const d = e?.detail || {};
      push("kpi", `Reboot pending: ${d.reboot ?? 0}, Error 1603: ${d.error1603 ?? 0}.`);
    });
    const off5 = on("pilot:triggered", (e) => {
      const id = e?.detail?.actionId;
      push("act", `Pilot triggered${id ? ` • Action #${id}` : ""}.`);
    });
    const off6 = on("production:triggered", (e) => {
      const id = e?.detail?.actionId;
      push("act", `Production triggered${id ? ` • Action #${id}` : ""}.`);
    });
    const off7 = on("flow:navigate", (e) => {
      const st = String(e?.detail?.stage || "").toUpperCase();
      if (st) push("nav", `Mapsd to ${st}.`);
    });
    const off8 = on("orchestrator:resetToSandbox", () => {
      push("danger", "Reset to Sandbox requested.");
    });

    return () => { off1(); off2(); off3(); off4(); off5(); off6(); off7(); off8(); };
  }, [push]);

  return (
    <section className="card reveal" data-reveal>
      <h2>Reports &amp; Notifications</h2>
      <div className="tableWrap rn-table-wrap">
        <table>
          <thead>
            <tr><th className="rn-th-when">When</th><th>Message</th></tr>
          </thead>
          <tbody>
            {feed.length === 0 ? (
              <tr><td colSpan={2} className="rn-td-empty">Waiting for events…</td></tr>
            ) : (
              feed.map((r, i) => (
                <tr key={i}>
                  <td className="rn-td-nowrap">{fmt(r.ts)}</td>
                  <td>
                    <span className={"rowchip " + (r.kind === "ok" ? "succ" : r.kind === "warn" ? "warn" : r.kind === "danger" ? "hf" : r.kind === "act" ? "pri" : "muted")}>
                      {r.msg}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}