const pool = require("../config/database");

const logActivity = async ({
  userId,
  action,
  entityType = null,
  entityId = null,
  details,
}) => {
  try {
    await pool.query(
      `
      INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [userId, action, entityType, entityId, details]
    );
  } catch (error) {
    console.error("Error logging activity:", error.message);
  }
};

module.exports = logActivity;