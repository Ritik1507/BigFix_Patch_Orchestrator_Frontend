// import { useEffect, useState, useMemo } from "react";
// import api from "../../api/api";
// import {
//   PieChart,
//   Pie,
//   Cell,
//   Tooltip,
//   ResponsiveContainer,
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
// } from "recharts";

// const COLORS = ["#ff4d4f", "#fa8c16", "#fadb14", "#52c41a", "#1890ff"];

// export default function DashboardTab() {
//   const [patches, setPatches] = useState([]);
//   const [cves, setCves] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [activeSection, setActiveSection] = useState("cve");

//   const [patchFilter, setPatchFilter] = useState("ALL");
//   const [cveFilter, setCveFilter] = useState(null);

//   useEffect(() => {
//     const fetchDashboardData = async () => {
//       try {
//         setLoading(true);

//         const patchRes = await api.get("/patches");
//         const patchData = Array.isArray(patchRes.data)
//           ? patchRes.data
//           : patchRes.data?.data || [];

//         setPatches(patchData);

//         const patchPayload = patchData.map((p) => ({
//           patch_id: p.patch_id,
//           site_name: p.site_name,
//         }));

//         const cveRes = await api.post("/cves/by-patches", {
//           patches: patchPayload,
//         });

//         const cveData = cveRes.data?.data || [];
//         setCves(cveData);
//       } catch (err) {
//         console.error("Dashboard load failed:", err);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchDashboardData();
//   }, []);

//   // ===============================
//   // CVE KPI CALCULATIONS
//   // ===============================

//   const cveKPIs = useMemo(() => {
//     const severityCount = {};
//     const kevCount = { KEV: 0, NON_KEV: 0 };

//     cves.forEach((c) => {
//       const sev = c.cvss_severity || "UNKNOWN";
//       severityCount[sev] = (severityCount[sev] || 0) + 1;

//       if (c.is_kev) kevCount.KEV++;
//       else kevCount.NON_KEV++;
//     });

//     return {
//       total: cves.length,
//       severityCount,
//       kevCount,
//     };
//   }, [cves]);

//   if (loading) return <div>Loading...</div>;

//   return (
//     <div className="dashboard-container">
//       {/* SECTION TOGGLE */}
//       <div className="dashboard-section-toggle">
//         <button onClick={() => setActiveSection("cve")}>CVE Dashboard</button>
//         <button onClick={() => setActiveSection("patch")}>
//           Patch Dashboard
//         </button>
//         <button onClick={() => setActiveSection("computer")}>
//           Computer Dashboard
//         </button>
//         <button onClick={() => setActiveSection("baseline")}>
//           Baseline Dashboard
//         </button>
//       </div>

//       {/* ================= CVE DASHBOARD ================= */}
//       {activeSection === "cve" && (
//         <div className="dashboard-section">
//           <h2>CVE Overview</h2>

//           <div className="dashboard-kpi-row">
//             <div
//               className="kpi-card clickable"
//               onClick={() => setCveFilter("ALL")}
//             >
//               <h3>Total CVEs</h3>
//               <p>{cveKPIs.total}</p>
//             </div>

//             <div
//               className="kpi-card clickable"
//               onClick={() => setCveFilter("KEV")}
//             >
//               <h3>KEV</h3>
//               <p>{cveKPIs.kevCount.KEV}</p>
//             </div>

//             <div
//               className="kpi-card clickable"
//               onClick={() => setCveFilter("NON_KEV")}
//             >
//               <h3>Non KEV</h3>
//               <p>{cveKPIs.kevCount.NON_KEV}</p>
//             </div>
//           </div>

//           <div className="dashboard-chart-row">
//             {/* Severity Distribution Donut */}
//             <div className="chart-box">
//               <h4>Severity Distribution</h4>
//               <ResponsiveContainer width="100%" height={350}>
//                 <PieChart>
//                   <Pie
//                     data={Object.entries(cveKPIs.severityCount).map(
//                       ([key, value]) => ({ name: key, value }),
//                     )}
//                     dataKey="value"
//                     nameKey="name"
//                     outerRadius={120}
//                     innerRadius={70}
//                     label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
//                   >
//                     {Object.entries(cveKPIs.severityCount).map((_, index) => (
//                       <Cell key={index} fill={COLORS[index % COLORS.length]} />
//                     ))}
//                   </Pie>

