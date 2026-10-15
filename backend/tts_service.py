"""
TTS Service — Piper text-to-speech synthesis
"""

import io
import logging
import time
import wave
from pathlib import Path

logger = logging.getLogger(__name__)

_voice = None
_synthesize = None


def _load_piper():
    """Load Piper voice model (lazy singleton)."""
    global _voice, _synthesize
    if _synthesize is not None:
        return

    from config import PIPER_VOICE, PIPER_LENGTH_SCALE, PIPER_SPEAKER_ID

    try:
        from piper import PiperVoice
        from piper.config import SynthesisConfig
        from piper.download_voices import download_voice

        # Download voice if needed
        data_dir = Path(__file__).parent / "models" / "piper"
        data_dir.mkdir(parents=True, exist_ok=True)
        model_path = data_dir / f"{PIPER_VOICE}.onnx"
        config_path = data_dir / f"{PIPER_VOICE}.onnx.json"
        if not model_path.is_file() or not config_path.is_file():
            download_voice(PIPER_VOICE, data_dir)

        logger.info("Loading Piper voice: %s", PIPER_VOICE)
        start = time.time()
        _voice = PiperVoice.load(str(model_path), config_path=str(config_path))
        logger.info("Piper voice loaded in %.1fs", time.time() - start)

        def synth(text: str) -> bytes:
            audio_buffer = io.BytesIO()
            with wave.open(audio_buffer, "wb") as wav_file:
                _voice.synthesize_wav(
                    text,
                    wav_file,
                    syn_config=SynthesisConfig(
                        speaker_id=PIPER_SPEAKER_ID,
                        length_scale=PIPER_LENGTH_SCALE,
                    ),
                )
            return audio_buffer.getvalue()

        _synthesize = synth

    except ImportError as exc:
        raise RuntimeError("Piper is unavailable. Install the backend requirements.") from exc
    except Exception as exc:
        logger.exception("Failed to load Piper voice")
        raise RuntimeError(f"Failed to load Piper voice {PIPER_VOICE}: {exc}") from exc


def synthesize(text: str) -> dict:
    """
    Convert text to speech audio (WAV).

    Returns dict with: audio_bytes, format, latency
    """
    _load_piper()

    start = time.time()
    audio_bytes = _synthesize(text)
    elapsed = time.time() - start

    logger.info(
        "TTS complete: latency=%.2fs text_len=%d audio_size=%d",
        elapsed, len(text), len(audio_bytes),
    )

    return {
        "audio_bytes": audio_bytes,
        "format": "wav",
        "latency": round(elapsed, 3),
        "text_length": len(text),
    }
