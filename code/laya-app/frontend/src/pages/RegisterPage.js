import { useState } from "react";
import { Link } from "react-router-dom";
import { registerUser } from "../services/authService";
import "../styles/wireframe.css";

function RegisterPage() {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "staff",
  });

  const [message, setMessage] = useState("");
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
    setMessage("");
    setError("");

    setSubmitting(true);

    try {
      const data = await registerUser(formData);
      setMessage(data.message);
      setFormData({
        full_name: "",
        email: "",
        password: "",
        role: "staff",
      });
    } catch (error) {
      setError(error.message);
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
              Research-ready tools,
              <br />
              field-ready results
            </h2>
            <div className="wf-auth-visual-subtitle">
              Create your account and start organizing experiments, trials, and
              layout generations more efficiently.
            </div>

            <div className="wf-auth-dots">
              <div className="wf-auth-dot" />
              <div className="wf-auth-dot active" />
            </div>
          </div>
        </div>

        <div className="wf-auth-form-side">
          <div className="wf-auth-form-wrap">
            <h1 className="wf-auth-form-title">Create account</h1>
            <div className="wf-auth-form-subtitle">
              Already have an account? <Link to="/login">Log in</Link>
            </div>

            {message && <div className="wf-auth-message-success">{message}</div>}
            {error && <div className="wf-auth-message-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="wf-auth-field">
                <input
                  className="wf-auth-input"
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="Full name"
                  required
                />
              </div>

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
                {submitting ? "Creating account..." : "Create account"}
              </button>
            </form>

            <div className="wf-auth-divider">For approved staff access</div>

            <div className="wf-auth-alt-row">
              <button className="wf-auth-alt-btn" type="button">
                Research Staff
              </button>
              <button className="wf-auth-alt-btn" type="button">
                Trial Manager
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;