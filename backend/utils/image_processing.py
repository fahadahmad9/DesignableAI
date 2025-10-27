from google.cloud import vision
import os

# Initialize Google Cloud Vision client
client = vision.ImageAnnotatorClient()


def extract_text(image_path: str):
    """Extract text from image using Google Cloud Vision API"""
    
    if not os.path.exists(image_path):
        return {"error": f"File not found: {image_path}"}
    
    try:
        print(f"Reading image: {image_path}")
        
        # Read image file
        with open(image_path, "rb") as image_file:
            content = image_file.read()
        
        # Create image object
        image = vision.Image(content=content)
        
        print("Sending to Google Cloud Vision API...")
        
        # Call Vision API
        response = client.document_text_detection(image=image)
        
        # Extract text from response
        full_text = response.full_text_annotation.text if response.full_text_annotation else ""
        
        # Extract individual text annotations with confidence
        details = []
        for text_annotation in response.text_annotations[1:]:  # Skip first (full text)
            details.append({
                "text": text_annotation.description,
                "confidence": 1.0  # Google Cloud Vision doesn't provide per-word confidence
            })
        
        return {
            "status": "success",
            "full_text": full_text.strip(),
            "details": details,
            "total_words": len(details)
        }
    
    except Exception as e:
        error_msg = f"Text extraction failed: {str(e)}"
        print(f"ERROR: {error_msg}")
        return {"error": error_msg}


def extract_text_simple(image_path: str):
    """Simple extraction - just get the text"""
    
    if not os.path.exists(image_path):
        return ""
    
    try:
        print(f"Reading image: {image_path}")
        
        with open(image_path, "rb") as image_file:
            content = image_file.read()
        
        image = vision.Image(content=content)
        
        print("Sending to Google Cloud Vision API...")
        
        response = client.document_text_detection(image=image)
        
        text = response.full_text_annotation.text if response.full_text_annotation else ""
        
        return text.strip()
    
    except Exception as e:
        print(f"Error: {e}")
        return ""