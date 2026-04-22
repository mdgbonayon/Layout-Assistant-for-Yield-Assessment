import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import SectionCard from "../components/SectionCard";
import { useAuth } from "../context/AuthContext";
import {
  fetchPendingUsers,
  approveUser,
  rejectUser,
  fetchDeletionRequests,
  approveDeletionRequest,
  rejectDeletionRequest,
} from "../services/authService";

function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [pendingUsers, setPendingUsers] = useState([]);
  const [deletionRequests, setDeletionRequests] = useState([]);

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingDeletionRequests, setLoadingDeletionRequests] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState("");

  function handleLogout() {
    logout();
    navigate("/login");
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
      key="map"
      className="wf-btn wf-btn-secondary"
      onClick={() => navigate("/map-view")}
    >
      Map View
    </button>,
    <button
      key="admin"
      className="wf-btn wf-btn-accent"
      onClick={() => navigate("/admin")}
    >
      Admin
    </button>,
  ];

  const rightActions = [
    <div key="user" className="wf-user-box">
      <div>{user?.full_name || "User"}</div>
      <div>Role: {user?.role || "-"}</div>
    </div>,
    <button key="logout" className="wf-btn" onClick={handleLogout}>
      Logout
    </button>,
  ];

  useEffect(() => {
    if (user?.role === "admin") {
      loadAdminData();
    }
  }, [user]);

  async function loadAdminData() {
    try {
      setError("");
      setLoadingUsers(true);
      setLoadingDeletionRequests(true);

      const [usersData, deletionData] = await Promise.all([
        fetchPendingUsers(),
        fetchDeletionRequests(),
      ]);

      setPendingUsers(usersData || []);
      setDeletionRequests(deletionData || []);
    } catch (err) {
      console.error("Failed to load admin data:", err);
      setError(err.message || "Failed to load admin data.");
    } finally {
      setLoadingUsers(false);
      setLoadingDeletionRequests(false);
    }
  }

  async function handleApproveUser(userId) {
    try {
      setProcessingId(`approve-user-${userId}`);
      setError("");
      await approveUser(userId);
      await loadAdminData();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to approve user.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRejectUser(userId) {
    try {
      setProcessingId(`reject-user-${userId}`);
      setError("");
      await rejectUser(userId);
      await loadAdminData();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to reject user.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleApproveDeletionRequest(requestId) {
    try {
      setProcessingId(`approve-delete-${requestId}`);
      setError("");
      await approveDeletionRequest(requestId);
      await loadAdminData();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to approve deletion request.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRejectDeletionRequest(requestId) {
    try {
      setProcessingId(`reject-delete-${requestId}`);
      setError("");
      await rejectDeletionRequest(requestId);
      await loadAdminData();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to reject deletion request.");
    } finally {
      setProcessingId(null);
    }
  }

  if (user?.role !== "admin") {
    return (
      <AppShell leftActions={leftActions} rightActions={rightActions}>
        <div className="wf-role-guard">
          This page is only available to admin users.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell leftActions={leftActions} rightActions={rightActions}>
      <div className="wf-admin-grid">
        <SectionCard title="Pending User Approvals">
          {loadingUsers && <div className="wf-loading">Loading pending users...</div>}

          {!loadingUsers && pendingUsers.length === 0 && (
            <div className="wf-admin-empty">No pending users.</div>
          )}

          {!loadingUsers && pendingUsers.length > 0 && (
            <div className="wf-table-wrap">
              <table className="wf-table">
                <thead>
                  <tr>
                    <th>FULL NAME</th>
                    <th>EMAIL</th>
                    <th>ROLE</th>
                    <th>DATE REQUESTED</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map((pendingUser) => (
                    <tr key={pendingUser.id}>
                      <td>{pendingUser.full_name}</td>
                      <td>{pendingUser.email}</td>
                      <td>{pendingUser.role}</td>
                      <td>
                        {pendingUser.created_at
                          ? new Date(pendingUser.created_at).toLocaleString()
                          : "-"}
                      </td>
                      <td>
                        <div className="wf-admin-actions">
                          <button
                            className="wf-btn wf-btn-primary"
                            onClick={() => handleApproveUser(pendingUser.id)}
                            disabled={processingId === `approve-user-${pendingUser.id}`}
                          >
                            {processingId === `approve-user-${pendingUser.id}`
                              ? "Approving..."
                              : "Approve"}
                          </button>

                          <button
                            className="wf-btn wf-btn-danger"
                            onClick={() => handleRejectUser(pendingUser.id)}
                            disabled={processingId === `reject-user-${pendingUser.id}`}
                          >
                            {processingId === `reject-user-${pendingUser.id}`
                              ? "Rejecting..."
                              : "Reject"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Pending Deletion Requests">
          {loadingDeletionRequests && (
            <div className="wf-loading">Loading deletion requests...</div>
          )}

          {!loadingDeletionRequests && deletionRequests.length === 0 && (
            <div className="wf-admin-empty">No pending deletion requests.</div>
          )}

          {!loadingDeletionRequests && deletionRequests.length > 0 && (
            <div className="wf-table-wrap">
              <table className="wf-table">
                <thead>
                  <tr>
                    <th>EXPERIMENT</th>
                    <th>CROP</th>
                    <th>DESIGN TYPE</th>
                    <th>REQUESTED BY</th>
                    <th>REASON</th>
                    <th>DATE REQUESTED</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {deletionRequests.map((request) => (
                    <tr key={request.id}>
                      <td>{request.experiment_name}</td>
                      <td>{request.crop}</td>
                      <td>{request.design_type}</td>
                      <td>{request.requested_by_name}</td>
                      <td>{request.reason || "-"}</td>
                      <td>
                        {request.created_at
                          ? new Date(request.created_at).toLocaleString()
                          : "-"}
                      </td>
                      <td>
                        <div className="wf-admin-actions">
                          <button
                            className="wf-btn wf-btn-primary"
                            onClick={() => handleApproveDeletionRequest(request.id)}
                            disabled={processingId === `approve-delete-${request.id}`}
                          >
                            {processingId === `approve-delete-${request.id}`
                              ? "Approving..."
                              : "Approve"}
                          </button>

                          <button
                            className="wf-btn wf-btn-danger"
                            onClick={() => handleRejectDeletionRequest(request.id)}
                            disabled={processingId === `reject-delete-${request.id}`}
                          >
                            {processingId === `reject-delete-${request.id}`
                              ? "Rejecting..."
                              : "Reject"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {error && <div className="wf-error">{error}</div>}
      </div>
    </AppShell>
  );
}

export default AdminPage;