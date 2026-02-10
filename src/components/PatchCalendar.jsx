// src/components/PatchCalendar.jsx
import { useState, useMemo, useEffect } from "react";

const DAYS_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// CSV Config
const CSV_HEADER = "Server,Day,Month,Year,Time,Operating System";
const SAMPLE_CSV = `Server-Win-01,15,January,2025,10:00 AM,Windows
Server-Win-02,16,January,2025,10:30 AM,Windows
DB-Linux-01,20,February,2025,02:00 PM,Linux`;

const API_BASE = window.env?.VITE_API_BASE || "http://localhost:5174";

export default function PatchCalendar({ onClose, userRole }) {
  // State for Navigation (Track specific date to know Month/Year)
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Data States
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal States
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const isAdmin = (userRole || "").toLowerCase() === "admin";

  // --- Derived Values for Calendar Grid ---
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOffset = new Date(year, month, 1).getDay(); // 0 = Sun

  // --- Fetch Data ---
  useEffect(() => {
    fetchEvents();
  }, [userRole]); // Fetch once on mount/role change

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/calendar?role=${encodeURIComponent(userRole)}`);
      const data = await res.json();
      if (data.ok) {
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error("Failed to fetch calendar", err);
    } finally {
      setLoading(false);
    }
  };

  // --- Navigation Handlers ---
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  // --- CSV Handling ---
  const downloadTemplate = () => {
    const blob = new Blob([`${CSV_HEADER}\n${SAMPLE_CSV}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "patch_schedule_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = (evt) => parseCSV(evt.target.result);
    reader.readAsText(file);
    e.target.value = null; 
  };

  const parseCSV = async (text) => {
    const lines = text.split(/\r?\n/);
    const newEvents = [];
    const nowYear = new Date().getFullYear();
    
    const startIndex = lines[0].toLowerCase().startsWith("server") ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(",");
      if (parts.length < 6) continue; 

      const server = parts[0].trim();
      const day = parseInt(parts[1].trim(), 10);
      const monthRaw = parts[2].trim();
      const yr = parseInt(parts[3].trim(), 10);
      const time = parts[4].trim();
      const os = parts[5].trim(); 

      let monthIndex = -1;
      if (!isNaN(monthRaw)) monthIndex = parseInt(monthRaw, 10) - 1;
      else monthIndex = MONTH_NAMES.findIndex(m => m.toLowerCase() === monthRaw.toLowerCase());

      if (!server || isNaN(day) || monthIndex === -1 || isNaN(yr) || !os) continue;

      if (yr !== nowYear) {
        setError(`Error: Row ${i+1} has year ${yr}. Only current year (${nowYear}) is allowed.`);
        return;
      }
      newEvents.push({ server, day, monthIndex, year: yr, time, os });
    }
    
    if (newEvents.length === 0) {
      setError("No valid events found in CSV.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/calendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: newEvents })
      });
      const data = await res.json();
      if (data.ok) {
        setEvents(newEvents);
        alert("Schedule uploaded successfully!");
      } else {
        setError("Failed to save: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      setError("Network error saving schedule.");
    } finally {
      setLoading(false);
    }
  };

  // --- Group Events for Current Month View ---
  const eventsByDate = useMemo(() => {
    const map = {}; 
    events.forEach(ev => {
      // Only map events for the currently viewed Month and Year
      if (ev.year === year && ev.monthIndex === month) {
        if (!map[ev.day]) map[ev.day] = [];
        map[ev.day].push(ev);
      }
    });
    return map;
  }, [events, year, month]);

  const handleDayClick = (day, dayEvents) => {
    if (!dayEvents || dayEvents.length === 0) return;
    setSearchTerm("");
    setSelectedDetails({
      title: `${MONTH_NAMES[month]} ${day}, ${year}`,
      events: dayEvents
    });
  };

  const filteredModalEvents = useMemo(() => {
    if (!selectedDetails) return [];
    if (!searchTerm) return selectedDetails.events;
    const lower = searchTerm.toLowerCase();
    return selectedDetails.events.filter(ev => 
      ev.server.toLowerCase().includes(lower) || 
      ev.os.toLowerCase().includes(lower)
    );
  }, [selectedDetails, searchTerm]);

  return (
    <div className="calendar-layout fade-in">
      {/* --- HEADER --- */}
      <div className="cal-header-bar">
        <div className="header-left">
          <h2>Patch Calendar</h2>
          <div className="nav-controls">
            <button onClick={prevMonth} className="nav-btn">‹</button>
            <span className="current-date-label">{MONTH_NAMES[month]} {year}</span>
            <button onClick={nextMonth} className="nav-btn">›</button>
            <button onClick={goToToday} className="today-btn">Today</button>
          </div>
        </div>

        <div className="header-right">
          {isAdmin && (
            <>
              <button className="btn-text" onClick={downloadTemplate}>Template</button>
              <label className="btn-upload">
                {loading ? "Syncing..." : "Upload CSV"}
                <input type="file" accept=".csv" onChange={handleFileUpload} hidden disabled={loading} />
              </label>
            </>
          )}
          <button className="btn-close-cal" onClick={onClose}>×</button>
        </div>
      </div>

      {error && <div className="error-alert">{error}</div>}

      {/* --- MAIN GRID --- */}
      <div className="cal-grid-container">
        {/* Weekday Headers */}
        <div className="weekday-row">
          {DAYS_WEEK.map(d => <div key={d} className="weekday-cell">{d}</div>)}
        </div>

        {/* Days Grid */}
        <div className="days-matrix">
          {/* Empty cells for previous month */}
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="day-card empty" />
          ))}

          {/* Actual Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayEvents = eventsByDate[day] || [];
            const hasEvent = dayEvents.length > 0;
            const isToday = 
              new Date().getDate() === day && 
              new Date().getMonth() === month && 
              new Date().getFullYear() === year;

            return (
              <div 
                key={day} 
                className={`day-card ${hasEvent ? "active" : ""} ${isToday ? "today" : ""}`}
                onClick={() => handleDayClick(day, dayEvents)}
              >
                <div className="day-header">
                  <span className="day-num">{day}</span>
                </div>
                
                {/* Event Indicator Block */}
                {hasEvent && (
                  <div className="event-block">
                    <span className="icon">⚙️</span>
                    <div className="event-info">
                      <span className="event-title">Patch Deployment</span>
                      <span className="event-count">{dayEvents.length} Server{dayEvents.length > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* --- MODAL (Same as before but styled cleaner) --- */}
      {selectedDetails && (
        <div className="cal-modal-overlay" onClick={() => setSelectedDetails(null)}>
          <div className="cal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <h3>{selectedDetails.title}</h3>
              <button onClick={() => setSelectedDetails(null)}>×</button>
            </div>
            <div className="modal-search">
              <input 
                placeholder="Search server..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                autoFocus
              />
            </div>
            <div className="modal-list">
              <table className="modal-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Server</th>
                    <th>OS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredModalEvents.map((ev, idx) => (
                    <tr key={idx}>
                      <td style={{fontFamily:'monospace', fontSize:'0.9em'}}>{ev.time}</td>
                      <td style={{fontWeight:'600'}}>{ev.server}</td>
                      <td>
                        <span className={`os-badge ${ev.os.toLowerCase().includes("win") ? "win" : "linux"}`}>
                          {ev.os}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredModalEvents.length === 0 && (
                    <tr><td colSpan="3" className="no-data">No servers found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* --- LAYOUT --- */
        .calendar-layout {
          height: 100%; display: flex; flex-direction: column;
          background: #f0f4f8; /* Soft blue-grey background */
          padding: 24px;
          font-family: 'Inter', sans-serif;
          color: #1e293b;
        }

        /* --- HEADER --- */
        .cal-header-bar {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 24px;
        }
        .header-left h2 { margin: 0 0 12px 0; font-size: 24px; font-weight: 800; color: #0f172a; }
        .nav-controls {
          display: flex; align-items: center; gap: 12px;
          background: #fff; padding: 6px 12px; border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .nav-btn {
          border: none; background: transparent; font-size: 24px; 
          cursor: pointer; color: #64748b; line-height: 1; padding: 0 8px;
        }
        .nav-btn:hover { color: #2563eb; }
        .current-date-label { font-size: 18px; font-weight: 700; min-width: 140px; text-align: center; }
        .today-btn {
          margin-left: 8px; padding: 6px 12px; border-radius: 6px;
          border: 1px solid #e2e8f0; background: #f8fafc;
          font-weight: 600; font-size: 13px; cursor: pointer; color: #475569;
        }
        .today-btn:hover { background: #e2e8f0; }

        .header-right { display: flex; align-items: center; gap: 12px; }
        .btn-text { background: none; border: none; font-weight: 600; color: #64748b; cursor: pointer; }
        .btn-text:hover { color: #2563eb; text-decoration: underline; }
        
        .btn-upload {
          background: #2563eb; color: #fff; padding: 10px 20px;
          border-radius: 8px; font-weight: 600; cursor: pointer;
          transition: background 0.2s;
        }
        .btn-upload:hover { background: #1d4ed8; }
        
        .btn-close-cal {
          font-size: 32px; background: none; border: none; color: #94a3b8;
          cursor: pointer; margin-left: 10px;
        }
        .btn-close-cal:hover { color: #ef4444; }

        /* --- GRID --- */
        .cal-grid-container {
          flex: 1; display: flex; flex-direction: column;
          background: #fff; border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.04);
          overflow: hidden; border: 1px solid #e2e8f0;
        }
        
        .weekday-row {
          display: grid; grid-template-columns: repeat(7, 1fr);
          background: #f1f5f9; border-bottom: 1px solid #e2e8f0;
        }
        .weekday-cell {
          padding: 12px; text-align: center; font-weight: 700; 
          color: #64748b; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;
        }

        .days-matrix {
          display: grid; grid-template-columns: repeat(7, 1fr);
          grid-auto-rows: 1fr; /* Equal height rows */
          flex: 1;
        }

        .day-card {
          border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;
          padding: 12px; display: flex; flex-direction: column;
          background: #fff; transition: background 0.1s;
          min-height: 120px; /* Ensure tall cells */
          position: relative;
        }
        .day-card:nth-child(7n) { border-right: none; } /* No border on right edge */
        
        .day-card.empty { background: #f8fafc; }
        
        .day-card:hover:not(.empty) { background: #f8fafc; cursor: pointer; }
        
        .day-num { font-weight: 600; color: #64748b; font-size: 14px; margin-bottom: 8px; }
        
        /* Today Style */
        .day-card.today .day-num {
          color: #2563eb; font-weight: 800;
        }
        .day-card.today { background: #eff6ff; }

        /* Active Event Style (Like image) */
        .day-card.active {
          background: #fff;
        }
        .day-card.active .day-num { color: #334155; }

        /* The "Patch Deployment" Block */
        .event-block {
          background: #1e40af; /* Deep blue from image */
          color: #fff;
          border-radius: 6px;
          padding: 8px;
          display: flex; gap: 8px; align-items: center;
          box-shadow: 0 4px 6px rgba(30, 64, 175, 0.2);
          animation: slideUp 0.2s ease;
        }
        .event-block .icon { font-size: 14px; filter: grayscale(1) brightness(2); }
        .event-info { display: flex; flex-direction: column; }
        .event-title { font-size: 11px; font-weight: 700; text-transform: uppercase; opacity: 0.9; }
        .event-count { font-size: 10px; opacity: 0.8; }

        /* --- MODAL --- */
        .cal-modal-overlay {
          position: fixed; inset: 0; background: rgba(15,23,42,0.4);
          backdrop-filter: blur(4px); z-index: 2000;
          display: flex; align-items: center; justify-content: center;
        }
        .cal-modal {
          background: #fff; width: 500px; max-width: 90%;
          border-radius: 16px; overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
          animation: slideUp 0.2s ease;
        }
        .modal-top {
          padding: 16px 24px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
          display: flex; justify-content: space-between; align-items: center;
        }
        .modal-top h3 { margin: 0; font-size: 18px; color: #0f172a; }
        .modal-top button { border: none; background: none; font-size: 24px; cursor: pointer; color: #94a3b8; }
        .modal-top button:hover { color: #ef4444; }

        .modal-search { padding: 12px 24px; border-bottom: 1px solid #e2e8f0; }
        .modal-search input {
          width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none;
        }
        .modal-search input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.1); }

        .modal-list { max-height: 400px; overflow-y: auto; }
        .modal-table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
        .modal-table th { 
          position: sticky; top: 0; background: #fff; 
          padding: 10px 24px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600; 
        }
        .modal-table td { padding: 10px 24px; border-bottom: 1px solid #f1f5f9; color: #334155; }
        .modal-table tr:hover td { background: #f8fafc; }
        
        .os-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
        .os-badge.win { background: #e0f2fe; color: #0369a1; }
        .os-badge.linux { background: #fff7ed; color: #c2410c; }
        
        .no-data { text-align: center; padding: 20px; color: #94a3b8; font-style: italic; }
        .error-alert { background: #fee2e2; color: #991b1b; padding: 12px; margin-bottom: 20px; border-radius: 8px; border: 1px solid #fecaca; }

        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}