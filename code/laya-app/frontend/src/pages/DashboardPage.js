import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import SectionCard from "../components/SectionCard";
//import PlaceholderPanel from "../components/PlaceholderPanel";
import RecentActivityPanel from "../components/RecentActivityPanel";
import { useAuth } from "../context/AuthContext";
import {
  fetchExperiments,
  generateLayout,
  submitDeletionRequests,
} from "../services/experimentService";


function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [experiments, setExperiments] = useState([]);
  const [loadingExperiments, setLoadingExperiments] = useState(true);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [submittingDeleteRequest, setSubmittingDeleteRequest] = useState(false);
  const [error, setError] = useState("");
  const [selectedExperimentIds, setSelectedExperimentIds] = useState([]);

  useEffect(() => {
    loadExperiments();
  }, []);

  async function loadExperiments() {
    try {
      setLoadingExperiments(true);
      setError("");
      const data = await fetchExperiments();
      setExperiments(data || []);
    } catch (err) {
      console.error("Failed to load experiments:", err.message);
      setError(err.message);
    } finally {
      setLoadingExperiments(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const initials =
    user?.full_name
      ?.split(" ")
      .map((name) => name[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  const selectedCount = selectedExperimentIds.length;

  const allVisibleIds = useMemo(
    () => experiments.map((exp) => exp.id),
    [experiments]
  );

  const allSelected =
    experiments.length > 0 &&
    selectedExperimentIds.length === experiments.length;

  function toggleSelectExperiment(experimentId) {
    setSelectedExperimentIds((prev) =>
      prev.includes(experimentId)
        ? prev.filter((id) => id !== experimentId)
        : [...prev, experimentId]
    );
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedExperimentIds([]);
    } else {
      setSelectedExperimentIds(allVisibleIds);
    }
  }

  async function handleGenerateLayoutForSelected() {
    if (selectedExperimentIds.length === 0) {
      window.alert("Please select at least one experiment.");
      return;
    }

    try {
      setBulkGenerating(true);
      setError("");

      for (const experimentId of selectedExperimentIds) {
        await generateLayout(experimentId);
      }

      window.alert("Layout generation completed for selected experiments.");
      await loadExperiments();
    } catch (err) {
      console.error("Bulk generate layout failed:", err);
      setError(err.message || "Failed to generate layouts.");
    } finally {
      setBulkGenerating(false);
    }
  }

  async function handleDeleteSelected() {
    if (selectedExperimentIds.length === 0) {
      window.alert("Please select at least one experiment.");
      return;
    }

    const confirmed = window.confirm(
      `Submit delete request for ${selectedExperimentIds.length} selected experiment(s)?`
    );
    if (!confirmed) return;

    const reason = window.prompt(
      "Optional reason for deletion request:",
      "No longer needed"
    );

    try {
      setSubmittingDeleteRequest(true);
      setError("");

      await submitDeletionRequests(selectedExperimentIds, reason || "");
      window.alert("Deletion request(s) submitted successfully.");

      setSelectedExperimentIds([]);
      await loadExperiments();
    } catch (err) {
      console.error("Delete request submission failed:", err);
      setError(err.message || "Failed to submit deletion request.");
    } finally {
      setSubmittingDeleteRequest(false);
    }
  }

  function handleGeneratePlantingReportSelected() {
    if (selectedExperimentIds.length === 0) {
      window.alert("Please select one experiment first.");
      return;
    }

    if (selectedExperimentIds.length > 1) {
      window.alert(
        "Please select only one experiment when generating a planting plan report."
      );
      return;
    }

    navigate(`/experiments/${selectedExperimentIds[0]}/planting-plan`);
  }
  
  return (
    <AppShell
      leftActions={[
        <button
          key="dashboard"
          className="wf-btn wf-btn-secondary"
          onClick={() => navigate("/dashboard")}
        >
          Dashboard
        </button>,
        <button
          key="map"
          className="wf-btn wf-btn-secondary"
          onClick={() => navigate("/map-view")}
        >
          Map View
        </button>,
        ...(user?.role === "admin"
          ? [
              <button
                key="admin"
                className="wf-btn wf-btn-accent"
                onClick={() => navigate("/admin")}
              >
                Admin
              </button>,
            ]
          : []),
      ]}
      rightActions={[
        <div key="user" className="wf-user-box">
          <div>{user?.full_name || "User"}</div>
          <div>Role: {user?.role || "-"}</div>
        </div>,
        <button key="logout" className="wf-btn" onClick={handleLogout}>
          Logout
        </button>,
      ]}
    >
      <SectionCard title="Profile Summary">
        <div className="wf-profile-row">
          <div className="wf-profile-left">
            {user?.profile_image_url ? (
              <img
                src={user.profile_image_url}
                alt="Profile"
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid #d6ddd8",
                }}
              />
            ) : (
              <div className="wf-avatar-box">{initials}</div>
            )}

            <div>
              <div>
                <strong>Nickname:</strong> {user?.full_name?.split(" ")[0] || "User"}
              </div>
              <div>
                <strong>Full Name:</strong> {user?.full_name || "-"}
              </div>
              <div>
                <strong>Role:</strong> {user?.role || "-"}
              </div>
              <div>
                <strong>Status:</strong> {user?.status || "-"}
              </div>
            </div>
          </div>

          <button
            className="wf-btn wf-btn-secondary"
            onClick={() => navigate("/profile")}
          >
            Edit Profile
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Experiments">
        <div className="wf-toolbar-info">
          <strong>{selectedCount}</strong> experiment
          {selectedCount === 1 ? "" : "s"} selected
        </div>

        <div className="wf-action-row">
          <button
            className="wf-btn wf-btn-primary"
            onClick={() => navigate("/create-experiment")}
          >
            Create Experiment
          </button>

          <button
            className="wf-btn wf-btn-danger"
            onClick={handleDeleteSelected}
            disabled={submittingDeleteRequest}
          >
            {submittingDeleteRequest ? "Submitting..." : "Delete Selected"}
          </button>

          <button
            className="wf-btn wf-btn-secondary"
            onClick={handleGenerateLayoutForSelected}
            disabled={bulkGenerating}
          >
            {bulkGenerating
              ? "Generating Layouts..."
              : "Generate Layout for Selected"}
          </button>

          <button
            className="wf-btn wf-btn-secondary"
            onClick={handleGeneratePlantingReportSelected}
          >
            Generate Planting Report for Selected
          </button>
        </div>

        {loadingExperiments && <div className="wf-loading">Loading experiments...</div>}
        {error && <div className="wf-error">{error}</div>}

        {!loadingExperiments && !error && experiments.length === 0 && (
          <div className="wf-empty">No experiments found yet.</div>
        )}

        {!loadingExperiments && !error && experiments.length > 0 && (
          <div className="wf-table-wrap">
            <table className="wf-table">
              <thead>
                <tr>
                  <th className="wf-checkbox-cell">
                    <input
                      type="checkbox"
                      className="wf-checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>EXPERIMENT NAME</th>
                  <th>DATE CREATED</th>
                  <th>DESIGN TYPE</th>
                  <th>STATUS</th>
                  <th>ACTIVE LAYOUT</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map((experiment) => {
                  const isChecked = selectedExperimentIds.includes(experiment.id);
                  const hasActiveLayout = Boolean(experiment.active_layout_batch_id);

                  return (
                    <tr
                      key={experiment.id}
                      className="wf-clickable-row"
                      onClick={() => navigate(`/experiments/${experiment.id}`)}
                    >
                      <td
                        className="wf-checkbox-cell"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="wf-checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectExperiment(experiment.id)}
                        />
                      </td>

                      <td>{experiment.experiment_name}</td>

                      <td>
                        {experiment.created_at
                          ? new Date(experiment.created_at).toLocaleDateString()
                          : "-"}
                      </td>

                      <td>{experiment.design_type}</td>

                      <td>{experiment.status}</td>

                      <td>
                        <span
                          className={`wf-badge ${
                            hasActiveLayout
                              ? "wf-badge-active"
                              : "wf-badge-muted"
                          }`}
                        >
                          {hasActiveLayout ? "ACTIVE" : "NONE"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Logs">
        <RecentActivityPanel />
      </SectionCard>
    </AppShell>
  );
}

export default DashboardPage;