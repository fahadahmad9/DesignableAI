import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sketch from "./Sketch";
import "../App.css";

const BACKEND_UPLOAD = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, "")}/analyze-chair`
  : "http://127.0.0.1:8000/analyze-chair";

function Dashboard() {
  const navigate = useNavigate();

  const [isSidebarExpanded, setSidebarExpanded] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isSketchOpen, setSketchOpen] = useState(false);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [imageDataUrl, setImageDataUrl] = useState(null);

  const [status, setStatus] = useState(
    "No design started. Upload an image, draw a sketch, or choose a template to begin."
  );

  const [resultText, setResultText] = useState("");
  const [loading, setLoading] = useState(false);

  const inputRef = useRef(null);

  const [segments, setSegments] = useState([]);
  const [result, setResult] = useState(null);
  const [lastPreview, setLastPreview] = useState(null);

  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState("");

  const linkedData = result?.linked_data || [];

  const detections = Array.isArray(result?.detections)
    ? result.detections
    : Array.isArray(result?.results)
    ? result.results
    : [];

  const displayPreview = preview || lastPreview;

  const sanitizeHistory = (hist = []) =>
    hist.filter(
      (msg) =>
        msg?.role !== "system" &&
        !(typeof msg?.content === "string" && msg.content.trim().startsWith("You are DesignableAI"))
    );

  // Preview Logic
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
    setResultText("");
    // Clear saved state when starting new upload
    sessionStorage.removeItem('dashboardState');
  }

  function handleFileChange(event) {
    const selectedFile = event.target.files && event.target.files[0];
    setFile(selectedFile || null);

    if (!selectedFile) {
      setImageDataUrl(null);
      return;
    }

    const fileReader = new FileReader();
    fileReader.onload = () => {
      const result = typeof fileReader.result === "string" ? fileReader.result : null;
      setImageDataUrl(result);
    };
    fileReader.onerror = () => {
      console.error("Failed to read image file as data URL");
      setImageDataUrl(null);
    };
    fileReader.readAsDataURL(selectedFile);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function openSketch() {
    setSketchOpen(true);
  }

  function closeSketch() {
    setSketchOpen(false);
  }

  function toggleSidebar() {
    setSidebarExpanded(!isSidebarExpanded);
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

      const resp = await fetch(BACKEND_UPLOAD, {
        method: "POST",
        body: form,
      });

      if (!resp.ok) {
        const text = await resp.text();
        setStatus(`Upload failed: ${resp.status} ${text}`);
        return;
      }

      const data = await resp.json();
      console.log("IMAGE ANALYSIS RESULT:", data);
      const parsed = data?.analysis || data || {};

      if (Array.isArray(data?.history)) {
        setChatHistory(sanitizeHistory(data.history));
      }

      const textBody =
        parsed.summary ||
        parsed.description ||
        parsed.text ||
        parsed.resultText ||
        "";
      setResultText(textBody);

      const incomingSegments =
        (parsed.segments_result && Array.isArray(parsed.segments_result.segments)
          ? parsed.segments_result.segments
          : []) || [];
      const incomingDetections = Array.isArray(parsed.detections)
        ? parsed.detections
        : Array.isArray(data?.detections)
        ? data.detections
        : Array.isArray(parsed.results)
        ? parsed.results
        : [];

      setSegments(incomingSegments.length ? incomingSegments : incomingDetections);
      setResult(parsed);

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
      setStatus(`Upload error: ${err.message}`);
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          ) : (
            <svg className="toggle-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
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
              openSketch();
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
          <div className="sidebar-footer">
            <a
              href="/"
              className="back-link"
              onClick={(e) => {
                e.preventDefault();
                navigate("/");
              }}
            >
              <svg className="back-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back to Home</span>
            </a>
          </div>
        )}
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
            <h2 style={{ margin: "6px 0 0", color: "#111" }}>{status}</h2>
          </div>

          {result && (
            <div
              className="muted small"
              style={{
                padding: "6px 12px",
                borderRadius: 10,
                background: "#f3f4f6",
                border: "1px solid #e5e5e5",
              }}
            >
              Text: {resultText ? `${resultText.length} chars` : "0"} · Segments:{" "}
              {segments.length} · Linked: {linkedData.length} · Detections:{" "}
              {detections.length}
            </div>
          )}
        </div>

        {/* CONTENT GRID (panels) */}
        <div
          className="content-sections"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {/* Uploaded Image */}
          <div
            className="panel-card"
            style={{ minHeight: 180, maxWidth: 500, justifySelf: "start" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <div style={{ fontWeight: 700 }}>Uploaded image</div>
              {file && <span className="muted small">{file.name}</span>}
            </div>
            {displayPreview ? (
              <img
                src={displayPreview}
                alt="Uploaded preview"
                style={{
                  width: "100%",
                  maxHeight: 180,
                  objectFit: "contain",
                  borderRadius: 12,
                  border: "1px solid #e5e5e5",
                  background: "#f9f9f9",
                }}
              />
            ) : (
              <div className="muted small">No image selected yet.</div>
            )}
            
            {result && (imageDataUrl || displayPreview) && (
              <button
                className="btn"
                onClick={() => {
                  navigate("/visualize", {
                    state: {
                      imageUrl: imageDataUrl || displayPreview,
                      segments: segments,
                      result: result,
                    },
                  });
                }}
                style={{
                  marginTop: 12,
                  width: "100%",
                }}
              >
                Visualize Chair
              </button>
            )}
          </div>

        </div>

        {/* CHAT AREA */}
        <div className="chat-container">
          {chatHistory.length > 0 && (
            <div className="chat-messages">
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`chat-message ${
                    msg.role === "assistant" ? "assistant" : "user"
                  }`}
                >
                  {msg.content}
                </div>
              ))}
            </div>
          )}

          <div className="chat-input-container">
            <input
              className="chat-input"
              placeholder="Ask the design assistant..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendChatMessage();
                }
              }}
            />

            <button className="chat-submit-btn" onClick={sendChatMessage}>
              <svg className="submit-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </main>

      {/* UPLOAD MODAL */}
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
                    border: "1px solid #e5e5e5",
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

      {/* SKETCH MODAL */}
      {isSketchOpen && (
        <div className="sketch-modal-backdrop" role="dialog">
          <div className="sketch-modal-content">
            <button className="sketch-close-btn" onClick={closeSketch}>
              ✕
            </button>
            <Sketch />
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
