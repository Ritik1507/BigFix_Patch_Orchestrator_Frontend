// src/App.jsx
import { useState, useMemo, useCallback, useEffect, Suspense, lazy, useRef } from "react";
import "./styles/Style.css";
import FlowCard, { Stage } from "./components/FlowCard.jsx";
import Environment, { EnvironmentProvider, useEnvironment } from "./components/Environment.jsx";
import DecisionEngine from "./components/DecisionEngine.jsx";
import ReportNotification from "./components/ReportNotification.jsx";
import Configuration from "./components/Configuration.jsx";
import Login from "./components/auth/Login.jsx";

const Header = lazy(() => import("./components/Header.jsx"));
const PilotEnvironment = lazy(() => import("./components/pilot/PilotEnvironment.jsx"));
const PilotSandboxResult = lazy(() => import("./components/pilot/PilotSandboxResult.jsx"));
const PilotKPI = lazy(() => import("./components/pilot/PilotKPI.jsx"));
const PilotDecisionEngine = lazy(() => import("./components/pilot/PilotDecisionEngine.jsx"));
const PilotReports = lazy(() => import("./components/pilot/PilotReports.jsx"));
const Management = lazy(() => import("./components/Management.jsx"));
const UserManagement = lazy(() => import("./components/UserManagement.jsx"));
const BaselineManager = lazy(() => import("./components/BaselineManager.jsx"));
const GroupManager = lazy(() => import("./components/GroupManager.jsx"));
const SnapshotManager = lazy(() => import("./components/SnapshotSelector.jsx"));
const CloneManager = lazy(() => import("./components/CloneSelector.jsx"));
const PatchCalendar = lazy(() => import("./components/PatchCalendar.jsx"));

const API = window.env?.VITE_API_BASE || "http://localhost:5174";

async function getJSON(url) { const r = await fetch(url, { headers: { Accept: "application/json" } }); return r.json(); }
async function postJSON(url, body) { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return r.json(); }

// FIX: EUC mapped to 9004
const STATE_ID_MAP = { 'Admin': 1, 'Windows': 9002, 'Linux': 9003, 'EUC': 9004 };

