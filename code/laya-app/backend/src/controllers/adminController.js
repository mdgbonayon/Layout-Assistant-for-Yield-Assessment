const pool = require("../config/database");
const logActivity = require("../utils/logActivity");

async function getPendingUsers(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, role, status, created_at
       FROM users
       WHERE status = 'pending'
       ORDER BY created_at ASC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get pending users error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

async function approveUser(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE users
       SET status = 'approved', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, full_name, email, role, status`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "User approved successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Approve user error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

async function rejectUser(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE users
       SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, full_name, email, role, status`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "User rejected successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Reject user error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

async function getDeletionRequests(req, res) {
  try {
    const result = await pool.query(
      `SELECT
         dr.id,
         dr.experiment_id,
         dr.requested_by,
         dr.reason,
         dr.status,
         dr.reviewed_by,
         dr.reviewed_at,
         dr.created_at,
         e.experiment_name,
         e.design_type,
         e.crop,
         u.full_name AS requested_by_name
       FROM deletion_requests dr
       JOIN experiments e ON dr.experiment_id = e.id
       JOIN users u ON dr.requested_by = u.id
       WHERE dr.status = 'pending'
       ORDER BY dr.created_at ASC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get deletion requests error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

async function approveDeletionRequest(req, res) {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const requestResult = await client.query(
      `SELECT *
       FROM deletion_requests
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (requestResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Deletion request not found" });
    }

    const deletionRequest = requestResult.rows[0];

    if (deletionRequest.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Request is not pending" });
    }

    const experimentResult = await client.query(
      `SELECT id, experiment_name
       FROM experiments
       WHERE id = $1`,
      [deletionRequest.experiment_id]
    );

    if (experimentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Experiment not found" });
    }

    const experiment = experimentResult.rows[0];

    await client.query(
      `UPDATE deletion_requests
       SET status = 'approved',
           reviewed_by = $1,
           reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [req.user.id, id]
    );

    await client.query(
      `UPDATE experiments
       SET status = 'deleted',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [deletionRequest.experiment_id]
    );

    await client.query("COMMIT");

    await logActivity({
      userId: req.user.id,
      action: "APPROVE_DELETE_EXPERIMENT",
      entityType: "experiment",
      entityId: experiment.id,
      details: `${req.user.full_name} approved deletion of experiment "${experiment.experiment_name}"`,
    });

    res.json({ message: "Deletion request approved successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Approve deletion request error:", error);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
}

async function rejectDeletionRequest(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE deletion_requests dr
       SET status = 'rejected',
           reviewed_by = $1,
           reviewed_at = CURRENT_TIMESTAMP
       FROM experiments e
       WHERE dr.id = $2
         AND dr.status = 'pending'
         AND e.id = dr.experiment_id
       RETURNING dr.*, e.experiment_name`,
      [req.user.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Pending deletion request not found" });
    }

    const request = result.rows[0];

    await logActivity({
      userId: req.user.id,
      action: "REJECT_DELETE_EXPERIMENT",
      entityType: "experiment",
      entityId: request.experiment_id,
      details: `${req.user.full_name} rejected deletion of experiment "${request.experiment_name}"`,
    });

    res.json({ message: "Deletion request rejected successfully" });
  } catch (error) {
    console.error("Reject deletion request error:", error);
    res.status(500).json({ message: "Server error" });
  }
}


module.exports = {
  getPendingUsers,
  approveUser,
  rejectUser,
  getDeletionRequests,
  approveDeletionRequest,
  rejectDeletionRequest
};