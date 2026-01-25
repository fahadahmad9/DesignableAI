# llama_client.py
import requests
from typing import Dict, Any


OLLAMA_URL = "http://localhost:11434/api/chat"


def call_llama(prompt_payload: Dict[str, Any], model: str = "llama3.1") -> str:
    """
    Sends a prompt to the local Ollama LLaMA model and returns the assistant's response text.
    prompt_payload should contain:
      - system_prompt
      - prompt (user prompt)
    """

    system_prompt = prompt_payload.get("system_prompt", "")
    user_prompt = prompt_payload.get("prompt", "")

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "stream": False
    }

    try:
        resp = requests.post(OLLAMA_URL, json=body, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        return data["message"]["content"]

    except Exception as e:
        print("\n❌ ERROR calling LLaMA:", e)
        raise RuntimeError(f"LLaMA API call failed: {e}")
