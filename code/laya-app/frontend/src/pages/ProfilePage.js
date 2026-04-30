import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppShell from "../components/AppShell";
import axios from "axios";

function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [preview, setPreview] = useState(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const token = localStorage.getItem("token");

  const API_URL =
    process.env.REACT_APP_API_URL || "http://localhost:5000/api";

  const API_BASE_URL =
    process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      setError("");

      const profileRes = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setProfile(profileRes.data);
      setFullName(profileRes.data.full_name || "");
      setNickname(profileRes.data.nickname || "");
      setEmail(profileRes.data.email || "");
      localStorage.setItem("user", JSON.stringify(profileRes.data));
    } catch (err) {
      console.error("Load profile failed:", err);
      setError(err?.response?.data?.message || "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const leftActions = [
    <button
      key="dashboard"
      className="wf-btn wf-btn-secondary"
      onClick={() => navigate("/dashboard")}
    >
      Dashboard
    </button>,
    <button
      key="map"
      className="wf-btn wf-btn-secondary"
      onClick={() => navigate("/map-view")}
    >
      Map View
    </button>,
    ...(user?.role === "admin"
      ? [
          <button
            key="admin"
            className="wf-btn wf-btn-accent"
            onClick={() => navigate("/admin")}
          >
            Admin
          </button>,
        ]
      : []),
  ];

  const rightActions = [
    <div key="user" className="wf-user-box">
      <div>{user?.full_name || "User"}</div>
      <div>Role: {user?.role || "-"}</div>
    </div>,
    <button key="logout" className="wf-btn" onClick={handleLogout}>
      Logout
    </button>,
  ];

  const imageSrc = useMemo(() => {
    if (preview) return preview;

    if (profile?.profile_image_url) {
      if (profile.profile_image_url.startsWith("http")) {
        return profile.profile_image_url;
      }

      return `${API_BASE_URL}${profile.profile_image_url}`;
    }

    return "https://via.placeholder.com/130";
  }, [preview, profile, API_BASE_URL]);

  async function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];

    if (!validTypes.includes(file.type)) {
      setError("Please upload a JPG, PNG, or WEBP image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5MB or smaller.");
      return;
    }

    setPreview(URL.createObjectURL(file));

    try {
      setUploadingImage(true);
      setError("");
      setSuccess("");

      const formData = new FormData();
      formData.append("profileImage", file);

      const uploadRes = await axios.post(
        `${API_URL}/auth/me/profile-image`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const updatedProfile = {
        ...profile,
        profile_image_url: uploadRes.data.profile_image_url,
      };

      setProfile(updatedProfile);
      localStorage.setItem("user", JSON.stringify(updatedProfile));
      setPreview(null);
      setSuccess("Profile image updated successfully.");
    } catch (err) {
      console.error("Image upload failed:", err);
      setError(err?.response?.data?.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  }

  async function handleSaveProfile() {
    try {
      setSavingProfile(true);
      setError("");
      setSuccess("");

      const updateRes = await axios.put(
        `${API_URL}/auth/me`,
        { full_name: fullName, nickname, email },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setProfile(updateRes.data.user);
      localStorage.setItem("user", JSON.stringify(updateRes.data.user));
      setSuccess("Profile updated successfully.");
    } catch (err) {
      console.error("Profile update failed:", err);
      setError(err?.response?.data?.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please complete all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    try {
      setChangingPassword(true);
      setError("");
      setSuccess("");

      await axios.put(
        `${API_URL}/auth/me/password`,
        {
          current_password: currentPassword,
          new_password: newPassword,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password updated successfully.");
    } catch (err) {
      console.error("Password change failed:", err);
      setError(err?.response?.data?.message || "Failed to change password.");
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <AppShell leftActions={leftActions} rightActions={rightActions}>
      <div className="wf-profile-page-wrap">
        <div className="wf-profile-page-header">
          <div>
            <h2 className="wf-profile-page-title">Profile</h2>
            <p className="wf-profile-page-subtitle">
              Manage your account information, profile photo, and password.
            </p>
          </div>
        </div>

        {loading && <div className="wf-loading">Loading profile...</div>}
        {error && <div className="wf-profile-message wf-profile-message-error">{error}</div>}
        {success && (
          <div className="wf-profile-message wf-profile-message-success">
            {success}
          </div>
        )}

        {!loading && (
          <>
            <div className="wf-summary-box wf-profile-card">
              <div className="wf-profile-image-section">
                <div className="wf-profile-image-wrap">
                  <img
                    src={imageSrc}
                    alt="Profile"
                    className="wf-profile-image-preview"
                  />
                </div>

                <div>
                  <h3 className="wf-profile-section-title">Profile Picture</h3>
                  <p className="wf-profile-help">
                    Upload a clear profile photo. JPG, PNG, or WEBP only, up to
                    5MB.
                  </p>

                  <div className="wf-profile-image-actions">
                    <label className="wf-btn wf-btn-primary">
                      {uploadingImage ? "Uploading..." : "Choose Image"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={handleImageChange}
                        disabled={uploadingImage}
                        style={{ display: "none" }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="wf-profile-grid">
              <div className="wf-summary-box wf-profile-card">
                <h3 className="wf-profile-section-title">Account Information</h3>

                <div className="wf-profile-meta-grid">
                  <div>
                    <span className="wf-profile-meta-label">Role</span>
                    <strong>{profile?.role || "-"}</strong>
                  </div>

                  <div>
                    <span className="wf-profile-meta-label">Status</span>
                    <strong>{profile?.status || "-"}</strong>
                  </div>
                </div>

                <div className="wf-form-group">
                  <label className="wf-label">Full Name</label>
                  <input
                    className="wf-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="wf-form-group">
                  <label className="wf-label">Nickname</label>
                  <input
                    className="wf-input"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Preferred nickname"
                  />
                </div>

                <div className="wf-form-group">
                  <label className="wf-label">Email</label>
                  <input
                    className="wf-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <button
                  className="wf-btn wf-btn-primary"
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? "Saving..." : "Save Changes"}
                </button>
              </div>

              <div className="wf-summary-box wf-profile-card">
                <h3 className="wf-profile-section-title">Change Password</h3>

                <div className="wf-form-group">
                  <label className="wf-label">Current Password</label>
                  <input
                    className="wf-input"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>

                <div className="wf-form-group">
                  <label className="wf-label">New Password</label>
                  <input
                    className="wf-input"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div className="wf-form-group">
                  <label className="wf-label">Confirm Password</label>
                  <input
                    className="wf-input"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                <button
                  className="wf-btn wf-btn-primary"
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                >
                  {changingPassword ? "Changing..." : "Change Password"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

export default ProfilePage;