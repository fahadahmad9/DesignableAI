from google.cloud import vision
import os

# Check if key path is correctly set
print("Using credentials from:", os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))

# Initialize Vision client
try:
    client = vision.ImageAnnotatorClient()
    print("✅ Vision client created successfully!")
except Exception as e:
    print("❌ Failed to create client:", e)
    exit()

# Test with a small local image
image_path = "sofa-chair1.jpg"  # put any small image file here
if not os.path.exists(image_path):
    print("⚠️ Please add a test image named test_image.jpg in this folder.")
    exit()

with open(image_path, "rb") as img_file:
    content = img_file.read()

image = vision.Image(content=content)

try:
    response = client.text_detection(image=image)
    if response.error.message:
        print("❌ API Error:", response.error.message)
    else:
        print("✅ API working! Extracted text:")
        print(response.text_annotations[0].description if response.text_annotations else "(no text found)")
except Exception as e:
    print("❌ Vision API test failed:", e)
