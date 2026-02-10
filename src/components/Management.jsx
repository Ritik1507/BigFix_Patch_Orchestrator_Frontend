// vite-project/src/components/Management.jsx
import { useEffect, useMemo, useRef, useState } from "react";

const API = window.env.VITE_API_BASE;

/* ---- Required: ONLY BigFix ---- */
const REQUIRED_KEYS = new Set([
  "BIGFIX_BASE_URL",
  "BIGFIX_USER",
  "BIGFIX_PASS",
]);

/* ---- Friendly labels ---- */
const LABELS = {
  BIGFIX_BASE_URL:          "BIGFIX BASE URL",
  BIGFIX_USER:              "BIGFIX API USERNAME",
  BIGFIX_PASS:              "BIGFIX API PASSWORD",
  BIGFIX_ALLOW_SELF_SIGNED: "BIGFIX ALLOW SELF SIGNED",

  SMTP_HOST:                "SMTP HOST",
  SMTP_USER:                "SMTP USERNAME",
  SMTP_PASSWORD:            "SMTP PASSWORD",
  SMTP_FROM:                "EMAIL FROM",
  SMTP_TO:                  "EMAIL TO",
  SMTP_CC:                  "EMAIL CC",
  SMTP_BCC:                 "EMAIL BCC",
  SMTP_PORT:                "SMTP PORT",
  SMTP_SECURE:              "SMTP SECURE",
  SMTP_ALLOW_SELF_SIGNED:   "SMTP ALLOW SELF SIGNED",

  SN_URL:                   "SERVICENOW URL",
  SN_USER:                  "SERVICENOW USERNAME",
  SN_PASSWORD:              "SERVICENOW PASSWORD",
  SN_ALLOW_SELF_SIGNED:     "SERVICENOW ALLOW SELF SIGNED",

  VCENTER_URL:              "VCENTER URL",
  VCENTER_USER:             "VCENTER USERNAME",
  VCENTER_PASSWORD:         "VCENTER PASSWORD",
  VCENTER_ALLOW_SELF_SIGNED:"VCENTER ALLOW SELF SIGNED",

  // LDAP Labels
  LDAP_ENABLED:             "ENABLE DIRECTORY SERVICES",
  LDAP_URL:                 "LDAP URL",
  LDAP_DOMAIN:              "LDAP DOMAIN",
  LDAP_ALLOW_SELF_SIGNED:   "LDAP ALLOW SELF SIGNED",

  DEBUG_LOG:                "DEBUG LEVEL",
};

