const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const multer = require("multer");
const path = require("path");

/* =========================
   MULTER CONFIG (UPLOAD)
========================= */
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDir = path.join(__dirname, "../../uploads/profiles");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

/* =========================
   REGISTER
========================= */
async function register(req, res) {
  const { full_name, nickname, email, password, role } = req.body;

  try {
    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!["staff"].includes(role)) {
      return res.status(400).json({ message: "Only staff can self-register" });
    }

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (full_name, nickname, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id, full_name, nickname, email, role, status`,
      [full_name, nickname || null, email, passwordHash, role]
    );

    res.status(201).json({
      message: "Registration successful. Awaiting admin approval.",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

/* =========================
   LOGIN
========================= */
async function login(req, res) {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      `SELECT id, full_name, nickname, email, password_hash, role, status, profile_image_url
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.status !== "approved") {
      return res.status(403).json({
        message: `Account is ${user.status}. Please wait for admin approval.`,
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        nickname: user.nickname,
        email: user.email,
        role: user.role,
        status: user.status,
        profile_image_url: user.profile_image_url,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

/* =========================
   GET CURRENT USER
========================= */
async function me(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, full_name, nickname, email, role, status, profile_image_url
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Me error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

/* =========================
   UPDATE PROFILE
========================= */
async function updateProfile(req, res) {
  const { full_name, nickname, email } = req.body;

  try {
    if (!full_name || !email) {
      return res.status(400).json({ message: "Full name and email are required" });
    }

    const emailOwner = await pool.query(
      `SELECT id FROM users WHERE email = $1 AND id <> $2`,
      [email, req.user.id]
    );

    if (emailOwner.rows.length > 0) {
      return res.status(409).json({ message: "Email is already used by another account" });
    }

    const result = await pool.query(
      `UPDATE users
       SET full_name = $1,
           nickname = $2,
           email = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, full_name, nickname, email, role, status, profile_image_url`,
      [full_name, nickname || null, email, req.user.id]
    );

    res.json({
      message: "Profile updated successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

/* =========================
   CHANGE PASSWORD
========================= */
async function changePassword(req, res) {
  const { current_password, new_password } = req.body;

  try {
    const result = await pool.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];

    const match = await bcrypt.compare(current_password, user.password_hash);

    if (!match) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const newHash = await bcrypt.hash(new_password, 10);

    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newHash, req.user.id]
    );

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

/* =========================
   UPLOAD PROFILE IMAGE
========================= */
async function uploadProfileImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const imageUrl = `/uploads/profiles/${req.file.filename}`;

    const result = await pool.query(
      `UPDATE users
       SET profile_image_url = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING profile_image_url`,
      [imageUrl, req.user.id]
    );

    res.json({
      message: "Profile image uploaded",
      profile_image_url: result.rows[0].profile_image_url,
    });
  } catch (error) {
    console.error("Upload image error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

/* =========================
   EXPORTS
========================= */
module.exports = {
  register,
  login,
  me,
  updateProfile,
  changePassword,
  uploadProfileImage,
  upload,
};