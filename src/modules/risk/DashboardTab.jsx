
import { useState } from "react";

import DashboardOverview from "./dashboard_component/DashboardOverview";
import CVEDashboard from "./dashboard_component/CVEDashboard";
import PatchDashboard from "./dashboard_component/PatchDashboard";
import ComputerDashboard from "./dashboard_component/ComputerDashboard";
import BaselineDashboard from "./dashboard_component/BaselineDashboard";

import "./dashboard.css";

export default function DashboardTab() {

  const [activeSection, setActiveSection] = useState("overview");

  return (

    <div className="dashboard-container">

      {/* DASHBOARD NAVIGATION */}

      <div className="dashboard-tabs">

        <button
          className={activeSection === "overview" ? "active" : ""}
          onClick={() => setActiveSection("overview")}
        >
          Overview
        </button>

        <button
          className={activeSection === "cve" ? "active" : ""}
          onClick={() => setActiveSection("cve")}
        >
          CVEs
        </button>

        <button
          className={activeSection === "patch" ? "active" : ""}
          onClick={() => setActiveSection("patch")}
        >
          Patches
        </button>

        <button
          className={activeSection === "computer" ? "active" : ""}
          onClick={() => setActiveSection("computer")}
        >
          Computers
        </button>

        <button
          className={activeSection === "baseline" ? "active" : ""}
          onClick={() => setActiveSection("baseline")}
        >
          Baselines
        </button>

      </div>

      {/* DASHBOARD CONTENT */}

      <div className="dashboard-content">

        {activeSection === "overview" &&
          <DashboardOverview navigate={setActiveSection} />
        }

        {activeSection === "cve" &&
          <CVEDashboard navigate={setActiveSection} />
        }

        {activeSection === "patch" &&
          <PatchDashboard navigate={setActiveSection} />
        }

        {activeSection === "computer" &&
          <ComputerDashboard navigate={setActiveSection} />
        }

        {activeSection === "baseline" &&
          <BaselineDashboard navigate={setActiveSection} />
        }

      </div>

    </div>
  );
}