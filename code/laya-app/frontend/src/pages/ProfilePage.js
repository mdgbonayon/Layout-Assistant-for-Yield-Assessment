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
  const [email, setEmail] = useState("");
  const [image, setImage] = useState(null);
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

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      setError("");
      const profileRes = await axios.get("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setProfile(profileRes.data);
      setFullName(profileRes.data.full_name || "");
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
      return `${window.location.protocol}//${window.location.hostname}:5000${profile.profile_image_url}`;
    }
    return "https://via.placeholder.com/120";
  }, [preview, profile]);

  async function handleSaveProfile() {
    try {
      setSavingProfile(true);
      setError("");
      setSuccess("");

      const updateRes = await axios.put(
        "/api/auth/me",
        { full_name: fullName, email },
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

  async function handleUploadImage() {
    if (!image) {
      setError("Please choose an image first.");
      return;
    }

    try {
      setUploadingImage(true);
      setError("");
      setSuccess("");

      const formData = new FormData();
      formData.append("profileImage", image);

      const uploadRes = await axios.post(
        "/api/auth/me/profile-image",
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
      setImage(null);
      setPreview(null);
      setSuccess("Profile image updated successfully.");
    } catch (err) {
      console.error("Image upload failed:", err);
      setError(err?.response?.data?.message || "Failed to upload profile image.");
    } finally {
      setUploadingImage(false);
    }
  }

    async function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // show preview instantly
    setPreview(URL.createObjectURL(file));
    setImage(file);

    try {
        setUploadingImage(true);
        setError("");
        setSuccess("");

        const formData = new FormData();
        formData.append("profileImage", file);

        const uploadRes = await axios.post(
        "/api/auth/me/profile-image",
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

        setSuccess("Profile image updated!");
    } catch (err) {
        console.error(err);
        setError("Failed to upload image");
    } finally {
        setUploadingImage(false);
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
        "/api/auth/me/password",
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
      <div style={{ maxWidth: "920px", margin: "0 auto" }}>
        <h2 style={{ marginBottom: "20px" }}>Profile</h2>

        {loading && <div className="wf-loading">Loading profile...</div>}
        {error && <div className="wf-error">{error}</div>}
        {success && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px 14px",
              borderRadius: "12px",
              background: "#eaf7f1",
              border: "1px solid #b9e0ca",
              color: "#1f7a63",
              fontWeight: 600,
            }}
          >
            {success}
          </div>
        )}

        {!loading && (
          <>
            <div
              className="wf-summary-box"
              style={{
                marginBottom: "20px",
                padding: "24px",
                display: "grid",
                gridTemplateColumns: "140px 1fr",
                gap: "24px",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", justifyContent: "center" }}>
                <img
                  src={imageSrc}
                  alt="Profile"
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid #d6ddd8",
                  }}
                />
              </div>

              <div>
                <div
                  style={{
                    marginBottom: "12px",
                    fontWeight: 700,
                    fontSize: "18px",
                  }}
                >
                  Profile Picture
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <label className="wf-btn wf-btn-primary">
                    Choose Image
                    <input
                        type="file"
                        onChange={handleImageChange}
                        style={{ display: "none" }}
                    />
                    </label>
                </div>
              </div>
            </div>

            <div
              className="wf-summary-box"
              style={{ marginBottom: "20px", padding: "24px" }}
            >
              <h3 style={{ marginTop: 0, marginBottom: "18px" }}>
                Account Information
              </h3>

              <div className="wf-form-group" style={{ marginBottom: "16px" }}>
                <label className="wf-label">Full Name</label>
                <input
                  className="wf-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="wf-form-group" style={{ marginBottom: "16px" }}>
                <label className="wf-label">Email</label>
                <input
                  className="wf-input"
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

            <div className="wf-summary-box" style={{ padding: "24px" }}>
              <h3 style={{ marginTop: 0, marginBottom: "18px" }}>
                Change Password
              </h3>

              <div className="wf-form-group" style={{ marginBottom: "16px" }}>
                <label className="wf-label">Current Password</label>
                <input
                  className="wf-input"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="wf-form-group" style={{ marginBottom: "16px" }}>
                <label className="wf-label">New Password</label>
                <input
                  className="wf-input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="wf-form-group" style={{ marginBottom: "16px" }}>
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
          </>
        )}
      </div>
    </AppShell>
  );
}

export default ProfilePage;