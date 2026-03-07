import { useState } from "react";
import PatchTab from "./PatchTab";
import BaselineTab from "./BaselineTab";
import DashboardTab from "./DashboardTab";
import "./Risk.css";

export default function RiskModule() {
  const [activeTab, setActiveTab] = useState("patches");

  const [baselines, setBaselines] = useState([]);

  const [pendingPatches, setPendingPatches] = useState([]);

  const addBaseline = (data) => {
    setPendingPatches(data.patches);

    setActiveTab("baseline");
  };

  const updateBaseline = (updatedBaseline) => {
    setBaselines((prev) =>
      prev.map((b) => (b.id === updatedBaseline.id ? updatedBaseline : b)),
    );
  };

  const deleteBaseline = (id) => {
    setBaselines((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <div className="risk-container">
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
        {activeTab === "patches" && <PatchTab addBaseline={addBaseline} />}

        {activeTab === "baseline" && (
          <BaselineTab
            baselines={baselines}
            pendingPatches={pendingPatches}
            updateBaseline={updateBaseline}
            deleteBaseline={deleteBaseline}
          />
        )}

        {activeTab === "dashboard" && <DashboardTab baselines={baselines} />}
      </div>
    </div>
  );
}
