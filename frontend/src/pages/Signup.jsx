import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/auth.css";

function Signup() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();

    try {
      // TODO: call your FastAPI signup endpoint
      // const res = await axios.post("/signup", { name, email, password });

      // mock signup success
      localStorage.setItem("token", "dummy_jwt_token");

      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      alert("Signup failed");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-logo">DesignableAI</div>
      
      <div className="auth-card">
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">Start designing with AI today</p>

        <form onSubmit={handleSignup}>
          <div className="auth-form-group">
            <label className="auth-label">Full Name</label>
            <input
              type="text"
              className="auth-input"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

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
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="auth-btn signup">
            Sign Up
          </button>

          <p className="auth-footer">
            Already have an account?{" "}
            <Link to="/">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default Signup;