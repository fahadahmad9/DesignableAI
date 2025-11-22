import { useState, useRef, useEffect } from "react";
import "../App.css"; // Keep using your existing CSS

// Backend upload URL
const BACKEND_UPLOAD = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, "")}/upload/`
  : "http://127.0.0.1:8000/upload/";

function Dashboard() {
  const [isModalOpen, setModalOpen] = useState(false);
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
      <aside className="side">
        <div className="logo-title">DesignableAI</div>
        <div className="panel-card">
          <div className="panel-head">
            <div>
              <div className="panel-title">Documents</div>
              <div className="muted small">
                Upload images to extract text
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button className="btn" onClick={openModal}>
              📤 Upload
            </button>
            <button className="btn" style={{ marginTop: 8 }}>
              ✏️ Draw
            </button>
            <button className="btn" style={{ marginTop: 8 }}>
              📋 Templates
            </button>
          </div>
        </div>

        <div className="profile-button">
          <div className="profile-image">
            <div className="profile-placeholder">F</div>
          </div>
          <span>Fahad</span>
        </div>

        <div className="tip muted">
          Tip: Upload images for text extraction, Draw to create sketches, or
          browse Templates for quick designs.
        </div>
      </aside>

      <main className="main">
        <div className="heading">
          <h2>Dashboard</h2>
        </div>

        <div className="panel-card">
          <div id="status" className="muted">
            {status}
          </div>

          {preview && <img src={preview} alt="preview" className="preview" />}

          <div id="result" className="output">
            {resultText}
          </div>

          {details && details.length > 0 && (
            <div className="details">
              <strong>Details</strong>
              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                {details.slice(0, 20).map((d, i) => (
                  <div key={i} className="detail-item">
                    {d.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {segments && segments.length > 0 && (
            <div className="segments">
              <strong>SAM Segments</strong>
              {segments.map((s, i) => (
                <div className="segment-card" key={i}>
                  <div style={{ fontSize: 13, marginBottom: 6 }}>
                    <strong>{s.component_type}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: "#556" }}>
                    <strong>BBox:</strong> [{s.bbox.join(", ")}]
                  </div>
                  <div style={{ fontSize: 12, color: "#556" }}>
                    <strong>Area:</strong> {s.area} &nbsp;{" "}
                    <strong>IOU:</strong> {s.predicted_iou.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {linkedData.length > 0 && (
            <div className="linked-data">
              <strong>Linked Measurements</strong>
              <div style={{ marginTop: 8 }}>
                {linkedData.map((item, i) => (
                  <div className="linked-item" key={i}>
                    {item.text} → {item.segment_class}{" "}
                    <span style={{ color: "#889", marginLeft: 8 }}>
                      ({item.distance.toFixed(2)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="chat-window">
          {chatHistory.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.sender}`}>
              {msg.text}
            </div>
          ))}
        </div>

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
    </div>
  );
}

export default Dashboard;
