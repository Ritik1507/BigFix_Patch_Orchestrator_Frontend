import { useState, useEffect } from "react";
import PatchTab from "./PatchTab";
import BaselineTab from "./BaselineTab";
import DashboardTab from "./DashboardTab";
import api from "../../api/api";
import "./Risk.css";

export default function RiskModule({ onClose }) {

  const [activeTab, setActiveTab] = useState("patches");

  const [baselines, setBaselines] = useState([]);
  const [pendingPatches, setPendingPatches] = useState([]);

  const [patches, setPatches] = useState([]);
  const [patchLoading, setPatchLoading] = useState(true);

  const addBaseline = (data) => {
    setPendingPatches(data.patches);
    setActiveTab("baseline");
  };

  const updateBaseline = (updatedBaseline) => {
    setBaselines((prev) =>
      prev.map((b) => (b.id === updatedBaseline.id ? updatedBaseline : b))
    );
  };

  const deleteBaseline = (id) => {
    setBaselines((prev) => prev.filter((b) => b.id !== id));
  };

  const handleClose = () => {
    if (onClose) onClose();
  };

  useEffect(() => {

    const loadPatches = async () => {

      try {
        const res = await api.get("/patches");
        setPatches(res.data || []);
      } catch (err) {
        console.error("Failed to load patches", err);
      } finally {
        setPatchLoading(false);
      }

    };

    loadPatches();

  }, []);

  return (
    <div className="risk-container">

      <div className="risk-header">
        <h2>Risk Prioritization</h2>

        <button className="btn" onClick={handleClose}>
          Close
        </button>
      </div>

      <div className="risk-tabs">

        <button
          className={activeTab === "patches" ? "active" : ""}
          onClick={() => setActiveTab("patches")}
        >
          Patches
        </button>

        <button
          className={activeTab === "baseline" ? "active" : ""}
          onClick={() => setActiveTab("baseline")}
        >
          Baseline
        </button>

        <button
          className={activeTab === "dashboard" ? "active" : ""}
          onClick={() => setActiveTab("dashboard")}
        >
          Dashboard
        </button>

      </div>

      <div className="risk-content">

        {activeTab === "patches" && (
          <PatchTab
            patches={patches}
            patchLoading={patchLoading}
            addBaseline={addBaseline}
          />
        )}

        {activeTab === "baseline" && (
          <BaselineTab
            baselines={baselines}
            pendingPatches={pendingPatches}
            updateBaseline={updateBaseline}
            deleteBaseline={deleteBaseline}
          />
        )}

        {activeTab === "dashboard" && (
          <DashboardTab baselines={baselines} />
        )}

      </div>

    </div>
  );
}