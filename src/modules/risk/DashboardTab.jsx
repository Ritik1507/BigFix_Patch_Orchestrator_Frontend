import { useState, useEffect } from "react";
import api from "../../api/api";

import DashboardOverview from "./dashboard_component/DashboardOverview";
import CVEDashboard from "./dashboard_component/CVEDashboard";
import PatchDashboard from "./dashboard_component/PatchDashboard";
import ComputerDashboard from "./dashboard_component/ComputerDashboard";
import BaselineDashboard from "./dashboard_component/BaselineDashboard";

import "./dashboard.css";

export default function DashboardTab({ baselines }) {

  const [activeSection, setActiveSection] = useState("overview");

  const [patches, setPatches] = useState([]);
  const [cves, setCves] = useState([]);

  const [loading, setLoading] = useState(true);

  /* =========================================
     LOAD PATCHES + CVES (FROM BACKEND CACHE)
  ========================================= */

  useEffect(() => {

    const loadDashboardData = async () => {

      try {

        const [patchRes, cveRes] = await Promise.all([
          api.get("/patches"),
          api.get("/cves")
        ]);

        setPatches(patchRes.data || []);
        setCves(cveRes.data?.data || []);

      } catch (err) {

        console.error("Dashboard load failed:", err);

      } finally {

        setLoading(false);

      }

    };

    loadDashboardData();

  }, []);

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

        {loading && (
          <div className="dashboard-loading">
            Loading dashboard...
          </div>
        )}

        {!loading && activeSection === "overview" &&
          <DashboardOverview
            navigate={setActiveSection}
            patches={patches}
            cves={cves}
            baselines={baselines}
          />
        }

        {!loading && activeSection === "cve" &&
          <CVEDashboard
            navigate={setActiveSection}
            patches={patches}
            cves={cves}
            baselines={baselines}
          />
        }

        {!loading && activeSection === "patch" &&
          <PatchDashboard
            navigate={setActiveSection}
            patches={patches}
            cves={cves}
            baselines={baselines}
          />
        }

        {!loading && activeSection === "computer" &&
          <ComputerDashboard
            navigate={setActiveSection}
            patches={patches}
            cves={cves}
            baselines={baselines}
          />
        }

        {!loading && activeSection === "baseline" &&
          <BaselineDashboard
            navigate={setActiveSection}
            patches={patches}
            cves={cves}
            baselines={baselines}
          />
        }

      </div>

    </div>

  );
}