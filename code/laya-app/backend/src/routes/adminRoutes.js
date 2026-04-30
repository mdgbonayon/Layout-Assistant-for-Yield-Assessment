const express = require("express");
const router = express.Router();

const {
  getPendingUsers,
  approveUser,
  rejectUser,
  getDeletionRequests,
  approveDeletionRequest,
  rejectDeletionRequest,
} = require("../controllers/adminController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get(
  "/pending-users",
  authMiddleware,
  roleMiddleware("admin"),
  getPendingUsers
);

router.patch(
  "/users/:id/approve",
  authMiddleware,
  roleMiddleware("admin"),
  approveUser
);

router.patch(
  "/users/:id/reject",
  authMiddleware,
  roleMiddleware("admin"),
  rejectUser
);

router.get(
  "/deletion-requests",
  authMiddleware,
  roleMiddleware("admin"),
  getDeletionRequests
);

router.patch(
  "/deletion-requests/:id/approve",
  authMiddleware,
  roleMiddleware("admin"),
  approveDeletionRequest
);

router.patch(
  "/deletion-requests/:id/reject",
  authMiddleware,
  roleMiddleware("admin"),
  rejectDeletionRequest
);

module.exports = router;