import { useState, useRef, useEffect } from "react";
import "../App.css";

// Backend upload URL
const BACKEND_ANALYZE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, "")}/analyze-chair`
  : "http://127.0.0.1:8000/analyze-chair";

function Dashboard() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [profile, setProfile] = useState(() => ({
    username: (localStorage.getItem("username") || "").trim(),
    email: (localStorage.getItem("email") || "").trim(),
  }));
  const displayUsername = profile.username || "Designer";
  const displayEmail = profile.email || "Not available";
  const userInitial = displayUsername.charAt(0).toUpperCase();

  const [isSidebarExpanded, setSidebarExpanded] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isUserMenuOpen, setUserMenuOpen] = useState(false);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [imageDataUrl, setImageDataUrl] = useState(null);

  const [status, setStatus] = useState(
    "No design started. Upload an image, draw a sketch, or choose a template to begin."
  );
  const [resultData, setResultData] = useState(null);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef(null);

  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (preview) setLastPreview(preview);
  }, [preview]);

  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    if (!userId || profile.email) {
      return;
    }

    let isMounted = true;

    const loadProfile = async () => {
      try {
        const response = await fetch(`${AUTH_BASE}/profile/${userId}`);
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (!isMounted) {
          return;
        }

        const nextUsername = typeof data?.username === "string" ? data.username.trim() : "";
        const nextEmail = typeof data?.email === "string" ? data.email.trim() : "";

        setProfile((prev) => ({
          username: prev.username || nextUsername,
          email: prev.email || nextEmail,
        }));

        if (nextUsername) {
          localStorage.setItem("username", nextUsername);
        }
        if (nextEmail) {
          localStorage.setItem("email", nextEmail);
        }
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [profile.email]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // Restore state from sessionStorage on mount
  useEffect(() => {
    try {
      const savedData = sessionStorage.getItem('dashboardState');
      if (savedData) {
        const { result, segments, resultText, lastPreview, imageDataUrl, status, chatHistory } = JSON.parse(savedData);
        if (result) setResult(result);
        if (segments) setSegments(segments);
        if (resultText) setResultText(resultText);
        if (lastPreview) setLastPreview(lastPreview);
        if (imageDataUrl) setImageDataUrl(imageDataUrl);
        if (status) setStatus(status);
        if (chatHistory) setChatHistory(chatHistory);
      }
    } catch (err) {
      console.error('Failed to restore dashboard state:', err);
    }
  }, []);

  // Sidebar & Modal Controls
  function openModal() {
    setFile(null);
    setImageDataUrl(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function toggleSidebar() {
    setSidebarExpanded(!isSidebarExpanded);
    setUserMenuOpen(false);
  }

  function handleLogout() {
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");
    localStorage.removeItem("email");
    localStorage.removeItem("token");
    sessionStorage.removeItem("dashboardState");
    navigate("/login");
  }

  // Chat Messaging
  async function sendChatMessage() {
    if (!chatInput.trim()) return;

    const userMessage = { role: "user", content: chatInput.trim() };

    setChatHistory((prev) => [...prev, userMessage]);
    const newHistory = [...chatHistory, userMessage];
    setChatInput("");

    setStatus("Thinking...");

    try {
      const resp = await fetch(BACKEND_UPLOAD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          history: newHistory,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        setStatus(`Chat failed: ${resp.status} ${text}`);
        return;
      }

      const data = await resp.json();
      console.log("CHAT RESPONSE:", data);

      const assistantReply = {
        role: "assistant",
        content: data.assistant_reply,
      };

      const filteredHistory = sanitizeHistory([...newHistory, assistantReply]);
      setChatHistory(filteredHistory);
      setStatus("Message received");
    } catch (err) {
      console.error(err);
      setStatus(`Chat error: ${err.message}`);
    }
  }

  // Upload API
  async function upload() {
    if (!file) return setStatus("Please choose a file first.");

    setLoading(true);
    setStatus("Analyzing chair...");

    try {
      const form = new FormData();
      form.append("file", file);

      const resp = await fetch(BACKEND_ANALYZE, {
        method: "POST",
        body: form,
      });

      if (!resp.ok) {
        const text = await resp.text();
        setStatus(`Error: ${resp.status} ${text}`);
        setResultData(null);
        return;
      }

      const data = await resp.json();
      setResultData(data);
      setStatus("Chair analyzed successfully!");
      setModalOpen(false);

      // Save state to sessionStorage
      sessionStorage.setItem('dashboardState', JSON.stringify({
        result: parsed,
        segments: incomingSegments.length ? incomingSegments : incomingDetections,
        resultText: textBody,
        lastPreview: preview,
        imageDataUrl: imageDataUrl,
        status: "Chair analyzed successfully!",
        chatHistory: sanitizeHistory(chatHistory)
      }));
    } catch (err) {
      console.error(err);
      setStatus(`Upload failed: ${err.message}`);
      setResultData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-root">
      {/* SIDEBAR */}
      <aside
        className={`sidebar ${
          isSidebarExpanded ? "expanded" : "collapsed"
        }`}
      >
        <button className="sidebar-toggle" onClick={toggleSidebar}>
          {isSidebarExpanded ? (
            <svg className="toggle-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 18l-6-6 6-6" />
            </svg>
          ) : (
            <svg className="toggle-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 6l6 6-6 6" />
            </svg>
          )}
        </button>

        <div className="sidebar-header">
          <div className="logo-container">
            <div className="logo-icon">D</div>
            {isSidebarExpanded && (
              <div className="logo-text">
                <div className="logo-name">Designable</div>
                <div className="logo-subtitle">AI Studio</div>
              </div>
            )}
          </div>
        </div>

        <nav className="sidebar-nav">
          <a
            href="#"
            className="nav-item active"
            onClick={(e) => {
              e.preventDefault();
              openModal();
            }}
          >
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" />
            </svg>
            {isSidebarExpanded && <span>Upload</span>}
          </a>

          <a
            href="#"
            className="nav-item"
            onClick={(e) => {
              e.preventDefault();
              navigate("/sketch");
            }}
          >
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            {isSidebarExpanded && <span>Canvas</span>}
          </a>

          <a
            href="#"
            className="nav-item"
            onClick={(e) => {
              e.preventDefault();
              setStatus("Template gallery coming soon");
            }}
          >
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            {isSidebarExpanded && <span>Templates</span>}
          </a>
        </nav>

        {isSidebarExpanded && (
          <div className="sidebar-preview-section">
            <div className="sidebar-preview-header">
              <span className="sidebar-preview-title">Uploaded image</span>
              {file && <span className="muted small sidebar-preview-filename">{file.name}</span>}
            </div>
            {displayPreview ? (
              <img
                src={displayPreview}
                alt="Uploaded preview"
                className="sidebar-preview-image"
              />
            ) : (
              <div className="muted small sidebar-preview-empty">No image selected yet.</div>
            )}
          </div>
        )}

        <div className="sidebar-footer">
          <button
            className="nav-item"
            onClick={toggleTheme}
          >
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {theme === "dark" ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364l-1.414-1.414M7.05 7.05 5.636 5.636m12.728 0L16.95 7.05M7.05 16.95l-1.414 1.414M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1 1 11.21 3c-.35.75-.55 1.58-.55 2.46a7 7 0 0 0 7 7c.88 0 1.71-.2 2.46-.67Z" />
              )}
            </svg>
            {isSidebarExpanded && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
          </button>
          <a 
            href="/"
            className="nav-item"
            onClick={(e) => {
              e.preventDefault();
              navigate("/");
            }}
          >
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {isSidebarExpanded && <span>Back to Home</span>}
          </a>

          <div className="user-menu-wrapper" ref={userMenuRef}>
            <button
              type="button"
              className="sidebar-user user-menu-trigger"
              title={`Logged in as ${displayUsername}`}
              aria-haspopup="dialog"
              aria-expanded={isUserMenuOpen}
              onClick={() => setUserMenuOpen((prev) => !prev)}
            >
              <div className="sidebar-user-avatar">{userInitial}</div>
              {isSidebarExpanded && (
                <div className="sidebar-user-meta">
                  <div className="sidebar-user-name">{displayUsername}</div>
                  <div className="sidebar-user-role">Account</div>
                </div>
              )}
            </button>

            {isUserMenuOpen && (
              <div className={`user-menu-popover ${isSidebarExpanded ? "expanded" : "collapsed"}`} role="dialog" aria-label="User profile menu">
                <div className="user-menu-title">Profile</div>
                <div className="user-menu-row">
                  <span className="user-menu-label">Username</span>
                  <span className="user-menu-value">{displayUsername}</span>
                </div>
                <div className="user-menu-row">
                  <span className="user-menu-label">Email</span>
                  <span className="user-menu-value user-menu-email">{displayEmail}</span>
                </div>
                <button type="button" className="user-menu-logout" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main
        className={`main-content ${
          isSidebarExpanded ? "sidebar-expanded" : "sidebar-collapsed"
        }`}
      >
        {/* HEADER */}
        <div
          className="content-header"
          style={{
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div className="muted small">Upload status</div>
            <h2 style={{ margin: "6px 0 0", color: "var(--text-primary)" }}>{status}</h2>
          </div>

          {preview && <img src={preview} alt="preview" className="preview" />}

          {/* ANALYSIS RESULTS DISPLAY */}
          {resultData && (
            <div className="analysis-output" style={{ marginTop: "20px" }}>
              <h3 style={{ marginBottom: "12px" }}>🔍 Analysis Results</h3>

              {/* Identified Chair Type */}
              {resultData.identified_type && (
                <div style={{ marginBottom: "20px", padding: "12px", backgroundColor: "#f5f5f5", borderRadius: "6px" }}>
                  <h4 style={{ marginBottom: "8px", color: "#333" }}>Detected Chair Type:</h4>
                  <p style={{ fontWeight: "bold", fontSize: "1.2em", color: "#1976d2", margin: 0 }}>
                    {resultData.identified_type}
                  </p>
                </div>
              )}

              {/* Canonical Parts */}
              {resultData.canonical_parts && resultData.canonical_parts.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <h4 style={{ marginBottom: "10px" }}>Detected Components:</h4>
                  <ul style={{ margin: "0 0 0 20px", padding: 0 }}>
                    {resultData.canonical_parts.map((part, i) => (
                      <li key={i} style={{ marginBottom: "6px" }}>
                        {part}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Linked Data / Measurements */}
              {resultData.linked_data && resultData.linked_data.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <h4 style={{ marginBottom: "10px" }}>Linked Measurements:</h4>
                  <div style={{ display: "grid", gap: "8px" }}>
                    {resultData.linked_data.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "8px",
                          backgroundColor: "#fafafa",
                          borderLeft: "3px solid #1976d2",
                          borderRadius: "4px",
                        }}
                      >
                        <strong>{item.text}</strong> → {item.segment_class}{" "}
                        <span style={{ color: "#666", fontSize: "0.9em" }}>
                          (distance: {item.distance.toFixed(2)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SAM Segments */}
              {resultData.segments && resultData.segments.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <h4 style={{ marginBottom: "10px" }}>Detected Segments (SAM):</h4>
                  <div style={{ display: "grid", gap: "10px" }}>
                    {resultData.segments.map((segment, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "10px",
                          backgroundColor: "#fafafa",
                          border: "1px solid #ddd",
                          borderRadius: "6px",
                        }}
                      >
                        <div style={{ fontWeight: "bold", marginBottom: "6px" }}>
                          {segment.component_type}
                        </div>
                        <div style={{ fontSize: "0.9em", color: "#666" }}>
                          <strong>BBox:</strong> [{segment.bbox.join(", ")}]
                        </div>
                        <div style={{ fontSize: "0.9em", color: "#666" }}>
                          <strong>Area:</strong> {segment.area} | <strong>IOU:</strong>{" "}
                          {segment.predicted_iou.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw JSON Response */}
              <details style={{ marginTop: "20px" }}>
                <summary style={{ cursor: "pointer", fontWeight: "bold", color: "#1976d2" }}>
                  View Raw JSON Response
                </summary>
                <pre
                  style={{
                    marginTop: "12px",
                    padding: "12px",
                    backgroundColor: "#f5f5f5",
                    borderRadius: "6px",
                    overflow: "auto",
                    fontSize: "0.85em",
                  }}
                >
                  {JSON.stringify(resultData, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>

        {/* Chat Window */}
        <div className="chat-window">
          {chatHistory.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.sender}`}>
              {msg.text}
            </div>
          ))}
        </div>

        {/* Chat Input */}
        <div className="chatbar">
          <input
            className="chat-input"
            placeholder="Ask the design assistant..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendChatMessage();
            }}
          />
          <button className="btn chat-send" onClick={sendChatMessage}>
            ➤
          </button>
        </div>
      </main>

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" role="dialog">
          <div className="modal panel-card">
            <div className="modal-head">
              <div className="modal-title">Upload Image</div>
              <button className="btn ghost" onClick={closeModal}>
                ✕
              </button>
            </div>

            <div className="muted small">
              Choose an image (jpg, png). Max file size depends on backend.
            </div>

            <input
              ref={inputRef}
              className="file-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />

            {preview && (
              <div style={{ marginTop: 20, textAlign: "center" }}>
                <img
                  src={preview}
                  alt="Preview"
                  style={{
                    maxWidth: "100%",
                    maxHeight: 320,
                    borderRadius: 14,
                    border: "1px solid var(--border-color)",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                  }}
                />
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: preview ? 20 : 12,
              }}
            >
              <button className="btn" onClick={upload} disabled={loading}>
                {loading ? "Uploading..." : "Upload & Analyze"}
              </button>

              <button className="btn ghost" onClick={closeModal}>
                Cancel
              </button>
            </div>

            <div className="muted small" style={{ marginTop: 10 }}>
              {loading ? "Working..." : ""}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;