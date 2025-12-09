import React, { useEffect, useRef, useState } from "react";
import "../styles/sketch.css";

export default function Sketch() {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [brushSize, setBrushSize] = useState(3);
  const [mode, setMode] = useState("draw");
  const [isDrawing, setIsDrawing] = useState(false);
  const history = useRef([]);
  const startPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = 900;
    canvas.height = 600;
    
    const context = canvas.getContext("2d");
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "black";
    context.lineWidth = brushSize;
    contextRef.current = context;

    // Fill with white background
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Save initial state
    saveState();
  }, []);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.lineWidth = brushSize;
    }
  }, [brushSize]);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = mode === "erase" ? "white" : "black";
    }
  }, [mode]);

  const saveState = () => {
    const canvas = canvasRef.current;
    history.current.push(canvas.toDataURL());
    
    if (history.current.length > 20) {
      history.current.shift();
    }
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    const pos = getMousePos(e);
    startPos.current = pos;
    setIsDrawing(true);

    if (mode === "draw" || mode === "erase") {
      contextRef.current.beginPath();
      contextRef.current.moveTo(pos.x, pos.y);
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const pos = getMousePos(e);
    const ctx = contextRef.current;
    const canvas = canvasRef.current;

    if (mode === "draw" || mode === "erase") {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (mode === "line" || mode === "rect" || mode === "circle") {
      // Redraw from history to show preview
      if (history.current.length > 0) {
        const img = new Image();
        img.src = history.current[history.current.length - 1];
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          
          ctx.strokeStyle = "black";
          ctx.lineWidth = brushSize;
          
          if (mode === "line") {
            ctx.beginPath();
            ctx.moveTo(startPos.current.x, startPos.current.y);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
          } else if (mode === "rect") {
            const width = pos.x - startPos.current.x;
            const height = pos.y - startPos.current.y;
            ctx.strokeRect(startPos.current.x, startPos.current.y, width, height);
          } else if (mode === "circle") {
            const radius = Math.sqrt(
              Math.pow(pos.x - startPos.current.x, 2) + 
              Math.pow(pos.y - startPos.current.y, 2)
            );
            ctx.beginPath();
            ctx.arc(startPos.current.x, startPos.current.y, radius, 0, 2 * Math.PI);
            ctx.stroke();
          }
        };
      }
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      if (mode === "draw" || mode === "erase") {
        contextRef.current.closePath();
      }
      saveState();
    }
    setIsDrawing(false);
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
  };

  const undo = () => {
    if (history.current.length > 1) {
      history.current.pop();
      
      const prevState = history.current[history.current.length - 1];
      const img = new Image();
      img.src = prevState;
      img.onload = () => {
        const ctx = contextRef.current;
        const canvas = canvasRef.current;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
    }
  };

  const clearCanvas = () => {
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    history.current = [canvas.toDataURL()];
  };

  return (
    <div className="sketch-wrapper">
      <div className="sketch-container">
        <div className="sketch-content">
          <div className="canvas-wrapper">
            <canvas 
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
          </div>

          <div className="tools-sidebar">
            <h2 className="sidebar-title">Tools</h2>
            
            <div className="tool-section">
              <h3 className="section-label">Drawing Tools</h3>
              <button
                onClick={() => handleModeChange("draw")}
                className={`tool-btn ${mode === "draw" ? "active" : ""}`}
                title="Draw"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                  <path d="M2 2l7.586 7.586"/>
                </svg>
                <span>Draw</span>
              </button>
              
              <button
                onClick={() => handleModeChange("erase")}
                className={`tool-btn ${mode === "erase" ? "active" : ""}`}
                title="Erase"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 20H7L3 16l7-7 10 10z"/>
                  <path d="M10 9l7 7"/>
                </svg>
                <span>Eraser</span>
              </button>

              <button
                onClick={() => handleModeChange("line")}
                className={`tool-btn ${mode === "line" ? "active" : ""}`}
                title="Line"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="19" x2="19" y2="5"/>
                </svg>
                <span>Line</span>
              </button>

              <button
                onClick={() => handleModeChange("rect")}
                className={`tool-btn ${mode === "rect" ? "active" : ""}`}
                title="Rectangle"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                </svg>
                <span>Rectangle</span>
              </button>

              <button
                onClick={() => handleModeChange("circle")}
                className={`tool-btn ${mode === "circle" ? "active" : ""}`}
                title="Circle"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                </svg>
                <span>Circle</span>
              </button>
            </div>

            <div className="tool-section">
              <h3 className="section-label">Brush Size</h3>
              <div className="brush-control-vertical">
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="brush-slider-vertical"
                />
                <span className="brush-value-large">{brushSize}px</span>
              </div>
            </div>

            <div className="tool-section">
              <h3 className="section-label">Actions</h3>
              <button 
                onClick={undo} 
                className="tool-btn" 
                title="Undo" 
                disabled={history.current.length <= 1}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 7v6h6"/>
                  <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
                </svg>
                <span>Undo</span>
              </button>

              <button 
                onClick={clearCanvas} 
                className="tool-btn clear-btn" 
                title="Clear Canvas"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
                  <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
                <span>Clear</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}