import asyncio
import base64
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import CORS_ORIGINS, MAX_AUDIO_SIZE_MB
from llm_service import chat, check_health
from stt_service import transcribe
from tts_service import synthesize

logger = logging.getLogger(__name__)
MAX_AUDIO_SIZE = MAX_AUDIO_SIZE_MB * 1024 * 1024


class ChatRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    message: str = Field(min_length=1, max_length=20_000)


@asynccontextmanager
async def lifespan(_: FastAPI):
    logging.basicConfig(level=logging.INFO)
    yield


app = FastAPI(title="Voice AI Assistant API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in CORS_ORIGINS if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _read_audio(file: UploadFile) -> bytes:
    audio = await file.read(MAX_AUDIO_SIZE + 1)
    if not audio:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")
    if len(audio) > MAX_AUDIO_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Audio file exceeds the {MAX_AUDIO_SIZE_MB} MB upload limit.",
        )
    return audio


def _audio_response(audio_bytes: bytes) -> dict:
    return {
        "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
        "audio_format": "wav",
    }


async def _generate_speech(text: str) -> dict:
    try:
        result = await asyncio.to_thread(synthesize, text)
    except Exception as exc:
        logger.exception("Text-to-speech synthesis failed")
        return {
            "audio_base64": None,
            "audio_format": "wav",
            "tts_error": f"Text-to-speech failed: {exc}",
        }
    return {
        **_audio_response(result["audio_bytes"]),
        "tts_error": None,
    }


@app.get("/api/health")
async def health() -> dict:
    ollama_status = await check_health()
    return {
        "status": (
            "ok"
            if ollama_status["online"] and ollama_status.get("model_available")
            else "degraded"
        ),
        "ollama": ollama_status,
    }


@app.post("/api/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str | None = Form(default=None, max_length=16),
) -> dict:
    audio = await _read_audio(file)
    try:
        result = await asyncio.to_thread(transcribe, audio, language)
    except Exception as exc:
        logger.exception("Audio transcription failed")
        raise HTTPException(
            status_code=503,
            detail=f"Speech-to-text failed: {exc}",
        ) from exc
    return result


@app.post("/api/chat")
async def text_chat(request: ChatRequest) -> dict:
    user_text = request.message.strip()
    if not user_text:
        raise HTTPException(status_code=422, detail="Message must not be blank.")
    try:
        result = await chat(request.session_id, user_text)
    except ConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    speech = await _generate_speech(result["response"])
    return {**result, **speech}


@app.post("/api/voice-chat")
async def voice_chat(
    file: UploadFile = File(...),
    session_id: str = Form(..., min_length=1, max_length=128),
    language: str | None = Form(default=None, max_length=16),
) -> dict:
    audio = await _read_audio(file)
    try:
        transcription = await asyncio.to_thread(transcribe, audio, language)
    except Exception as exc:
        logger.exception("Audio transcription failed")
        raise HTTPException(
            status_code=503,
            detail=f"Speech-to-text failed: {exc}",
        ) from exc

    user_text = transcription["text"].strip()
    if not user_text:
        raise HTTPException(
            status_code=422,
            detail="No speech was recognized. Try speaking more clearly or closer to the microphone.",
        )

    try:
        result = await chat(session_id, user_text)
    except ConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    speech = await _generate_speech(result["response"])
    return {
        "transcription": transcription,
        **result,
        **speech,
    }
