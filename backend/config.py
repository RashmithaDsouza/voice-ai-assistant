"""
Voice AI Assistant — Backend Configuration
"""

import os
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)

TEMP_DIR = BASE_DIR / "tmp"
TEMP_DIR.mkdir(exist_ok=True)

# ── Whisper (STT) ───────────────────────────────────────────────
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL", "base")      # tiny | base | small | medium | large-v3
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")           # cpu | cuda
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE", "int8")   # int8 | float16 | float32
WHISPER_LANGUAGE = os.getenv("WHISPER_LANG", None)            # None = auto-detect, "en", "hi", etc.

# ── Ollama (LLM) ────────────────────────────────────────────────
OLLAMA_BASE_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")     # lightweight default
OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "120"))
OLLAMA_SYSTEM_PROMPT = os.getenv("OLLAMA_SYSTEM_PROMPT", (
    "You are a helpful, friendly voice assistant. Keep responses concise and conversational "
    "(2-3 sentences max) since your replies will be spoken aloud. Be natural and warm."
))

# ── Piper (TTS) ─────────────────────────────────────────────────
PIPER_VOICE = os.getenv("PIPER_VOICE", "en_US-lessac-medium")
PIPER_SPEAKER_ID = int(os.getenv("PIPER_SPEAKER", "0"))
PIPER_LENGTH_SCALE = float(os.getenv("PIPER_SPEED", "1.0"))  # < 1 = faster, > 1 = slower

# ── Server ───────────────────────────────────────────────────────
MAX_AUDIO_SIZE_MB = int(os.getenv("MAX_AUDIO_MB", "25"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

# ── Conversation ─────────────────────────────────────────────────
MAX_CONVERSATION_TURNS = int(os.getenv("MAX_TURNS", "20"))
