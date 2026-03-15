import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "../App.css";

function Visualize() {
  const location = useLocation();
  const navigate = useNavigate();
  const { imageUrl, segments, result } = location.state || {};

  const [error, setError] = useState(null);

  useEffect(() => {
    if (!imageUrl || !result) {
      setError("No visualization data available. Please upload an image first.");
    }
  }, [imageUrl, result]);

  if (error) {
    return (
      <div className="app-root">
        <main className="main-content sidebar-collapsed">
          <div className="content-header">
            <h2>Visualization Error</h2>
          </div>
          <div className="panel-card" style={{ maxWidth: 600, margin: "0 auto" }}>
            <p className="muted">{error}</p>
            <button 
              className="btn" 
              onClick={() => navigate("/dashboard")}
              style={{ marginTop: 20 }}
            >
              Back to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  const detections = Array.isArray(result?.detections)
    ? result.detections
    : Array.isArray(result?.results)
    ? result.results
    : [];

  return (
    <div className="app-root">
      <main className="main-content sidebar-collapsed">
        {/* HEADER */}
        <div className="content-header" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, color: "#111" }}>Chair Visualization</h2>
            <p className="muted small" style={{ marginTop: 4 }}>
              Analysis results and segmentation data
            </p>
          </div>
          <button 
            className="btn ghost"
            onClick={() => navigate("/dashboard")}
          >
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 16, height: 16, marginRight: 6 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
        </div>

        {/* CONTENT GRID */}
        <div
          className="content-sections"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20,
          }}
        >
          {/* Image Display */}
          <div className="panel-card" style={{ gridColumn: "span 1" }}>
            <h3 style={{ marginTop: 0 }}>Uploaded Image</h3>
            <img
              src={imageUrl}
              alt="Chair visualization"
              style={{
                width: "100%",
                maxHeight: 400,
                objectFit: "contain",
                borderRadius: 12,
                border: "1px solid #e5e5e5",
                background: "#f9f9f9",
              }}
            />
          </div>

          {/* Segmentation Data */}
          <div className="panel-card" style={{ gridColumn: "span 1" }}>
            <h3 style={{ marginTop: 0 }}>Segmentation Data</h3>
            {segments && segments.length > 0 ? (
              <div>
                <p className="muted small">
                  Found {segments.length} segment{segments.length !== 1 ? "s" : ""}
                </p>
                <div style={{ marginTop: 16, maxHeight: 400, overflowY: "auto" }}>
                  {segments.map((seg, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 12,
                        marginBottom: 8,
                        borderRadius: 8,
                        background: "#f9f9f9",
                        border: "1px solid #e5e5e5",
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        Segment {idx + 1}
                      </div>
                      {seg.class_name && (
                        <div className="muted small">
                          Class: {seg.class_name}
                        </div>
                      )}
                      {seg.confidence !== undefined && (
                        <div className="muted small">
                          Confidence: {(seg.confidence * 100).toFixed(1)}%
                        </div>
                      )}
                      {seg.bbox && (
                        <div className="muted small">
                          BBox: [{seg.bbox.map(v => v.toFixed(1)).join(", ")}]
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="muted small">No segmentation data available</p>
            )}
          </div>

          {/* Analysis Results */}
          {result && (
            <div className="panel-card" style={{ gridColumn: "1 / -1" }}>
              <h3 style={{ marginTop: 0 }}>Analysis Results</h3>
              
              {result.summary && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Summary</div>
                  <p style={{ lineHeight: 1.6, color: "#555" }}>{result.summary}</p>
                </div>
              )}

              {result.description && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Description</div>
                  <p style={{ lineHeight: 1.6, color: "#555" }}>{result.description}</p>
                </div>
              )}

              {detections && detections.length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>
                    Detections ({detections.length})
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                      gap: 12,
                    }}
                  >
                    {detections.map((det, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          background: "#f9f9f9",
                          border: "1px solid #e5e5e5",
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {det.class || det.class_name || `Detection ${idx + 1}`}
                        </div>
                        {det.confidence !== undefined && (
                          <div className="muted small" style={{ marginTop: 4 }}>
                            {(det.confidence * 100).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Visualize;
