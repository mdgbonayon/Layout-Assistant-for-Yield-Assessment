import { useEffect, useState } from "react";
import { fetchRecentActivityLogs } from "../services/experimentService";

function RecentActivityPanel() {
  const [activities, setActivities] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logError, setLogError] = useState("");

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    try {
      setLoadingLogs(true);
      setLogError("");
      const data = await fetchRecentActivityLogs();
      setActivities(data || []);
    } catch (err) {
      console.error("Failed to load activity logs:", err);
      setLogError(err.message || "Failed to load activity logs.");
    } finally {
      setLoadingLogs(false);
    }
  }

  function formatDateTime(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  }

  return (
    <div>
      {loadingLogs && <div className="wf-loading">Loading activity logs...</div>}

      {!loadingLogs && logError && (
        <div className="wf-error">{logError}</div>
      )}

      {!loadingLogs && !logError && activities.length === 0 && (
        <div className="wf-empty">No recent activity yet.</div>
      )}

      {!loadingLogs && !logError && activities.length > 0 && (
        <div className="wf-activity-list">
          {activities.map((activity) => (
            <div key={activity.id} className="wf-activity-item">
              <div className="wf-activity-text">{activity.details}</div>
              <div className="wf-activity-time">
                {formatDateTime(activity.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RecentActivityPanel;