// src/components/auth/Login.jsx
import { useState, useEffect, useRef } from "react";

const API_BASE = window.env.VITE_API_BASE;

/* --- Custom Select Component (Matches Management.jsx style) --- */
function Select({ value, options, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown when clicking outside
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

/* --- Main Login Component --- */
export default function Login({ onSuccess }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  
  // First Run Setup State
  const [isSetup, setIsSetup] = useState(false);
  const [setupConfirm, setSetupConfirm] = useState("");
  
  // LDAP First Login State
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
        // --- 1. SETUP ADMIN ---
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
        // --- 2. COMPLETE LDAP REGISTRATION ---
        await performLdapRegister();

      } else {
        // --- 3. NORMAL LOGIN ---
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
      
      // Check for LDAP First Time Login signal
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
          
          {/* USERNAME */}
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
          
          {/* PASSWORD */}
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

          {/* ADMIN CONFIRM */}
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

          {/* CUSTOM ROLE SELECTOR */}
          {needsRole && (
             <label>
                <span>Select Team Role</span>
                <Select 
                    value={selectedRole}
                    onChange={setSelectedRole}
                    options={[
                        { value: "Windows", label: "Windows Team" },
                        { value: "Linux", label: "Linux Team" },
                        { value: "EUC", label: "EUC Team" } // Added EUC
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

      <style>{`
        .login-title { text-align: center; font-size: 24px; font-weight: 800; color: #2379da; margin: 0 0 20px 0; }
        .intro-text { text-align: center; margin-bottom: 20px; color: #666; font-size: 0.9em; line-height: 1.5; }
        .login-outer{ min-height: calc(100vh - var(--header-h,68px)); display:grid; place-items:center; background: radial-gradient(1200px 600px at 35% -10%, rgba(88,136,255,.12), transparent), radial-gradient(1200px 600px at 75% 110%, rgba(57,180,205,.18), transparent); padding: 28px 16px; }
        .login-card{ width:100%; max-width: 520px; padding: 22px 22px 20px; border-radius: 18px; background: rgba(255,255,255,.96); backdrop-filter: blur(8px) saturate(1.1); box-shadow: 0 10px 30px rgba(0,0,0,.12); }

        form{ display:grid; gap:12px; }
        label{ display:grid; gap:6px; }
        label span{ font-size:12px; color:#4b587c; font-weight:700; letter-spacing:.02em; }
        
        /* Inputs */
        input { 
            height:44px; padding:0 12px; border-radius:12px; border:1px solid #dbe3ff; 
            background:#fff; outline:none; transition: box-shadow .15s, border-color .15s; width: 100%; 
            font-size: 14px; color: #333;
        }
        input:focus { border-color:#97b3ff; box-shadow: 0 0 0 3px rgba(43,141,219,.15); }

        /* --- Custom Select Styles (Matches Management.jsx) --- */
        .custom-select { position: relative; width: 100%; }
        
        .select-trigger {
            width: 100%; height: 44px; 
            display: flex; align-items: center; justify-content: space-between;
            padding: 0 12px;
            background: #fff; border: 1px solid #dbe3ff; border-radius: 12px;
            font-size: 14px; color: #333; cursor: pointer; text-align: left;
            transition: all 0.15s;
        }
        .select-trigger:focus, .custom-select.open .select-trigger {
            outline: none; border-color:#97b3ff; box-shadow: 0 0 0 3px rgba(43,141,219,.15);
        }
        .chevron { color: #64748b; transition: transform 0.2s; }
        .custom-select.open .chevron { transform: rotate(180deg); }

        .select-menu {
            position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 10;
            background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
            box-shadow: 0 10px 40px -5px rgba(0,0,0,0.15);
            overflow: hidden; animation: fadeIn 0.15s ease-out;
        }
        
        .select-item {
            padding: 10px 12px; font-size: 14px; color: #333; cursor: pointer;
            display: flex; align-items: center; justify-content: space-between;
            transition: background 0.1s;
        }
        .select-item:hover { background: #f1f5f9; }
        .select-item.selected { background: #eff6ff; color: #2563eb; font-weight: 600; }
        .tick { font-size: 14px; font-weight: bold; }

        @keyframes fadeIn { from{opacity:0; transform:translateY(-5px)} to{opacity:1; transform:translateY(0)} }

        /* Buttons & Alerts */
        .btn-primary{ height:46px; border:none; border-radius:12px; font-weight:900; letter-spacing:.02em; color:#fff; background: linear-gradient(90deg,#2379da,#2379da); cursor:pointer; font-size: 14px; }
        .btn-primary:hover { filter: brightness(110%); }
        .btn-link { background: none; border: none; color: #666; font-size: 13px; cursor: pointer; text-decoration: underline; margin-top: 4px; }
        
        .alert{ padding:10px 12px; border-radius:10px; font-size:12px; }
        .alert.error{ color:#b42318; background:#fee4e2; border:1px solid #f1a29d; }
        .alert.success{ color:#05603a; background:#e9f8f1; border:1px solid #93d5b5; }

        @media (max-width: 480px) {
          .login-card { padding: 20px 16px; }
          .login-title { font-size: 20px; }
        }
      `}</style>
    </div>
  );
}