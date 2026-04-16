import React, { useCallback, useEffect, useRef, useState } from "react";
import { fabric } from "fabric";
import { useNavigate } from "react-router-dom";

const TOOL_ITEMS = [
  { key: "select", label: "Select", icon: "select" },
  { key: "draw", label: "Pencil", icon: "pencil" },
  { key: "curve", label: "Curve", icon: "curve" },
  { key: "line", label: "Line", icon: "line" },
  { key: "rect", label: "Rectangle", icon: "rect" },
  { key: "oval", label: "Oval", icon: "oval" },
  { key: "triangle", label: "Triangle", icon: "triangle" },
  { key: "circle", label: "Circle", icon: "circle" },
  { key: "erase", label: "Eraser", icon: "eraser" },
];

const COLORS = [
  "#000000",
  "#ffffff",
  "#ff0000",
  "#0000ff",
  "#008000",
  "#ffff00",
];

function ToolButton({ item, isActive, onClick }) {
  const frameStyle = isActive
    ? {
        borderTop: "1px solid #0b1220",
        borderLeft: "1px solid #0b1220",
        borderRight: "1px solid #334155",
        borderBottom: "1px solid #334155",
        background: "#1e293b",
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
      }
    : {
        borderTop: "1px solid #334155",
        borderLeft: "1px solid #334155",
        borderRight: "1px solid #0b1220",
        borderBottom: "1px solid #0b1220",
        background: "#223046",
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
      };

  return (
    <button
      type="button"
      onClick={() => onClick(item.key)}
      title={item.label}
      style={{
        width: 40,
        height: 40,
        border: "none",
        background: "#223046",
        color: "#e2e8f0",
        cursor: "pointer",
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        ...frameStyle,
      }}
    >
      <ToolIcon type={item.icon} />
      <span style={{ display: "none" }}>{item.label}</span>
    </button>
  );
}

function ToolIcon({ type }) {
  if (type === "select") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 3l8 8-4 1-1 4-3-13z" />
      </svg>
    );
  }

  if (type === "pencil") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 17.25V21h3.75L18 9.75 14.25 6 3 17.25z" />
        <path d="M13 7l4 4" />
      </svg>
    );
  }

  if (type === "line") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="5" y1="19" x2="19" y2="5" />
      </svg>
    );
  }

  if (type === "curve") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 17c5-8 11 8 16-6" />
      </svg>
    );
  }

  if (type === "rect") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="6" width="16" height="12" />
      </svg>
    );
  }

  if (type === "oval") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <ellipse cx="12" cy="12" rx="8" ry="5" />
      </svg>
    );
  }

  if (type === "triangle") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12,5 19,18 5,18" />
      </svg>
    );
  }

  if (type === "circle") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="7" />
      </svg>
    );
  }

  if (type === "eraser") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 16l5-5 6 6-2 2H9l-2-2z" />
        <line x1="13" y1="11" x2="18" y2="16" />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="6" y="6" width="12" height="12" strokeDasharray="2 2" />
      <polyline points="8,4 4,4 4,8" />
      <line x1="4" y1="4" x2="10" y2="10" />
    </svg>
  );
}

function ColorSwatch({ color, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(color)}
      title={color}
      style={{
        width: 22,
        height: 22,
        border: isActive ? "2px solid #1e3a8a" : "1px solid #475569",
        borderRadius: 4,
        background: color,
        cursor: "pointer",
        padding: 0,
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.18)",
      }}
    />
  );
}

