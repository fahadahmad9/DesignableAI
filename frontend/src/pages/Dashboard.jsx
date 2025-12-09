import { useState, useRef, useEffect } from "react";
import Sketch from "./Sketch";
import "../App.css";

const BACKEND_UPLOAD = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, "")}/upload/`
  : "http://127.0.0.1:8000/upload/";

function Dashboard() {
  const [isSidebarExpanded, setSidebarExpanded] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isSketchOpen, setSketchOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState(
    "No design started. Upload an image, draw a sketch, or choose a template to begin."
  );
  const [resultText, setResultText] = useState("");
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const [segments, setSegments] = useState([]);
  const [result, setResult] = useState(null);

  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState("");

  const linkedData = result?.linked_data || [];

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function openModal() {
    setFile(null);
    setModalOpen(true);
    setResultText("");
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

  function sendChatMessage() {
    if (!chatInput || !chatInput.trim()) return;

    const message = {
      text: chatInput.trim(),
      sender: "user",
    };

    setChatHistory((prev) => [...prev, message]);
    setChatInput("");
    setStatus(`Message sent: ${message.text}`);
  }

  async function upload() {
    if (!file) return setStatus("Please choose a file first.");
    setLoading(true);
    setStatus("Uploading...");

    try {
      const form = new FormData();
      form.append("file", file, file.name);

      const resp = await fetch(BACKEND_UPLOAD, { method: "POST", body: form });
      if (!resp.ok) {
        const text = await resp.text();
        setStatus(`Upload failed: ${resp.status} ${text}`);
        return;
      }

      const data = await resp.json();
      if (data.error) {
        setStatus(`Error: ${data.error}`);
        return;
      }

      setStatus(
        `Last uploaded: ${file.name} (${data.text_result?.total_words || 0} words)`
      );
      setResultText(data.text_result?.full_text || "No text found");
      setDetails(
        Array.isArray(data.text_result?.details)
          ? data.text_result.details
          : []
      );
      setSegments(
        Array.isArray(data.segments_result?.segments)
          ? data.segments_result.segments
          : []
      );

      setResult(data);
      setModalOpen(false);
    } catch (err) {
      setStatus(`Upload error: ${err.message || err}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-root">
      <aside className={`sidebar ${isSidebarExpanded ? 'expanded' : 'collapsed'}`}>
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
          <a href="#" className="nav-item active">
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {isSidebarExpanded && <span>Dashboard</span>}
          </a>
          <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); openSketch(); }}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            {isSidebarExpanded && <span>Canvas</span>}
          </a>
          <a href="#" className="nav-item">
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            {isSidebarExpanded && <span>Projects</span>}
          </a>
          <a href="#" className="nav-item">
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {isSidebarExpanded && <span>Settings</span>}
          </a>
          <a href="#" className="nav-item">
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {isSidebarExpanded && <span>Help</span>}
          </a>
        </nav>

        {isSidebarExpanded && (
          <div className="sidebar-footer">
            <a href="#" className="back-link">
              <svg className="back-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back to Home</span>
            </a>
          </div>
        )}
      </aside>

      <main className={`main-content ${isSidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
         <div className="content-header">
        </div>

        <div className="content-sections">
        </div>

        <div className="chat-container">
          {chatHistory.length > 0 && (
            <div className="chat-messages">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`chat-message ${msg.sender}`}>
                  {msg.text}
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
              onChange={(e) =>
                setFile(e.target.files && e.target.files[0])
              }
            />

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button className="btn" onClick={upload} disabled={loading}>
                {loading ? "Uploading..." : "Upload & Extract"}
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
