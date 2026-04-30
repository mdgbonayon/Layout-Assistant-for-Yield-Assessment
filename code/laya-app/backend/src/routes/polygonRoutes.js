const express = require("express");
const router = express.Router();

const {
  saveExperimentPolygon,
  getExperimentPolygon,
  getAllExperimentPolygons,
} = require("../controllers/polygonController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.post(
  "/:id/polygon",
  authMiddleware,
  roleMiddleware("admin", "staff"),
  saveExperimentPolygon
);

router.get(
  "/:id/polygon",
  authMiddleware,
  roleMiddleware("admin", "staff"),
  getExperimentPolygon
);

router.get(
  "/polygons",
  authMiddleware,
  roleMiddleware("admin", "staff"),
  getAllExperimentPolygons
);

module.exports = router;