/* ---- Template ---- */
const TEMPLATE = [
  // BIGFIX (Required)
  { key: "BIGFIX_BASE_URL",            value: "",      type: "string",  secret: false, hint: "https://server:52311", required: true },
  { key: "BIGFIX_USER",                value: "",      type: "string",  secret: false, hint: "e.g. bigfix",          required: true },
  { key: "BIGFIX_PASS",                value: "",      type: "string",  secret: true,  hint: "",                     required: true },
  { key: "BIGFIX_ALLOW_SELF_SIGNED",   value: "false", type: "boolean", secret: false, hint: "Allow self-signed" },

  // LDAP (Optional)
  { key: "LDAP_ENABLED",               value: "false", type: "boolean", secret: false, hint: "Authenticate via Active Directory" },
  { key: "LDAP_URL",                   value: "",      type: "string",  secret: false, hint: "ldaps://dc.example.com:636" }, // <--- UPDATED HINT
  { key: "LDAP_DOMAIN",                value: "",      type: "string",  secret: false, hint: "example.com" },
  { key: "LDAP_ALLOW_SELF_SIGNED",     value: "false", type: "boolean", secret: false, hint: "Disable SSL validation (internal)" },

  // SMTP (Optional)
  { key: "SMTP_HOST",                  value: "",      type: "string",  secret: false, hint: "smtp.domain.com" },
  { key: "SMTP_USER",                  value: "",      type: "string",  secret: false, hint: "" },
  { key: "SMTP_PASSWORD",              value: "",      type: "string",  secret: true,  hint: "" },
  { key: "SMTP_FROM",                  value: "",      type: "string",  secret: false, hint: "noreply@domain.com" },
  { key: "SMTP_TO",                    value: "",      type: "string",  secret: false, hint: "comma-separated" },
  { key: "SMTP_PORT",                  value: "25",    type: "enum",    secret: false, hint: "", options: ["25","465","587"] },
  { key: "SMTP_SECURE",                value: "false", type: "boolean", secret: false, hint: "Use TLS/SSL" },
  { key: "SMTP_CC",                    value: "",      type: "string",  secret: false, hint: "" },
  { key: "SMTP_BCC",                   value: "",      type: "string",  secret: false, hint: "" },
  { key: "SMTP_ALLOW_SELF_SIGNED",     value: "false", type: "boolean", secret: false, hint: "" },

  // ServiceNow (Optional)
  { key: "SN_URL",                     value: "",      type: "string",  secret: false, hint: "https://instance.service-now.com" },
  { key: "SN_USER",                    value: "",      type: "string",  secret: false, hint: "" },
  { key: "SN_PASSWORD",                value: "",      type: "string",  secret: true,  hint: "" },
  { key: "SN_ALLOW_SELF_SIGNED",       value: "false", type: "boolean", secret: false, hint: "" },

  // VCenter (Optional)
  { key: "VCENTER_URL",                value: "",      type: "string",  secret: false, hint: "https://vcenter.domain.com" },
  { key: "VCENTER_USER",               value: "",      type: "string",  secret: false, hint: "user@vsphere.local" },
  { key: "VCENTER_PASSWORD",           value: "",      type: "string",  secret: true,  hint: "" },
  { key: "VCENTER_ALLOW_SELF_SIGNED",  value: "false", type: "boolean", secret: false, hint: "" },

  // DEBUG (Optional)
  { key: "DEBUG_LOG",                  value: "0",     type: "enum-map", secret: false, hint: "",
    options: [
      { value: "0", label: "Info" },
      { value: "1", label: "Debug" },
    ]
  },
];

/* ---------- UI bits ---------- */
function Switch({ checked, onChange, id, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      onClick={() => onChange(!checked)}
      className={`sw ${checked ? "on" : ""}`}
      title={checked ? "On" : "Off"}
      disabled={disabled}
    >
      <span className="knob" />
    </button>
  );
}

