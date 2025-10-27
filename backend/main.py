from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os

from utils.image_processing import extract_text

app = FastAPI()

# Enable CORS
from fastapi.middleware.cors import CORSMiddleware

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
    """Upload image and extract text"""
    
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    
    try:
        # Save the uploaded file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"File saved: {file_path}")
        
        # Extract text using OCR
        result = extract_text(file_path)
        
        print(f"Result: {result}")
        
        return JSONResponse(content=result)
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )
    
    finally:
        # Clean up the file
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"File deleted: {file_path}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)