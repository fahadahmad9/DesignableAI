# vision_utils.py
import re
from typing import List, Dict
from google.cloud import vision

# ============================================================
# 1. CLIENT INITIALIZATION
# ============================================================

_client = None

def get_vision_client():
    """Load Google Cloud Vision OCR client once."""
    global _client
    if _client is None:
        _client = vision.ImageAnnotatorClient()
    return _client


# ============================================================
# 2. OCR EXTRACTION
# ============================================================

def ocr_extract_lines(image_path: str) -> List[str]:
    """
    Runs Google Cloud Vision OCR and returns cleaned text lines.
    """
    client = get_vision_client()

    with open(image_path, "rb") as f:
        content = f.read()

    image = {"content": content}
    response = client.document_text_detection(image=image)

    if response.error.message:
        raise RuntimeError(f"Vision API error: {response.error.message}")

    full_text = response.full_text_annotation.text or ""
    lines = [ln.strip() for ln in full_text.split("\n") if ln.strip()]

    return lines


# ============================================================
# 3. CANONICAL LABEL MAP
# ============================================================

CANONICAL_MEAS_LABELS = {
    "AH": "arm_height",
    "ARM_HEIGHT": "arm_height",
    "ARM_H": "arm_height",

    "SD": "seat_depth",
    "SEAT_DEPTH": "seat_depth",

    "SW": "seat_width",
    "SEAT_WIDTH": "seat_width",

    "SH": "seat_height",
    "SEAT_HEIGHT": "seat_height",

    "BH": "backrest_height",
    "BACK_HEIGHT": "backrest_height",

    "LH": "leg_height",
    "LEG_HEIGHT": "leg_height",
}

# ============================================================
# 4. REGEX FOR MEASUREMENTS
# ============================================================

MEAS_REGEX = re.compile(
    r"""
    (?P<label>[A-Za-z]{1,6})           # AH, SD, SW, etc.
    \s*[:=\s]?\s*
    (?P<value>\d{1,4}(?:[.,]\d{1,2})?) # number like 420 or 45.5
    \s*
    (?P<unit>mm|cm|in|inch|inches|")?  # unit or none
    """,
    re.IGNORECASE | re.VERBOSE
)

# ============================================================
# 5. PARSING MEASUREMENTS
# ============================================================

def parse_measurements_from_lines(lines: List[str]) -> Dict[str, Dict]:
    """
    Parse OCR text lines into normalized measurement values.

    Returns:
    {
        "arm_height": { "raw_label": "AH", "value": 420.0, "unit": "mm", "source_line": "AH: 420 mm" },
        "seat_depth": { ... },
        "other": [...]
    }
    """
    parsed = {}

    for ln in lines:
        for match in MEAS_REGEX.finditer(ln):
            raw_label = match.group("label")
            raw_value = match.group("value").replace(",", ".")
            raw_unit = (match.group("unit") or "").lower().replace(".", "")

            # Convert numeric
            try:
                num = float(raw_value)
            except:
                continue

            # Normalize units → output always mm
            if raw_unit == "cm":
                value_mm = num * 10
                unit = "cm"
            elif raw_unit in ("in", "inch", "inches", '"'):
                value_mm = num * 25.4
                unit = "in"
            else:
                value_mm = num
                unit = "mm"

            # Canonicalize label
            label_key = raw_label.upper().strip()

            canonical = CANONICAL_MEAS_LABELS.get(label_key)
            if not canonical:
                # fallback: strip punctuation
                cleaned = re.sub(r"[^A-Za-z]", "", label_key)
                canonical = CANONICAL_MEAS_LABELS.get(cleaned)

            if canonical:
                parsed[canonical] = {
                    "raw_label": raw_label,
                    "value": round(value_mm, 2),
                    "unit": "mm",
                    "source_line": ln,
                }
            else:
                parsed.setdefault("other", []).append({
                    "label": raw_label,
                    "value": num,
                    "unit": raw_unit or "unknown",
                    "source_line": ln
                })

    return parsed