export default function Sketch({ onBack }) {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const drawingObjectRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const isRestoringRef = useRef(false);
  const historyRef = useRef([]);
  const analyzeRequestIdRef = useRef(0);

  const [brushSize, setBrushSize] = useState(3);
  const [selectedTool, setSelectedTool] = useState("select");
  const [selectedColor, setSelectedColor] = useState("#000000");
  const [selectedObject, setSelectedObject] = useState(null);
  const [aiDescription, setAiDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const getRelativePosition = (centerY, canvasHeight) => {
    if (!canvasHeight || canvasHeight <= 0) {
      return "middle";
    }

    const third = canvasHeight / 3;
    if (centerY < third) {
      return "top";
    }
    if (centerY < third * 2) {
      return "middle";
    }
    return "bottom";
  };

  const approximateSegmentLength = (p0, p1) => {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const quadraticPoint = (p0, p1, p2, t) => {
    const omt = 1 - t;
    return {
      x: omt * omt * p0.x + 2 * omt * t * p1.x + t * t * p2.x,
      y: omt * omt * p0.y + 2 * omt * t * p1.y + t * t * p2.y,
    };
  };

  const cubicPoint = (p0, p1, p2, p3, t) => {
    const omt = 1 - t;
    return {
      x:
        omt * omt * omt * p0.x +
        3 * omt * omt * t * p1.x +
        3 * omt * t * t * p2.x +
        t * t * t * p3.x,
      y:
        omt * omt * omt * p0.y +
        3 * omt * omt * t * p1.y +
        3 * omt * t * t * p2.y +
        t * t * t * p3.y,
    };
  };

  const getPathLength = (obj) => {
    if (!obj || obj.type !== "path" || !Array.isArray(obj.path)) {
      return 0;
    }

    let length = 0;
    let current = { x: 0, y: 0 };
    let subpathStart = { x: 0, y: 0 };

    obj.path.forEach((segment) => {
      if (!Array.isArray(segment) || segment.length === 0) {
        return;
      }

      const cmd = segment[0];

      if (cmd === "M" || cmd === "m") {
        current = { x: Number(segment[1]) || 0, y: Number(segment[2]) || 0 };
        subpathStart = { ...current };
        return;
      }

      if (cmd === "L" || cmd === "l") {
        const next = { x: Number(segment[1]) || 0, y: Number(segment[2]) || 0 };
        length += approximateSegmentLength(current, next);
        current = next;
        return;
      }

      if (cmd === "Q" || cmd === "q") {
        const control = { x: Number(segment[1]) || 0, y: Number(segment[2]) || 0 };
        const end = { x: Number(segment[3]) || 0, y: Number(segment[4]) || 0 };

        let prev = { ...current };
        const steps = 12;
        for (let i = 1; i <= steps; i += 1) {
          const t = i / steps;
          const point = quadraticPoint(current, control, end, t);
          length += approximateSegmentLength(prev, point);
          prev = point;
        }
        current = end;
        return;
      }

      if (cmd === "C" || cmd === "c") {
        const c1 = { x: Number(segment[1]) || 0, y: Number(segment[2]) || 0 };
        const c2 = { x: Number(segment[3]) || 0, y: Number(segment[4]) || 0 };
        const end = { x: Number(segment[5]) || 0, y: Number(segment[6]) || 0 };

        let prev = { ...current };
        const steps = 16;
        for (let i = 1; i <= steps; i += 1) {
          const t = i / steps;
          const point = cubicPoint(current, c1, c2, end, t);
          length += approximateSegmentLength(prev, point);
          prev = point;
        }
        current = end;
        return;
      }

      if (cmd === "Z" || cmd === "z") {
        length += approximateSegmentLength(current, subpathStart);
        current = { ...subpathStart };
      }
    });

    return Math.round(length);
  };

  const analyzeDesign = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.warn("[analyzeDesign] Canvas not found");
      return;
    }
    const canvasHeight = canvas.getHeight() || 0;

    const designObjects = canvas.getObjects().map((obj) => {
      const width = Math.round(obj.getScaledWidth?.() || obj.width || 0);
      const height = Math.round(obj.getScaledHeight?.() || obj.height || 0);
      const left = Math.round(obj.left || 0);
      const top = Math.round(obj.top || 0);
      const centerY = top + height / 2;

      const simplified = {
        type: obj.data?.type || obj.type,
        left,
        top,
        width,
        height,
        angle: Math.round(obj.angle || 0),
        relativePosition: getRelativePosition(centerY, canvasHeight),
      };

      if (obj.type === "path") {
        simplified.pathLength = getPathLength(obj);
      }

      return simplified;
    });

    console.log(`[analyzeDesign] Canvas has ${designObjects.length} objects`);
    console.log("[analyzeDesign] Objects to send:", designObjects);

    const requestId = Date.now();
    analyzeRequestIdRef.current = requestId;
    setLoading(true);

    const sendRequest = async () => {
      try {
        console.log("[analyzeDesign] Sending POST to /api/v1/design-feedback");
        const response = await fetch("http://localhost:8000/api/v1/design-feedback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(designObjects),
        });

        console.log(`[analyzeDesign] Response status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[analyzeDesign] Request failed with status ${response.status}: ${errorText}`);
          throw new Error(`Request failed with status ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log("[analyzeDesign] Response data:", data);

        const description =
          (typeof data === "string" && data) ||
          data?.description ||
          data?.feedback ||
          data?.message ||
          data?.ai_description ||
          "Design analyzed successfully.";

        console.log(`[analyzeDesign] Extracted description: ${description.substring(0, 100)}...`);

        if (analyzeRequestIdRef.current === requestId) {
          setAiDescription(description);
        }
      } catch (err) {
        console.error("[analyzeDesign] Error:", err.message, err);
        if (analyzeRequestIdRef.current === requestId) {
          setAiDescription(`AI feedback unavailable: ${err.message}`);
        }
      } finally {
        if (analyzeRequestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    };

    sendRequest();
  }, []);

  const setObjectInteractivity = (canvas, selectable) => {
    canvas.getObjects().forEach((obj) => {
      obj.selectable = selectable;
      obj.evented = selectable;
    });
    canvas.selection = selectable;
    if (!selectable) {
      canvas.discardActiveObject();
    }
    canvas.requestRenderAll();
  };

  const saveState = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || isRestoringRef.current) {
      return;
    }

    historyRef.current.push(JSON.stringify(canvas.toJSON()));
    if (historyRef.current.length > 40) {
      historyRef.current.shift();
    }
  };

  const updateSelectedObjectState = (obj) => {
    if (!obj) {
      setSelectedObject(null);
      return;
    }

    setSelectedObject({
      id: obj.__uid || `${Date.now()}-${Math.random()}`,
      type: obj.type,
      width: Math.round(obj.getScaledWidth()),
      height: Math.round(obj.getScaledHeight()),
      angle: Math.round(obj.angle || 0),
      skewX: Math.round(obj.skewX || 0),
      skewY: Math.round(obj.skewY || 0),
    });
  };

  const applyToActiveObject = (transformer) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      return;
    }
    const obj = canvas.getActiveObject();
    if (!obj) {
      return;
    }

    transformer(obj);
    obj.setCoords();
    canvas.requestRenderAll();
    updateSelectedObjectState(obj);
    saveState();
  };

  useEffect(() => {
    const canvasElement = canvasRef.current;
    const container = canvasContainerRef.current;
    if (!canvasElement || !container) {
      return;
    }

    const canvas = new fabric.Canvas(canvasElement, {
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
    });

    fabricCanvasRef.current = canvas;

    const resizeCanvas = () => {
      const width = Math.max(1, Math.floor(container.clientWidth - 360 - 24));
      const height = Math.max(1, Math.floor(container.clientHeight - 24));
      canvas.setWidth(width);
      canvas.setHeight(height);
      canvas.requestRenderAll();
    };

    resizeCanvas();

    canvas.on("selection:created", (e) => updateSelectedObjectState(e.selected?.[0] || null));
    canvas.on("selection:updated", (e) => updateSelectedObjectState(e.selected?.[0] || null));
    canvas.on("selection:cleared", () => updateSelectedObjectState(null));
    canvas.on("object:modified", (e) => {
      updateSelectedObjectState(e.target || null);
      saveState();
    });
    canvas.on("path:created", () => {
      saveState();
    });

    saveState();

    window.addEventListener("resize", resizeCanvas);
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [analyzeDesign]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      return;
    }

    const drawingMode = selectedTool === "draw" || selectedTool === "erase";
    canvas.isDrawingMode = drawingMode;

    if (drawingMode) {
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.width = brushSize;
      canvas.freeDrawingBrush.color = selectedTool === "erase" ? "#ffffff" : selectedColor;
    }

    setObjectInteractivity(canvas, selectedTool === "select");

    const handleMouseDown = (event) => {
      if (["draw", "erase", "select"].includes(selectedTool)) {
        return;
      }

      const pointer = canvas.getPointer(event.e);
      startPosRef.current = { x: pointer.x, y: pointer.y };

      let obj = null;
      const common = {
        stroke: selectedColor,
        strokeWidth: brushSize,
        fill: "transparent",
        selectable: false,
        evented: false,
        originX: "left",
        originY: "top",
      };

      if (selectedTool === "line") {
        obj = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], common);
      } else if (selectedTool === "rect") {
        obj = new fabric.Rect({ left: pointer.x, top: pointer.y, width: 1, height: 1, ...common });
      } else if (selectedTool === "circle") {
        obj = new fabric.Circle({ left: pointer.x, top: pointer.y, radius: 1, ...common });
      } else if (selectedTool === "oval") {
        obj = new fabric.Ellipse({ left: pointer.x, top: pointer.y, rx: 1, ry: 1, ...common });
      } else if (selectedTool === "triangle") {
        obj = new fabric.Triangle({ left: pointer.x, top: pointer.y, width: 1, height: 1, ...common });
      } else if (selectedTool === "curve") {
        obj = new fabric.Path(`M ${pointer.x} ${pointer.y} L ${pointer.x} ${pointer.y}`, {
          ...common,
          fill: "",
          data: { type: "curve", controlPoint: null, startPoint: { x: pointer.x, y: pointer.y } },
        });
      }

      if (obj) {
        drawingObjectRef.current = obj;
        canvas.add(obj);
      }
    };

    const handleMouseMove = (event) => {
      const obj = drawingObjectRef.current;
      if (!obj) {
        return;
      }

      const pointer = canvas.getPointer(event.e);
      const start = startPosRef.current;

      if (selectedTool === "line") {
        obj.set({ x2: pointer.x, y2: pointer.y });
      } else if (selectedTool === "rect" || selectedTool === "triangle") {
        const width = Math.abs(pointer.x - start.x);
        const height = Math.abs(pointer.y - start.y);
        obj.set({
          left: Math.min(start.x, pointer.x),
          top: Math.min(start.y, pointer.y),
          width,
          height,
        });
      } else if (selectedTool === "circle") {
        const radius = Math.max(Math.abs(pointer.x - start.x), Math.abs(pointer.y - start.y)) / 2;
        obj.set({
          radius,
          left: Math.min(start.x, pointer.x),
          top: Math.min(start.y, pointer.y),
        });
      } else if (selectedTool === "oval") {
        obj.set({
          left: Math.min(start.x, pointer.x),
          top: Math.min(start.y, pointer.y),
          rx: Math.abs(pointer.x - start.x) / 2,
          ry: Math.abs(pointer.y - start.y) / 2,
        });
      } else if (selectedTool === "curve") {
        const dx = pointer.x - start.x;
        const dy = pointer.y - start.y;
        const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const midX = (start.x + pointer.x) / 2;
        const midY = (start.y + pointer.y) / 2;
        const offset = length * 0.25;
        const nx = -dy / length;
        const ny = dx / length;
        const cx = midX + nx * offset;
        const cy = midY + ny * offset;

        canvas.remove(obj);
        const path = new fabric.Path(`M ${start.x} ${start.y} Q ${cx} ${cy} ${pointer.x} ${pointer.y}`, {
          stroke: selectedColor,
          strokeWidth: brushSize,
          fill: "",
          selectable: false,
          evented: false,
        });
        drawingObjectRef.current = path;
        canvas.add(path);
      }

      canvas.requestRenderAll();
    };

    const handleMouseUp = () => {
      if (!drawingObjectRef.current) {
        return;
      }

      drawingObjectRef.current.setCoords();
      drawingObjectRef.current = null;
      saveState();
    };

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
    };
  }, [selectedTool, brushSize, selectedColor]);

  const handleModeChange = (newMode) => {
    setSelectedTool(newMode);
  };

  const undo = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || historyRef.current.length <= 1) {
      return;
    }

    historyRef.current.pop();
    const previous = historyRef.current[historyRef.current.length - 1];
    if (!previous) {
      return;
    }

    isRestoringRef.current = true;
    canvas.loadFromJSON(previous, () => {
      canvas.renderAll();
      isRestoringRef.current = false;
      setObjectInteractivity(canvas, selectedTool === "select");
      setSelectedObject(null);
    });
  };

  const clearCanvas = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.getObjects().forEach((obj) => canvas.remove(obj));
    canvas.backgroundColor = "#ffffff";
    canvas.renderAll();
    setSelectedObject(null);
    saveState();
  };

  const handleBack = () => {
    if (typeof onBack === "function") {
      onBack();
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/dashboard", { replace: true });
  };

  const handleSubmitDesign = () => {
    console.log("[handleSubmitDesign] Requesting fresh analysis...");
    analyzeDesign();
  };

  const canvasCursor =
    selectedTool === "erase"
      ? "cell"
      : ["line", "rect", "circle", "oval", "triangle", "curve"].includes(selectedTool)
        ? "crosshair"
        : selectedTool === "select"
          ? "default"
          : "crosshair";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        height: "100vh",
        width: "100vw",
        background: "#0f172a",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "Segoe UI, Tahoma, Verdana, sans-serif",
        zIndex: 999,
      }}
    >
      <style>
        {`
          @keyframes aiThinkingPulse {
            0% { box-shadow: 0 10px 22px rgba(15, 23, 42, 0.34); }
            50% { box-shadow: 0 12px 28px rgba(59, 130, 246, 0.28); }
            100% { box-shadow: 0 10px 22px rgba(15, 23, 42, 0.34); }
          }
        `}
      </style>

      <header
        style={{
          background: "linear-gradient(180deg, #1e293b 0%, #172033 100%)",
          borderBottom: "1px solid #334155",
          padding: "6px 10px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          style={{
            borderTop: "1px solid #334155",
            borderLeft: "1px solid #334155",
            borderRight: "1px solid #0b1220",
            borderBottom: "1px solid #0b1220",
            background: "#243247",
            color: "#e2e8f0",
            padding: "4px 10px",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          Back
        </button>

        <h1
          style={{
            margin: 0,
            fontSize: 18,
            lineHeight: 1.2,
            fontWeight: 600,
            color: "#f1f5f9",
            letterSpacing: 0.2,
          }}
        >
          Sketch Designer
        </h1>

        <button
          type="button"
          onClick={handleSubmitDesign}
          disabled={loading}
          style={{
            borderTop: "1px solid #334155",
            borderLeft: "1px solid #334155",
            borderRight: "1px solid #0b1220",
            borderBottom: "1px solid #0b1220",
            background: loading ? "#1e293b" : "#1e40af",
            color: "#e2e8f0",
            padding: "4px 14px",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              maxWidth: 360,
              color: loading ? "#93c5fd" : "#cbd5e1",
              fontSize: 11,
              lineHeight: 1.35,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={aiDescription || "Click Analyze to get AI feedback"}
          >
            {loading
              ? "Analyzing design..."
              : aiDescription || "Click Analyze to get AI feedback"}
          </div>

          {selectedObject && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1", fontSize: 11 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                W
                <input
                  type="number"
                  min="1"
                  value={selectedObject.width}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (!value) return;
                    applyToActiveObject((obj) => {
                      const base = obj.width || 1;
                      obj.set("scaleX", value / base);
                    });
                  }}
                  style={{ width: 56, background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155" }}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                H
                <input
                  type="number"
                  min="1"
                  value={selectedObject.height}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (!value) return;
                    applyToActiveObject((obj) => {
                      const base = obj.height || 1;
                      obj.set("scaleY", value / base);
                    });
                  }}
                  style={{ width: 56, background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155" }}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                A
                <input
                  type="number"
                  value={selectedObject.angle}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (Number.isNaN(value)) return;
                    applyToActiveObject((obj) => obj.set("angle", value));
                  }}
                  style={{ width: 52, background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155" }}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                SX
                <input
                  type="range"
                  min="-45"
                  max="45"
                  value={selectedObject.skewX}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    applyToActiveObject((obj) => obj.set("skewX", value));
                  }}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                SY
                <input
                  type="range"
                  min="-45"
                  max="45"
                  value={selectedObject.skewY}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    applyToActiveObject((obj) => obj.set("skewY", value));
                  }}
                />
              </label>
            </div>
          )}

          <button
            type="button"
            onClick={undo}
            disabled={historyRef.current.length <= 1}
            style={{
              borderTop: "1px solid #334155",
              borderLeft: "1px solid #334155",
              borderRight: "1px solid #0b1220",
              borderBottom: "1px solid #0b1220",
              background: "#243247",
              color: "#e2e8f0",
              padding: "4px 10px",
              borderRadius: 4,
              fontSize: 12,
              opacity: historyRef.current.length <= 1 ? 0.55 : 1,
              cursor: historyRef.current.length <= 1 ? "not-allowed" : "pointer",
            }}
          >
            Undo
          </button>

          <button
            type="button"
            onClick={clearCanvas}
            style={{
              borderTop: "1px solid #334155",
              borderLeft: "1px solid #334155",
              borderRight: "1px solid #0b1220",
              borderBottom: "1px solid #0b1220",
              background: "#243247",
              color: "#e2e8f0",
              padding: "4px 10px",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            Clear
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <aside
          style={{
            width: 58,
            minWidth: 58,
            background: "linear-gradient(180deg, #1e293b 0%, #172033 100%)",
            borderRight: "1px solid #334155",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            padding: "9px 6px",
          }}
        >
          {TOOL_ITEMS.map((tool) => (
            <ToolButton
              key={tool.key}
              item={tool}
              isActive={selectedTool === tool.key}
              onClick={handleModeChange}
            />
          ))}

          <div style={{ marginTop: 6, width: "100%", textAlign: "center", color: "#cbd5e1", fontSize: 10 }}>
            {brushSize}px
          </div>
          <input
            type="range"
            min="1"
            max="30"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            title="Brush Size"
            style={{ width: "100%", accentColor: "#1e3a8a" }}
          />
        </aside>

        <main
          ref={canvasContainerRef}
          style={{
            flex: 1,
            position: "relative",
            background: "#111827",
            display: "flex",
            gap: 8,
            padding: 8,
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 0,
              minHeight: 0,
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                background: "#ffffff",
                borderTop: "1px solid #334155",
                borderLeft: "1px solid #334155",
                borderRight: "1px solid #94a3b8",
                borderBottom: "1px solid #94a3b8",
                maxWidth: "100%",
                maxHeight: "100%",
                cursor: canvasCursor,
                display: "block",
                boxShadow: "0 10px 24px rgba(2, 6, 23, 0.45)",
              }}
            />
          </div>

          <div
            style={{
              width: 360,
              background: "linear-gradient(180deg, #1a2332 0%, #0f172a 100%)",
              border: "1px solid #334155",
              borderRadius: 8,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 10px 24px rgba(2, 6, 23, 0.45)",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #334155",
                background: "#1e293b",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#f1f5f9",
                }}
              >
                AI Analysis
              </h3>
            </div>

            <div
              style={{
                flex: 1,
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                padding: 12,
                minHeight: 0,
              }}
            >
              {loading ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    animation: "aiThinkingPulse 1.6s ease-in-out infinite",
                  }}
                >
                  <div
                    style={{
                      color: "#93c5fd",
                      fontSize: 13,
                      textAlign: "center",
                      lineHeight: 1.5,
                    }}
                  >
                    AI is analyzing your design...
                  </div>
                </div>
              ) : aiDescription ? (
                <div
                  style={{
                    background: "rgba(30, 41, 59, 0.6)",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    padding: 10,
                    color: "#e2e8f0",
                    fontSize: 12,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {aiDescription}
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "#64748b",
                    fontSize: 12,
                    textAlign: "center",
                    lineHeight: 1.5,
                  }}
                >
                  Click Analyze to see AI analysis here
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <footer
        style={{
          borderTop: "1px solid #334155",
          background: "linear-gradient(180deg, #1e293b 0%, #172033 100%)",
          padding: "6px 10px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        {COLORS.map((color) => (
          <ColorSwatch
            key={color}
            color={color}
            isActive={selectedColor === color}
            onClick={setSelectedColor}
          />
        ))}
      </footer>
    </div>
  );
}
