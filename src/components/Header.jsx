// src/components/Header.jsx
import { useEffect, useState, useRef } from "react";
import logo from "../assets/bigfix-logo.jpg";

function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  try {
    const saved = localStorage.getItem("theme");
    if (saved) return saved;
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

/* --- ICONS --- */
const IconPatch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"/><polyline points="14 2 14 8 20 8"/><path d="M2 15h10"/><path d="M2 12h10"/><path d="M2 18h10"/></svg>
);
const IconGroup = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
);
const IconSettings = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 0 2.83 2 2 0 0 1 0-2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
);
const IconUsers = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
const IconLogout = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
);
const IconFolder = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
);
const IconCloud = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>
);
const IconCamera = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
);
const IconCopy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
);
const IconCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
);

export default function Header({ 
  onOpenSettings, 
  onOpenUsers, 
  onOpenBaseline, 
  onOpenGroup, 
  onOpenSnapshot, 
  onOpenClone,    
  onOpenCalendar,
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

          <div className="toolbar" style={{ display: "flex", gap: 8 }}>
            
            {authed && (
              <>
                {/* --- UNIFIED MANAGEMENT DROPDOWN --- */}
                <div className="dropdown-wrap" ref={menuRef}>
                  <button 
                    className={`btn ${menuOpen ? "active" : ""}`} 
                    onClick={() => setMenuOpen(o => !o)} 
                    title="Management"
                  >
                    <span className="btn-text">Management</span>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 6, transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      <path d="M5 7l5 6 5-6" />
                    </svg>
                  </button>
                  
                  {menuOpen && (
                    <div className="dropdown-menu">
                      {/* 1. Patch Management */}
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

                      {/* 2. Group Management */}
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

                      {/* 3. VCenter Management (HIDDEN FOR EUC) */}
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

                      {/* Admin Only Items */}
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
                   <span className="btn-text" style={{marginLeft: 6}}>Logout</span>
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
      <div style={{ height: "var(--header-h, 72px)" }} />
      <style>{`
        :root { --header-h: 72px; }

        .app-header{
          position: fixed;
          inset: 0 0 auto 0;
          z-index: 1000;
          min-height: var(--header-h);
          height: auto;
          display: flex; align-items: center;
          backdrop-filter: saturate(1.1) blur(6px);
          background: linear-gradient(90deg, #2379da 0%, #152038 100%);
          border-bottom: 1px solid rgba(255,255,255,.16);
          padding: 4px 0;
        }
        
        .app-header .container{
          width: 100%;
          max-width: 100%;
          margin: 0;
          display: flex; 
          align-items: center; 
          gap: 14px;
          padding: 0 24px;
          flex-wrap: wrap; 
        }

        .brand{
          display: inline-flex; align-items: center; gap: 10px;
          font-weight: 800; font-size: 22px; color: #fff;
          letter-spacing: .2px;
          white-space: nowrap; 
          flex-shrink: 0;
          margin-right: 10px;
        }
        .brand.as-btn{
          background: transparent; border: none;
          padding: 8px 10px; border-radius: 12px; cursor: pointer;
          transition: background .2s ease;
        }
        .brand.as-btn:hover{ background: rgba(255,255,255,.08); }

        .logo-wrap{
          display: inline-flex; align-items: center;
          height: 36px; width: 36px;
          overflow: visible;
          border-radius: 50%;
          padding: 2px; 
        }
        .logo{ height: 100%; width: 100%; object-fit: contain; display: block; border-radius: 50%; }
        .brand-text{ line-height: 1; transform: translateY(-1px); }

        .chip{
          display: inline-flex; align-items: center; justify-content: center;
          min-height: 40px;
          padding: 0 18px;
          border: 1px solid rgba(255,255,255,.55);
          border-radius: 999px;
          color: #e8f7ff; font-weight: 600;
          background: rgba(255,255,255,.06);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
          white-space: nowrap;
        }

        .spacer{ flex: 1; min-width: 10px; }

        .toolbar {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: nowrap; 
        }

        /* --- BUTTONS --- */
        .btn {
          padding: 10px 14px;
          background: #f4f6fb; color: #0f172a;
          border: none; border-radius: 12px; font-weight: 700;
          display: inline-flex; align-items: center; justify-content: center; 
          cursor: pointer; white-space: nowrap;
          transition: all 0.2s ease;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        .btn:hover { background: #eef2f9; transform: translateY(-1px); }
        .btn.active { background: #e0e7ff; color: #2563eb; }
        .btn:focus { outline: 2px solid rgba(255,255,255,.6); outline-offset: 2px; }

        .logout-btn {
          background: rgba(255,255,255,0.15) !important;
          color: white !important;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .logout-btn:hover {
          background: rgba(255,255,255,0.25) !important;
          color: white !important;
        }

        .iconbtn{
          width: 42px; height: 42px; display: grid; place-items: center;
          border-radius: 14px; border: none; background: #f4f6fb;
          color: #0f172a;
          cursor: pointer;
          flex-shrink: 0;
        }
        html[data-theme="dark"] .btn,
        html[data-theme="dark"] .iconbtn { background:#E8ECF7; color:#0b1020; }
        
        /* --- DROPDOWNS --- */
        .dropdown-wrap { position: relative; }
        
        .dropdown-menu {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          min-width: 240px;
          background: var(--panel, #fff);
          border: 1px solid var(--border, #e5e9f4);
          border-radius: 16px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.05);
          z-index: 1001;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          transform-origin: top right;
          animation: menuPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        @keyframes menuPop {
          from { opacity: 0; transform: scale(0.95) translateY(-5px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        html[data-theme="dark"] .dropdown-menu {
           background: #1e293b;
           border-color: #334155;
           box-shadow: 0 12px 32px rgba(0,0,0,0.4);
        }

        .dropdown-divider {
           height: 1px;
           background: var(--border, #e5e9f4);
           margin: 4px 0;
           width: 100%;
        }
        html[data-theme="dark"] .dropdown-divider {
           background: #334155;
        }
        
        .dropdown-item {
          display: flex;
          align-items: center;
          width: 100%;
          text-align: left;
          padding: 10px 12px;
          border-radius: 10px;
          background: none;
          border: none;
          color: var(--text, #0f172a);
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative; /* For submenu positioning */
        }
        
        .dropdown-item .item-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: var(--panel-2, #f1f4fb);
          color: var(--muted, #64748b);
          margin-right: 12px;
          transition: all 0.15s;
        }
        .item-icon.small svg { width: 14px; height: 14px; }
        
        .dropdown-item:hover {
          background: var(--panel-2, #f1f4fb);
          color: var(--primary, #2563eb);
        }
        
        .dropdown-item:hover .item-icon {
          background: #dbeafe;
          color: #2563eb;
        }

        .arrow { margin-left: auto; font-size: 16px; color: var(--muted, #94a3b8); line-height: 1; }
        .dropdown-item:hover .arrow { color: var(--primary, #2563eb); }

        /* --- SUBMENU STYLES --- */
        .submenu {
          display: none;
          position: absolute;
          left: 100%;
          top: -4px;
          margin-left: 8px;
          min-width: 180px;
          background: var(--panel, #fff);
          border: 1px solid var(--border, #e5e9f4);
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
          padding: 6px;
          animation: fadeLeft 0.2s ease;
          z-index: 1002;
        }
        @keyframes fadeLeft { from { opacity: 0; transform: translateX(-5px); } to { opacity: 1; transform: translateX(0); } }

        /* Show submenu on hover of parent item */
        .dropdown-item.parent:hover .submenu {
          display: block;
        }

        /* Prevent submenu from closing when hovering gap */
        .dropdown-item.parent::after {
          content: "";
          position: absolute;
          top: 0; right: -10px; bottom: 0; width: 15px;
        }

        .submenu-item {
          display: flex;
          align-items: center;
          width: 100%;
          text-align: left;
          padding: 8px 12px;
          border-radius: 8px;
          background: none;
          border: none;
          color: var(--text, #0f172a);
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.1s;
        }
        .submenu-item:hover { background: var(--panel-2, #f1f4fb); color: var(--primary, #2563eb); }
        .submenu-item .item-icon { width: 24px; height: 24px; margin-right: 10px; }

        html[data-theme="dark"] .dropdown-item:hover {
          background: #334155;
          color: #60a5fa;
        }
        html[data-theme="dark"] .dropdown-item .item-icon {
           background: #0f172a;
           color: #94a3b8;
        }
        html[data-theme="dark"] .dropdown-item:hover .item-icon {
           background: #1e3a8a;
           color: #60a5fa;
        }
        html[data-theme="dark"] .submenu {
           background: #1e293b;
           border-color: #334155;
        }
        html[data-theme="dark"] .submenu-item:hover {
           background: #334155;
           color: #60a5fa;
        }

        /* --- PROFILE --- */
        .profile-container {
          position: relative;
          margin-right: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
        }

        .profile-icon {
          width: 42px; 
          height: 42px;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          display: grid;
          place-items: center;
          transition: background 0.2s, transform 0.2s;
          color: #fff;
          border: 1px solid rgba(255,255,255,0.15);
        }
        
        .profile-container:hover .profile-icon {
          background: rgba(255,255,255,0.25);
          transform: translateY(1px);
        }

        .profile-details-tooltip {
          visibility: hidden;
          opacity: 0;
          position: absolute;
          top: 130%; 
          right: 0;
          background: #fff; 
          border: 1px solid #e5e9f4;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
          border-radius: 12px;
          padding: 12px 16px;
          min-width: 180px;
          z-index: 2000;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          transform: translateY(-8px);
          text-align: left;
          pointer-events: none; 
        }

        html[data-theme="dark"] .profile-details-tooltip {
          background: #1e293b;
          border-color: #334155;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }

        .profile-container:hover .profile-details-tooltip {
          visibility: visible;
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }

        .tooltip-name {
          font-weight: 700;
          color: #0f172a; 
          font-size: 14px;
          margin-bottom: 4px;
        }
        html[data-theme="dark"] .tooltip-name { color: #e6e9f2; }

        .tooltip-role {
          font-size: 11px;
          text-transform: uppercase;
          color: #64748b;
          font-weight: 700;
          letter-spacing: 0.5px;
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
          display: inline-block;
        }
        html[data-theme="dark"] .tooltip-role {
          background: #0f172a;
          color: #94a3b8;
        }

        /* --- RESPONSIVE --- */
        @media (max-width: 1100px) {
          .chip { display: none; } 
        }

        @media (max-width: 700px) {
          .app-header .container { padding: 10px 16px; }
          .btn-text { display: none; } 
          .btn { padding: 10px; min-width: 40px; }
          .dropdown-wrap .btn svg { margin-left: 0 !important; }
        }

        @media (max-width: 400px) {
           .brand-text { display: none; }
        }
      `}</style>
    </>
  );
}