function Main({ userId, username, role, onOpenSnapshot, onOpenClone }) {
  const { env } = useEnvironment();
  const [stateLoading, setStateLoading] = useState(true);
  const isInitialMount = useRef(true);
  const [currentStage, setCurrentStage] = useState(Stage.CONFIG);
  const [sandboxTriggered, setSandboxTriggered] = useState(false);
  const [pilotTriggered, setPilotTriggered] = useState(false);
  const [configLocked, setConfigLocked] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [completedStages, setCompletedStages] = useState([]);
  const [lastActions, setLastActions] = useState({});

  const isEUC = role === 'EUC';
  const apiBase = useMemo(() => API, []);
  const sharedStateId = STATE_ID_MAP[role] || 1;

  const fetchState = useCallback(async () => {
    if (!userId) { setStateLoading(false); return; }
    setStateLoading(true);
    try {
      const data = await getJSON(`${apiBase}/api/auth/state/${sharedStateId}`);
      if (data.state) {
        const s = data.state;
        if (s?.currentStage) setCurrentStage(s.currentStage);
        if (Array.isArray(s?.completedStages)) setCompletedStages(s.completedStages);
        if (s?.configSaved) setConfigSaved(true);
        if (s?.configLocked) setConfigLocked(true);
        if (s?.sandboxTriggered) setSandboxTriggered(true);
        if (s?.pilotTriggered) setPilotTriggered(true);
        if (s?.lastActions) setLastActions(s.lastActions);
      }
    } catch {} finally { setStateLoading(false); setTimeout(() => { isInitialMount.current = false; }, 50); }
  }, [userId, sharedStateId, apiBase]);

  useEffect(() => { fetchState(); }, [fetchState]);

  useEffect(() => {
    if (stateLoading || isInitialMount.current || !userId) return;
    postJSON(`${apiBase}/api/auth/state/${sharedStateId}`, {
      currentStage, completedStages, configSaved, configLocked, sandboxTriggered, pilotTriggered, lastActions
    }).catch(console.error);
  }, [stateLoading, userId, currentStage, completedStages, configSaved, configLocked, sandboxTriggered, pilotTriggered, lastActions]);

  const postStageSignal = async (stage, status) => { try { await fetch(`${apiBase}/orchestrator/stages/${stage}`, { method: "POST", body: JSON.stringify({ status }) }); } catch {} };
  const addCompleted = (stage) => { setCompletedStages(p => p.includes(stage) ? p : [...p, stage]); postStageSignal(stage, "completed"); };

  // Custom Navigation Logic for EUC (Config -> Production)
  const canGotoStage = useCallback((next) => {
    if (next === Stage.CONFIG) return true;
    if (next === Stage.PRODUCTION && isEUC && (configSaved || completedStages.includes(Stage.CONFIG))) return true; 
    if (next === Stage.SANDBOX) return !isEUC && (configSaved || completedStages.includes(Stage.CONFIG));
    if (next === Stage.PILOT) return !isEUC && completedStages.includes(Stage.SANDBOX);
    if (next === Stage.PRODUCTION) return completedStages.includes(Stage.PILOT);
    if (next === Stage.FinalResult) return completedStages.includes(Stage.PRODUCTION);
    return false;
  }, [configSaved, completedStages, isEUC]);

  const handleStageChange = (next) => { if (canGotoStage(next)) { setCurrentStage(next); postStageSignal(next, "active"); } };
  const recordAction = (stage, id) => { if(id) setLastActions(p => ({ ...p, [stage]: { id, ts: Date.now() } })); };

  function handleConfigSaved() {
    setConfigSaved(true); setConfigLocked(true); addCompleted(Stage.CONFIG);
    // Jump to Production directly if EUC
    const next = isEUC ? Stage.PRODUCTION : Stage.SANDBOX;
    setCurrentStage(next); postStageSignal(next, "active");
  }

  const handleSandboxDone = async (result) => {
    if (!result?.ok) return;
    const id = result?.actionId;
    if (id) recordAction(Stage.SANDBOX, id);
    setSandboxTriggered(true); addCompleted(Stage.SANDBOX);
    setCurrentStage(Stage.PILOT);
  };

  useEffect(() => {
    const onPilotTrig = (e) => {
      const id = e?.detail?.actionId; if(id) recordAction(Stage.PILOT, id);
      setPilotTriggered(true); addCompleted(Stage.PILOT); setCurrentStage(Stage.PRODUCTION);
    };
    window.addEventListener("pilot:triggered", onPilotTrig);
    return () => window.removeEventListener("pilot:triggered", onPilotTrig);
  }, [addCompleted]);

  useEffect(() => {
    const onProdTrig = (e) => {
      const id = e?.detail?.actionId; if(id) recordAction(Stage.PRODUCTION, id);
      addCompleted(Stage.PRODUCTION); addCompleted(Stage.FinalResult); setCurrentStage(Stage.FinalResult);
    };
    window.addEventListener("production:triggered", onProdTrig);
    return () => window.removeEventListener("production:triggered", onProdTrig);
  }, [addCompleted]);

  if (stateLoading) return <div className="app-content" style={{textAlign:'center', padding:40}}>Loading...</div>;

  return (
    <div className="app-content">
      {/* Pass role to FlowCard */}
      <FlowCard activeStage={currentStage} completedStages={completedStages} gotoStage={handleStageChange} canGotoStage={canGotoStage} role={role} />

      {currentStage === Stage.CONFIG && <Configuration onSaved={handleConfigSaved} />}

      {/* Render Sandbox only if NOT EUC */}
      {currentStage === Stage.SANDBOX && !isEUC && (
        <>
          <Environment />
          <div className="two-up-cards">
            <DecisionEngine apiBase={apiBase} baseline={env.baseline} group={env.sbxGroup} autoMail={env.autoMail} onDone={handleSandboxDone} disabled={currentStage !== Stage.SANDBOX || sandboxTriggered} username={username} />
            <ReportNotification />
          </div>
        </>
      )}

      {/* Render Pilot only if NOT EUC */}
      {currentStage === Stage.PILOT && !isEUC && (
        <Suspense fallback={<div>Loading Pilot...</div>}>
          <div className="grid g-3"><PilotEnvironment mode="pilot" /><PilotSandboxResult title="Sandbox Result" actionId={lastActions?.SANDBOX?.id} /><PilotKPI title="Pilot KPI" lastActions={lastActions} /></div>
          <div className="two-up-cards"><PilotDecisionEngine sbxDone={sandboxTriggered} mode="pilot" autoMail={env.autoMail} readOnly={pilotTriggered} lastActions={lastActions} username={username} onOpenSnapshot={onOpenSnapshot} onOpenClone={onOpenClone} /><PilotReports /></div>
        </Suspense>
      )}

      {/* Production Stage - Adjusted for EUC */}
      {currentStage === Stage.PRODUCTION && (
        <Suspense fallback={<div>Loading Production...</div>}>
          {/* Use 'euc-layout' class for 2-column grid when EUC to remove gaps */}
          <div className={`grid g-3 ${isEUC ? "euc-layout" : ""}`}>
            <PilotEnvironment mode="production" />
            
            {/* HIDE PilotSandboxResult COMPLETELY if EUC (no gap) */}
            {!isEUC && (
              <PilotSandboxResult title="Pilot Result" actionId={lastActions?.PILOT?.id} />
            )}
            
            <PilotKPI title="Production KPI" lastActions={lastActions} />
          </div>

          <div className="two-up-cards">
            {/* For EUC, pass forced 'done' props so engine enables Trigger */}
            <PilotDecisionEngine sbxDone={true} pilotDone={true} mode="production" autoMail={env.autoMail} lastActions={lastActions} username={username} onOpenSnapshot={onOpenSnapshot} onOpenClone={onOpenClone} role={role} />
            <PilotReports />
          </div>
        </Suspense>
      )}

      {/* Final Result Stage */}
      {currentStage === Stage.FinalResult && (
        <Suspense fallback={null}>
          {/* For EUC, use g-1 to show single card properly centered or full width. For others, g-3. */}
          <div className={`grid ${isEUC ? "g-1" : "g-3"}`}>
            {!isEUC && <PilotSandboxResult title="Sandbox Result" actionId={lastActions?.SANDBOX?.id} />}
            {!isEUC && <PilotSandboxResult title="Pilot Result" actionId={lastActions?.PILOT?.id} />}
            {/* This one renders for everyone, fulfilling the user's request */}
            <PilotSandboxResult title="Production Result" actionId={lastActions?.PRODUCTION?.id} />
          </div>
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showUserMgmt, setShowUserMgmt] = useState(false);
  const [showBaseline, setShowBaseline] = useState(false);
  const [showGroup, setShowGroup] = useState(false); 
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [showClone, setShowClone] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const closeAll = () => { setShowSettings(false); setShowUserMgmt(false); setShowBaseline(false); setShowGroup(false); setShowSnapshot(false); setShowClone(false); setShowCalendar(false); };
  const handleLogout = async () => { try { await postJSON(`${API}/api/auth/logout`, {}); } catch {} setSession(null); closeAll(); sessionStorage.removeItem('BPS_SESSION_ACTIVE'); };

  useEffect(() => {
    setAuthLoading(true);
    getJSON(`${API}/api/auth/status`).then(d => {
       if(d.ok && d.authed && sessionStorage.getItem('BPS_SESSION_ACTIVE')) setSession(d.userData);
       else { setSession(null); sessionStorage.removeItem('BPS_SESSION_ACTIVE'); }
    }).finally(() => setAuthLoading(false));
  }, []);

  if (authLoading) return <div style={{display:'grid',placeItems:'center',height:'100vh'}}>Loading...</div>;

  return (
    <EnvironmentProvider>
      <Header onOpenSettings={()=>{closeAll();setShowSettings(true)}} onOpenUsers={()=>{closeAll();setShowUserMgmt(true)}} onOpenBaseline={()=>{closeAll();setShowBaseline(true)}} onOpenGroup={()=>{closeAll();setShowGroup(true)}} onOpenSnapshot={()=>{closeAll();setShowSnapshot(true)}} onOpenClone={()=>{closeAll();setShowClone(true)}} onOpenCalendar={()=>{closeAll();setShowCalendar(true)}} authed={!!session} onLogout={handleLogout} role={session?.role} username={session?.username} />
      {!session ? <Login onSuccess={(u)=>{sessionStorage.setItem('BPS_SESSION_ACTIVE','true');setSession(u)}} /> : 
       showBaseline ? <Suspense fallback={null}><div className="app-content"><BaselineManager onClose={()=>setShowBaseline(false)}/></div></Suspense> :
       showGroup ? <Suspense fallback={null}><div className="app-content"><GroupManager onClose={()=>setShowGroup(false)}/></div></Suspense> :
       showSnapshot ? <Suspense fallback={null}><div className="app-content"><SnapshotManager onClose={()=>setShowSnapshot(false)} groupName="All Computers"/></div></Suspense> :
       showClone ? <Suspense fallback={null}><div className="app-content"><CloneManager onClose={()=>setShowClone(false)} groupName="All Computers"/></div></Suspense> :
       showCalendar ? <Suspense fallback={null}><div className="app-content"><PatchCalendar onClose={()=>setShowCalendar(false)} userRole={session?.role} /></div></Suspense> :
       showSettings ? <Suspense fallback={null}><div className="app-content"><Management onClose={()=>setShowSettings(false)}/></div></Suspense> :
       showUserMgmt ? <Suspense fallback={null}><div className="app-content"><UserManagement onClose={()=>setShowUserMgmt(false)} currentUserId={session?.userId}/></div></Suspense> :
       <Main userId={session?.userId} username={session?.username} role={session?.role} onOpenSnapshot={()=>{closeAll();setShowSnapshot(true)}} onOpenClone={()=>{closeAll();setShowClone(true)}} />
      }
      <style>{`:root{ --header-h:68px; } .app-content{ padding: 10px} html, body { height:100%; }`}</style>
    </EnvironmentProvider>
  );
}