import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import SectionCard from "../components/SectionCard";
import { useAuth } from "../context/AuthContext";
import { downloadPlantingPlanPdf } from "../utils/plantingPlanPdf";
import { downloadPlantingPlanExcel } from "../utils/plantingPlanExcel";
import {
  fetchPlantingPlanReport,
  updatePlantingPlanRemark,
} from "../services/experimentService";

function PlantingPlanReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [reportData, setReportData] = useState(null);
  const [remarksDrafts, setRemarksDrafts] = useState({});
  const [savingKey, setSavingKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await fetchPlantingPlanReport(id);
      setReportData(data);

      const draftMap = {};
      (data.trials || []).forEach((trial) => {
        (trial.rows || []).forEach((row) => {
          draftMap[`${trial.trial_id}-${row.entry_no}`] = row.remarks || "";
        });
      });
      setRemarksDrafts(draftMap);
    } catch (err) {
      console.error("Failed to load planting plan report:", err);
      setError(err.message || "Failed to load planting plan report.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  async function handleSaveRemark(trialId, entryNo) {
    const key = `${trialId}-${entryNo}`;
    const remarks = remarksDrafts[key] || "";

    try {
      setSavingKey(key);
      setError("");

      await updatePlantingPlanRemark(id, {
        trial_id: trialId,
        entry_no: entryNo,
        remarks,
      });

      await loadReport();
    } catch (err) {
      console.error("Failed to save remark:", err);
      setError(err.message || "Failed to save remark.");
    } finally {
      setSavingKey(null);
    }
  }

  function handleRemarkChange(trialId, entryNo, value) {
    const key = `${trialId}-${entryNo}`;
    setRemarksDrafts((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  const leftActions = [
    <button
      key="dashboard"
      className="wf-btn wf-btn-secondary"
      onClick={() => navigate("/dashboard")}
    >
      Dashboard
    </button>,
    <button
      key="back"
      className="wf-btn wf-btn-secondary"
      onClick={() => navigate(`/experiments/${id}`)}
    >
      Back to Experiment
    </button>,
  ];

  const rightActions = [
    <button
      key="pdf"
      className="wf-btn wf-btn-primary"
      onClick={() => {
        if (reportData) {
          downloadPlantingPlanPdf(reportData);
        }
      }}
    >
      Download PDF
    </button>,
    <button
      key="excel"
      className="wf-btn wf-btn-secondary"
      onClick={() => {
        if (reportData) {
          downloadPlantingPlanExcel(reportData);
        }
      }}
    >
      Export Excel
    </button>,
    <button
      key="print"
      className="wf-btn wf-btn-secondary"
      onClick={() => window.print()}
    >
      Print View
    </button>,
    <div key="user" className="wf-user-box">
      <div>{user?.full_name || "User"}</div>
      <div>Role: {user?.role || "-"}</div>
    </div>,
    <button key="logout" className="wf-btn" onClick={handleLogout}>
      Logout
    </button>,
  ];

  return (
    <AppShell leftActions={leftActions} rightActions={rightActions}>
      {loading && <div className="wf-loading">Loading planting plan report...</div>}
      {error && <div className="wf-error">{error}</div>}

      {!loading && !error && reportData && (
        <>
          {reportData.trials.map((trial) => {
            const repCount = Number(reportData.experiment.replications_per_trial);

            const rowLength = (
              (Number(reportData.experiment.plants_per_row) - 1) *
              Number(reportData.experiment.plant_spacing)
            ).toFixed(2);

            return (
              <SectionCard
                key={trial.trial_id}
                title={`Planting Plan - ${reportData.experiment.experiment_name} - ${trial.trial_name}`}
              >
                <div style={{ textAlign: "center", marginBottom: "12px" }}>
                <h2 style={{ margin: 0 }}>
                    PLANTING PLAN REPORT
                </h2>
                <div style={{ fontSize: "14px" }}>
                    {reportData.experiment.experiment_name}
                </div>
                </div>
                <div className="wf-summary-grid" style={{ marginBottom: "18px" }}>
                  <div className="wf-summary-box">
                    <p><strong>Experiment:</strong> {reportData.experiment.experiment_name}</p>
                    <p><strong>Trial:</strong> {trial.trial_name}</p>
                    <p><strong>Location:</strong> {reportData.experiment.location || ""}</p>
                    <p><strong>Date Planted:</strong> {reportData.experiment.date_planted || ""}</p>
                    <p><strong>Season:</strong> {reportData.experiment.season || ""}</p>
                    <p><strong>Crop:</strong> {reportData.experiment.crop}</p>
                    <p><strong>Design Type:</strong> {reportData.experiment.design_type}</p>
                  </div>

                  <div className="wf-summary-box">
                    <p><strong>Replications:</strong> {reportData.experiment.replications_per_trial}</p>
                    <p><strong>Varieties / Replication:</strong> {reportData.experiment.varieties_per_replication}</p>
                    <p><strong>Rows / Plot:</strong> {reportData.experiment.rows_per_plot}</p>
                    <p>
                    <strong>Spacing:</strong> {reportData.experiment.row_spacing} m x {reportData.experiment.plant_spacing} m
                    </p>
                    <p>
                    <strong>Row Length:</strong> {rowLength} m
                    </p>
                    <p><strong>Alley:</strong> {reportData.experiment.alleyway_spacing}m</p>
                  </div>
                </div>

                <div className="wf-table-wrap">
                  <table className="wf-table">
                    <thead>
                      <tr>
                        <th>ENTRY NO.</th>
                        <th>VARIETY</th>
                        {Array.from({ length: repCount }, (_, i) => (
                          <th key={i}>REP {i + 1}</th>
                        ))}
                        <th>REMARKS</th>
                        <th>SAVE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trial.rows.map((row) => {
                        const rowKey = `${trial.trial_id}-${row.entry_no}`;

                        return (
                          <tr key={row.entry_no}>
                            <td>{row.entry_no}</td>
                            <td>{row.variety_name}</td>

                            {Array.from({ length: repCount }, (_, i) => {
                              const repNo = i + 1;
                              return <td key={repNo}>{row.reps?.[repNo] || ""}</td>;
                            })}

                            <td style={{ minWidth: "220px" }}>
                            <input
                                className="wf-input"
                                type="text"
                                value={remarksDrafts[rowKey] || ""}
                                onChange={(e) =>
                                handleRemarkChange(
                                    trial.trial_id,
                                    row.entry_no,
                                    e.target.value
                                )
                                }
                                placeholder="Enter remarks"
                            />

                            {/* PRINT MODE TEXT */}
                            <div className="wf-remark-text">
                                {remarksDrafts[rowKey] || ""}
                            </div>
                            </td>

                            <td>
                              <button
                                className="wf-btn wf-btn-secondary"
                                onClick={() =>
                                  handleSaveRemark(trial.trial_id, row.entry_no)
                                }
                                disabled={savingKey === rowKey}
                              >
                                {savingKey === rowKey ? "Saving..." : "Save"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            );
          })}
        </>
      )}
    </AppShell>
  );
}

export default PlantingPlanReportPage;