"""
main.py — DesignableAI v2.2
==========================
FastAPI backend with three endpoints:

  POST /analyze-chair     (multipart file) → Full pipeline
  POST /analyze-chair     (JSON body)      → Chat follow-up
  POST /recalculate-geometry               → Re-run geometry on modified masks
  POST /ai-feedback                        → LLM assessment of user modifications
"""

import uvicorn
import tempfile
import os
import uuid
import json
import numpy as np
import cv2
from fastapi import FastAPI, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from visions_utils import ocr_extract_lines, parse_measurements_from_lines
from yolov8_inference import run_inference_on_image
from chair_classification import normalize_parts, classify_chair, _CANONICAL_LOWER
from table_classification import normalize_table_parts, classify_table, build_table_prompt_context
from geometry_analyzer import (
    analyze_geometry,
    compute_px_per_mm,
    compute_spatial_relations,
    get_part_role,
)
from prompt_builder import build_expert_prompt, detect_phase, build_modification_feedback_prompt
from gemini_client import call_designable_ai

####  DATABASE SETUP ####
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from typing import Optional, List
import shutil
from pathlib import Path
from database import engine, get_db
from models import Base, User, Upload, Project3D
from schemas import SignupRequest, LoginRequest, TokenResponse, UploadResponse, SaveProject3DRequest, Project3DResponse
from auth import hash_password, verify_password, create_access_token, get_current_user_id

#########################################################################3

_TABLE_CANONICAL_LOWER = {
    "table_top": "table_top",
    "tabletop": "table_top",
    "top": "table_top",
    "surface": "table_top",
    "deck": "table_top",
    "leg": "leg",
    "legs": "leg",
    "table_leg": "leg",
    "support": "leg",
    "post": "leg",
    "apron": "apron",
    "table_apron": "apron",
    "skirt": "apron",
    "frieze": "apron",
    "pedestal": "pedestal",
    "column": "pedestal",
    "center_post": "pedestal",
    "stretcher": "stretcher",
    "cross_brace": "stretcher",
    "strut": "stretcher",
    "trestle": "stretcher",
}

# Creates users.db automatically on first run
Base.metadata.create_all(bind=engine)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="DesignableAI v2.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles
app.mount("/uploaded-images", StaticFiles(directory="uploads"), name="uploaded-images")

############################################################

@app.post("/signup", response_model=TokenResponse)
def signup(data: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return {"access_token": token}


@app.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return {"access_token": token}

@app.post("/uploads/save", response_model=UploadResponse)
async def save_upload(
    file: UploadFile,
    furniture_type: str = "chair",
    identified_type: Optional[str] = None,
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_current_user_id)
):
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    # Build a clean filename: user_1_1234567890_originalname.jpg
    suffix = Path(file.filename).suffix or ".jpg"
    safe_name = f"user_{user_id}_{int(__import__('time').time())}_{file.filename}"
    save_path = UPLOAD_DIR / safe_name

    # Save file to disk
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Save record to database
    upload = Upload(
        user_id=user_id,
        filename=file.filename,
        furniture_type=furniture_type,
        identified_type=identified_type,
        image_path=str(save_path),
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)
    return upload


@app.get("/uploads/history", response_model=List[UploadResponse])
def get_history(
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_current_user_id)
):
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")

    uploads = db.query(Upload).filter(
        Upload.user_id == user_id
    ).order_by(Upload.created_at.desc()).all()
    return uploads

# ─────────────────────────────────────────────────────────────────────────
# 3D PROJECT ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────

@app.post("/projects-3d/save", response_model=Project3DResponse)
def save_project_3d(
    request: SaveProject3DRequest,
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_current_user_id)
):
    """Save a 3D sculpted project. User must be logged in (not guest)."""
    if not user_id:
        raise HTTPException(status_code=401, detail="Must be logged in to save projects")
    
    # Serialize the project data to JSON
    project_data = {
        "parts": request.parts,
        "textures": request.textures,
        "metadata": request.project_metadata or {}
    }
    
    project = Project3D(
        user_id=user_id,
        project_name=request.project_name,
        furniture_type=request.furniture_type,
        project_data=json.dumps(project_data)
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

@app.get("/projects-3d/list", response_model=List[Project3DResponse])
def list_projects_3d(
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_current_user_id)
):
    """Get all saved 3D projects for the current user."""
    if not user_id:
        raise HTTPException(status_code=401, detail="Must be logged in to view projects")
    
    projects = db.query(Project3D).filter(
        Project3D.user_id == user_id
    ).order_by(Project3D.created_at.desc()).all()
    return projects

