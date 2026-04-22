const express = require("express");
const router = express.Router();
const { getRecentActivity } = require("../controllers/activityLogController");
const protect = require("../middleware/authMiddleware");

router.get("/recent", protect, getRecentActivity);

module.exports = router;