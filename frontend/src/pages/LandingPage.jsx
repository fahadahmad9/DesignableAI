import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/LandingPage.css";

function LandingPage() {
  const navigate = useNavigate();
  const [isHovering, setIsHovering] = useState(false);

  const handleGetStarted = () => {
    navigate("/dashboard");
  };

  return (
    <div className="landing-page">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <div className="logo-icon">D</div>
            <span className="logo-text">DESIGNABLE</span>
          </div>
          <nav className="nav-menu">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#about">About</a>
          </nav>
          <div className="header-actions">
            <button className="btn-text">Log In</button>
            <button className="btn-primary" onClick={handleGetStarted}>
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-left">
            <div className="hero-tag">AI-Powered Design Partner</div>
            <h1 className="hero-title">
              DESIGNABLE
              <br />
              AI
            </h1>
            <p className="hero-description">
              Transform your furniture sketches into stunning visualizations.
              The creative companion for architects and interior designers.
            </p>
            <div className="hero-buttons">
              <button className="btn-primary large" onClick={handleGetStarted}>
                Get Started
              </button>
              <button className="btn-secondary large">Watch Demo</button>
            </div>
            <div className="hero-stats">
              <div className="stat">
                <div className="stat-number">10K+</div>
                <div className="stat-label">Designers</div>
              </div>
              <div className="stat">
                <div className="stat-number">500K+</div>
                <div className="stat-label">Designs Created</div>
              </div>
              <div className="stat">
                <div className="stat-number">4.9★</div>
                <div className="stat-label">Rating</div>
              </div>
            </div>
          </div>
          <div className="hero-right">
            <div className="sketch-preview">
              <div className="sketch-header">
                <div className="window-controls">
                  <span className="control red"></span>
                  <span className="control yellow"></span>
                  <span className="control green"></span>
                </div>
                <span className="sketch-title">sketch.ai</span>
              </div>
              <div className="sketch-content">
                <div 
                  className="sketch-placeholder"
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                >
                  {!isHovering ? (
                    <>
                      <div className="sketch-icon">
                        <svg
                          width="40"
                          height="40"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M12 19l7 2-7-18-7 18 7-2zm0 0v-8" />
                        </svg>
                      </div>
                      <p>Hover to sketch</p>
                    </>
                  ) : (
                    <svg
                      className="chair-animation"
                      viewBox="0 0 300 400"
                      width="300"
                      height="400"
                    >
                      {/* Chair Back - Curved Lines */}
                      <path
                        d="M 100 80 Q 150 70 200 80"
                        stroke="#333"
                        strokeWidth="3"
                        fill="none"
                        className="draw-path"
                        style={{ animationDelay: "0s" }}
                      />
                      <path
                        d="M 100 120 Q 150 110 200 120"
                        stroke="#333"
                        strokeWidth="3"
                        fill="none"
                        className="draw-path"
                        style={{ animationDelay: "0.3s" }}
                      />
                      <path
                        d="M 100 160 Q 150 150 200 160"
                        stroke="#333"
                        strokeWidth="3"
                        fill="none"
                        className="draw-path"
                        style={{ animationDelay: "0.6s" }}
                      />
                      
                      {/* Chair Seat Base */}
                      <path
                        d="M 80 200 L 220 200"
                        stroke="#333"
                        strokeWidth="3"
                        fill="none"
                        className="draw-path"
                        style={{ animationDelay: "0.9s" }}
                      />
                      
                      {/* Chair Seat Sides */}
                      <path
                        d="M 80 200 L 70 220"
                        stroke="#333"
                        strokeWidth="3"
                        fill="none"
                        className="draw-path"
                        style={{ animationDelay: "1.2s" }}
                      />
                      <path
                        d="M 220 200 L 230 220"
                        stroke="#333"
                        strokeWidth="3"
                        fill="none"
                        className="draw-path"
                        style={{ animationDelay: "1.2s" }}
                      />
                      
                      {/* Chair Support Bar */}
                      <path
                        d="M 90 250 L 210 250"
                        stroke="#333"
                        strokeWidth="3"
                        fill="none"
                        className="draw-path"
                        style={{ animationDelay: "1.5s" }}
                      />
                      
                      {/* Front Left Leg */}
                      <path
                        d="M 80 220 L 75 340"
                        stroke="#333"
                        strokeWidth="3"
                        fill="none"
                        className="draw-path"
                        style={{ animationDelay: "1.8s" }}
                      />
                      
                      {/* Front Right Leg */}
                      <path
                        d="M 220 220 L 225 340"
                        stroke="#333"
                        strokeWidth="3"
                        fill="none"
                        className="draw-path"
                        style={{ animationDelay: "1.8s" }}
                      />
                      
                      {/* Back Left Support */}
                      <path
                        d="M 100 80 L 90 200"
                        stroke="#333"
                        strokeWidth="3"
                        fill="none"
                        className="draw-path"
                        style={{ animationDelay: "2.1s" }}
                      />
                      
                      {/* Back Right Support */}
                      <path
                        d="M 200 80 L 210 200"
                        stroke="#333"
                        strokeWidth="3"
                        fill="none"
                        className="draw-path"
                        style={{ animationDelay: "2.1s" }}
                      />
                      
                      {/* Detail Lines */}
                      <circle
                        cx="110"
                        cy="300"
                        r="3"
                        fill="#999"
                        className="fade-in"
                        style={{ animationDelay: "2.4s" }}
                      />
                      <circle
                        cx="190"
                        cy="300"
                        r="3"
                        fill="#999"
                        className="fade-in"
                        style={{ animationDelay: "2.4s" }}
                      />
                      <path
                        d="M 230 160 L 245 155"
                        stroke="#ddd"
                        strokeWidth="2"
                        fill="none"
                        className="fade-in"
                        style={{ animationDelay: "2.6s" }}
                      />
                      <path
                        d="M 235 170 L 250 165"
                        stroke="#ddd"
                        strokeWidth="2"
                        fill="none"
                        className="fade-in"
                        style={{ animationDelay: "2.7s" }}
                      />
                      <path
                        d="M 240 180 L 255 175"
                        stroke="#ddd"
                        strokeWidth="2"
                        fill="none"
                        className="fade-in"
                        style={{ animationDelay: "2.8s" }}
                      />
                      <circle
                        cx="240"
                        cy="320"
                        r="4"
                        fill="none"
                        stroke="#ddd"
                        strokeWidth="1"
                        className="fade-in"
                        style={{ animationDelay: "2.9s" }}
                      />
                    </svg>
                  )}
                </div>
              </div>
              <div className="sketch-footer">
                <div className="feature-badge">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                  <span>AI Enhanced</span>
                </div>
                <div className="feature-badge secondary">
                  {isHovering ? (
                    <span className="status-text">Ready in seconds</span>
                  ) : (
                    <>
                      <span className="dot"></span>
                      <span>Interactive</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works" id="features">
        <div className="section-header">
          <span className="section-tag">How it works</span>
          <h2 className="section-title">From Sketch to Reality</h2>
        </div>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
            </div>
            <h3 className="feature-title">Upload Sketches</h3>
            <p className="feature-description">
              Drop your hand-drawn furniture concepts and watch them come alive
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 3a9 9 0 100 18 9 9 0 000-18zM12 9v4m0 4h.01" />
              </svg>
            </div>
            <h3 className="feature-title">AI Enhancement</h3>
            <p className="feature-description">
              Our model refines your vision with photorealistic rendering options
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </div>
            <h3 className="feature-title">Iterate & Export</h3>
            <p className="feature-description">
              Build upon designs, create variations, and export production-ready
              files
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <span className="cta-tag">Ready to transform your workflow?</span>
          <h2 className="cta-title">
            Start Designing
            <br />
            Smarter Today
          </h2>
          <p className="cta-description">
            Join thousands of architects and designers who are already creating
            stunning visualizations with Designable AI.
          </p>
          <div className="cta-buttons">
            <button className="btn-primary large" onClick={handleGetStarted}>
              Get Started Free
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
            <button className="btn-secondary large">Schedule Demo</button>
          </div>
          <p className="cta-note">No credit card required · Free trial available</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="logo-icon">D</div>
              <span className="logo-text">DESIGNABLE</span>
            </div>
            <p className="footer-tagline">
              AI-powered design partner for architects and interior designers.
            </p>
          </div>
          <div className="footer-links">
            <div className="footer-column">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#api">API</a>
              <a href="#changelog">Changelog</a>
            </div>
            <div className="footer-column">
              <h4>Company</h4>
              <a href="#about">About</a>
              <a href="#blog">Blog</a>
              <a href="#careers">Careers</a>
              <a href="#press">Press</a>
            </div>
            <div className="footer-column">
              <h4>Resources</h4>
              <a href="#docs">Documentation</a>
              <a href="#tutorials">Tutorials</a>
              <a href="#community">Community</a>
              <a href="#support">Support</a>
            </div>
            <div className="footer-column">
              <h4>Legal</h4>
              <a href="#privacy">Privacy</a>
              <a href="#terms">Terms</a>
              <a href="#security">Security</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2024 Designable AI. All rights reserved.</p>
          <div className="social-links">
            <a href="#twitter" aria-label="Twitter">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
              </svg>
            </a>
            <a href="#instagram" aria-label="Instagram">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zm1.5-4.87h.01" />
              </svg>
            </a>
            <a href="#linkedin" aria-label="LinkedIn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;