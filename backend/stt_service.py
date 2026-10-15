"""
STT Service — Faster-Whisper speech-to-text
"""

import io
import logging
import time

from faster_whisper import WhisperModel

from config import (
    WHISPER_MODEL_SIZE,
    WHISPER_DEVICE,
    WHISPER_COMPUTE_TYPE,
    WHISPER_LANGUAGE,
    MODELS_DIR,
)

logger = logging.getLogger(__name__)

_model: WhisperModel | None = None


def load_model() -> WhisperModel:
    """Load Whisper model (cached singleton)."""
    global _model
    if _model is not None:
        return _model

    model_dir = str(MODELS_DIR / "whisper")
    logger.info(
        "Loading Faster-Whisper model=%s device=%s compute=%s",
        WHISPER_MODEL_SIZE, WHISPER_DEVICE, WHISPER_COMPUTE_TYPE,
    )
    start = time.time()
    _model = WhisperModel(
        WHISPER_MODEL_SIZE,
        device=WHISPER_DEVICE,
        compute_type=WHISPER_COMPUTE_TYPE,
        download_root=model_dir,
    )
    logger.info("Whisper model loaded in %.1fs", time.time() - start)
    return _model


def transcribe(audio_bytes: bytes, language: str | None = None) -> dict:
    """
    Transcribe audio bytes to text.

    Returns:
        dict with keys: text, language, duration, segments
    """
    model = load_model()
    lang = language or WHISPER_LANGUAGE

    start = time.time()
    segments_gen, info = model.transcribe(
        io.BytesIO(audio_bytes),
        language=lang,
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500),
    )

    segments = []
    full_text_parts = []
    for seg in segments_gen:
        segments.append({
            "start": round(seg.start, 2),
            "end": round(seg.end, 2),
            "text": seg.text.strip(),
        })
        full_text_parts.append(seg.text.strip())

    full_text = " ".join(full_text_parts)
    elapsed = time.time() - start

    logger.info(
        "STT complete: lang=%s duration=%.1fs latency=%.2fs text=%s",
        info.language, info.duration, elapsed, full_text[:80],
    )

    return {
        "text": full_text,
        "language": info.language,
        "language_probability": round(info.language_probability, 3),
        "duration": round(info.duration, 2),
        "latency": round(elapsed, 3),
        "segments": segments,
    }
