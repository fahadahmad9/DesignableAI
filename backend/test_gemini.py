import os
from google import genai
import sys

# Load API Key from environment variable
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable not set. Please set it before running tests.")

def test_connection():
    print("--- 🚀 Testing DesignableAI Connection ---")
    
    try:
        # 1. Initialize the new Client
        client = genai.Client(api_key=API_KEY)
        
        # 2. Try a simple generation using Gemini 1.5 Flash
        print("Testing: gemini-3.0-flash...")
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents="Hello! Confirm you are working for DesignableAI."
        )
        
        print(f"\n✅ SUCCESS! Response: {response.text}")
        print("\nYour environment is ready for the ANALYSIS phase.")

    except Exception as e:
        print(f"\n❌ FAILED: {e}")
        
        print("\n--- 🔍 Diagnosing Available Models ---")
        try:
            # Let's see what your key actually has access to
            client = genai.Client(api_key=API_KEY)
            print("Models available for your API Key:")
            for m in client.models.list():
                print(f"- {m.name}")
        except Exception as list_err:
            print(f"Could not list models: {list_err}")
            print("TIP: If you see 'API_KEY_INVALID', double-check AI Studio.")

if __name__ == "__main__":
    test_connection()