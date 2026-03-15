import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

// ─── Segment colour palette ───────────────────────────────────────────────────
const SEGMENT_COLORS = {
  seat:        "#c8a165",
  back:        "#8b5e3c",
  backrest:    "#8b5e3c",
  leg:         "#6b7fa3",
  legs:        "#6b7fa3",
  armrest:     "#a07850",
  armrests:    "#a07850",
  cushion:     "#d4909a",
  frame:       "#5a6475",
  base:        "#4a5060",
  eames_base:  "#4caf82",
  eames_lounge:"#e09a2e",
  wheel:       "#3a3a4a",
  wheels:      "#3a3a4a",
  headrest:    "#b08860",
};

const FALLBACK_PALETTE = [
  "#e05c5c", "#e09a2e", "#4caf82", "#5b8dd9",
  "#9c6dd4", "#d45d8b", "#3ab8c4", "#c49a3a", "#7ab040", "#c4603a",
];

function getSegmentColor(label = "", index = 0) {
  const key = label.toLowerCase().trim();
  return SEGMENT_COLORS[key] ?? FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

/** CSS hex → THREE.Color */
function toThreeColor(hex) {
  return new THREE.Color(hex);
}

/**
 * Extract label + normalised bbox from the backend segment shape:
 *   { part_name, normalized_bbox_xywh: [cx, cy, w, h], mask_base64, ... }
 */
function parseSegment(seg) {
  const label = (seg.part_name ?? seg.label ?? seg.class_name ?? seg.class ?? "part").toString();
  let x1 = 0, y1 = 0, x2 = 1, y2 = 1;

  if (Array.isArray(seg.normalized_bbox_xywh) && seg.normalized_bbox_xywh.length >= 4) {
    const [cx, cy, bw, bh] = seg.normalized_bbox_xywh;
    x1 = Math.max(0, cx - bw / 2);
    y1 = Math.max(0, cy - bh / 2);
    x2 = Math.min(1, cx + bw / 2);
    y2 = Math.min(1, cy + bh / 2);
  } else if (Array.isArray(seg.bbox) && seg.bbox.length >= 4) {
    const [a, b, c, d] = seg.bbox;
    const isPixels = [a, b, c, d].some(v => Math.abs(v) > 1.5);
    if (a < c && b < d) {
      x1 = a; y1 = b; x2 = c; y2 = d;
    } else {
      x1 = a - c / 2; y1 = b - d / 2; x2 = a + c / 2; y2 = b + d / 2;
    }
    if (isPixels) { /* already handled by caller if needed */ }
  }

  return { label, x1, y1, x2, y2, bw: x2 - x1, bh: y2 - y1 };
}

// ─── sessionStorage key ───────────────────────────────────────────────────────
const SESSION_KEY = "visualizeChair_state";

// ─── Legend item ──────────────────────────────────────────────────────────────
function LegendDot({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 11, height: 11, borderRadius: "50%",
        background: color, flexShrink: 0,
        border: "1px solid rgba(255,255,255,0.20)",
        boxShadow: `0 0 5px ${color}99`,
      }} />
      <span style={{ fontSize: 12, color: "#ddd5c8", textTransform: "capitalize" }}>
        {label.replace(/_/g, " ")}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function VisualizeChair() {
  const location = useLocation();
  const navigate = useNavigate();

  // ── Resolve state from router or sessionStorage ───────────────────────────
  const resolvedState = (() => {
    if (location.state?.imageUrl) return location.state;
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  })();
  const { imageUrl, segments } = resolvedState;

  useEffect(() => {
    if (location.state?.imageUrl) {
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          imageUrl: location.state.imageUrl,
          segments: location.state.segments ?? [],
        }));
      } catch { /* quota exceeded */ }
    }
  }, [location.state]);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const mountRef      = useRef(null);   // Three.js canvas mount point
  const labelCanvasRef= useRef(null);   // 2D canvas for label pills only
  const sceneRef      = useRef(null);
  const cameraRef     = useRef(null);
  const rendererRef   = useRef(null);
  const rafRef        = useRef(null);
  const mountedRef    = useRef(false);
  const segMeshesRef  = useRef({});     // segmentMeshes[label] = mesh
  const baseMeshRef   = useRef(null);
  const planeSizeRef  = useRef({ w: 4, h: 4 }); // world-space plane size

  // ── State ─────────────────────────────────────────────────────────────────
  const [sceneReady,    setSceneReady]    = useState(false);
  const [loadError,     setLoadError]     = useState(false);
  const [showOverlay,   setShowOverlay]   = useState(true);
  const [segmentLegend, setSegmentLegend] = useState([]);

  // ── Effect 1: Three.js scene bootstrap (runs once) ────────────────────────
  useEffect(() => {
    if (mountedRef.current || !mountRef.current) return;
    mountedRef.current = true;

    // Scene — white background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      50, window.innerWidth / window.innerHeight, 0.1, 1000
    );
    camera.position.z = 7; // far enough to see full 4.2-unit-tall plane with 50° FOV
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights — strong ambient so white segment meshes render at full brightness
    // Base plane uses MeshBasicMaterial so lighting doesn't affect the sketch.
    const ambient = new THREE.AmbientLight(0xffffff, 2.0);
    scene.add(ambient);

    // Soft directional for subtle depth on segment meshes
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(4, 8, 6);
    dir.castShadow = false;
    scene.add(dir);

    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-4, 4, 3);
    scene.add(fill);

    // Resize handler
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    // Render loop
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      mountedRef.current = false;
    };
  }, []);

  // ── Effect 2: load base image plane ──────────────────────────────────────
  useEffect(() => {
    if (!imageUrl || !sceneRef.current) return;
    const scene = sceneRef.current;

    // Remove any existing base/segment meshes
    const toRemove = [];
    scene.traverse(obj => { if (obj.isMesh) toRemove.push(obj); });
    toRemove.forEach(obj => {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
      scene.remove(obj);
    });
    segMeshesRef.current = {};
    baseMeshRef.current = null;

    const loader = new THREE.TextureLoader();
    loader.load(
      imageUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;

        const imgW   = texture.image.width;
        const imgH   = texture.image.height;
        const aspect = imgW / imgH;

        // ── Base plane sized to fill most of the viewport ─────────────────
        const planeH = 4.2;
        const planeW = planeH * aspect;
        planeSizeRef.current = { w: planeW, h: planeH };

        const geo = new THREE.PlaneGeometry(planeW, planeH);

        // ── MeshBasicMaterial — renders sketch cleanly, unaffected by lighting ─
        const mat = new THREE.MeshBasicMaterial({
          map:         texture,
          transparent: true,
          opacity:     1.0,
          side:        THREE.FrontSide,
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.name  = "chairBase";
        mesh.position.set(0, 0, 0); // centered in scene
        scene.add(mesh);
        baseMeshRef.current = mesh;

        console.log(`[VisualizeChair] ✅ Base plane added — ${planeW.toFixed(2)} × ${planeH.toFixed(2)} world units`);
        setSceneReady(true);
      },
      undefined,
      (err) => {
        console.error("[VisualizeChair] ❌ Base texture failed:", err);
        setLoadError(true);
      }
    );
  }, [imageUrl]);

  // ── Effect 3: build segment meshes once base plane is ready ──────────────
  useEffect(() => {
    if (!sceneReady || !sceneRef.current) return;
    if (!Array.isArray(segments) || segments.length === 0) return;

    const scene  = sceneRef.current;
    const { w: planeW, h: planeH } = planeSizeRef.current;
    const loader = new THREE.TextureLoader();
    const legend = [];

    // Remove any previous segment meshes (but keep chairBase)
    const toRemove = [];
    scene.traverse(obj => {
      if (obj.isMesh && obj.name?.startsWith("seg_")) toRemove.push(obj);
    });
    toRemove.forEach(obj => {
      obj.geometry.dispose();
      obj.material.dispose();
      scene.remove(obj);
    });
    segMeshesRef.current = {};

    segments.forEach((seg, idx) => {
      const { label } = parseSegment(seg);
      const color     = getSegmentColor(label, idx);

      if (!seg.mask_base64) {
        console.warn(`[VisualizeChair] "${label}" has no mask_base64 — skipping mesh`);
        return;
      }

      loader.load(
        seg.mask_base64,
        (maskTexture) => {
          // alphaMap must be in linear space (no gamma correction on masks)
          maskTexture.colorSpace = THREE.LinearSRGBColorSpace;

          // ── PlaneGeometry — same dimensions as base image plane ───────────
          const geo = new THREE.PlaneGeometry(planeW, planeH);

          // ── MeshStandardMaterial:
          //    color: segment tint so parts are visible against white background
          //    alphaMap: mask PNG (white=visible, black=transparent) for crisp cutout
          //    userData.baseColor = "#ffffff" reserved for future PBR texture step
          const mat = new THREE.MeshStandardMaterial({
            color:       new THREE.Color(color),  // segment tint color
            transparent: true,
            alphaMap:    maskTexture,             // white=visible, black=cut out
            alphaTest:   0.1,                     // discard near-transparent edges
            opacity:     0.72,
            roughness:   0.75,
            metalness:   0.0,
            side:        THREE.FrontSide,
            depthWrite:  false,
          });
          mat.userData.segmentColor = color;
          mat.userData.baseColor    = "#ffffff"; // future texture mapping base

          const mesh     = new THREE.Mesh(geo, mat);
          mesh.name      = `seg_${label}_${idx}`;
          // Stagger z so each segment sits clearly above the base and above each other
          mesh.position.set(0, 0, 0.01 + idx * 0.003);
          mesh.visible   = showOverlay;
          scene.add(mesh);

          // Store in dictionary: segmentMeshes[label] = mesh
          segMeshesRef.current[label] = mesh;

          console.log(`[VisualizeChair] ✅ Segment mesh "${label}" — color: ${color}, z: ${mesh.position.z.toFixed(4)}`);
        },
        undefined,
        (err) => console.error(`[VisualizeChair] ❌ Mask texture failed for "${label}":`, err)
      );

      legend.push({ label, color });
    });

    setSegmentLegend(legend);
    console.log(`[VisualizeChair] Segment meshes dict:`, Object.keys(segMeshesRef.current));
  }, [sceneReady, segments]);

  // ── Effect 4: toggle segment mesh visibility ──────────────────────────────
  useEffect(() => {
    Object.values(segMeshesRef.current).forEach(mesh => {
      mesh.visible = showOverlay;
    });
  }, [showOverlay]);

  // ── Draw label pills on the 2D canvas (positioned over each segment) ──────
  const drawLabels = useCallback(() => {
    const canvas   = labelCanvasRef.current;
    const renderer = rendererRef.current;
    const camera   = cameraRef.current;
    if (!canvas || !renderer || !camera || !sceneReady) return;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width  = window.innerWidth  + "px";
    canvas.style.height = window.innerHeight + "px";

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!showOverlay) return;

    const { w: planeW, h: planeH } = planeSizeRef.current;

    segments?.forEach((seg, idx) => {
      const { label, x1, y1, bw, bh } = parseSegment(seg);
      const color = getSegmentColor(label, idx);

      // Convert normalised bbox top-left to world space
      // YOLO: (0,0) = top-left, (1,1) = bottom-right
      // Three.js plane: (-planeW/2, planeH/2) = top-left, (planeW/2, -planeH/2) = bottom-right
      const worldX = (x1 - 0.5) * planeW;
      const worldY = (0.5 - y1) * planeH;

      // Project world point → screen space
      const v = new THREE.Vector3(worldX, worldY, 0.02);
      v.project(camera);

      const sx = (v.x + 1) / 2 * canvas.width;
      const sy = (1 - v.y) / 2 * canvas.height;

      // Label pill
      const tag   = label.replace(/_/g, " ");
      const pad   = 5;
      const fSize = 12;
      ctx.font    = `600 ${fSize}px 'DM Sans', system-ui, sans-serif`;
      const tw    = ctx.measureText(tag).width;
      const th    = fSize + pad * 2;

      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle   = color;
      if (ctx.roundRect) {
        ctx.beginPath(); ctx.roundRect(sx + 4, sy + 4, tw + pad * 2, th, 4); ctx.fill();
      } else {
        ctx.fillRect(sx + 4, sy + 4, tw + pad * 2, th);
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillText(tag, sx + 4 + pad, sy + 4 + fSize + pad * 0.55);
      ctx.restore();
    });
  }, [sceneReady, segments, showOverlay]);

  useEffect(() => { drawLabels(); }, [drawLabels]);
  useEffect(() => {
    window.addEventListener("resize", drawLabels);
    return () => window.removeEventListener("resize", drawLabels);
  }, [drawLabels]);

  // ──────────────────────────────────────────────────────────────────────────
  const hasSegments = Array.isArray(segments) && segments.length > 0;

  return (
    <div style={{
      width: "100vw", height: "100vh",
      overflow: "hidden", position: "relative",
      background: "#ffffff",
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>

      {/* ── Layer 1: Three.js canvas ─────────────────────────────────────── */}
      <div
        ref={mountRef}
        style={{ position: "absolute", inset: 0, zIndex: 1 }}
      />

      {/* ── Layer 2: 2D canvas for label pills ──────────────────────────── */}
      <canvas
        ref={labelCanvasRef}
        style={{
          position:      "fixed",
          inset:         0,
          pointerEvents: "none",
          zIndex:        10,
        }}
      />

      {/* ── No image prompt ───────────────────────────────────────────────── */}
      {!imageUrl && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 20,
          display: "flex", alignItems: "center",
          justifyContent: "center", flexDirection: "column", gap: 16,
        }}>
          <p style={{ color: "#888", fontSize: 15 }}>
            No image found. Please upload a chair sketch first.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              padding: "10px 22px", background: "#111", color: "#fff",
              border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14,
            }}
          >
            Back to Dashboard
          </button>
        </div>
      )}

      {/* ── Load error ────────────────────────────────────────────────────── */}
      {loadError && (
        <div style={{
          position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
          background: "#ef4444", color: "#fff",
          padding: "8px 16px", borderRadius: 8, zIndex: 2000, fontSize: 13,
        }}>
          Failed to load image — check console for details.
        </div>
      )}

      {/* ── Segment legend panel ──────────────────────────────────────────── */}
      {segmentLegend.length > 0 && showOverlay && (
        <div style={{
          position: "fixed", top: 20, right: 20,
          background: "rgba(12,12,18,0.84)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12, padding: "14px 18px",
          zIndex: 1000, minWidth: 155,
        }}>
          <p style={{
            color: "#7a7060", fontSize: 10, letterSpacing: "0.12em",
            textTransform: "uppercase", margin: "0 0 10px",
          }}>
            Detected Parts
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {segmentLegend.map(({ label, color }, i) => (
              <LegendDot key={i} label={label} color={color} />
            ))}
          </div>
        </div>
      )}

      {/* ── Scene ready badge ─────────────────────────────────────────────── */}
      {sceneReady && (
        <div style={{
          position: "fixed", bottom: 20, right: 20,
          background: "rgba(12,12,18,0.82)", color: "#7fcfa0",
          padding: "7px 14px", borderRadius: 8, fontSize: 12,
          zIndex: 2000, backdropFilter: "blur(6px)",
          border: "1px solid rgba(127,207,160,0.20)",
          letterSpacing: "0.03em",
        }}>
          ✓ Scene ready
          {hasSegments && ` · ${segments.length} segment${segments.length > 1 ? "s" : ""} mapped`}
        </div>
      )}

      {/* ── Back button ───────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate("/dashboard")}
        style={{
          position: "fixed", top: 20, left: 20,
          padding: "10px 20px",
          background: "rgba(10,10,15,0.78)", color: "#ddd5c8",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 9, cursor: "pointer", zIndex: 1000,
          fontSize: 13, letterSpacing: "0.03em",
          backdropFilter: "blur(6px)", transition: "background 0.18s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(30,30,40,0.92)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(10,10,15,0.78)")}
      >
        ← Back
      </button>

      {/* ── Segments toggle ───────────────────────────────────────────────── */}
      {hasSegments && (
        <button
          onClick={() => setShowOverlay(v => !v)}
          style={{
            position: "fixed", top: 20, left: 125,
            padding: "10px 16px",
            background: showOverlay ? "rgba(127,207,160,0.16)" : "rgba(10,10,15,0.78)",
            color:  showOverlay ? "#7fcfa0" : "#8a8070",
            border: `1px solid ${showOverlay ? "rgba(127,207,160,0.32)" : "rgba(255,255,255,0.10)"}`,
            borderRadius: 9, cursor: "pointer", zIndex: 1000,
            fontSize: 13, letterSpacing: "0.03em",
            backdropFilter: "blur(6px)", transition: "all 0.18s",
          }}
        >
          {showOverlay ? "Segments ON" : "Segments OFF"}
        </button>
      )}
    </div>
  );
}