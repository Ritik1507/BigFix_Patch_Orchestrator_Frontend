// vite-project/src/components/ValidationGate.jsx
import { useState, useEffect } from "react";

export default function ValidationGate({ targetGroupName, onValidationChange }) {
  const [status, setStatus] = useState("idle"); // idle, checking, success, error
  const [data, setData] = useState(null);

  // --- FIX: Reset state when the Target Group changes ---
  useEffect(() => {
    // 1. Reset local state to 'idle' so the user knows they must validate again
    setStatus("idle");
    setData(null);
    
    // 2. Lock the parent Trigger button immediately
    // This prevents triggering Pilot for Group B based on Group A's successful validation
    onValidationChange(false);
  }, [targetGroupName, onValidationChange]);

  const handleValidate = async () => {
    setStatus("checking");
    const API = window.env?.VITE_API_BASE || "http://localhost:5174";
    
    try {
      const res = await fetch(`${API}/api/vcenter/validate`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json", 
            "x-user-role": sessionStorage.getItem("user_role") || "Admin" 
        },
        body: JSON.stringify({ 
            groupName: targetGroupName, 
            lookbackHours: 24 
        })
      });
      const json = await res.json();
      
      setData(json);
      
      if (json.ok && json.ready) {
        setStatus("success");
        onValidationChange(true); // Unlock Parent
      } else {
        setStatus("error");
        onValidationChange(false); // Keep Locked
      }
    } catch (e) {
      console.error(e);
      setStatus("error");
      onValidationChange(false);
    }
  };

  return (
    <div style={{ background: "#f8fafc", padding: "15px", border: "1px solid #e2e8f0", borderRadius: "8px", marginBottom: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h4 style={{ margin: "0 0 5px 0", fontSize: "14px", color: "#334155" }}>
            🛡️ Pre-Flight: Backup Validation
          </h4>
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            Checking group: <b>{targetGroupName || "None"}</b>
          </div>
        </div>

        {status === "idle" && (
           <button 
             className="btn" 
             onClick={handleValidate} 
             style={{padding: "6px 12px"}}
             disabled={!targetGroupName}
           >
             Validate
           </button>
        )}
        
        {status === "checking" && <span className="pill blue" style={{padding: "4px 8px", borderRadius:4, background:"#dbeafe", color:"#1e40af", fontSize:12}}>Checking...</span>}
        
        {status === "success" && (
           <span className="pill green" style={{padding: "4px 8px", borderRadius:4, background:"#dcfce7", color:"#166534", fontSize:12}}>
             ✓ All {data?.total || 0} Protected
           </span>
        )}
        
        {status === "error" && data?.missing && (
           <span className="pill red" style={{padding: "4px 8px", borderRadius:4, background:"#fee2e2", color:"#991b1b", fontSize:12}}>
             ⚠ {data.missing.length} Missing
           </span>
        )}
        
        {status === "error" && !data?.missing && (
           <span className="pill red" style={{padding: "4px 8px", borderRadius:4, background:"#fee2e2", color:"#991b1b", fontSize:12}}>
             ⚠ Error
           </span>
        )}
      </div>

      {status === "error" && data?.missing?.length > 0 && (
        <div style={{ marginTop: "10px", padding: "10px", background: "#fee2e2", borderRadius: "4px", fontSize: "12px", color: "#991b1b" }}>
          <b>Validation Failed.</b> These servers have no Snapshot or Clone in the last 24h:
          <ul style={{ margin: "5px 0 0 0", paddingLeft: "20px" }}>
            {data.missing.map(m => <li key={m}>{m}</li>)}
            {data.total > (data.protected || 0) + data.missing.length && <li>...and others</li>}
          </ul>
        </div>
      )}
    </div>
  );
}