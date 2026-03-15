# main.py
from visions_utils import ocr_extract_lines, parse_measurements_from_lines
import uvicorn
import tempfile
import os
import json
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from yolov8_inference import run_inference_on_image
from chair_classification import classify_json
from prompt_builder import build_prompt_from_classifier_result
from llama_client import call_llama


app = FastAPI(title="DesignableAI - Unified Endpoint")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/analyze-chair")
async def analyze_chair(request: Request, file: UploadFile = None):

    # -------------------------
    # CASE 1: User is chatting
    # -------------------------
    if file is None:
        body = await request.json()
        user_message = body.get("message")
        history = body.get("history", [])

        if not user_message:
            raise HTTPException(status_code=400, detail="Missing 'message' field")

        response = call_llama({
            "system_prompt": history[0]["content"] if history else "",
            "prompt": user_message
        })

        messages = history + [{"role": "user", "content": user_message}]
        return {"assistant_reply": response, "history": messages}


    # -------------------------
    # CASE 2: Image uploaded
    # -------------------------
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    suffix = os.path.splitext(file.filename)[1] or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        temp_path = tmp.name
        tmp.write(await file.read())

    try:
        # OCR → measurement extraction
        ocr_lines = ocr_extract_lines(temp_path)
        measurements = parse_measurements_from_lines(ocr_lines)

        # YOLO inference
        detections = run_inference_on_image(temp_path, conf_thresh=0.25)

        # Classification (NO measurement param!)
        classification = classify_json(detections, image_id=file.filename)

        # Attach detections (with masks) for frontend visualization
        classification["detections"] = detections

        # Attach measurements here
        classification["measurements"] = measurements
        classification["ocr_lines"] = ocr_lines

        # Build LLaMA prompt
        prompt_payload = build_prompt_from_classifier_result(classification)

        # First assistant reply
        assistant_reply = call_llama(prompt_payload)

        history = [
            {"role": "system", "content": prompt_payload["system_prompt"]},
            {"role": "assistant", "content": assistant_reply}
        ]

        return {
            "analysis": classification,
            "assistant_reply": assistant_reply,
            "history": history
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        try:
            os.remove(temp_path)
        except:
            pass



if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
