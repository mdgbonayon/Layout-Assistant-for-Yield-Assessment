const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const experimentRoutes = require("./routes/experimentRoutes");
const polygonRoutes = require("./routes/polygonRoutes");
const activityLogRoutes = require("./routes/activityLogRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "LAYA backend is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/experiments", polygonRoutes);
app.use("/api/experiments", experimentRoutes);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/api/activity-logs", activityLogRoutes);


module.exports = app;