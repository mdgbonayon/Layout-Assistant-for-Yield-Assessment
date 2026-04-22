import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import "../styles/wireframe.css";

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const data = await loginUser(formData);
      login(data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="wf-auth-page">
      <div className="wf-auth-shell">
        <div
          className="wf-auth-visual"
          style={{
            backgroundImage: `
              linear-gradient(180deg, rgba(20, 90, 70, 0.34), rgba(20, 90, 70, 0.68)),
              linear-gradient(135deg, rgba(31, 122, 99, 0.22), rgba(143, 21, 55, 0.14)),
              url(${process.env.PUBLIC_URL}/images/auth-field.jpg)
            `,
            backgroundPosition: "85% center",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div className="wf-auth-visual-top">
            <div className="wf-auth-logo">LAYA</div>
            <a href="/" className="wf-auth-back-link">
              Back to website →
            </a>
          </div>

          <div className="wf-auth-visual-bottom">
            <h2 className="wf-auth-visual-title">
              Smarter field layouts,
              <br />
              greener planning
            </h2>
            <div className="wf-auth-visual-subtitle">
              Organize experiments, manage trials, and generate field layouts
              with a workflow built for agricultural research.
            </div>

            <div className="wf-auth-dots">
              <div className="wf-auth-dot active" />
              <div className="wf-auth-dot" />

            </div>
          </div>
        </div>

        <div className="wf-auth-form-side">
          <div className="wf-auth-form-wrap">
            <h1 className="wf-auth-form-title">Welcome back</h1>
            <div className="wf-auth-form-subtitle">
              No account yet? <Link to="/register">Create one</Link>
            </div>

            {error && <div className="wf-auth-message-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="wf-auth-field">
                <input
                  className="wf-auth-input"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email"
                  required
                />
              </div>

              <div className="wf-auth-field">
                <input
                  className="wf-auth-input"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  required
                />
              </div>

              <button
                type="submit"
                className="wf-auth-submit"
                disabled={submitting}
              >
                {submitting ? "Logging in..." : "Login"}
              </button>
            </form>

            <div className="wf-auth-divider">System access</div>

            <div className="wf-auth-alt-row">
              <button className="wf-auth-alt-btn" type="button">
                Staff
              </button>
              <button className="wf-auth-alt-btn" type="button">
                Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;