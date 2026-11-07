"""Piper text-to-speech synthesis for English and Hindi."""

import io
import logging
import threading
import time
import wave
from pathlib import Path
from typing import Callable

logger = logging.getLogger(__name__)

_synthesizers: dict[str, Callable[[str], bytes]] = {}
_voice_lock = threading.Lock()


def _load_piper(language: str) -> Callable[[str], bytes]:
    """Load and cache the Piper voice for the selected language."""
    from config import PIPER_HINDI_VOICE, PIPER_LENGTH_SCALE, PIPER_SPEAKER_ID, PIPER_VOICE

    voice_name = {"en": PIPER_VOICE, "hi": PIPER_HINDI_VOICE}.get(language)
    if voice_name is None:
        raise ValueError("Language must be English (en) or Hindi (hi).")

    with _voice_lock:
        if voice_name in _synthesizers:
            return _synthesizers[voice_name]

        try:
            from piper import PiperVoice
            from piper.config import SynthesisConfig
            from piper.download_voices import download_voice

            data_dir = Path(__file__).parent / "models" / "piper"
            data_dir.mkdir(parents=True, exist_ok=True)
            model_path = data_dir / f"{voice_name}.onnx"
            config_path = data_dir / f"{voice_name}.onnx.json"
            if not model_path.is_file() or not config_path.is_file():
                download_voice(voice_name, data_dir)

            logger.info("Loading Piper voice: %s", voice_name)
            start = time.time()
            voice = PiperVoice.load(str(model_path), config_path=str(config_path))
            logger.info("Piper voice loaded in %.1fs", time.time() - start)

            def synth(text: str) -> bytes:
                audio_buffer = io.BytesIO()
                with wave.open(audio_buffer, "wb") as wav_file:
                    voice.synthesize_wav(
                        text,
                        wav_file,
                        syn_config=SynthesisConfig(
                            speaker_id=PIPER_SPEAKER_ID,
                            length_scale=PIPER_LENGTH_SCALE,
                        ),
                    )
                return audio_buffer.getvalue()

            _synthesizers[voice_name] = synth
            return synth

        except ImportError as exc:
            raise RuntimeError("Piper is unavailable. Install the backend requirements.") from exc
        except Exception as exc:
            logger.exception("Failed to load Piper voice %s", voice_name)
            raise RuntimeError(f"Failed to load Piper voice {voice_name}: {exc}") from exc


def synthesize(text: str, language: str = "en") -> dict:
    """Convert text to speech audio (WAV) using the selected language voice."""
    synth = _load_piper(language)

    start = time.time()
    audio_bytes = synth(text)
    elapsed = time.time() - start

    logger.info(
        "TTS complete: language=%s latency=%.2fs text_len=%d audio_size=%d",
        language,
        elapsed,
        len(text),
        len(audio_bytes),
    )

    return {
        "audio_bytes": audio_bytes,
        "format": "wav",
        "latency": round(elapsed, 3),
        "text_length": len(text),
    }