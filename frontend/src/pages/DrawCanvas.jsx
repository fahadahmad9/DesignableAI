import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import "../styles/drawCanvas.css";

const TOOLS = [
  { key: "select",   label: "Select"   },
  { key: "freehand", label: "Pencil"   },
  { key: "eraser",   label: "Eraser"   },
  { key: "line",     label: "Line"     },
  { key: "curve",    label: "Curve"    },
  { key: "rect",     label: "Rect"     },
  { key: "square",   label: "Square"   },
  { key: "circle",   label: "Circle"   },
  { key: "triangle", label: "Triangle" },
];

const HANDLE_SIZE = 8;
const ROTATE_HANDLE_OFFSET = 24;
const BG_COLOR = "#141210";
const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";
const ANALYZE_DRAWING = `${API}/analyze-drawing`;
const UPLOAD_CANVAS = `${API}/upload-canvas-sketch`;

// ── geometry helpers ──────────────────────────────────────────────────────────

function getBoundingBox(obj) {
  if (obj.type === "freehand" || obj.type === "eraser") {
    const xs = obj.points.map((p) => p.x);
    const ys = obj.points.map((p) => p.y);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    };
  }
  return { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
}

function transformPoint(p, cx, cy, angle) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const dx = p.x - cx, dy = p.y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

function inverseTransformPoint(p, cx, cy, angle) {
  return transformPoint(p, cx, cy, -angle);
}

// ── drawing ───────────────────────────────────────────────────────────────────

function drawObject(ctx, obj) {
  const { x, y, w, h } = getBoundingBox(obj);
  const cx = x + w / 2, cy = y + h / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(obj.rotation || 0);
  ctx.translate(-cx, -cy);
  ctx.strokeStyle = obj.color;
  ctx.lineWidth   = obj.size;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";

  if (obj.type === "freehand" || obj.type === "eraser") {
    if (obj.points.length < 2) {
      const p = obj.points[0];
      if (p) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.5, obj.size / 2), 0, Math.PI * 2);
        ctx.fillStyle = obj.color;
        ctx.fill();
      }
      ctx.restore();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(obj.points[0].x, obj.points[0].y);
    for (let i = 1; i < obj.points.length; i++) ctx.lineTo(obj.points[i].x, obj.points[i].y);
    ctx.stroke();
  } else if (obj.type === "line") {
    ctx.beginPath();
    ctx.moveTo(obj.x1, obj.y1);
    ctx.lineTo(obj.x2, obj.y2);
    ctx.stroke();
  } else if (obj.type === "curve") {
    ctx.beginPath();
    ctx.moveTo(obj.x1, obj.y1);
    ctx.quadraticCurveTo(obj.cx, obj.cy, obj.x2, obj.y2);
    ctx.stroke();
  } else if (obj.type === "rect" || obj.type === "square") {
    ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
  } else if (obj.type === "circle") {
    ctx.beginPath();
    ctx.arc(obj.cx, obj.cy, obj.r, 0, Math.PI * 2);
    ctx.stroke();
  } else if (obj.type === "triangle") {
    ctx.beginPath();
    ctx.moveTo(obj.x + obj.w / 2, obj.y);
    ctx.lineTo(obj.x + obj.w,     obj.y + obj.h);
    ctx.lineTo(obj.x,             obj.y + obj.h);
    ctx.closePath();
    ctx.stroke();
  }

  ctx.restore();
}