function Select({ value, options, onChange, placeholder, disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const getLabel = (opt) => (typeof opt === "string" ? opt : (opt?.label ?? opt?.value ?? ""));
  const getValue = (opt) => (typeof opt === "string" ? opt : (opt?.value ?? ""));

  const label = (() => {
    const match = (options || []).find(o => getValue(o) === value);
    return match ? getLabel(match) : (placeholder || "Select");
  })();

  return (
    <div ref={ref} className={`select ${open ? "open" : ""}`}>
      <button 
        type="button" 
        className="select-btn" 
        onClick={() => setOpen(o=>!o)} 
        aria-haspopup="listbox" 
        aria-expanded={open}
        disabled={disabled}
      >
        <span>{label}</span>
        <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden><path d="M5 7l5 6 5-6" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
      </button>
      {open && (
        <ul className="menu" role="listbox">
          {(options || []).map((opt, idx) => {
            const v = getValue(opt);
            const l = getLabel(opt);
            const sel = v === value;
            return (
              <li
                key={`${v}-${idx}`}
                role="option"
                aria-selected={sel}
                className={`item ${sel ? "sel" : ""}`}
                onClick={() => { onChange(v); setOpen(false); }}
              >
                {l}
                {sel && <span className="tick">✓</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Field({ item, value, onChange, invalid, disabled = false }) {
  const [show, setShow] = useState(false);
  const isBool   = item.type === "boolean";
  const isEnum   = item.type === "enum";
  const isEnumMap= item.type === "enum-map";
  const isNum    = item.type === "number";
  const isSecret = item.secret;
  const val = value ?? item.value ?? "";

  return (
    <div className={`field ${invalid ? "invalid" : ""}`}>
      <div className="meta">
        <label htmlFor={item.key}>
          {LABELS[item.key] ?? item.key}{REQUIRED_KEYS.has(item.key) ? <span className="req">*</span> : null}
        </label>
        {item.hint ? <div className="hint">{item.hint}</div> : null}
      </div>

      {isBool ? (
        <Switch
          id={item.key}
          checked={String(val).toLowerCase() === "true"}
          onChange={(next) => onChange(item.key, next ? "true" : "false")}
          disabled={disabled}
        />
      ) : (isEnum || isEnumMap) ? (
        <div className="inputwrap">
          <Select
            value={val}
            options={item.options || []}
            onChange={(v) => onChange(item.key, v)}
            placeholder=""
            disabled={disabled}
          />
          {item.key === "DEBUG_LOG" && (
            <button
              type="button"
              className="ghost tiny"
              onClick={() => onChange(item.key, val === "1" ? "0" : "1")}
              title="Toggle Info/Debug"
              disabled={disabled}
            >
              {val === "1" ? "Debug" : "Info"}
            </button>
          )}
        </div>
      ) : (
        <div className="inputwrap">
          <input
            id={item.key}
            type={isSecret && !show ? "password" : (isNum ? "number" : "text")}
            placeholder={item.hint || ""}
            value={val}
            onChange={(e) => onChange(item.key, e.target.value)}
            autoComplete="off"
            disabled={disabled}
          />
          {isSecret && (
            <button type="button" className="ghost tiny" onClick={() => setShow(s => !s)} disabled={disabled}>
              {show ? "Hide" : "Show"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function isEmail(x) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(x).trim()); }
function listValidEmails(s) {
  if (!s) return true;
  return String(s).split(",").map(v => v.trim()).filter(Boolean).every(isEmail);
}

export default function Management({ onClose }) {
  const [values, setValues] = useState({});
  const [originalValues, setOriginalValues] = useState({});
  const [editingSection, setEditingSection] = useState(null); 
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const sections = useMemo(() => {
    const ord = {
      BIGFIX_: ["BIGFIX_BASE_URL","BIGFIX_USER","BIGFIX_PASS","BIGFIX_ALLOW_SELF_SIGNED"],
      LDAP_:   ["LDAP_ENABLED", "LDAP_URL", "LDAP_DOMAIN", "LDAP_ALLOW_SELF_SIGNED"], // <--- LDAP Order
      SMTP_:   ["SMTP_HOST","SMTP_USER","SMTP_PASSWORD","SMTP_FROM","SMTP_TO","SMTP_PORT","SMTP_SECURE","SMTP_CC","SMTP_BCC","SMTP_ALLOW_SELF_SIGNED"],
      SN_:     ["SN_URL","SN_USER","SN_PASSWORD","SN_ALLOW_SELF_SIGNED"],
      VCENTER_:["VCENTER_URL", "VCENTER_USER", "VCENTER_PASSWORD", "VCENTER_ALLOW_SELF_SIGNED"],
      DEBUG_:  ["DEBUG_LOG"]
    };
    const pick = (pfx) => {
      const arr = TEMPLATE.filter(i => i.key.startsWith(pfx));
      const o = ord[pfx] || [];
      return arr.sort((a,b) => o.indexOf(a.key) - o.indexOf(b.key));
    };
    return {
      BIGFIX: pick("BIGFIX_"),
      LDAP:   pick("LDAP_"), // <--- LDAP Section
      SMTP:   pick("SMTP_"),
      SN:     pick("SN_"),
      VCENTER:pick("VCENTER_"),
      DEBUG:  pick("DEBUG_"),
    };
  }, []);

  // Validation Checkers
  const smtpTouched = useMemo(() => {
    const keys = ["SMTP_HOST","SMTP_USER","SMTP_PASSWORD","SMTP_FROM","SMTP_TO","SMTP_CC","SMTP_BCC"];
    return keys.some(k => (values[k] ?? "").toString().trim() !== "");
  }, [values]);

  const vcenterTouched = useMemo(() => {
    const keys = ["VCENTER_URL", "VCENTER_USER", "VCENTER_PASSWORD"];
    return keys.some(k => (values[k] ?? "").toString().trim() !== "");
  }, [values]);

  const ldapEnabled = useMemo(() => {
    return String(values["LDAP_ENABLED"] ?? "false").toLowerCase() === "true";
  }, [values]);

  const invalidMap = useMemo(() => {
    const m = {};
    for (const it of TEMPLATE) {
      if (REQUIRED_KEYS.has(it.key)) {
        if (it.secret && editingSection !== 'BIGFIX') { m[it.key] = false; continue; }
        const v = (values[it.key] ?? it.value ?? "").toString().trim();
        m[it.key] = v === "";
      }
    }

    if (smtpTouched) {
      const from = (values.SMTP_FROM ?? "").trim();
      const host = (values.SMTP_HOST ?? "").trim();
      m.SMTP_HOST = host === "";
      m.SMTP_FROM = !isEmail(from);
      m.SMTP_TO   = !listValidEmails(values.SMTP_TO);
    }

    if (vcenterTouched) {
      m.VCENTER_URL = (values.VCENTER_URL ?? "").trim() === "";
    }

    // LDAP Validation: Required only if Enabled
    if (ldapEnabled) {
        const url = (values.LDAP_URL ?? "").trim();
        const dom = (values.LDAP_DOMAIN ?? "").trim();
        m.LDAP_URL = url === "";
        m.LDAP_DOMAIN = dom === "";
    }

    return m;
  }, [values, smtpTouched, vcenterTouched, ldapEnabled, editingSection]);

  const validationMap = {
    BIGFIX: sections.BIGFIX.every(it => !invalidMap[it.key]),
    LDAP:   sections.LDAP.every(it => !invalidMap[it.key]), // <--- LDAP Valid?
    SMTP:   sections.SMTP.every(it => !(smtpTouched ? invalidMap[it.key] : false)),
    SN:     true,
    VCENTER:sections.VCENTER.every(it => !(vcenterTouched ? invalidMap[it.key] : false)),
    DEBUG:  true,
  };

  async function fetchEnv() {
    setMsg(""); setLoading(true);
    try {
      const r = await fetch(`${API}/api/env`);
      const j = await r.json();
      const apiValues = j.values || {}; 
      const dict = {};
      TEMPLATE.forEach(t => {
        if (t.secret) dict[t.key] = ""; 
        else dict[t.key] = (apiValues[t.key] ?? t.value ?? "");
      });
      setValues(dict); setOriginalValues(dict);
    } catch (e) {
      setMsg(`Error: ${e.message}`);
      const dict = {}; TEMPLATE.forEach(t => { dict[t.key] = t.value ?? ""; });
      setValues(dict); setOriginalValues(dict);
    } finally { setLoading(false); }
  }
  
  useEffect(() => { fetchEnv(); }, []);
  const onChange = (k, v) => setValues(prev => ({ ...prev, [k]: v }));

  async function onSave(sectionKey) {
    setSaving(true); setMsg("");
    try {
      const sectionKeys = sections[sectionKey].map(it => it.key);
      const outgoing = {};
      for (const key of sectionKeys) outgoing[key] = values[key] ?? "";

      const r = await fetch(`${API}/api/env`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: outgoing }),
      });
      
      if (!r.ok && r.status !== 204) {
        const j = await r.json().catch(()=>({}));
        setMsg(j.message || "Save failed");
      } else {
        const newOriginals = { ...values };
        TEMPLATE.forEach(t => { if (t.secret) newOriginals[t.key] = ""; });
        setValues(newOriginals); setOriginalValues(newOriginals);
        setEditingSection(null);
        setMsg("Saved successfully!"); setTimeout(() => setMsg(""), 2000);
      }
    } catch (e) { setMsg(e?.message || "Save failed"); } finally { setSaving(false); }
  }

  function onCancel() {
    setValues(originalValues); setEditingSection(null); setMsg("");
  }

  return (
    <div className="mgmt">
      <div className="topbar">
        <div className="left"><h2 className="clickable" onClick={onClose}>Environment Settings</h2></div>
        <div className="right"><button className="btn" onClick={onClose}>Close</button></div>
      </div>

      {msg && <div className={`banner ${msg.includes("failed")||msg.includes("Error") ? "error" : "success"}`}>{msg}</div>}
      {loading && <div className="sub" style={{padding: 20}}>Loading settings...</div>}

      {/* BIGFIX */}
      {!loading && (
        <div className="section">
          <div className="section-head">
            <span className="title">BigFix</span><span className="pill">Required</span><div className="spacer" />
            {editingSection === 'BIGFIX' ? (
              <div className="actions">
                <button className="btn ghost" onClick={onCancel} disabled={saving}>Cancel</button>
                <button className="btn primary" onClick={() => onSave('BIGFIX')} disabled={saving || !validationMap['BIGFIX']}>{saving?"Saving…":"Save"}</button>
              </div>
            ) : <button className="btn" onClick={() => setEditingSection('BIGFIX')} disabled={saving || editingSection !== null}>Edit</button>}
          </div>
          <div className="grid">
            {sections.BIGFIX.map(it => (
              <Field key={it.key} item={it} value={values[it.key]} onChange={onChange} invalid={invalidMap[it.key]} disabled={editingSection !== 'BIGFIX'} />
            ))}
          </div>
        </div>
      )}

      {/* LDAP (NEW) */}
      {!loading && (
        <details className="section" open>
            <summary className="section-head">
                <span className="title">Directory Services (LDAP)</span><span className="pill soft">Optional</span><div className="spacer" />
                {editingSection === 'LDAP' ? (
                <div className="actions">
                    <button className="btn ghost" onClick={onCancel} disabled={saving}>Cancel</button>
                    <button className="btn primary" onClick={() => onSave('LDAP')} disabled={saving || !validationMap['LDAP']}>{saving?"Saving…":"Save"}</button>
                </div>
                ) : <button className="btn" onClick={() => setEditingSection('LDAP')} disabled={saving || editingSection !== null}>Edit</button>}
            </summary>
            <div className="grid">
                {sections.LDAP.map(it => {
                    // Disable sub-fields if LDAP is not enabled, unless we are editing the Enabled switch itself
                    const isDisabled = editingSection !== 'LDAP' || (it.key !== 'LDAP_ENABLED' && !ldapEnabled);
                    return (
                        <Field key={it.key} item={it} value={values[it.key]} onChange={onChange} invalid={invalidMap[it.key]} disabled={isDisabled} />
                    );
                })}
            </div>
        </details>
      )}

      {/* SMTP */}
      {!loading && (
        <div className="section">
          <div className="section-head">
            <span className="title">SMTP / Email</span><span className="pill soft">Optional</span><div className="spacer" />
            {editingSection === 'SMTP' ? (
              <div className="actions">
                <button className="btn ghost" onClick={onCancel} disabled={saving}>Cancel</button>
                <button className="btn primary" onClick={() => onSave('SMTP')} disabled={saving || !validationMap['SMTP']}>{saving?"Saving…":"Save"}</button>
              </div>
            ) : <button className="btn" onClick={() => setEditingSection('SMTP')} disabled={saving || editingSection !== null}>Edit</button>}
          </div>
          <div className="grid">
            {sections.SMTP.map(it => (
              <Field key={it.key} item={it} value={values[it.key]} onChange={onChange} invalid={smtpTouched ? invalidMap[it.key] : false} disabled={editingSection !== 'SMTP'} />
            ))}
          </div>
        </div>
      )}

      {/* ServiceNow */}
      {!loading && (
        <details className="section" open>
          <summary className="section-head">
            <span className="title">ServiceNow</span><span className="pill soft">Optional</span><div className="spacer" />
            {editingSection === 'SN' ? (
              <div className="actions">
                <button className="btn ghost" onClick={onCancel} disabled={saving}>Cancel</button>
                <button className="btn primary" onClick={() => onSave('SN')} disabled={saving || !validationMap['SN']}>{saving?"Saving…":"Save"}</button>
              </div>
            ) : <button className="btn" onClick={() => setEditingSection('SN')} disabled={saving || editingSection !== null}>Edit</button>}
          </summary>
          <div className="grid">
            {sections.SN.map(it => (
              <Field key={it.key} item={it} value={values[it.key]} onChange={onChange} disabled={editingSection !== 'SN'} />
            ))}
          </div>
        </details>
      )}

      {/* VCenter */}
      {!loading && (
        <details className="section" open>
          <summary className="section-head">
            <span className="title">VCenter</span><span className="pill soft">Optional</span><div className="spacer" />
            {editingSection === 'VCENTER' ? (
              <div className="actions">
                <button className="btn ghost" onClick={onCancel} disabled={saving}>Cancel</button>
                <button className="btn primary" onClick={() => onSave('VCENTER')} disabled={saving || !validationMap['VCENTER']}>{saving?"Saving…":"Save"}</button>
              </div>
            ) : <button className="btn" onClick={() => setEditingSection('VCENTER')} disabled={saving || editingSection !== null}>Edit</button>}
          </summary>
          <div className="grid">
            {sections.VCENTER.map(it => (
              <Field key={it.key} item={it} value={values[it.key]} onChange={onChange} invalid={vcenterTouched ? invalidMap[it.key] : false} disabled={editingSection !== 'VCENTER'} />
            ))}
          </div>
        </details>
      )}

      {/* Debug */}
      {!loading && (
        <details className="section" open>
          <summary className="section-head">
            <span className="title">Logging</span><span className="pill soft">Optional</span><div className="spacer" />
            {editingSection === 'DEBUG' ? (
              <div className="actions">
                <button className="btn ghost" onClick={onCancel} disabled={saving}>Cancel</button>
                <button className="btn primary" onClick={() => onSave('DEBUG')} disabled={saving || !validationMap['DEBUG']}>{saving?"Saving…":"Save"}</button>
              </div>
            ) : <button className="btn" onClick={() => setEditingSection('DEBUG')} disabled={saving || editingSection !== null}>Edit</button>}
          </summary>
          <div className="grid">
            {sections.DEBUG.map(it => (
              <Field key={it.key} item={it} value={values[it.key]} onChange={onChange} disabled={editingSection !== 'DEBUG'} />
            ))}
          </div>
        </details>
      )}

      <style>{`
        .mgmt{ padding:20px; }
        .topbar{ position:sticky; top:0; display:flex; align-items:center; justify-content:space-between; padding:8px 0 12px; z-index:2; border-bottom: 1px solid var(--border); margin-bottom: 16px; border-radius: 12px; background: #fff; }
        .topbar .right{ display:flex; gap:8px; padding: 10px }
        .clickable{ cursor:pointer; padding:10px }
        .clickable:hover{ text-decoration:underline; }
        .btn{ padding:9px 14px; border:1px solid #e5e7eb; background:#fff; border-radius:12px; cursor:pointer; font-weight: 700; }
        .btn.ghost{ background:transparent; border-color: #d1d5db; }
        .btn.primary{ background:#2563eb; color:#fff; border-color:#1e40af }
        .btn:disabled{ opacity:.6; cursor:not-allowed }
        .banner{ margin:10px 0; padding:10px 12px; border-radius:12px; }
        .banner.error{ background:#fff2f0; border:1px solid #ffccc7; color: #b42318; }
        .banner.success{ background:#f0fdf4; border:1px solid #bbf7d0; color: #15803d; }
        .section{ margin:16px 0 10px; border:1px solid #eef0f3; border-radius:16px; background:#fff; }
        .section-head{ display:flex; align-items:center; gap:10px; padding:12px 14px; }
        .section > .grid{ padding:12px 14px 16px; }
        .title{ font-weight:700; }
        .pill{ font-size:12px; padding:3px 8px; border-radius:999px; color:#065f46; background:#d1fae5; border:1px solid #a7f3d0; }
        .pill.soft{ color:#4b5563; background:#f3f4f6; border:1px solid #e5e7eb; }
        .spacer { flex: 1; }
        .actions { display: flex; gap: 8px; }
        .grid{ display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:12px; }
        .field{ display:flex; flex-direction:column; gap:8px; padding:12px; border:1px solid #eef0f3; border-radius:12px; background:#fafbff; }
        .field.invalid{ border-color:#fecaca; background:#fff7f7; }
        .meta{ display:flex; align-items:baseline; gap:8px; }
        .meta label{ font-weight:800; font-size:12px; color:#334155; }
        .meta .req{ color:#ef4444; margin-left:4px; }
        .hint{ font-size:11px; color:#64748b; }
        .inputwrap{ display:flex; align-items:center; gap:8px; }
        input[type="text"], input[type="number"], input[type="password"]{ flex:1; padding:10px 12px; border:1px solid #d1d5db; border-radius:10px; background:#fff; }
        input:disabled { background: #f3f4f6; color: #6b7280; cursor: not-allowed; }
        .select{ position:relative; }
        .select-btn{ width:365px; display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border:1px solid #d1d5db; border-radius:10px; background:#fff; cursor:pointer; }
        .select-btn:disabled { background: #f3f4f6; color: #6b7280; cursor: not-allowed; }
        .select.open .select-btn{ border-color:#94a3b8; box-shadow:0 0 0 3px rgba(37,99,235,.15); }
        .select .menu{ position:absolute; margin-top:6px; z-index:5; left:0; right:0; background:#fff; border:1px solid #e5e7eb; border-radius:12px; box-shadow:0 12px 30px rgba(0,0,0,.08); padding:6px; max-height:200px; overflow:auto; }
        .select .item{ padding:10px 12px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; }
        .select .item:hover{ background:#f1f5f9; }
        .select .item.sel{ background:#eef2ff; color:#1e40af; }
        .select .tick{ font-size:14px; }
        .ghost.tiny{ padding:6px 8px; border-radius:8px; border:1px solid #e5e7eb; background:#fff; }
        .sw{ width:46px; height:28px; border-radius:999px; border:1px solid #d1d5db; background:#f1f5f9; position:relative; transition:.2s; cursor:pointer; }
        .sw .knob{ position:absolute; top:2px; left:2px; width:24px; height:24px; border-radius:999px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.15); transition:.2s; }
        .sw.on{ background:#2563eb; border-color:#1e40af; }
        .sw.on .knob{ transform:translateX(18px); }
        .sw:disabled { opacity: .6; cursor: not-allowed; background: #e5e7eb; }
        details > summary{ list-style:none; cursor:pointer; }
        details > summary::-webkit-details-marker{ display:none; }
        details[open] > summary { border-bottom: 1px solid #f2f4f7; }
        [data-theme="light"] .section { border-color: #e5e9f4; background: #fff; }
        [data-theme="light"] .section-head { border-bottom-color: #f1f4fb; }
        [data-theme="light"] .field { background: #f8fafc; border-color: #f1f4fb; }
        [data-theme="light"] input[type="text"], [data-theme="light"] input[type="number"], [data-theme="light"] input[type="password"] { border-color: #dbe0ea; background: #fff; }
        [data-theme="light"] input:disabled { background: #f1f4fb; color: #64748b; }
        [data-theme="light"] .select-btn { border-color: #dbe0ea; background: #fff; }
        [data-theme="light"] .select-btn:disabled { background: #f1f4fb; color: #64748b; }
        [data-theme="light"] .sw { background: #e2e8f0; border-color: #cbd5e1; }
        [data-theme="light"] .sw .knob { background: #fff; }
        [data-theme="light"] .sw.on { background: #4f46e5; border-color: #4338ca; }
        [data-theme="light"] .sw:disabled { background: #e2e8f0; opacity: .7; }
      `}</style>
    </div>
  );
}