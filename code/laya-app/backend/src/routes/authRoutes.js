const express = require("express");
const router = express.Router();

const {
  register,
  login,
  me,
  updateProfile,
  changePassword,
  uploadProfileImage,
  upload,
} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, me);

router.put("/me", authMiddleware, updateProfile);
router.put("/me/password", authMiddleware, changePassword);
router.post(
  "/me/profile-image",
  authMiddleware,
  upload.single("profileImage"),
  uploadProfileImage
);

module.exports = router;