@app.get("/projects-3d/{project_id}", response_model=dict)
def get_project_3d(
    project_id: int,
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_current_user_id)
):
    """Get a specific 3D project with full data."""
    if not user_id:
        raise HTTPException(status_code=401, detail="Must be logged in to view projects")
    
    project = db.query(Project3D).filter(
        Project3D.id == project_id,
        Project3D.user_id == user_id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {
        "id": project.id,
        "project_name": project.project_name,
        "furniture_type": project.furniture_type,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "data": json.loads(project.project_data)
    }

###########################


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def _contour_bbox(mask_data) -> tuple:
    try:
        pts = np.array(mask_data, dtype=np.int32)
        if pts.size == 0: return None
        x, y, w, h = cv2.boundingRect(pts)
        return (x, y, w, h)
    except Exception:
        return None


def _extract_seat_meta(detections: list) -> dict:
    for det in detections:
        mask_data = det.get("mask")
        if det.get("part_name", "").lower() == "seat" and mask_data:
            try:
                pts = np.array(mask_data, dtype=np.int32)
                if pts.size > 0:
                    _, _, w, h = cv2.boundingRect(pts)
                    return {"height": h, "width": w}
            except Exception:
                pass
    return {}


def _canonicalize_part_name(raw_name: str, furniture_type: str) -> Optional[str]:
    if not raw_name:
        return None

    key = raw_name.lower().strip().replace(" ", "_").replace("-", "_")
    while "__" in key:
        key = key.replace("__", "_")

    if furniture_type == "table":
        direct = _TABLE_CANONICAL_LOWER.get(key)
        if direct:
            return direct

        candidates = [key]
        if key.endswith("ss"):
            candidates.append(key[:-1])
        if key.endswith("s"):
            candidates.append(key[:-1])
        if key.startswith("table_"):
            stripped = key[len("table_"):]
            candidates.append(stripped)
            if stripped.endswith("s"):
                candidates.append(stripped[:-1])

        for candidate in candidates:
            mapped = _TABLE_CANONICAL_LOWER.get(candidate)
            if mapped:
                return mapped

        # Heuristic fallback for noisy detector labels
        if "top" in key or "tabletop" in key or "surface" in key or "deck" in key:
            return "table_top"
        if "leg" in key or "support" in key:
            return "leg"
        if "apron" in key or "skirt" in key or "frieze" in key or "trim" in key:
            return "apron"
        if "pedestal" in key or "column" in key or "center_post" in key:
            return "pedestal"
        if "stretcher" in key or "brace" in key or "strut" in key or "trestle" in key:
            return "stretcher"
        return None

    return _CANONICAL_LOWER.get(key)


def _infer_canvas_role(index: int, total: int, furniture_type: str) -> str:
    if furniture_type == "table":
        if index == 0:
            return "table_top"
        if index == 1:
            return "apron"
        if index == 2:
            return "leg"
        if index == 3:
            return "stretcher"
        return "support"

    if total <= 1:
        return "seat"
    if total == 2:
        return "backrest" if index == 0 else "seat"
    if total == 3:
        return ["headrest", "backrest", "seat"][index]
    if index == 0:
        return "headrest"
    if index == 1:
        return "backrest"
    if index == 2:
        return "seat"
    if index == total - 1:
        return "base"
    return "armrest"


def _build_canvas_object_summary(obj: Dict[str, Any], furniture_type: str, index: int, total: int) -> Dict[str, Any]:
    bbox = obj.get("bbox") or {}
    x = float(bbox.get("x", 0))
    y = float(bbox.get("y", 0))
    width = float(bbox.get("width", 0))
    height = float(bbox.get("height", 0))
    center_x = x + width / 2
    center_y = y + height / 2
    object_type = obj.get("type", "unknown")
    inferred_part = _infer_canvas_role(index, total, furniture_type)

    summary: Dict[str, Any] = {
        "order": index + 1,
        "id": obj.get("id"),
        "type": object_type,
        "inferred_part": inferred_part,
        "bbox": {
            "x": round(x, 2),
            "y": round(y, 2),
            "width": round(width, 2),
            "height": round(height, 2),
            "area": round(width * height, 2),
            "center_x": round(center_x, 2),
            "center_y": round(center_y, 2),
        },
        "stroke_size": obj.get("size"),
        "rotation_degrees": round(float(obj.get("rotation", 0) or 0) * 180 / np.pi, 2),
        "color": obj.get("color"),
    }

    if object_type in {"line", "curve"}:
        x1 = float(obj.get("x1", 0))
        y1 = float(obj.get("y1", 0))
        x2 = float(obj.get("x2", 0))
        y2 = float(obj.get("y2", 0))
        summary["points"] = {
            "start": {"x": round(x1, 2), "y": round(y1, 2)},
            "end": {"x": round(x2, 2), "y": round(y2, 2)},
            "length": round(float(np.hypot(x2 - x1, y2 - y1)), 2),
        }
        if object_type == "curve":
            cx = float(obj.get("cx", 0))
            cy = float(obj.get("cy", 0))
            summary["points"]["control"] = {"x": round(cx, 2), "y": round(cy, 2)}
    elif object_type in {"rect", "square", "triangle"}:
        summary["dimensions"] = {
            "width": round(width, 2),
            "height": round(height, 2),
            "diagonal": round(float(np.hypot(width, height)), 2),
        }
    elif object_type == "circle":
        radius = float(obj.get("r", min(width, height) / 2))
        summary["dimensions"] = {
            "radius": round(radius, 2),
            "diameter": round(radius * 2, 2),
        }
    elif object_type in {"freehand", "eraser"}:
        points = obj.get("points", [])
        total_length = 0.0

        def _point_xy(point):
            if isinstance(point, dict):
                return float(point.get("x", 0)), float(point.get("y", 0))
            return float(point[0]), float(point[1])

        for pt_index in range(1, len(points)):
            prev_pt = points[pt_index - 1]
            current_pt = points[pt_index]
            prev_x, prev_y = _point_xy(prev_pt)
            curr_x, curr_y = _point_xy(current_pt)
            total_length += float(np.hypot(curr_x - prev_x, curr_y - prev_y))
        summary["path"] = {
            "point_count": len(points),
            "length": round(total_length, 2),
            "points": points,
        }

    return summary


def _build_canvas_prompt_payload(request_data: "DrawingAnalysisRequest") -> Dict[str, str]:
    furniture_type = (request_data.furniture_type or "chair").strip().lower()
    if furniture_type not in {"chair", "table"}:
        raise HTTPException(status_code=400, detail="furniture_type must be 'chair' or 'table'.")

    ordered_objects = []
    for obj in request_data.objects:
        bbox = obj.get("bbox") or {}
        ordered_objects.append(
            {
                **obj,
                "bbox": bbox,
                "_sort_y": float(bbox.get("y", 0)),
                "_sort_x": float(bbox.get("x", 0)),
            }
        )

    ordered_objects.sort(key=lambda item: (item["_sort_y"], item["_sort_x"]))
    canvas_objects = [
        _build_canvas_object_summary(obj, furniture_type, index, len(ordered_objects))
        for index, obj in enumerate(ordered_objects)
    ]

    structured_payload = {
        "session_id": request_data.session_id,
        "furniture_type": furniture_type,
        "canvas": request_data.canvas or {},
        "structural_sequence": " -> ".join(item["inferred_part"] for item in canvas_objects) or "none",
        "objects": canvas_objects,
        "instructions": [
            "Describe the drawing as a furniture concept, not as random sketch strokes.",
            "Use every supplied dimension, bounding box, stroke size, and point count.",
            "For a chair, treat the top-most drawn object as the headrest, then backrest, then seat, then the lower support structure.",
            "For a table, treat the top-most drawn object as the tabletop, then apron, then legs or stretchers.",
            "Do not invent measurements that are not present in the payload.",
            "Call out what the geometry suggests about posture, balance, and proportions.",
        ],
    }

    system_prompt = (
        "You are the Lead Furniture Architect at DesignableAI. "
        "You are analyzing a user-made drawing on the canvas. "
        "Use only the structured payload below. "
        "If the user drew a chair, describe the top-to-bottom sequence as headrest, backrest, seat, then the lower support structure. "
        "If the user drew a table, describe the top-to-bottom sequence as tabletop, apron, legs, and stretchers or braces. "
        "Every claim must reference a concrete value from the payload. "
        "Return a concise markdown response with an overall interpretation, a part-by-part reading, and one focused next step."
    )

    prompt = json.dumps(structured_payload, indent=2)
    return {"system_prompt": system_prompt, "prompt": prompt}


# ---------------------------------------------------------------------------
# REQUEST MODELS
# ---------------------------------------------------------------------------

class RecalcPart(BaseModel):
    label: str
    mask: List[List[float]]
    scale_x: float = 1.0
    scale_y: float = 1.0

class RecalcRequest(BaseModel):
    parts: List[RecalcPart]
    px_per_mm: Optional[float] = None
    seat_meta: Optional[Dict[str, Any]] = None

class ModificationEntry(BaseModel):
    label: str
    changes: Dict[str, Any]
    original_measurements: Dict[str, Any] = {}
    new_measurements: Dict[str, Any] = {}
    original_flags: List[Dict[str, Any]] = []
    new_flags: List[Dict[str, Any]] = []

class AIFeedbackRequest(BaseModel):
    session_id: str = "visualizer"
    chair_type: str = "Unknown"
    is_hybrid: bool = False
    influences: List[str] = []
    modifications: List[ModificationEntry]
    classification_data: Optional[Dict[str, Any]] = None

class DrawingAnalysisRequest(BaseModel):
    session_id: str = "drawing_canvas"
    furniture_type: str = "chair"
    canvas: Optional[Dict[str, Any]] = None
    objects: List[Dict[str, Any]]


# ---------------------------------------------------------------------------
# ROUTES
# ---------------------------------------------------------------------------

@app.post("/analyze-chair")
async def analyze_chair(request: Request, file: UploadFile = None, furniture_type: str = "chair"):

    # ── CHAT FOLLOW-UP ──────────────────────────────────────────────────
    if file is None:
        body             = await request.json()
        user_message     = body.get("message", "")
        session_id       = body.get("session_id", "default_user")
        current_phase    = body.get("phase", "ANALYSIS")
        analysis_data    = body.get("classification_data", {})

        if not user_message:
            raise HTTPException(status_code=400, detail="No message provided.")

        current_phase = detect_phase(user_message, current_phase)

        prompt_payload = build_expert_prompt(
            analysis_data,
            current_phase=current_phase,
            is_followup=True,
            user_message=user_message,
        )

        assistant_reply = call_designable_ai(session_id, prompt_payload)

        return {
            "assistant_reply": assistant_reply,
            "phase":           current_phase,
            "session_id":      session_id,
        }

    # ── IMAGE UPLOAD ─────────────────────────────────────────────────────
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    suffix = os.path.splitext(file.filename)[1] or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        temp_path = tmp.name
        tmp.write(await file.read())

    try:
        selected_type = (furniture_type or "chair").strip().lower()
        if selected_type not in {"chair", "table"}:
            raise HTTPException(status_code=400, detail="furniture_type must be 'chair' or 'table'.")

        ocr_lines    = ocr_extract_lines(temp_path)
        measurements = parse_measurements_from_lines(ocr_lines)
        detections   = run_inference_on_image(temp_path, conf_thresh=0.25, furniture_type=selected_type)
        seat_meta    = _extract_seat_meta(detections)
        px_per_mm    = compute_px_per_mm(measurements, seat_meta)
        
        if selected_type == "chair":
            parts_set = normalize_parts(detections)
            classification = classify_chair(parts_set)
            identified_type = classification["type"]
            is_hybrid       = classification["is_hybrid"]
            influences      = classification.get("influences", [])
        else:
            parts_set = normalize_table_parts(detections)
            table_type, confidence = classify_table(parts_set)
            identified_type = table_type
            is_hybrid       = False
            influences      = []

        parts_with_traits = []
        parts_for_spatial = []

        img = cv2.imread(temp_path)
        img_h, img_w = img.shape[:2] if img is not None else (800, 600)

        # ── Detect duplicate labels and assign left/right suffixes ────
        # First pass: collect all canonical labels and their mask centroids
        label_instances = {}  # canon -> list of (detection, centroid_x)
        for det in detections:
            raw_name = det.get("part_name", "")
            mask_data = det.get("mask")
            canon = _canonicalize_part_name(raw_name, selected_type)
            if not canon or not mask_data:
                continue
            # Compute centroid X for left/right determination
            pts = np.array(mask_data, dtype=np.int32)
            cx = float(pts.reshape(-1, 2)[:, 0].mean()) if pts.size > 0 else 0
            if canon not in label_instances:
                label_instances[canon] = []
            label_instances[canon].append((det, cx))

        # Second pass: build parts, suffixing duplicates
        for canon, instances in label_instances.items():
            if len(instances) > 1:
                # Sort by centroid X: leftmost first
                instances.sort(key=lambda x: x[1])
                suffixes = ["_left", "_right"] if len(instances) == 2 else [f"_{i+1}" for i in range(len(instances))]
            else:
                suffixes = [""]

            for (det, cx), suffix in zip(instances, suffixes):
                mask_data = det.get("mask")
                unique_label = canon + suffix

                geometry = analyze_geometry(
                    mask_points=mask_data, part_label=canon,  # use canonical for geometry analysis
                    seat_metadata=seat_meta if seat_meta else None,
                    px_per_mm=px_per_mm,
                )
                if geometry is None:
                    continue

                bbox = _contour_bbox(mask_data)

                parts_with_traits.append({
                    "label": unique_label,    # unique label with suffix
                    "canonical": canon,        # original canonical label for role lookup
                    "geometry": geometry,
                    "mask": mask_data,
                    "bbox": list(bbox) if bbox else None,
                })
                parts_for_spatial.append({
                    "label": canon,            # spatial relations use canonical labels
                    "mask": mask_data,
                    "bbox": bbox,
                    "geometry": geometry,
                })

        spatial_relations = compute_spatial_relations(parts_for_spatial)

        analysis_data = {
            "furniture_type":   selected_type,
            "identified_type":   identified_type,
            "is_hybrid":         is_hybrid,
            "influences":        influences,
            "canonical_parts":   sorted(list(parts_set)),
            "parts_with_traits": parts_with_traits,
            "spatial_relations": spatial_relations,
            "measurements":      measurements,
            "scale_factor": {
                "px_per_mm": round(px_per_mm, 4) if px_per_mm else None,
                "anchor":    "SH label + seat bounding box" if px_per_mm else "not established",
            },
            "image_dimensions": { "width": img_w, "height": img_h },
        }

        prompt_payload  = build_expert_prompt(analysis_data, current_phase="ANALYSIS", is_followup=False)
        session_id      = f"{uuid.uuid4()}_{file.filename}_{selected_type}"
        assistant_reply = call_designable_ai(session_id, prompt_payload)

        return {
            "analysis":        analysis_data,
            "assistant_reply": assistant_reply,
            "phase":           "ANALYSIS",
            "session_id":      session_id,
        }

    except Exception as e:
        import traceback
        print(f"[DesignableAI] Pipeline error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/recalculate-geometry")
async def recalculate_geometry(req: RecalcRequest):
    """
    Recalculates geometry for parts after client-side resizing.
    """
    try:
        results = []
        parts_for_spatial = []
        seat_meta = req.seat_meta or {}

        for part in req.parts:
            mask = np.array(part.mask, dtype=np.float64)
            centroid = mask.mean(axis=0)
            scaled = (mask - centroid) * np.array([part.scale_x, part.scale_y]) + centroid
            scaled_list = scaled.astype(np.int32).tolist()

            geometry = analyze_geometry(
                mask_points=scaled_list, part_label=part.label,
                seat_metadata=seat_meta if seat_meta else None,
                px_per_mm=req.px_per_mm,
            )
            if geometry is None: continue

            bbox = _contour_bbox(scaled_list)
            results.append({ "label": part.label, "geometry": geometry, "mask": scaled_list, "bbox": list(bbox) if bbox else None })
            parts_for_spatial.append({ "label": part.label, "mask": scaled_list, "bbox": bbox, "geometry": geometry })

        spatial_relations = compute_spatial_relations(parts_for_spatial)
        return { "parts": results, "spatial_relations": spatial_relations }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Recalculation failed: {str(e)}")


@app.post("/ai-feedback")
async def ai_feedback(req: AIFeedbackRequest):
    """
    Sends modification data to the LLM for ergonomic assessment.
    Returns a focused analysis of the changes the user made in the visualizer.
    """
    try:
        prompt_payload = build_modification_feedback_prompt(
            chair_type=req.chair_type,
            is_hybrid=req.is_hybrid,
            influences=req.influences,
            modifications=[m.dict() for m in req.modifications],
            classification_data=req.classification_data or {},
        )

        feedback = call_designable_ai(req.session_id, prompt_payload)

        return { "feedback": feedback }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI feedback failed: {str(e)}")


@app.post("/analyze-drawing")
async def analyze_drawing(req: DrawingAnalysisRequest):
    """
    Sends canvas drawing geometry to Gemini for chair/table interpretation.
    """
    try:
        prompt_payload = _build_canvas_prompt_payload(req)
        assistant_reply = call_designable_ai(req.session_id, prompt_payload)
        return {
            "assistant_reply": assistant_reply,
            "session_id": req.session_id,
            "furniture_type": (req.furniture_type or "chair").strip().lower(),
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Drawing analysis failed: {str(e)}")




@app.post("/upload-canvas-sketch")
async def upload_canvas_sketch(
    file: UploadFile,
    furniture_type: str = "chair",
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_current_user_id)
):
    '''
    Uploads a canvas sketch drawing as an image file, applies preprocessing,
    runs YOLO segmentation, and returns detailed analysis via Gemini.
    
    Flow:
    1. Save file to disk and database
    2. Apply sketch preprocessing (upscale, CLAHE, morphological ops)
    3. Run YOLO inference on preprocessed image
    4. Classify furniture type and parts
    5. Generate analysis via Gemini
    '''
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")
    
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")
    
    # Build safe filename
    suffix = Path(file.filename).suffix or ".png"
    safe_name = f"user_{user_id}_{int(__import__('time').time())}_sketch_{file.filename}"
    save_path = UPLOAD_DIR / safe_name
    
    # Save original file to disk
    file_content = await file.read()
    with open(save_path, "wb") as f:
        f.write(file_content)
    
    # Save record to database
    upload_record = Upload(
        user_id=user_id,
        filename=file.filename,
        furniture_type=furniture_type,
        identified_type=None,  # Will be determined after analysis
        image_path=str(save_path),
    )
    db.add(upload_record)
    db.commit()
    db.refresh(upload_record)
    
    try:
        # Apply sketch preprocessing for better segmentation
        from sketch_preprocessing import apply_sketch_preprocessing_inplace
        
        selected_type = (furniture_type or "chair").strip().lower()
        if selected_type not in {"chair", "table"}:
            raise HTTPException(status_code=400, detail="furniture_type must be 'chair' or 'table'.")
        
        # Save preprocessed version to temp file
        preprocessed_img = apply_sketch_preprocessing_inplace(str(save_path), upscale_factor=2.0)
        preprocessed_path = str(save_path).replace(".png", "_preprocessed.png")
        preprocessed_path = preprocessed_path.replace(".jpg", "_preprocessed.jpg")
        cv2.imwrite(preprocessed_path, preprocessed_img)
        
        # Run inference on PREPROCESSED image
        detections = run_inference_on_image(
            preprocessed_path,
            conf_thresh=0.25,
            furniture_type=selected_type
        )
        
        # Extract seat metadata for measurement calibration
        seat_meta = _extract_seat_meta(detections)
        px_per_mm = compute_px_per_mm({}, seat_meta)
        
        # Classify furniture type
        if selected_type == "chair":
            parts_set = normalize_parts(detections)
            classification = classify_chair(parts_set)
            identified_type = classification["type"]
        else:
            parts_set = normalize_table_parts(detections)
            table_type, confidence = classify_table(parts_set)
            identified_type = table_type
        
        # Update database with identified type
        upload_record.identified_type = identified_type
        db.commit()
        
        # Build parts list with geometry analysis
        parts_with_traits = []
        img = cv2.imread(preprocessed_path)
        img_h, img_w = img.shape[:2] if img is not None else (800, 600)
        
        # Group detections by canonical part name
        label_instances = {}
        for det in detections:
            raw_name = det.get("part_name", "")
            mask_data = det.get("mask")
            canon = _canonicalize_part_name(raw_name, selected_type)
            if not canon or not mask_data:
                continue
            pts = np.array(mask_data, dtype=np.int32)
            cx = float(pts.reshape(-1, 2)[:, 0].mean()) if pts.size > 0 else 0
            if canon not in label_instances:
                label_instances[canon] = []
            label_instances[canon].append((det, cx))
        
        # Process parts with left/right suffixes for duplicates
        for canon, instances in label_instances.items():
            if len(instances) > 1:
                instances.sort(key=lambda x: x[1])
                suffixes = ["_left", "_right"] if len(instances) == 2 else [f"_{i+1}" for i in range(len(instances))]
            else:
                suffixes = [""]
            
            for (det, cx), suffix in zip(instances, suffixes):
                mask_data = det.get("mask")
                unique_label = canon + suffix
                
                geom = analyze_geometry(
                    mask_data,
                    img_h, img_w,
                    px_per_mm=px_per_mm,
                    img=img,
                    confidence=det.get("confidence", 0.5)
                )
                
                part_role = get_part_role(unique_label, furniture_type=selected_type)
                
                part_entry = {
                    "part_name": unique_label,
                    "role": part_role,
                    "mask": mask_data,
                    "confidence": round(det.get("confidence", 0.5), 3),
                    "bbox": geom.get("bbox", {}),
                    "area": geom.get("area", 0),
                    "centroid": geom.get("centroid", {}),
                    "major_axis": geom.get("major_axis", 0),
                    "minor_axis": geom.get("minor_axis", 0),
                }
                parts_with_traits.append(part_entry)
        
        # Build prompt for Gemini analysis
        if selected_type == "chair":
            prompt_payload = build_expert_prompt(
                {
                    "type": identified_type,
                    "parts": parts_with_traits,
                    "image_path": str(save_path),
                },
                current_phase="ANALYSIS",
            )
        else:
            context = build_table_prompt_context(parts_with_traits)
            prompt_payload = f"The user has uploaded a table sketch image. Here is the detected geometry and context:\n\n{context}\n\nPlease analyze this table design sketch."
        
        # Get analysis from Gemini
        session_id = f"sketch_{upload_record.id}_{uuid.uuid4()}"
        assistant_reply = call_designable_ai(session_id, prompt_payload)
        
        return {
            "assistant_reply": assistant_reply,
            "session_id": session_id,
            "furniture_type": selected_type,
            "identified_type": identified_type,
            "upload_id": upload_record.id,
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Clean up preprocessed file if it exists
        try:
            preprocessed_path = str(save_path).replace(".png", "_preprocessed.png")
            preprocessed_path = preprocessed_path.replace(".jpg", "_preprocessed.jpg")
            if Path(preprocessed_path).exists():
                Path(preprocessed_path).unlink()
        except:
            pass
        raise HTTPException(status_code=500, detail=f"Canvas sketch analysis failed: {str(e)}")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)