function drawSelectionHandles(ctx, obj) {
  const { x, y, w, h } = getBoundingBox(obj);
  const cx = x + w / 2, cy = y + h / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(obj.rotation || 0);
  ctx.translate(-cx, -cy);

  ctx.strokeStyle = "#4a9eff";
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(x - 6, y - 6, w + 12, h + 12);
  ctx.setLineDash([]);

  const hx = x - 6, hy = y - 6, hw = w + 12, hh = h + 12;
  const pts = [
    [hx,       hy],       [hx+hw/2, hy],       [hx+hw, hy],
    [hx+hw,    hy+hh/2],  [hx+hw,   hy+hh],
    [hx+hw/2,  hy+hh],    [hx,      hy+hh],    [hx, hy+hh/2],
  ];
  pts.forEach(([px, py]) => {
    ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#4a9eff"; ctx.lineWidth = 1.5;
    ctx.fillRect(px - HANDLE_SIZE/2, py - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
    ctx.strokeRect(px - HANDLE_SIZE/2, py - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
  });

  const rx = hx + hw / 2, ry = hy - ROTATE_HANDLE_OFFSET;
  ctx.strokeStyle = "#4a9eff"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(rx, hy); ctx.lineTo(rx, ry); ctx.stroke();
  ctx.beginPath(); ctx.arc(rx, ry, HANDLE_SIZE / 2 + 1, 0, Math.PI * 2);
  ctx.fillStyle = "#4a9eff"; ctx.fill();

  ctx.restore();
}

// ── hit testing ───────────────────────────────────────────────────────────────

function getHandleAt(obj, pt) {
  const { x, y, w, h } = getBoundingBox(obj);
  const cx = x + w / 2, cy = y + h / 2;
  const local = inverseTransformPoint(pt, cx, cy, obj.rotation || 0);
  const hx = x-6, hy = y-6, hw = w+12, hh = h+12;
  const handles = [
    { id: "tl",     lx: hx,        ly: hy                    },
    { id: "tm",     lx: hx+hw/2,   ly: hy                    },
    { id: "tr",     lx: hx+hw,     ly: hy                    },
    { id: "mr",     lx: hx+hw,     ly: hy+hh/2               },
    { id: "br",     lx: hx+hw,     ly: hy+hh                 },
    { id: "bm",     lx: hx+hw/2,   ly: hy+hh                 },
    { id: "bl",     lx: hx,        ly: hy+hh                 },
    { id: "ml",     lx: hx,        ly: hy+hh/2               },
    { id: "rotate", lx: hx+hw/2,   ly: hy-ROTATE_HANDLE_OFFSET },
  ];
  const hitR = HANDLE_SIZE + 4;
  for (const h of handles) {
    if (Math.abs(local.x - h.lx) <= hitR && Math.abs(local.y - h.ly) <= hitR) return h.id;
  }
  return null;
}

function hitTestObject(obj, pt) {
  const { x, y, w, h } = getBoundingBox(obj);
  const cx = x + w / 2, cy = y + h / 2;
  const local = inverseTransformPoint(pt, cx, cy, obj.rotation || 0);
  const pad = Math.max(8, obj.size / 2 + 4);
  return local.x >= x-pad && local.x <= x+w+pad && local.y >= y-pad && local.y <= y+h+pad;
}

const HANDLE_CURSORS = {
  tl: "nw-resize", tm: "n-resize",  tr: "ne-resize",
  mr: "e-resize",  br: "se-resize", bm: "s-resize",
  bl: "sw-resize", ml: "w-resize",  rotate: "crosshair",
};

// ── object transform helpers ──────────────────────────────────────────────────

function applyResizeToObject(obj, handleId, startBB, dx, dy) {
  let { x, y, w, h } = startBB;
  if (handleId.includes("l")) { x += dx; w -= dx; }
  if (handleId.includes("r")) { w += dx; }
  if (handleId.includes("t")) { y += dy; h -= dy; }
  if (handleId.includes("b")) { h += dy; }
  if (w < 4) { if (handleId.includes("l")) x -= 4 - w; w = 4; }
  if (h < 4) { if (handleId.includes("t")) y -= 4 - h; h = 4; }

  const updated = { ...obj };
  if (obj.type === "freehand" || obj.type === "eraser") {
    const ob = getBoundingBox(obj);
    const sx = ob.w > 0 ? w / ob.w : 1, sy = ob.h > 0 ? h / ob.h : 1;
    updated.points = obj.points.map((p) => ({ x: x+(p.x-ob.x)*sx, y: y+(p.y-ob.y)*sy }));
  } else if (obj.type === "line" || obj.type === "curve") {
    const ob = getBoundingBox(obj);
    const sx = ob.w > 0 ? w / ob.w : 1, sy = ob.h > 0 ? h / ob.h : 1;
    updated.x1 = x+(obj.x1-ob.x)*sx; updated.y1 = y+(obj.y1-ob.y)*sy;
    updated.x2 = x+(obj.x2-ob.x)*sx; updated.y2 = y+(obj.y2-ob.y)*sy;
    if (obj.type === "curve") { updated.cx = x+(obj.cx-ob.x)*sx; updated.cy = y+(obj.cy-ob.y)*sy; }
  } else if (obj.type === "circle") {
    updated.cx = x+w/2; updated.cy = y+h/2; updated.r = Math.min(w,h)/2;
    updated.x = x; updated.y = y; updated.w = w; updated.h = h;
  } else {
    updated.x = x; updated.y = y; updated.w = w; updated.h = h;
  }
  return updated;
}

function translateObject(obj, dx, dy) {
  const u = { ...obj };
  if (obj.type === "freehand" || obj.type === "eraser") {
    u.points = obj.points.map((p) => ({ x: p.x+dx, y: p.y+dy }));
  } else if (obj.type === "line" || obj.type === "curve") {
    u.x1 = obj.x1+dx; u.y1 = obj.y1+dy; u.x2 = obj.x2+dx; u.y2 = obj.y2+dy;
    if (obj.type === "curve") { u.cx = obj.cx+dx; u.cy = obj.cy+dy; }
  } else if (obj.type === "circle") {
    u.cx = obj.cx+dx; u.cy = obj.cy+dy; u.x = obj.x+dx; u.y = obj.y+dy;
  } else {
    u.x = obj.x+dx; u.y = obj.y+dy;
  }
  return u;
}

function estimatePathLength(points) {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

function getObjectCenter(obj) {
  const { x, y, w, h } = getBoundingBox(obj);
  return { x: x + w / 2, y: y + h / 2 };
}

function inferCanvasRole(index, total, furnitureType) {
  if (furnitureType === "table") {
    if (index === 0) return "table_top";
    if (index === 1) return "apron";
    if (index === 2) return "leg";
    if (index === 3) return "stretcher";
    return "support";
  }

  if (total <= 1) return "seat";
  if (total === 2) return index === 0 ? "backrest" : "seat";
  if (total === 3) return ["headrest", "backrest", "seat"][index];
  if (index === 0) return "headrest";
  if (index === 1) return "backrest";
  if (index === 2) return "seat";
  if (index === total - 1) return "base";
  return "armrest";
}

function serializeObject(obj, index, total, furnitureType) {
  const bbox = getBoundingBox(obj);
  const center = getObjectCenter(obj);
  const inferredPart = inferCanvasRole(index, total, furnitureType);
  const rotationDegrees = ((obj.rotation || 0) * 180) / Math.PI;
  const payload = {
    order: index + 1,
    id: obj.id,
    type: obj.type,
    inferred_part: inferredPart,
    bbox: {
      x: Number(bbox.x.toFixed(2)),
      y: Number(bbox.y.toFixed(2)),
      width: Number(bbox.w.toFixed(2)),
      height: Number(bbox.h.toFixed(2)),
      area: Number((bbox.w * bbox.h).toFixed(2)),
      center_x: Number(center.x.toFixed(2)),
      center_y: Number(center.y.toFixed(2)),
    },
    stroke_size: obj.size,
    rotation_degrees: Number(rotationDegrees.toFixed(2)),
    color: obj.color,
  };

  if (obj.type === "line" || obj.type === "curve") {
    payload.points = {
      start: { x: Number(obj.x1.toFixed(2)), y: Number(obj.y1.toFixed(2)) },
      end: { x: Number(obj.x2.toFixed(2)), y: Number(obj.y2.toFixed(2)) },
      length: Number(Math.hypot(obj.x2 - obj.x1, obj.y2 - obj.y1).toFixed(2)),
    };
    if (obj.type === "curve") {
      payload.points.control = {
        x: Number(obj.cx.toFixed(2)),
        y: Number(obj.cy.toFixed(2)),
      };
    }
  }

  if (obj.type === "rect" || obj.type === "square" || obj.type === "triangle") {
    payload.dimensions = {
      width: Number(bbox.w.toFixed(2)),
      height: Number(bbox.h.toFixed(2)),
      diagonal: Number(Math.hypot(bbox.w, bbox.h).toFixed(2)),
    };
  }

  if (obj.type === "circle") {
    payload.dimensions = {
      radius: Number(obj.r.toFixed(2)),
      diameter: Number((obj.r * 2).toFixed(2)),
    };
  }

  if (obj.type === "freehand" || obj.type === "eraser") {
    payload.path = {
      point_count: obj.points.length,
      length: Number(estimatePathLength(obj.points).toFixed(2)),
      points: obj.points,
    };
  }

  return payload;
}

function buildDrawingPayload(objects, canvasWidth, canvasHeight, furnitureType) {
  const ordered = [...objects].sort((a, b) => {
    const aCenter = getObjectCenter(a);
    const bCenter = getObjectCenter(b);
    return aCenter.y - bCenter.y || aCenter.x - bCenter.x;
  });

  const serializedObjects = ordered.map((obj, index) => serializeObject(obj, index, ordered.length, furnitureType));

  return {
    session_id: `drawing_${crypto.randomUUID()}`,
    furniture_type: furnitureType,
    canvas: {
      width: canvasWidth,
      height: canvasHeight,
      object_count: ordered.length,
    },
    objects: serializedObjects,
  };
}

// ── component ─────────────────────────────────────────────────────────────────

export default function DrawCanvas() {
  const navigate     = useNavigate();
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);

  const [brushSize,  setBrushSize]  = useState(4);
  const [brushColor, setBrushColor] = useState("#f5f1eb");
  const [tool,       setTool]       = useState("freehand");
  const [objects,    setObjects]    = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [furnitureType, setFurnitureType] = useState("chair");
  const [analysisReply, setAnalysisReply] = useState("Draw a chair or table, then click Analyze.");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  const interactionRef = useRef({
    mode: null, startPt: null, lastPt: null,
    activeHandle: null, startBB: null,
    startAngle: null, startObjAngle: null, currentObj: null,
  });

  const objectsRef    = useRef(objects);
  const selectedIdRef = useRef(selectedId);
  const toolRef       = useRef(tool);
  const brushColorRef = useRef(brushColor);
  const brushSizeRef  = useRef(brushSize);

  useEffect(() => { objectsRef.current    = objects;    }, [objects]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { toolRef.current       = tool;       }, [tool]);
  useEffect(() => { brushColorRef.current = brushColor; }, [brushColor]);
  useEffect(() => { brushSizeRef.current  = brushSize;  }, [brushSize]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const obj of objectsRef.current) drawObject(ctx, obj);
    const ia = interactionRef.current;
    if (ia.currentObj) drawObject(ctx, ia.currentObj);
    const sel = objectsRef.current.find((o) => o.id === selectedIdRef.current);
    if (sel) drawSelectionHandles(ctx, sel);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container) return;
    const resize = () => {
      canvas.width  = Math.max(1, container.clientWidth);
      canvas.height = Math.max(1, container.clientHeight);
      render();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [render]);

  useEffect(() => { render(); }, [objects, selectedId, render]);

  const getPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const buildPrimitiveObj = (type, start, end, color, size) => {
    const dx = end.x - start.x, dy = end.y - start.y;
    const id = crypto.randomUUID();
    if (type === "line") {
      return { id, type:"line", x1:start.x, y1:start.y, x2:end.x, y2:end.y,
        x:Math.min(start.x,end.x), y:Math.min(start.y,end.y),
        w:Math.abs(dx), h:Math.abs(dy), color, size, rotation:0 };
    }
    if (type === "curve") {
      const mx=(start.x+end.x)/2, my=(start.y+end.y)/2;
      const len=Math.max(1,Math.hypot(dx,dy));
      const nx=-dy/len, ny=dx/len;
      const cxp=mx+nx*len*0.25, cyp=my+ny*len*0.25;
      return { id, type:"curve", x1:start.x, y1:start.y, x2:end.x, y2:end.y, cx:cxp, cy:cyp,
        x:Math.min(start.x,end.x,cxp), y:Math.min(start.y,end.y,cyp),
        w:Math.max(start.x,end.x,cxp)-Math.min(start.x,end.x,cxp),
        h:Math.max(start.y,end.y,cyp)-Math.min(start.y,end.y,cyp),
        color, size, rotation:0 };
    }
    if (type === "rect") {
      return { id, type:"rect", x:Math.min(start.x,end.x), y:Math.min(start.y,end.y),
        w:Math.abs(dx), h:Math.abs(dy), color, size, rotation:0 };
    }
    if (type === "square") {
      const side=Math.max(Math.abs(dx),Math.abs(dy));
      return { id, type:"square",
        x:start.x+(dx<0?-side:0), y:start.y+(dy<0?-side:0),
        w:side, h:side, color, size, rotation:0 };
    }
    if (type === "circle") {
      const r=Math.hypot(dx,dy);
      return { id, type:"circle", cx:start.x, cy:start.y, r,
        x:start.x-r, y:start.y-r, w:r*2, h:r*2, color, size, rotation:0 };
    }
    if (type === "triangle") {
      return { id, type:"triangle",
        x:Math.min(start.x,end.x), y:Math.min(start.y,end.y),
        w:Math.abs(dx), h:Math.abs(dy), color, size, rotation:0 };
    }
  };

  const onMouseDown = (e) => {
    const pt = getPoint(e);
    const ia = interactionRef.current;
    const currentTool = toolRef.current;

    if (currentTool === "select") {
      const selId = selectedIdRef.current;
      const objs  = objectsRef.current;
      if (selId) {
        const selObj = objs.find((o) => o.id === selId);
        if (selObj) {
          const handle = getHandleAt(selObj, pt);
          if (handle === "rotate") {
            const bb = getBoundingBox(selObj);
            ia.mode = "rotate";
            ia.startAngle    = Math.atan2(pt.y-(bb.y+bb.h/2), pt.x-(bb.x+bb.w/2));
            ia.startObjAngle = selObj.rotation || 0;
            return;
          }
          if (handle) {
            ia.mode = "resize";
            ia.activeHandle = handle;
            ia.startBB = getBoundingBox(selObj);
            const { x, y, w, h } = ia.startBB;
            ia.startPt = inverseTransformPoint(pt, x+w/2, y+h/2, selObj.rotation || 0);
            return;
          }
        }
      }
      let hit = null;
      for (let i = objs.length - 1; i >= 0; i--) {
        if (hitTestObject(objs[i], pt)) { hit = objs[i]; break; }
      }
      if (hit) { setSelectedId(hit.id); ia.mode = "move"; ia.lastPt = pt; }
      else      { setSelectedId(null);  ia.mode = null; }
      return;
    }

    if (currentTool === "freehand" || currentTool === "eraser") {
      ia.mode = "draw-freehand";
      ia.currentObj = {
        id: crypto.randomUUID(),
        type:     currentTool === "eraser" ? "eraser" : "freehand",
        points:   [pt],
        color:    currentTool === "eraser" ? BG_COLOR : brushColorRef.current,
        size:     currentTool === "eraser" ? brushSizeRef.current * 4 : brushSizeRef.current,
        rotation: 0,
      };
    } else {
      ia.mode = "draw-primitive";
      ia.startPt    = pt;
      ia.currentObj = buildPrimitiveObj(currentTool, pt, pt, brushColorRef.current, brushSizeRef.current);
    }
    render();
  };

  const onMouseMove = (e) => {
    const pt = getPoint(e);
    const ia = interactionRef.current;

    if (!ia.mode) {
      const canvas = canvasRef.current;
      if (!canvas || toolRef.current !== "select") return;
      const selObj = objectsRef.current.find((o) => o.id === selectedIdRef.current);
      if (selObj) {
        const handle = getHandleAt(selObj, pt);
        if (handle) { canvas.style.cursor = HANDLE_CURSORS[handle] || "default"; return; }
        if (hitTestObject(selObj, pt)) { canvas.style.cursor = "move"; return; }
      }
      canvas.style.cursor = objectsRef.current.slice().reverse().some((o) => hitTestObject(o, pt))
        ? "pointer" : "default";
      return;
    }

    if (ia.mode === "draw-freehand") {
      ia.currentObj.points.push(pt); render(); return;
    }
    if (ia.mode === "draw-primitive") {
      ia.currentObj = buildPrimitiveObj(toolRef.current, ia.startPt, pt, brushColorRef.current, brushSizeRef.current);
      if (ia.currentObj) ia.currentObj.id = crypto.randomUUID();
      render(); return;
    }
    if (ia.mode === "move") {
      const dx = pt.x - ia.lastPt.x, dy = pt.y - ia.lastPt.y;
      ia.lastPt = pt;
      setObjects((prev) => prev.map((o) => o.id === selectedIdRef.current ? translateObject(o, dx, dy) : o));
      return;
    }
    if (ia.mode === "resize") {
      const selObj = objectsRef.current.find((o) => o.id === selectedIdRef.current);
      if (!selObj) return;
      const { x, y, w, h } = ia.startBB;
      const localNow = inverseTransformPoint(pt, x+w/2, y+h/2, selObj.rotation || 0);
      const updated  = applyResizeToObject(selObj, ia.activeHandle, ia.startBB,
        localNow.x - ia.startPt.x, localNow.y - ia.startPt.y);
      setObjects((prev) => prev.map((o) => o.id === selObj.id ? updated : o));
      return;
    }
    if (ia.mode === "rotate") {
      const selObj = objectsRef.current.find((o) => o.id === selectedIdRef.current);
      if (!selObj) return;
      const bb = getBoundingBox(selObj);
      const cx = bb.x + bb.w/2, cy = bb.y + bb.h/2;
      const newRotation = ia.startObjAngle + (Math.atan2(pt.y-cy, pt.x-cx) - ia.startAngle);
      setObjects((prev) => prev.map((o) => o.id === selObj.id ? { ...o, rotation: newRotation } : o));
    }
  };

  // ── FIX: removed manual render() calls after setObjects so the useEffect
  //         on [objects] drives the repaint — by then objectsRef.current is
  //         up-to-date and the stroke is no longer cleared before it appears.
  const onMouseUp = (e) => {
    const pt = getPoint(e);
    const ia = interactionRef.current;

    if (ia.mode === "draw-freehand" && ia.currentObj) {
      const lastPoint = ia.currentObj.points[ia.currentObj.points.length - 1];
      if (!lastPoint || lastPoint.x !== pt.x || lastPoint.y !== pt.y) {
        ia.currentObj.points.push(pt);
      }
      const completedStroke = { ...ia.currentObj, points: [...ia.currentObj.points] };
      const nextObjects = [...objectsRef.current, completedStroke];
      objectsRef.current = nextObjects;
      setObjects(nextObjects);
      render();
      ia.currentObj = null;
      ia.mode = null;
      return;
    }

    if (ia.mode === "draw-primitive") {
      const obj = buildPrimitiveObj(toolRef.current, ia.startPt, pt, brushColorRef.current, brushSizeRef.current);
      if (obj) {
        const bb = getBoundingBox(obj);
        if (bb.w > 2 || bb.h > 2) setObjects((prev) => [...prev, obj]);
      }
      ia.currentObj = null;
      ia.mode = null;
      return;
    }

    ia.mode = null; ia.currentObj = null; ia.activeHandle = null; ia.startBB = null;
  };

  const clearCanvas = () => {
    setObjects([]); setSelectedId(null);
    interactionRef.current = {
      mode:null, startPt:null, lastPt:null,
      activeHandle:null, startBB:null,
      startAngle:null, startObjAngle:null, currentObj:null,
    };
  };

  const deleteSelected = useCallback(() => {
    if (selectedIdRef.current) {
      setObjects((prev) => prev.filter((o) => o.id !== selectedIdRef.current));
      setSelectedId(null);
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!objectsRef.current.length) {
      setAnalysisError("Draw at least one shape before analyzing.");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      setAnalysisError("Canvas is not ready yet.");
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError("");

    try {
      const payload = buildDrawingPayload(objectsRef.current, canvas.width, canvas.height, furnitureType);
      const response = await fetch(ANALYZE_DRAWING, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Drawing analysis failed.");
      }

      setAnalysisReply(data.assistant_reply || "No analysis was returned.");
    } catch (error) {
      setAnalysisError(error.message || "Unable to analyze the drawing.");
    } finally {
      setAnalysisLoading(false);
    }
  }, [furnitureType]);

  const handleUploadCanvas = useCallback(async () => {
    if (!objectsRef.current.length) {
      setAnalysisError("Draw at least one shape before uploading.");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      setAnalysisError("Canvas is not ready yet.");
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError("");

    try {
      // Capture canvas as PNG blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setAnalysisError("Failed to capture canvas.");
          setAnalysisLoading(false);
          return;
        }

        // Create FormData and append the image
        const formData = new FormData();
        formData.append("file", blob, "sketch.png");
        formData.append("furniture_type", furnitureType);

        const response = await fetch(UPLOAD_CANVAS, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || "Canvas upload and analysis failed.");
        }

        // Display the analysis reply
        setAnalysisReply(data.assistant_reply || "No analysis was returned.");
      });
    } catch (error) {
      setAnalysisError(error.message || "Unable to upload and analyze the drawing.");
    } finally {
      setAnalysisLoading(false);
    }
  }, [furnitureType]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelected]);

  return (
    <div className="dc-root">
      <header className="dc-header">
        <div style={{ display:"flex", alignItems:"center", gap:"12px", flexShrink:0 }}>
          <button className="dc-back" type="button" onClick={() => navigate("/")}>
            Back
          </button>
          <div className="dc-title-wrap">
            <span className="dc-logo">Designable<span className="dc-dot">.</span></span>
            <span className="dc-title">Drawing Canvas</span>
          </div>
        </div>

        <div style={{
          flex: "1 1 0",
          display: "flex",
          justifyContent: "center",
          overflow: "hidden",
          padding: "0 8px",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            flexWrap: "nowrap",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}>
            {TOOLS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`dc-tool-btn ${tool === item.key ? "active" : ""}`}
                style={{ whiteSpace: "nowrap", padding: "4px 9px", fontSize: "11px", flexShrink: 0 }}
                onClick={() => {
                  setTool(item.key);
                  if (item.key !== "select") setSelectedId(null);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:"8px", flexShrink:0 }}>
          <label className="dc-control">
            Type
            <select
              className="dc-select"
              value={furnitureType}
              onChange={(e) => setFurnitureType(e.target.value)}
            >
              <option value="chair">Chair</option>
              <option value="table">Table</option>
            </select>
          </label>

          <label className="dc-control">
            Size
            <input
              type="range" min="1" max="24" value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
            />
          </label>

          <label className="dc-control">
            Color
            <input
              type="color" value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
            />
          </label>

          {selectedId && (
            <button className="dc-clear" type="button" onClick={deleteSelected}>
              Delete
            </button>
          )}

          <button className="dc-analyze" type="button" onClick={handleAnalyze} disabled={analysisLoading}>
            {analysisLoading ? "Analyzing..." : "Analyze"}
          </button>

          <button className="dc-analyze" type="button" onClick={handleUploadCanvas} disabled={analysisLoading} style={{ backgroundColor: "#48a868" }}>
            {analysisLoading ? "Uploading..." : "Upload"}
          </button>

          <button className="dc-clear" type="button" onClick={clearCanvas}>
            Clear
          </button>
        </div>
      </header>

      <div className="dc-body">
        <aside className="dc-panel">
          <div className="dc-panel-header">
            <span className="dc-panel-eyebrow">Gemini output</span>
            <h2>Sketch readout</h2>
          </div>

          {analysisError && <div className="dc-panel-error">{analysisError}</div>}

          <div className="dc-panel-content">
            <ReactMarkdown>{analysisReply}</ReactMarkdown>
          </div>
        </aside>

        <main className="dc-stage" ref={containerRef}>
          <canvas
            ref={canvasRef}
            className="dc-canvas"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          />
        </main>
      </div>
    </div>
  );
}