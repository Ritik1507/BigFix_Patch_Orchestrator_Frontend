// src/components/auth/Login.jsx
import { useState, useEffect, useRef } from "react";

const API_BASE = window.env.VITE_API_BASE;

function Select({ value, options, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label || "Select";

  return (
    <div className={`custom-select ${open ? "open" : ""}`} ref={ref}>
      <button 
        type="button" 
        className="select-trigger" 
        onClick={() => !disabled && setOpen(!open)} 
        disabled={disabled}
      >
        <span>{selectedLabel}</span>
        <svg className="chevron" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 7l5 6 5-6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      
      {open && (
        <div className="select-menu">
          {options.map(opt => (
            <div 
              key={opt.value} 
              className={`select-item ${value === opt.value ? 'selected' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label}
              {value === opt.value && <span className="tick">✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Login({ onSuccess }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [isSetup, setIsSetup] = useState(false);
  const [setupConfirm, setSetupConfirm] = useState("");
  const [needsRole, setNeedsRole] = useState(false);
  const [selectedRole, setSelectedRole] = useState("Windows");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/setup-required`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.requiresSetup) {
          setIsSetup(true);
        }
      })
      .catch(() => {});
  }, []);

  async function handleAction(e) {
    e.preventDefault();
    setErr("");
    setInfo("");
    setBusy(true);

    try {
      if (isSetup) {
        if (p !== setupConfirm) throw new Error("Passwords do not match.");
        const r = await fetch(`${API_BASE}/api/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: u.trim(), password: p, role: 'Admin' }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) throw new Error(j.message || "Setup failed.");

        setInfo("Admin account created successfully! Please login.");
        setIsSetup(false); setP(""); setSetupConfirm(""); setBusy(false); 

      } else if (needsRole) {
        await performLdapRegister();
      } else {
        await performLogin();
      }
    } catch (e2) {
      setErr(e2.message === "invalid" ? "Invalid username or password." : e2.message || "Error occurred.");
      setBusy(false);
    }
  }

  async function performLogin() {
    const r = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u.trim(), password: p }),
      });
      const j = await r.json().catch(() => ({}));
      
      if (j.error === 'role_required') {
          setNeedsRole(true);
          setInfo(j.message || "Please select your team role to continue.");
          setBusy(false);
          return;
      }

      if (!r.ok || !j.ok) throw new Error(j.error || "server_error");
      
      const userRole = j.role || "Windows";
      sessionStorage.setItem("user_role", userRole);
      onSuccess?.({ username: j.username, userId: j.userId, role: userRole });
      setBusy(false);
  }

  async function performLdapRegister() {
      const r = await fetch(`${API_BASE}/api/auth/ldap-first-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: u.trim(), password: p, role: selectedRole }),
      });
      const j = await r.json().catch(() => ({}));
      
      if (!r.ok || !j.ok) throw new Error(j.message || "Registration failed.");

      const userRole = j.role;
      sessionStorage.setItem("user_role", userRole);
      onSuccess?.({ username: j.username, userId: j.userId, role: userRole });
      setBusy(false);
  }

  return (
    <div className="login-outer">
      <div className="login-card">
        <h2 className="login-title">
            {isSetup ? "Create Admin Account" : needsRole ? "Complete Setup" : "Login"}
        </h2>
        
        {isSetup && <p className="intro-text">Welcome! Please create the first Administrator account.</p>}
        
        {needsRole && (
            <p className="intro-text">
                Welcome, <strong>{u}</strong>. This is your first login. Please select your team role.
            </p>
        )}

        <form onSubmit={handleAction}>
          
          {!needsRole && (
             <label>
                <span>Username</span>
                <input
                  value={u}
                  onChange={(e) => setU(e.target.value)}
                  placeholder="Enter username"
                  autoComplete="username"
                  required
                  disabled={needsRole}
                />
             </label>
          )}
          
          {!needsRole && (
            <label>
              <span>Password</span>
              <input
                type="password"
                value={p}
                onChange={(e) => setP(e.target.value)}
                placeholder="Enter password"
                autoComplete={isSetup ? "new-password" : "current-password"}
                required
              />
            </label>
          )}

          {isSetup && (
             <label>
                <span>Confirm Password</span>
                <input
                  type="password"
                  value={setupConfirm}
                  onChange={(e) => setSetupConfirm(e.target.value)}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  required
                />
             </label>
          )}

          {needsRole && (
             <label>
                <span>Select Team Role</span>
                <Select 
                    value={selectedRole}
                    onChange={setSelectedRole}
                    options={[
                        { value: "Windows", label: "Windows Team" },
                        { value: "Linux", label: "Linux Team" },
                        { value: "EUC", label: "EUC Team" }
                    ]}
                />
             </label>
          )}

          {!!err && <div className="alert error">{err}</div>}
          {!!info && <div className="alert success">{info}</div>}

          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Processing..." : (isSetup ? "Create Admin" : needsRole ? "Save & Login" : "Login")}
          </button>
          
          {needsRole && (
              <button type="button" className="btn-link" onClick={() => { setNeedsRole(false); setP(""); setErr(""); }}>
                  Back to Login
              </button>
          )}
        </form>
      </div>
    </div>
  );
}