//                   <Tooltip
//                     formatter={(value, name) => [`${value} CVEs`, name]}
//                   />

//                   {/* Center Total */}
//                   <text
//                     x="50%"
//                     y="50%"
//                     textAnchor="middle"
//                     dominantBaseline="middle"
//                     style={{ fontSize: 20, fontWeight: "bold" }}
//                   >
//                     {cveKPIs.total}
//                   </text>
//                 </PieChart>
//               </ResponsiveContainer>
//             </div>

//             {/* KEV vs Non-KEV Donut */}
//             <div className="chart-box">
//               <h4>KEV vs Non-KEV</h4>
//               <ResponsiveContainer width="100%" height={350}>
//                 <PieChart>
//                   <Pie
//                     data={[
//                       { name: "KEV", value: cveKPIs.kevCount.KEV },
//                       { name: "Non KEV", value: cveKPIs.kevCount.NON_KEV },
//                     ]}
//                     dataKey="value"
//                     nameKey="name"
//                     outerRadius={120}
//                     innerRadius={70}
//                     label={({ value }) => value}
//                   >
//                     <Cell fill="#ff4d4f" />
//                     <Cell fill="#52c41a" />
//                   </Pie>

//                   <Tooltip
//                     formatter={(value, name) => [`${value} CVEs`, name]}
//                   />

//                   {/* Center Total */}
//                   <text
//                     x="50%"
//                     y="50%"
//                     textAnchor="middle"
//                     dominantBaseline="middle"
//                     style={{ fontSize: 20, fontWeight: "bold" }}
//                   >
//                     {cveKPIs.total}
//                   </text>
//                 </PieChart>
//               </ResponsiveContainer>
//             </div>
//           </div>

//           {cveFilter && (
//             <div className="risk-table" style={{ marginTop: 30 }}>
//               <div style={{ display: "flex", justifyContent: "space-between" }}>
//                 <h4>
//                   {cveFilter === "ALL"
//                     ? "All CVEs"
//                     : cveFilter === "KEV"
//                       ? "KEV CVEs"
//                       : "Non KEV CVEs"}
//                 </h4>
//                 <button onClick={() => setCveFilter(null)}>X</button>
//               </div>

//               <table>
//                 <thead>
//                   <tr>
//                     <th>CVE ID</th>
//                     <th>Severity</th>
//                     <th>CVSS</th>
//                     <th>KEV</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {cves
//                     .filter((c) => {
//                       if (cveFilter === "ALL") return true;
//                       if (cveFilter === "KEV") return c.is_kev;
//                       if (cveFilter === "NON_KEV") return !c.is_kev;
//                       return true;
//                     })
//                     .map((c) => (
//                       <tr key={c.cve_id}>
//                         <td>{c.cve_id}</td>
//                         <td>{c.cvss_severity || "UNKNOWN"}</td>
//                         <td>{c.cvss_base_score || "-"}</td>
//                         <td>{c.is_kev ? "Yes" : "No"}</td>
//                       </tr>
//                     ))}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </div>
//       )}

//       {/* ================= PATCH DASHBOARD ================= */}
//       {activeSection === "patch" && (
//         <div className="dashboard-section">
//           <h2>Patch Overview</h2>

//           {(() => {
//             // Severity distribution
//             const severityCount = {};
//             patches.forEach((p) => {
//               const sev = p.severity || "UNKNOWN";
//               severityCount[sev] = (severityCount[sev] || 0) + 1;
//             });

//             const severityChartData = Object.entries(severityCount).map(
//               ([key, value]) => ({ name: key, value }),
//             );

