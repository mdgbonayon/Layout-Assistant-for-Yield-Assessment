const pool = require("../config/database");

const getRecentActivity = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        al.id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.details,
        al.created_at,
        u.full_name AS user_name
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 3
      `
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching activity logs:", error.message);
    res.status(500).json({ message: "Failed to fetch activity logs" });
  }
};

module.exports = { getRecentActivity };