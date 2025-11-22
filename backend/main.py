from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os

from utils.image_processing import extract_text, extract_segments, visualize_segments, link_measurements_to_segments


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.get("/")
async def root():
    return {"message": "OCR API is running", "endpoint": "/upload/"}


@app.post("/upload/")
async def upload_image(file: UploadFile = File(...)):
    """Upload image, extract text, and detect segments"""
    
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    
    try:
        # Save uploaded file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"File saved: {file_path}")
        
        # Extract text using OCR
        print("Starting text extraction...")
        text_result = extract_text(file_path)
        if isinstance(text_result, dict):
            print(f"Text extraction result: {text_result.get('status', 'unknown')}")
        else:
            print(f"Extracted {len(text_result)} text items")

        
        # Extract segments using CV
        print("Starting segmentation...")
        segments_result = extract_segments(file_path)
        print(f"Segmentation result: {segments_result.get('status', 'unknown')}")
        
        # Don't visualize in API - it blocks
        visualize_segments(file_path, segments_result)
        
        # Link measurements to nearest segments
        print("Linking measurements to segments...")
        linked_data = link_measurements_to_segments(
            text_result if isinstance(text_result, list) else text_result.get("details", []),
            segments_result.get("segments", [])
        )

        print(f"Linked {len(linked_data)} measurements to segments")

        # Combine results
        result = {
            "text_result": text_result,
            "segments_result": segments_result,
            "linked_data": linked_data,   # <-- added this line
        }

        return JSONResponse(content=result)
    
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"ERROR in upload endpoint: {error_detail}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "detail": error_detail}
        )
    
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"File deleted: {file_path}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)