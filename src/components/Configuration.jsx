// src/components/Configuration.jsx
import { useEffect, useState, useRef } from "react";
import { useEnvironment } from "./Environment.jsx";

const API_BASE = window.env.VITE_API_BASE;

/* --- Helpers --- */
async function getJSON(url, signal) {
  const r = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store", signal });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 400)}`);
  return JSON.parse(t);
}

async function postJSON(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { throw new Error(`Unexpected response: ${t.slice(0, 400)}`); }
  if (!r.ok || j?.ok === false) throw new Error(j?.error || j?.message || `HTTP ${r.status}`);
  return j;
}

function ensureFxStyles() {
  if (document.getElementById("fx-select-styles")) return;
  const css = `
  .fx-wrap { position: relative; display: block; width: 100%; min-width: 0; }
  .fx-trigger {
    width: 100%; height: 46px; border-radius: 12px; border: 1px solid var(--border,#e2e8f0);
    background: var(--panel,#fff); padding: 0 16px; display: flex; align-items: center; justify-content: space-between;
    font: inherit; cursor: pointer; transition: all .2s ease; color: var(--text); font-size: 14px;
    white-space: nowrap; overflow: hidden;
  }
  .fx-trigger:hover { border-color: #cbd5e1; }
  .fx-trigger:focus { outline: 0; border-color: var(--primary,#3b82f6); box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
  .fx-wrap.fx-open .fx-trigger { border-color: var(--primary,#3b82f6); }
  .fx-menu {
    position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 9999; display: none;
    background: var(--panel,#fff); border: 1px solid var(--border,#e2e8f0);
    border-radius: 12px; box-shadow: 0 10px 40px -5px rgba(0,0,0,0.2);
    max-height: 240px; overflow-y: auto; animation: fxSlide .15s ease-out;
  }
  @keyframes fxSlide { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
  .fx-wrap.fx-open .fx-menu { display: block; }
  .fx-menu-inner { padding: 6px; }
  .fx-item {
    padding: 10px 12px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between;
    cursor: pointer; font-size: 14px; color: var(--text); transition: background .1s;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .fx-item.fx-empty { cursor: default; color: #94a3b8; justify-content: center; font-style: italic; }
  .fx-item:hover, .fx-item.fx-hover { background: #f1f5f9; }
  .fx-item.fx-active { background: #eff6ff; color: #2563eb; font-weight: 600; }
  .fx-tick { font-weight: bold; font-size: 14px; margin-left: 8px; flex-shrink: 0; }
  `;
  const style = document.createElement("style");
  style.id = "fx-select-styles";
  style.textContent = css;
  document.head.appendChild(style);
}

function enhanceNativeSelect(selectEl) {
  if (!selectEl || selectEl.dataset.fx === "ok") return;
  ensureFxStyles();
  selectEl.dataset.fx = "ok";
  selectEl.style.display = "none";
  const wrap = document.createElement("div");
  wrap.className = "fx-wrap";
  selectEl.parentNode.insertBefore(wrap, selectEl);
  wrap.appendChild(selectEl);
  const getLabel = () => {
    const opt = selectEl.options[selectEl.selectedIndex];
    return opt ? opt.text : "— select —";
  };
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "fx-trigger";
  trigger.innerHTML = `<span class="fx-value" style="overflow:hidden;text-overflow:ellipsis;">${getLabel()}</span><span class="fx-chevron" style="opacity:0.5;font-size:12px;">▼</span>`;
  wrap.insertBefore(trigger, selectEl);
  const menu = document.createElement("div");
  menu.className = "fx-menu";
  const menuInner = document.createElement("div");
  menuInner.className = "fx-menu-inner";
  menu.appendChild(menuInner);
  wrap.appendChild(menu);
  const allOptions = Array.from(selectEl.querySelectorAll("option"));
  const itemsOnly = () => allOptions.filter(o => !o.disabled && o.value !== "");
  let hoverIdx = -1;
  function renderMenu() {
    menuInner.innerHTML = "";
    const real = itemsOnly();
    if (!real.length) {
      menuInner.innerHTML = `<div class="fx-item fx-empty">No options</div>`;
      return;
    }
    real.forEach((option, i) => {
      const it = document.createElement("div");
      const active = option.selected;
      it.className = "fx-item" + (active ? " fx-active" : "");
      it.innerHTML = `<span class="fx-label">${option.textContent}</span>${active ? "<span class='fx-tick'>✓</span>" : ""}`;
      it.onclick = () => commit(i);
      menuInner.appendChild(it);
    });
  }
  function open() {
    if (wrap.classList.contains("fx-open")) return;
    wrap.classList.add("fx-open");
    renderMenu();
    document.addEventListener("mousedown", onDocDown);
  }
  function close() {
    wrap.classList.remove("fx-open");
    document.removeEventListener("mousedown", onDocDown);
  }
  function onDocDown(e) { if (!wrap.contains(e.target)) close(); }
  function commit(i) {
    const real = itemsOnly();
    if (!real[i]) return;
    allOptions.forEach(o => o.selected = false);
    real[i].selected = true;
    selectEl.value = real[i].value;
    trigger.querySelector(".fx-value").textContent = real[i].textContent;
    close();
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  }
  trigger.onclick = (e) => { e.stopPropagation(); wrap.classList.contains("fx-open") ? close() : open(); };
}

