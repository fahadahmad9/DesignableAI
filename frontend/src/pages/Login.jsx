import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/auth.css";

const AUTH_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, "")}/auth`
  : "http://127.0.0.1:8000/auth";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${AUTH_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        let message = "Login failed. Please try again.";

        try {
          const data = await response.json();
          if (typeof data?.detail === "string") {
            message = data.detail;
          }
        } catch {
          // Fallback to generic message if response is not JSON.
        }

        setError(message);
        return;
      }

      const data = await response.json();

      if (data?.user_id) {
        localStorage.setItem("user_id", String(data.user_id));
      }
      if (data?.username) {
        localStorage.setItem("username", data.username);
      }
      localStorage.setItem("email", data?.email || email);


      navigate("/dashboard");
    } catch (err) {
      setError(err?.message || "Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <Link to="/" className="auth-logo" aria-label="Back to landing page">
        DesignableAI
      </Link>
      
      <div className="auth-card">
        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle">Log in to continue designing</p>

        <form onSubmit={handleLogin}>
          {error && <p className="auth-error">{error}</p>}

          <div className="auth-form-group">
            <label className="auth-label">Email Address</label>
            <input
              type="email"
              className="auth-input"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth-form-group">
            <label className="auth-label">Password</label>
            <input
              type="password"
              className="auth-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="auth-btn login" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>

          <p className="auth-footer">
            Don't have an account?{" "}
            <Link to="/signup">Sign up</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default Login;