//             // Applicability buckets
//             const appBuckets = { "1-5": 0, "6-20": 0, "21-100": 0, "100+": 0 };
//             patches.forEach((p) => {
//               const count = Number(p.applicable_count || 0);
//               if (count <= 5) appBuckets["1-5"]++;
//               else if (count <= 20) appBuckets["6-20"]++;
//               else if (count <= 100) appBuckets["21-100"]++;
//               else appBuckets["100+"]++;
//             });

//             const appChartData = Object.entries(appBuckets).map(
//               ([key, value]) => ({ name: key, value }),
//             );

//             // KEV-linked patches
//             const kevPatchIds = new Set();
//             cves.forEach((cve) => {
//               if (cve.is_kev && cve.patch_id) {
//                 kevPatchIds.add(cve.patch_id);
//               }
//             });

//             let filteredPatches = patches;
//             if (patchFilter === "KEV") {
//               filteredPatches = patches.filter((p) =>
//                 kevPatchIds.has(p.patch_id),
//               );
//             }

//             return (
//               <>
//                 <div className="dashboard-kpi-row">
//                   <div
//                     className="kpi-card clickable"
//                     onClick={() => setPatchFilter("ALL")}
//                   >
//                     <h3>Total Patches</h3>
//                     <p>{patches.length}</p>
//                   </div>

//                   <div
//                     className="kpi-card clickable"
//                     onClick={() => setPatchFilter("KEV")}
//                   >
//                     <h3>KEV Linked</h3>
//                     <p>{kevPatchIds.size}</p>
//                   </div>
//                 </div>

//                 <div className="dashboard-chart-row">
//                   <div className="chart-box">
//                     <h4>Severity Distribution</h4>
//                     <ResponsiveContainer width="100%" height={300}>
//                       <PieChart>
//                         <Pie
//                           data={severityChartData}
//                           dataKey="value"
//                           outerRadius={100}
//                           innerRadius={60}
//                         >
//                           {severityChartData.map((_, index) => (
//                             <Cell
//                               key={index}
//                               fill={COLORS[index % COLORS.length]}
//                             />
//                           ))}
//                         </Pie>
//                         <Tooltip />
//                       </PieChart>
//                     </ResponsiveContainer>
//                   </div>

//                   <div className="chart-box">
//                     <h4>Applicability Distribution</h4>
//                     <ResponsiveContainer width="100%" height={300}>
//                       <BarChart data={appChartData}>
//                         <CartesianGrid strokeDasharray="3 3" />
//                         <XAxis dataKey="name" />
//                         <YAxis />
//                         <Tooltip />
//                         <Bar dataKey="value" fill="#1890ff" />
//                       </BarChart>
//                     </ResponsiveContainer>
//                   </div>
//                 </div>

//                 <div className="risk-table" style={{ marginTop: 30 }}>
//                   <h4>
//                     {patchFilter === "KEV"
//                       ? "KEV Linked Patches"
//                       : "All Patches"}
//                   </h4>

//                   <table>
//                     <thead>
//                       <tr>
//                         <th>Patch ID</th>
//                         <th>Name</th>
//                         <th>Severity</th>
//                         <th>Score</th>
//                         <th>Applicable</th>
//                       </tr>
//                     </thead>
//                     <tbody>
//                       {filteredPatches.map((p) => (
//                         <tr key={p.patch_id}>
//                           <td>{p.patch_id}</td>
//                           <td>{p.patch_name}</td>
//                           <td>{p.severity}</td>
//                           <td>{Number(p.final_score || 0).toFixed(2)}</td>
//                           <td>{p.applicable_count}</td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               </>
//             );
//           })()}
//         </div>
//       )}

//       {/* PLACEHOLDERS */}
//       {activeSection === "computer" && (
//         <div className="dashboard-section">
//           <h2>Computer Dashboard</h2>
//         </div>
//       )}

//       {activeSection === "baseline" && (
//         <div className="dashboard-section">
//           <h2>Baseline Dashboard</h2>
//         </div>
//       )}
//     </div>
//   );
// }

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