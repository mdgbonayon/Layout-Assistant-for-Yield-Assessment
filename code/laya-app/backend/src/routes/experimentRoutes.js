const express = require("express");
const router = express.Router();

const {
  createExperiment,
  getExperiments,
  getExperimentById,
  generateLayout,
  getExperimentLayouts,
  deleteAllLayouts,
  deleteLayoutBatch,
  setActiveLayoutBatch,
  submitDeletionRequests,
  getPlantingPlanReport,
  updatePlantingPlanRemark,
} = require("../controllers/experimentController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.post(
  "/",
  authMiddleware,
  roleMiddleware("admin", "staff"),
  createExperiment
);

router.get(
  "/",
  authMiddleware,
  roleMiddleware("admin", "staff"),
  getExperiments
);

router.post(
  "/delete-requests",
  authMiddleware,
  roleMiddleware("admin", "staff"),
  submitDeletionRequests
);

router.get(
  "/:id/planting-plan",
  authMiddleware,
  roleMiddleware("admin", "staff"),
  getPlantingPlanReport
);

router.patch(
  "/:id/planting-plan/remarks",
  authMiddleware,
  roleMiddleware("admin", "staff"),
  updatePlantingPlanRemark
);

router.patch(
  "/:id/layout-batches/:batchId/activate",
  authMiddleware,
  roleMiddleware("admin", "staff"),
  setActiveLayoutBatch
);

router.delete(
  "/:id/layout-batches/:batchId",
  authMiddleware,
  roleMiddleware("admin", "staff"),
  deleteLayoutBatch
);

router.delete(
  "/:id/layouts",
  authMiddleware,
  roleMiddleware("admin", "staff"),
  deleteAllLayouts
);

router.post(
  "/:id/generate-layout",
  authMiddleware,
  roleMiddleware("admin", "staff"),
  generateLayout
);

router.get(
  "/:id/layouts",
  authMiddleware,
  roleMiddleware("admin", "staff"),
  getExperimentLayouts
);


router.get(
  "/:id",
  authMiddleware,
  roleMiddleware("admin", "staff"),
  getExperimentById
);



module.exports = router;