// src/components/Header.jsx
import { useEffect, useState, useRef } from "react";
import logo from "../assets/bigfix-logo.jpg";

function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  try {
    const saved = localStorage.getItem("theme");
    if (saved) return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

const IconPatch = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"/><polyline points="14 2 14 8 20 8"/><path d="M2 15h10"/><path d="M2 12h10"/><path d="M2 18h10"/></svg>);
const IconGroup = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>);
const IconSettings = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 0 2.83 2 2 0 0 1 0-2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>);
const IconUsers = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>);
const IconLogout = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>);
const IconFolder = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>);
const IconCloud = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>);
const IconCamera = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>);
const IconCopy = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>);
const IconCalendar = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>);
const IconRisk = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>);

export default function Header({ 
  onOpenSettings, 
  onOpenUsers, 
  onOpenBaseline, 
  onOpenGroup, 
  onOpenSnapshot, 
  onOpenClone,    
  onOpenCalendar,
  onOpenRisk,
  authed = false, 
  onLogout, 
  role, 
  username 
}) {
  const [theme, setTheme] = useState(getInitialTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuRef]);

  const toggleTheme = () => setTheme(t => (t === "light" ? "dark" : "light"));

  const goHome = () => {
    try {
      window.dispatchEvent(new CustomEvent("flow:navigate", { detail: { stage: "CONFIG" } }));
    } catch {}
  };

  return (
    <>
      <header className="app-header">
        <div className="nav container">
          <button type="button" className="brand as-btn" onClick={goHome} title="Go to Configuration">
            <span className="logo-wrap" aria-hidden="true">
              <img className="logo" src={logo} alt="BigFix" />
            </span>
            <span className="brand-text">BigFix Patch Setu</span>
          </button>

          {authed && (
            <div className="badges">
              <span className="chip" role="note">Sandbox → Pilot → Production</span>
            </div>
          )}

          <div className="spacer" />

          <div className="toolbar">
            {authed && (
              <>
                <div className="dropdown-wrap" ref={menuRef}>
                  <button 
                    className={`btn ${menuOpen ? "active" : ""}`} 
                    onClick={() => setMenuOpen(o => !o)} 
                    title="Management"
                  >
                    <span className="btn-text">Management</span>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className={`header-dropdown-icon ${menuOpen ? "open" : ""}`}>
                      <path d="M5 7l5 6 5-6" />
                    </svg>
                  </button>
                  
                  {menuOpen && (
                    <div className="dropdown-menu">
                      <div className="dropdown-item parent">
                        <div className="item-icon"><IconPatch /></div>
                        <span>Patch Management</span>
                        <span className="arrow">›</span>
                        <div className="submenu">
                          <button className="submenu-item" onClick={() => { onOpenBaseline && onOpenBaseline(); setMenuOpen(false); }}>
                            <div className="item-icon small"><IconFolder /></div>
                            <span>Baseline</span>
                          </button>
                          <button className="submenu-item" onClick={() => { onOpenCalendar && onOpenCalendar(); setMenuOpen(false); }}>
                            <div className="item-icon small"><IconCalendar /></div>
                            <span>Patch Calendar</span>
                          </button>
                        </div>
                      </div>

                      {/* NEW MENU ITEM */}
                      <button className="dropdown-item" onClick={() => { onOpenRisk && onOpenRisk(); setMenuOpen(false); }}>
                        <div className="item-icon"><IconRisk /></div>
                        <span>Risk Prioritization</span>
                      </button>

                      <div className="dropdown-item parent">
                        <div className="item-icon"><IconGroup /></div>
                        <span>Group Management</span>
                        <span className="arrow">›</span>
                        <div className="submenu">
                          <button className="submenu-item" onClick={() => { onOpenGroup && onOpenGroup(); setMenuOpen(false); }}>
                            <div className="item-icon small"><IconFolder /></div>
                            <span>Group</span>
                          </button>
                        </div>
                      </div>

                      {role !== 'EUC' && (
                        <div className="dropdown-item parent">
                          <div className="item-icon"><IconCloud /></div>
                          <span>VCenter Management</span>
                          <span className="arrow">›</span>
                          <div className="submenu">
                            <button className="submenu-item" onClick={() => { onOpenSnapshot && onOpenSnapshot(); setMenuOpen(false); }}>
                              <div className="item-icon small"><IconCamera /></div>
                              <span>Take Snapshot</span>
                            </button>
                            <button className="submenu-item" onClick={() => { onOpenClone && onOpenClone(); setMenuOpen(false); }}>
                              <div className="item-icon small"><IconCopy /></div>
                              <span>Clone VM</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {role === 'Admin' && (
                        <>
                          <div className="dropdown-divider" />
                          <button className="dropdown-item" onClick={() => { onOpenUsers && onOpenUsers(); setMenuOpen(false); }}>
                            <div className="item-icon"><IconUsers /></div>
                            <span>User Management</span>
                          </button>
                          <button className="dropdown-item" onClick={() => { onOpenSettings && onOpenSettings(); setMenuOpen(false); }}>
                            <div className="item-icon"><IconSettings /></div>
                            <span>Environment Settings</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <button className="btn logout-btn" onClick={onLogout} title="Logout">
                   <IconLogout />
                   <span className="btn-text logout-btn-text">Logout</span>
                </button>

                <div className="profile-container" aria-label="Profile Info">
                  <div className="profile-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div className="profile-details-tooltip">
                    <div className="tooltip-name">Username: {username || "User"}</div>
                    <div className="tooltip-role">Role: {role || "Guest"}</div>
                  </div>
                </div>
              </>
            )}
            
            <button className="iconbtn" onClick={toggleTheme} title="Toggle Theme">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            </button>
          </div>
        </div>
      </header>
      <div className="header-placeholder" />
    </>
  );
}