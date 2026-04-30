const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const experimentRoutes = require("./routes/experimentRoutes");
const polygonRoutes = require("./routes/polygonRoutes");
const activityLogRoutes = require("./routes/activityLogRoutes");

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

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