function enhanceNativeSelects(root = document) {
  if (!root) return;
  root.querySelectorAll("select.control").forEach(enhanceNativeSelect);
}

function Switch({ checked, onChange, label, subLabel, disabled }) {
  return (
    <div className={`switch-row ${disabled ? "disabled" : ""}`}>
      <div className="switch-text">
        <div className="switch-label">{label}</div>
        {subLabel && <div className="switch-sub">{subLabel}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        className={`switch-toggle ${checked ? "on" : "off"}`}
        disabled={disabled}
      >
        <div className="knob" />
      </button>
    </div>
  );
}

function Section({ title, children, icon }) {
  return (
    <div className="config-section">
      <div className="section-header">
        {icon && <span className="section-icon">{icon}</span>}
        <h3>{title}</h3>
      </div>
      <div className="section-body">{children}</div>
    </div>
  );
}

export default function Configuration({ onSaved, locked = false }) {
  const { env, setEnv } = useEnvironment();
  const [disk, setDisk] = useState(10);
  const [lastReportValue, setLastReportValue] = useState(10);
  const [lastReportUnit, setLastReportUnit] = useState("days");
  const [requireChg, setRequireChg] = useState(true);
  const [checkService, setCheckService] = useState(false);
  const [cloneVM, setCloneVM] = useState(false);
  const [snapshotVM, setSnapshotVM] = useState(false);
  
  // Local State for Stage Toggles
  const [enableSandbox, setEnableSandbox] = useState(true);
  const [enablePilot, setEnablePilot] = useState(true);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const configRef = useRef(null);

  const role = sessionStorage.getItem("user_role") || "Admin";
  const isLinux = role === "Linux";
  const isEUC = role === "EUC";
  const isAdmin = role === "Admin";

  const handleNumChange = (setter) => (e) => {
    const val = e.target.value;
    if (val === "") setter(""); 
    else setter(Number(val)); 
  };
  const handleBlur = (val, setter, min, max) => {
    let num = Number(val);
    if (!Number.isFinite(num) || val === "") num = min;
    num = Math.min(max, Math.max(min, num));
    setter(num);
  };

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const j = await getJSON(`${API_BASE}/api/config`, controller.signal);
        if (typeof j?.diskThresholdGB === "number") setDisk(j.diskThresholdGB);
        if (typeof j?.requireChg === "boolean") setRequireChg(j.requireChg);
        if (typeof j?.checkServiceStatus === "boolean") setCheckService(j.checkServiceStatus);
        setCloneVM(Boolean(j?.cloneVM));
        setSnapshotVM(Boolean(j?.snapshotVM));
        
        if (typeof j?.enableSandbox === "boolean") setEnableSandbox(j.enableSandbox);
        if (typeof j?.enablePilot === "boolean") setEnablePilot(j.enablePilot);

        setEnv(f => ({ 
            ...f, 
            autoMail: j.autoMail, 
            postMail: j.postMail, 
            cloneVM: Boolean(j?.cloneVM), 
            snapshotVM: Boolean(j?.snapshotVM),
            enableSandbox: j.enableSandbox ?? true, 
            enablePilot: j.enablePilot ?? true      
        }));
        
        if (typeof j?.lastReportValue === "number") setLastReportValue(j.lastReportValue);
        if (typeof j?.lastReportUnit  === "string") setLastReportUnit(j.lastReportUnit);
      } catch (e) { setErr(e.message || String(e)); } finally { setTimeout(() => enhanceNativeSelects(configRef.current), 100); }
    })();
    return () => controller.abort();
  }, [setEnv]);

  async function save() {
    if (busy || locked) return;
    setBusy(true); setErr("");
    const diskSafe = Math.max(0, Number(disk) || 0);
    const lastSafe = Math.max(0, Number(lastReportValue) || 0);
    
    // Prepare new config object
    const newConfigValues = {
        diskThreshold: diskSafe,
        requireChg: Boolean(requireChg),
        prePatchMail:  !!env.autoMail,  
        postPatchMail: !!env.postMail,
        checkServiceStatus: Boolean(checkService),
        cloneVM: Boolean(cloneVM),
        snapshotVM: Boolean(snapshotVM),
        enableSandbox: Boolean(enableSandbox),
        enablePilot: Boolean(enablePilot),
        lastReportValue: lastSafe,
        lastReportUnit: String(lastReportUnit),
    };

    try {
      await postJSON(`${API_BASE}/api/config`, newConfigValues);
      
      // Update Context
      setEnv(f => ({ 
          ...f, 
          cloneVM: Boolean(cloneVM), 
          snapshotVM: Boolean(snapshotVM),
          enableSandbox: Boolean(enableSandbox),
          enablePilot: Boolean(enablePilot)
      }));

      // FIX: Pass the NEW config values directly to parent handler
      // This prevents the parent from reading stale 'env' values
      onSaved?.({
          enableSandbox: Boolean(enableSandbox),
          enablePilot: Boolean(enablePilot)
      });

    } catch (e) { setErr(e.message || String(e)); } finally { setBusy(false); }
  }

  return (
    <section className="config-container card reveal" data-reveal ref={configRef}>
      <div className="header-row">
        <div><h2>Environment Configuration</h2><p className="subtitle">Configure critical health checks, notification rules, and process gates.</p></div>
        {locked && <div className="badge locked">🔒 Configuration Locked</div>}
      </div>
      {err && <div className="banner error">{err}</div>}
      <div className="config-grid">
        <Section title="Health Thresholds" icon="🩺">
          <div className="field-group">
            <div className="field">
              <label>Minimum Disk Space (GB)</label>
              <input type="number" min="0" className="control input-modern" value={disk} onChange={handleNumChange(setDisk)} onBlur={() => handleBlur(disk, setDisk, 0, 1000)} disabled={locked} placeholder="e.g. 10" />
              <div className="help-text">Servers below this limit will fail health checks.</div>
            </div>
            <div className="field">
              <label>Last Report Time Threshold</label>
              <div className="input-combo">
                <div style={{ flex: 1 }}><input type="number" min="0" className="control input-modern" value={lastReportValue} onChange={handleNumChange(setLastReportValue)} onBlur={() => handleBlur(lastReportValue, setLastReportValue, 0, 365)} disabled={locked} /></div>
                <div style={{ flex: 1.5, minWidth: '140px' }}><select value={lastReportUnit} onChange={(e) => setLastReportUnit(e.target.value)} disabled={locked} className="control"><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select></div>
              </div>
              <div className="help-text">Max time allowed since last BigFix report.</div>
            </div>
            {!isLinux && <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}><Switch checked={checkService} onChange={setCheckService} label="Check Window Update Service" subLabel="Fail health check if 'wuauserv' is not running." disabled={locked} /></div>}
          </div>
        </Section>
        <Section title="Process Gates & Controls" icon="⚙️">
          <Switch checked={requireChg} onChange={setRequireChg} label="ITSM Change Required" subLabel="Validate CHG status at 'Implement' stage before proceeding." disabled={locked} />
          
          {/* FIX: HIDE CLONE & SNAPSHOT FOR EUC ROLE */}
          {!isEUC && (
            <>
              <Switch checked={cloneVM} onChange={setCloneVM} label="Clone VM" subLabel="Create a full clone of the VM before patching." disabled={locked} />
              <Switch checked={snapshotVM} onChange={setSnapshotVM} label="Snapshot VM" subLabel="Trigger a VM snapshot for quick rollback capability." disabled={locked} />
              
              {/* --- Sandbox/Pilot Toggles (Admin Only) --- */}
              <div style={{marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16}}>
                 <Switch 
                   checked={enableSandbox} 
                   onChange={setEnableSandbox} 
                   label="Enable Sandbox Stage" 
                   subLabel="Include Sandbox verification in the patch workflow." 
                   disabled={locked || !isAdmin} 
                 />
                 <Switch 
                   checked={enablePilot} 
                   onChange={setEnablePilot} 
                   label="Enable Pilot Stage" 
                   subLabel="Include Pilot group deployment in the patch workflow." 
                   disabled={locked || !isAdmin} 
                 />
                 {!isAdmin && <div style={{fontSize:12, color:'#94a3b8', marginTop:6}}>Only Administrators can modify workflow stages.</div>}
              </div>
            </>
          )}
        </Section>
        <Section title="Notifications" icon="📬">
          <Switch checked={!!env.autoMail} onChange={(val) => setEnv(f => ({ ...f, autoMail: val }))} label="Pre-Patch Notifications" subLabel="Email stakeholders when a new patch cycle is triggered." disabled={locked} />
          <Switch checked={!!env.postMail} onChange={(val) => setEnv(f => ({ ...f, postMail: val }))} label="Post-Patch Report" subLabel="Email results summary after action completion." disabled={locked} />
        </Section>
      </div>
      <div className="footer-actions">
        <button className="btn secondary" disabled={locked} onClick={() => { if(!locked) { setDisk(10); setRequireChg(true); setCheckService(false); setCloneVM(false); setSnapshotVM(false); setEnableSandbox(true); setEnablePilot(true); setLastReportValue(10); setLastReportUnit("days"); setEnv(f => ({ ...f, autoMail: false, postMail: false })); } }}>Reset to Defaults</button>
        <button className="btn primary" onClick={save} disabled={busy || locked}>{busy ? "Saving Settings..." : "Save Configuration"}</button>
      </div>
      <style>{`
        .config-container { padding: 24px; margin-bottom: 24px; overflow: visible !important; }
        .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
        h2 { font-size: 22px; font-weight: 700; color: var(--text); margin: 0 0 6px 0; }
        .subtitle { font-size: 15px; color: var(--muted); margin: 0; }
        .badge.locked { background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .config-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; margin-bottom: 32px; align-items: start; }
        .config-section { background: transparent; border: 1px solid var(--border); border-radius: 12px; overflow: visible; display: flex; flex-direction: column; height: 100%; }
        .section-header { padding: 14px 18px; background: var(--panel-2); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; border-radius: 11px 11px 0 0; }
        .section-icon { font-size: 18px; line-height: 1; }
        .section-header h3 { font-size: 14px; font-weight: 700; margin: 0; text-transform: uppercase; color: var(--text); letter-spacing: 0.5px; }
        .section-body { padding: 20px; display: flex; flex-direction: column; gap: 20px; flex: 1; }
        .field-group { display: flex; flex-direction: column; gap: 20px; }
        .field label { display: block; font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 8px; }
        .input-modern { width: 100%; height: 46px; border: 1px solid var(--border); border-radius: 12px; padding: 0 14px; font-size: 14px; transition: all 0.2s; background: #fff; color: var(--text); }
        .input-modern:focus { border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent); outline: none; }
        .input-combo { display: flex; gap: 12px; width: 100%; }
        .help-text { font-size: 12px; color: var(--muted); margin-top: 8px; line-height: 1.5; }
        .switch-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 4px 0; }
        .switch-row.disabled { opacity: 0.6; pointer-events: none; }
        .switch-text { flex: 1; padding-top: 2px; }
        .switch-label { font-size: 14px; font-weight: 600; color: var(--text); line-height: 1.4; }
        .switch-sub { font-size: 12px; color: var(--muted); margin-top: 4px; line-height: 1.4; }
        .switch-toggle { width: 44px; height: 24px; border-radius: 20px; border: none; cursor: pointer; position: relative; transition: background 0.2s; flex-shrink: 0; padding: 0; margin-top: 2px; }
        .switch-toggle.off { background: #cbd5e1; }
        .switch-toggle.on { background: var(--primary); }
        .switch-toggle .knob { width: 20px; height: 20px; background: #fff; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .switch-toggle.on .knob { transform: translateX(20px); }
        .footer-actions { display: flex; justify-content: flex-end; gap: 12px; padding-top: 24px; border-top: 1px solid var(--border); }
        .btn { height: 44px; padding: 0 24px; border-radius: 12px; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all 0.2s; font-size: 14px; }
        .btn.primary { background: var(--primary); color: #fff; box-shadow: 0 4px 12px -2px color-mix(in srgb, var(--primary) 40%, transparent); }
        .btn.primary:hover { transform: translateY(-1px); filter: brightness(110%); }
        .btn.secondary { background: #fff; border-color: var(--border); color: var(--text); }
        .btn.secondary:hover { background: var(--panel-2); border-color: #cbd5e1; }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
        .banner { padding: 14px; border-radius: 12px; margin-bottom: 24px; font-size: 14px; font-weight: 500; }
        .banner.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        @media (max-width: 768px) { .config-grid { grid-template-columns: 1fr; } .header-row { flex-direction: column; gap: 12px; } .config-container { padding: 16px; } }
      `}</style>
    </section>
  );
}