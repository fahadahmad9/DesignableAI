import os
import logging
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from llama_client import call_llama

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

router = APIRouter()

SYSTEM_PROMPT = (
    "You are a professional industrial furniture designer analyzing a chair sketch. "
    "You will receive a list of geometric shapes (rectangles, circles, paths, lines) with their positions on the canvas. "
    "Analyze ONLY what is actually present in the data. Do NOT invent curves, arcs, or details not mentioned. "
    "Describe the chair based on the actual shapes: their positions (top=headrest area, upper-middle=backrest area, middle=seat area, bottom=legs area), "
    "their dimensions, and their angles. Focus on: (1) headrest (if present), (2) backrest structure and angle, (3) seat dimensions, "
    "(4) leg design. Keep it to 2-3 sentences and be factual about what shapes are present."
)


class DesignObject(BaseModel):
    type: str
    left: float
    top: float
    width: float
    height: float
    angle: float
    relativePosition: str
    pathLength: float | None = None


def generate_design_prompt(data: List[DesignObject]) -> str:
    if not data:
        return (
            "No geometric objects were provided. Describe this as an empty or unfinished chair concept "
            "and suggest what structural elements are missing."
        )

    # Filter out very small objects that are likely noise, but keep small ones at the very top (headrest)
    MIN_DIMENSION = 5
    significant_data = []
    
    if data:
        max_top = min((item.top for item in data), default=0)
        for item in data:
            # Keep items if: they're large enough, OR they're near the top (potential headrest)
            if item.width >= MIN_DIMENSION or item.height >= MIN_DIMENSION or (item.top <= max_top + 50):
                significant_data.append(item)
    
    if not significant_data:
        return "The sketch is too small or minimal to analyze. Add larger shapes to define the chair structure."

    sorted_data = sorted(significant_data, key=lambda item: (item.top, item.left))

    # Categorize shapes by region (headrest, backrest, seat, legs)
    canvas_height = max((item.top + item.height) for item in sorted_data) if sorted_data else 300
    min_top = min((item.top for item in sorted_data)) if sorted_data else 0
    
    # Define regions as percentages from top
    headrest_threshold = min_top + (canvas_height * 0.15)
    backrest_threshold = min_top + (canvas_height * 0.50)
    seat_threshold = min_top + (canvas_height * 0.80)
    
    headrest_parts = []
    backrest_parts = []
    seat_parts = []
    leg_parts = []
    
    for item in sorted_data:
        center_y = item.top + item.height / 2
        
        shape_desc = f"{item.type}"
        if item.type == "path":
            shape_desc = f"curved path (length ~{round(item.pathLength or 0)}px)"
        elif item.type == "rect":
            shape_desc = f"rectangle ({round(item.width)}x{round(item.height)}px)"
        elif item.type in ["circle", "oval"]:
            shape_desc = f"{item.type} ({round(item.width)}x{round(item.height)}px)"
        
        detail = f"{shape_desc} at angle {round(item.angle)}°"
        
        if center_y < headrest_threshold:
            headrest_parts.append(detail)
        elif center_y < backrest_threshold:
            backrest_parts.append(detail)
        elif center_y < seat_threshold:
            seat_parts.append(detail)
        else:
            leg_parts.append(detail)
    
    # Build structured description
    parts = []
    
    if headrest_parts:
        parts.append(f"Headrest: {', '.join(headrest_parts)}")
    
    if backrest_parts:
        parts.append(f"Backrest: {', '.join(backrest_parts)}")
    
    if seat_parts:
        parts.append(f"Seat: {', '.join(seat_parts)}")
    
    if leg_parts:
        parts.append(f"Legs/Base: {', '.join(leg_parts)}")
    
    geometry_description = ". ".join(parts) if parts else "Empty canvas"

    return (
        "Chair sketch geometry: "
        f"{geometry_description}. "
        "Describe ONLY the structure that is present. "
        "Do NOT invent curves or details not shown. "
        "Analyze the headrest (if present), backrest tilt, seat width/depth, and leg structure."
    )


@router.post("/api/v1/design-feedback")
async def design_feedback(data: List[DesignObject]):
    logger.info(f"[DESIGN FEEDBACK] Received {len(data)} objects from canvas")
    logger.debug(f"[DESIGN FEEDBACK] Objects: {data}")
    
    prompt = generate_design_prompt(data)
    logger.info(f"[DESIGN FEEDBACK] Generated prompt: {prompt[:100]}...")
    
    model_name = os.getenv("OLLAMA_MODEL", "llama3.1")
    logger.info(f"[DESIGN FEEDBACK] Using model: {model_name}")

    try:
        logger.info(f"[DESIGN FEEDBACK] Calling llama_client...")
        content = call_llama(
            {
                "system_prompt": SYSTEM_PROMPT,
                "prompt": prompt,
            },
            model=model_name,
        )
        logger.info(f"[DESIGN FEEDBACK] Received response from LLM: {content[:100]}...")

        if not content or not str(content).strip():
            logger.error("[DESIGN FEEDBACK] No content returned by Ollama")
            raise HTTPException(status_code=502, detail="No content returned by Ollama.")

        logger.info(f"[DESIGN FEEDBACK] Successfully analyzed design")
        return {"description": content}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[DESIGN FEEDBACK] Error during analysis: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Design analysis failed: {exc}")
