// frontend/src/components/DecisionEngine.jsx
import { useState } from "react";
import { useEnvironment } from "./Environment.jsx"; 

export default function DecisionEngine({
  apiBase = window.env.VITE_API_BASE,
  baseline = "",
  group = "",
  autoMail = false,
  onDone = () => {},
  disabled = false,
  username, // <--- NEW: Accept Username
}) {
  const { env } = useEnvironment();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // --- Validation State ---
  const [checkingBaseline, setCheckingBaseline] = useState(false);
  const [baselineWarning, setBaselineWarning] = useState(null);

  // Helper to check baseline times via Backend
  async function checkBaselineStatus() {
    if (!baseline) return null;
    try {
      const resp = await fetch(`${apiBase.replace(/\/+$/, "")}/api/baseline/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baselineName: baseline })
      });
      
      if (resp.ok) {
        const j = await resp.json();
        if (j.modified) {
          return j.warning;
        }
      }
    } catch (e) {
      console.warn("Baseline validation error:", e);
    }
    return null;
  }

  async function executeTrigger() {
    if (disabled || busy) return;
    
    setShowConfirmModal(false);
    setBusy(true);
    setStatus("");

    try {
      const url = `${apiBase.replace(/\/+$/, "")}/api/actions`;

      const payload = {
        baselineName: baseline,
        groupName: group,
        autoMail: !!autoMail,
        triggeredBy: username, // <--- NEW: Send Username in payload
        patchWindow: {
          days: env.patchWindowDays || 0,
          hours: env.patchWindowHours || 0,
          minutes: env.patchWindowMinutes || 0,
        }
      };

      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await resp.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { ok: false, raw: text };
      }

      if (!resp.ok || data.ok === false) {
        const msg =
          data?.error ||
          data?.message ||
          `HTTP ${resp.status}${text ? `: ${text.slice(0, 300)}` : ""}`;
        setStatus(`Failed to trigger sandbox: ${msg}`);
        onDone({ ok: false, error: msg });
        return;
      }

      let successMsg = "Sandbox trigger sent successfully.";
      if (data.preMailError) {
        successMsg += `\n(Email failed: ${data.preMailError})`;
      }
      setStatus(successMsg);
      onDone({ ok: true, ...data }); 

    } catch (err) {
      const msg = (err && err.message) || String(err);
      setStatus(`Failed to trigger sandbox: ${msg}`);
      onDone({ ok: false, error: msg });
    } finally {
      setBusy(false);
    }
  }

  const isDisabled = disabled || busy || !baseline || !group;

  // --- Click handler with validation ---
  async function handleTriggerClick() {
    if (isDisabled) return;
    
    setCheckingBaseline(true);
    setBaselineWarning(null);
    
    // Check validation via backend before showing modal
    const warning = await checkBaselineStatus();
    if (warning) setBaselineWarning(warning);
    
    setCheckingBaseline(false);
    setShowConfirmModal(true);
  }

  return (
    <>
      <section className="card reveal" id="card-decision" data-reveal>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2>Decision Engine</h2>
          <button
            type="button"
            className="btn pri"
            onClick={handleTriggerClick}
            disabled={isDisabled || checkingBaseline}
            title={
              disabled 
                ? "Sandbox completed - view only mode" 
                : isDisabled ? "Select a baseline and group first" : "Trigger Sandbox"
            }
          >
            {busy ? "Triggering…" : checkingBaseline ? "Checking..." : "Trigger Sandbox"}
          </button>
        </div>

        <div className="sub" style={{ marginTop: 10 }}>
          {disabled && (
            <span style={{ marginLeft: 10 }} className="pill blue">View Only</span>
          )}
        </div>

        {status && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--panel-2)",
              whiteSpace: "pre-wrap",
            }}
          >
            {status}
          </div>
        )}

        <div className="sub" style={{ marginTop: 14 }}>
          Sandbox → Pilot → Production. Trigger Pilot only in Pilot stage. Promote after Evaluate.
        </div>
      </section>

      {/* --- Confirmation Modal --- */}
      {showConfirmModal && (
        <div className="modal show" role="dialog" aria-modal="true">
          <div className="box" style={{ maxWidth: 520 }}>
            <h3 style={{color: 'var(--primary, #2563eb)'}}>Confirm Sandbox Action</h3>
            
            {/* --- Warning Banner --- */}
            {baselineWarning && (
              <div className="banner error" style={{ marginBottom: 16, fontSize: 13, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', padding: '10px', borderRadius: '8px' }}>
                <strong>⚠️ Baseline Modified</strong>
                <div style={{ marginTop: 4 }}>{baselineWarning}</div>
              </div>
            )}

            <div className="sub" style={{ fontSize: 14, lineHeight: 1.6, margin: '16px 0' }}>
              You are about to trigger the baseline:
              <br />
              <strong>{baseline || "N/A"}</strong>
              <br />
              <br />
              This action will target the group:
              <br />
              <strong>{group || "N/A"}</strong>
            </div>
            
            <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
              <button type="button" className="btn" onClick={() => setShowConfirmModal(false)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="btn pri" onClick={executeTrigger} disabled={busy}>
                {busy ? "Triggering..." : "Confirm & Trigger"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}