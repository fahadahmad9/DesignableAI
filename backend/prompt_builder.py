# prompt_builder.py
from typing import Dict, Any
from chair_summaries import CHAIR_SUMMARIES


# -------------------------------------------------
# 1. OPTIMIZED SYSTEM PROMPT (NEW VERSION)
# -------------------------------------------------

OPTIMIZED_SYSTEM_PROMPT = """
You are DesignableAI — a senior furniture design consultant.

Your role:
Interpret 2D chair sketches, understand structural/ergonomic intent, and guide the designer through slow, thoughtful, step-by-step refinement.

Tone:
Calm, analytical, curious, collaborative — never authoritative. You explore ideas with the designer instead of giving final answers.

Your response MUST ALWAYS follow this exact structure:

## 1. Interpretation
Briefly describe what you understand based on:
- detected components
- proportions
- design intent
- If measurements were extracted (AH, SD, SW, SH, BH, etc.), interpret them clearly and comment on whether they are typical, ergonomic, or unusual.

## 2. Design Considerations
Give 3–5 short bullet points covering:
- ergonomics
- structure
- materials
- manufacturing constraints
- aesthetics

## 3. Follow-up Question (ONE only)
Ask exactly ONE precise question that logically moves the design forward.
Never ask multiple questions at once.
Do not move ahead until the user responds.

## 4. Suggested Next Step
Give ONE small recommendation only.

STRICT RULES:
- Always acknowledge every detected chair component.
- Keep responses concise and structured.
- Never output large paragraphs.
- Never ask more than one question.
- Never give full designs or manufacturing instructions.
- Maintain an expert, collaborative tone.
"""


# -------------------------------------------------
# 2. CONFIDENCE SCORE BASED ON EXPECTED PARTS
# -------------------------------------------------

EXPECTED_PARTS = {
    "Eames Lounge Chair": {"eames_lounge_cushion", "eames_base", "headrest", "backrest", "seat"},
    "Ergonomic Office Chair": {"five_star_base", "caster_wheel", "control_mechanism", "lumbar_support", "backrest"},
    "Sofa Chair": {"sofa_armrest", "seat", "backrest"},
    "Egg Chair": {"armrest_egg", "seat", "backrest"},
    "Armchair": {"armrest", "seat", "backrest"},"Wing Chair": {
        "wing_flanage",   # from your canonical mapping
        "armrest",        # wing chairs typically have arms
        "backrest",
        "seat"
    },
}


def compute_rule_confidence(pred_type: str, parts: list) -> float:
    """Simple heuristic to indicate model confidence."""
    parts_set = set(parts)
    expected = EXPECTED_PARTS.get(pred_type)

    if expected:
        match_count = len(parts_set & expected)
        return round(match_count / max(1, len(expected)), 2)

    # fallback confidence for unknown chairs
    if len(parts) >= 4:
        return 0.7
    return round(min(1.0, len(parts) / 3.0), 2)


# -------------------------------------------------
# 3. MAIN PROMPT BUILDER (UPDATED)
# -------------------------------------------------

def build_prompt_from_classifier_result(classifier_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Builds the final structured prompt for LLaMA.
    """

    canonical_parts = classifier_result.get("canonical_parts", [])
    predicted_type = classifier_result.get("identified_type", "Unknown Chair Type")
    image_id = classifier_result.get("image_id", "uploaded_image")
    measurements = classifier_result.get("measurements", {})

    # Confidence score
    rule_conf = compute_rule_confidence(predicted_type, canonical_parts)

    # Create compact part string
    readable_parts = ", ".join(canonical_parts) if canonical_parts else "No parts detected"

    # Get your custom chair summary (kept exactly as you wrote them)
    chair_summary = CHAIR_SUMMARIES.get(predicted_type, "")

    # -------------------------------------------------
    # Build the USER prompt sent to LLaMA
    # -------------------------------------------------
    if measurements:
         meas_lines = []
         for k, v in measurements.items():
            if k == "other":
                continue
            meas_lines.append(f"- {k}: {v['value']} {v['unit']} (from {v['raw_label']})")
         meas_text = "\n".join(meas_lines)
    else:
        meas_text = "No measurements detected."
    prompt = f"""
The following chair components were detected: {readable_parts}.
The chair has been classified as: {predicted_type}.
Detected measurements:
{meas_text}
Confidence score: {rule_conf}

Chair Type Insight:
{chair_summary}

Please begin the structured analysis using the required format.
"""

    return {
        "system_prompt": OPTIMIZED_SYSTEM_PROMPT.strip(),
        "prompt": prompt.strip()
    }


# -------------------------------------------------
# TEST (run only if executed directly)
# -------------------------------------------------

if __name__ == "__main__":
    dummy = {
        "canonical_parts": ["wing_flange", "armrest", "seat", "backrest"],
        "identified_type": "Wing Chair",
        "image_id": "test_img.jpg"
    }

    out = build_prompt_from_classifier_result(dummy)
    print("\nSYSTEM PROMPT:\n", out["system_prompt"])
    print("\nUSER PROMPT:\n", out["prompt"])
