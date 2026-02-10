// src/components/UserManagement.jsx
import { useEffect, useState, useRef } from "react";

const API = window.env?.VITE_API_BASE || "http://localhost:5174";

// Helper function
async function apiFetch(url, options = {}) {
  const r = await fetch(`${API}${url}`, options);
  let j;
  try {
    j = await r.json();
  } catch (e) {
    j = { ok: false, error: "Failed to parse server response." };
  }

  if (!r.ok || j.ok === false) {
    throw new Error(j.error || j.message || `HTTP ${r.status}`);
  }
  return j;
}

// Format date helper
function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/* ==================================================================================
   FANCY DROPDOWN
   ================================================================================== */
const FancySelect = ({ label, options, value, onChange, disabled, placeholder }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o === value);
  const displayText = selectedOption || placeholder;
  const isPlaceholder = !selectedOption;

  return (
    <div className="field">
      {label && <span className="label">{label}</span>}
      <div 
        className={`fx-wrap ${open ? "fx-open" : ""}`} 
        ref={wrapperRef}
        style={{ pointerEvents: disabled ? "none" : "auto", opacity: disabled ? 0.6 : 1 }}
      >
        <button type="button" className="fx-trigger" onClick={() => setOpen(!open)}>
          <span className={`fx-value ${isPlaceholder ? "fx-placeholder" : ""}`}>{displayText}</span>
          <span className="fx-chevron">▾</span>
        </button>
        {open && (
          <div className="fx-menu">
            <div className="fx-menu-inner">
              {options.map((opt) => (
                <div 
                  key={opt} 
                  className={`fx-item ${opt === value ? "fx-active" : ""}`}
                  onClick={() => { onChange(opt); setOpen(false); }}
                >
                  <span className="fx-label">{opt}</span>
                  {opt === value && <span className="fx-tick">✓</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function UserManagement({ onClose, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentRole = sessionStorage.getItem("user_role") || "Windows";
  const isAdmin = currentRole === "Admin";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [role, setRole] = useState("Windows"); 
  const [formError, setFormError] = useState("");
  const [formBusy, setFormBusy] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState(null);
  const [editRole, setEditRole] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  // UPDATE: Added EUC
  const roleOptions = ["Windows", "Linux", "EUC", "Admin"];
  
  // FIX: Added 9004 to exclude list
  const visibleUsers = users.filter(u => ![9002, 9003, 9004].includes(Number(u.UserID)));

  async function fetchUsers() {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/api/auth/users");
      setUsers(data.users || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleCreateUser(e) {
    e.preventDefault();
    setFormError("");
    
    if (!isAdmin) {
      setFormError("Permission Denied: Only Admins can create users.");
      return;
    }

    if (!username || !password) {
      setFormError("Username and password are required.");
      return;
    }
    if (password !== confirmPass) {
      setFormError("Passwords do not match.");
      return;
    }
    setFormBusy(true);
    try {
      const data = await apiFetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }), 
      });
      
      const newUser = data.userData ? { ...data.userData, Role: role } : { UserID: data.userId, LoginName: username, Role: role, CreatedAt: new Date().toISOString() };
      setUsers([...users, newUser]);

      setUsername("");
      setPassword("");
      setConfirmPass("");
      setRole("Windows"); 
    } catch (e) {
      setFormError(e.message === 'user_exists' ? 'User already exists.' : 'Failed to create user.');
    } finally {
      setFormBusy(false);
    }
  }

  async function handleDeleteUser(userId) {
    if (!isAdmin) {
      alert("Permission Denied: Only Admins can delete users.");
      return;
    }
    if (Number(userId) === Number(currentUserId)) {
      alert("Error: You cannot delete your own account.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }

    try {
      await apiFetch(`/api/auth/users/${userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentUserId: currentUserId }) 
      });
      setUsers(users.filter(u => u.UserID !== userId));
    } catch (e) {
      setError(`Failed to delete user: ${e.message}`);
    }
  }

  const startEditing = (user) => {
    setEditingId(user.UserID);
    setEditRole(user.Role);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditRole("");
  };

  const saveRole = async (userId) => {
    if (!editRole) return;
    setEditBusy(true);
    try {
      await apiFetch(`/api/auth/users/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editRole })
      });
      
      setUsers(users.map(u => u.UserID === userId ? { ...u, Role: editRole } : u));
      setEditingId(null);
    } catch (e) {
      alert(`Failed to update role: ${e.message}`);
    } finally {
      setEditBusy(false);
    }
  };

  // Helper to determine pill color
  const getPillClass = (r) => {
      if (r === 'Admin') return 'red';
      if (r === 'Linux') return 'amber';
      if (r === 'EUC') return 'blue'; // New style for EUC
      return 'green'; // Windows (default)
  };

  return (
    <div className="mgmt">
      <div className="topbar">
        <div className="left">
          <h2 className="clickable" onClick={onClose} title="Go back">User Management</h2>
        </div>
        <div className="right">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      {!isAdmin && (
        <div className="banner warning" style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', marginBottom: 20, borderRadius: 12, padding: '12px 16px', fontSize: 14, fontWeight: 600 }}>
           Only Admins can create or delete users.
        </div>
      )}

      {isAdmin && (
        <div className="section" style={{ overflow: 'visible' }}>
          <div className="section-head">
            <span className="title">Create New User</span>
          </div>
          <form className="grid-create" onSubmit={handleCreateUser}>
            <div className="field">
              <label htmlFor="new_username">Username</label>
              <input
                id="new_username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                autoComplete="off"
                className="control"
              />
            </div>
            
            <FancySelect 
              label="Role"
              options={roleOptions}
              value={role}
              onChange={setRole}
              placeholder="Select Role"
            />

            <div className="field">
              <label htmlFor="new_password">Password</label>
              <input
                id="new_password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                autoComplete="new-password"
                className="control"
              />
            </div>
            <div className="field">
              <label htmlFor="confirm_password">Confirm Password</label>
              <input
                id="confirm_password"
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                className="control"
              />
            </div>
            <div className="field-action" style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingBottom: 2 }}>
              <button type="submit" className="btn primary" disabled={formBusy} style={{ width: '100%', height: '44px' }}>
                {formBusy ? "Creating..." : "Create User"}
              </button>
            </div>
            {formError && <div className="alert error small">{formError}</div>}
          </form>
        </div>
      )}

      <div className="section">
        <div className="section-head">
          <span className="title">Existing Users</span>
        </div>
        <div className="grid">
          {loading ? (
            <p style={{padding: 20, color: 'var(--muted)'}}>Loading users...</p>
          ) : (
            <div className="tableWrap">
              <table className="user-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Created At</th>
                    <th style={{ textAlign: 'center', width: 100 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map(user => {
                    const isEditing = editingId === user.UserID;
                    const isSelf = user.UserID === currentUserId;
                    
                    return (
                     <tr key={user.UserID}>
                        <td>
                          {user.LoginName}
                          {isSelf && <span className="you-pill"> (You)</span>}
                        </td>
                        <td style={{ minWidth: 140 }}>
                          {isEditing ? (
                            <div style={{ width: '100%', minWidth: 120 }}>
                              <FancySelect 
                                options={roleOptions}
                                value={editRole}
                                onChange={setEditRole}
                                placeholder="Select Role"
                                disabled={editBusy}
                              />
                            </div>
                          ) : (
                            <span className={`pill ${getPillClass(user.Role)}`}>
                              {user.Role || 'Windows'}
                            </span>
                          )}
                        </td>
                        <td>{fmtDate(user.CreatedAt)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            {isEditing ? (
                              <>
                                <button
                                  className="btn-icon save"
                                  title="Save Role"
                                  onClick={() => saveRole(user.UserID)}
                                  disabled={editBusy}
                                >
                                  💾
                                </button>
                                <button
                                  className="btn-icon cancel"
                                  title="Cancel"
                                  onClick={cancelEditing}
                                  disabled={editBusy}
                                >
                                  ✕
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="btn-icon edit"
                                  title="Edit Role"
                                  onClick={() => startEditing(user)}
                                  disabled={!isAdmin}
                                  style={{ opacity: !isAdmin ? 0.3 : 1 }}
                                >
                                  ✎
                                </button>
                                <button
                                  className="btn-icon delete"
                                  title="Delete User"
                                  onClick={() => handleDeleteUser(user.UserID)}
                                  disabled={isSelf || !isAdmin}
                                  style={{ opacity: (!isAdmin || isSelf) ? 0.3 : 1 }}
                                >
                                  🗑
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .mgmt{ padding:20px; }
        .topbar{ position:sticky; top:0; backdrop-filter:saturate(180%) blur(8px); display:flex; align-items:center; justify-content:space-between; padding:8px 0 12px; z-index:2; }
        .topbar .right{ display:flex; gap:8px; }
        .clickable{ cursor:pointer; }
        .clickable:hover{ text-decoration:underline; }

        .btn{ padding:9px 14px; border:1px solid #e5e7eb; background:#fff; border-radius:12px; cursor:pointer; font-weight: 700; }
        .btn.ghost{ background:transparent }
        .btn.primary{ background:#2563eb; color:#fff; border-color:#1e40af }
        .btn:disabled{ opacity:.6; cursor:not-allowed }

        .banner{ margin:10px 0; padding:10px 12px; border-radius:12px; }
        .banner.error{ background:#fff2f0; border:1px solid #ffccc7; }
        .alert.error{ color:#b42318; background:#fee4e2; border:1px solid #f1a29d; }
        .alert.small { padding: 8px 10px; font-size: 12px; grid-column: 1 / -1; }

        .section{ margin:16px 0 10px; border:1px solid #eef0f3; border-radius:16px; background:#fff; }
        .section-head{ display:flex; align-items:center; gap:10px; padding:12px 14px; border-bottom:1px solid #f2f4f7; }
        .section > .grid, .section > .grid-create { padding:12px 14px 16px; }
        .title{ font-weight:700; }
        
        .grid-create {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr auto; 
          gap: 16px;
          align-items: flex-start;
        }
        @media (max-width: 1100px) {
          .grid-create { grid-template-columns: 1fr 1fr; }
          .field-action { grid-column: 1 / -1; }
        }
        @media (max-width: 600px) {
          .grid-create { grid-template-columns: 1fr; }
        }

        .field{ display:flex; flex-direction:column; gap:8px; }
        .field label{ font-weight:700; font-size:11px; color:var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
        
        /* Consistent Input Style */
        input.control {
          height: 44px; width: 100%; border: 1px solid var(--border); border-radius: 12px; background: var(--panel); color: var(--text);
          padding: 0 12px; font-size: 14px; outline: none; transition: all 160ms;
        }
        input.control:focus { border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 20%, transparent); }

        /* Fancy Dropdown Styles */
        .fx-wrap { position: relative; width: 100%; }
        .fx-trigger {
          height: 44px; width: 100%; border: 1px solid var(--border); border-radius: 12px; background: var(--panel); color: var(--text);
          font-size: 14px; text-align: left; display: grid; grid-template-columns: 1fr auto; align-items: center;
          padding: 0 12px; gap: 8px; cursor: pointer; outline: none;
          box-shadow: 0 1px 0 rgba(0,0,0,.02) inset, 0 4px 12px rgba(0,0,0,.06); transition: all 160ms;
        }
        .fx-trigger:hover { transform: translateY(-1px); box-shadow: var(--shadow); }
        .fx-wrap.fx-open .fx-trigger { border-color: var(--primary); }
        .fx-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fx-value.fx-placeholder { color: var(--muted); opacity: 0.8; }
        .fx-chevron { font-size: 12px; color: var(--muted); transition: transform 160ms; }
        .fx-wrap.fx-open .fx-chevron { transform: rotate(180deg); }

        .fx-menu {
          position: absolute; left: 0; right: 0; top: 100%; margin-top: 5px;
          background: var(--panel); color: var(--text); border: 1px solid var(--border); border-radius: 12px;
          box-shadow: var(--shadow); max-height: 220px; overflow: hidden; z-index: 9999; animation: fadeIn .15s ease;
        }
        .fx-menu-inner { max-height: 220px; overflow-y: auto; padding: 6px; }
        .fx-item {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 13px; margin: 1px 0; transition: background 120ms;
        }
        .fx-item:hover { background: color-mix(in srgb, var(--primary) 14%, transparent); }
        .fx-item.fx-active { background: color-mix(in srgb, var(--primary) 22%, transparent); font-weight: 600; }
        .fx-tick { color: var(--primary); font-weight: 800; font-size: 11px; margin-left: auto; }
        
        .tableWrap { overflow-x: auto; border-top: 1px solid var(--border); overflow: visible; }
        .user-table { width: 100%; border-collapse: collapse; min-width: 600px; }
        .user-table th, .user-table td { 
          padding: 12px 14px; 
          border-bottom: 1px solid #eef0f3;
          text-align: left;
          font-size: 14px;
          vertical-align: middle;
        }
        .user-table th { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
        .user-table tr:last-child td { border-bottom: none; }
        .you-pill { font-size: 11px; color: #05603a; font-weight: 700; background: #dcfce7; padding: 2px 6px; border-radius: 4px; margin-left: 6px; }
        
        /* Role Pills */
        .pill { padding: 4px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; border: 1px solid transparent; }
        .pill.green { background: #dcfce7; color: #166534; border-color: #bbf7d0; } /* Windows */
        .pill.amber { background: #fef3c7; color: #92400e; border-color: #fde68a; } /* Linux */
        .pill.red { background: #fee2e2; color: #991b1b; border-color: #fecaca; }   /* Admin */
        .pill.blue { background: #dbeafe; color: #1e40af; border-color: #bfdbfe; }   /* EUC */

        .btn-icon {
          width: 32px; height: 32px;
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          background: #fff;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }
        .btn-icon:disabled { cursor: not-allowed; opacity: 0.5; }
        
        .btn-icon.edit:hover { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
        .btn-icon.delete { border-color: #fecaca; color: #ef4444; background: #fff7f7; }
        .btn-icon.delete:hover { background: #fee4e2; }
        
        .btn-icon.save { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
        .btn-icon.save:hover { background: #bbf7d0; }
        
        .btn-icon.cancel { background: #f3f4f6; color: #4b5563; }
        .btn-icon.cancel:hover { background: #e5e7eb; }
        
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
      `}</style>
    </div>
  );
}