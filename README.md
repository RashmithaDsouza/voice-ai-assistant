# Voice AI Assistant

## Overview

Voice AI Assistant is a local application with a React and Vite frontend and a Python and FastAPI backend. It supports text and microphone input, speech transcription, local LLM responses, and spoken audio output in English or Hindi.

The speech-to-text pipeline uses Faster-Whisper, chat responses use Ollama, and text-to-speech uses Piper. See [ARCHITECTURE.md](ARCHITECTURE.md) for additional design details.

## Features

- Text chat and browser microphone recording
- English and Hindi language selection
- Faster-Whisper speech transcription
- Ollama chat with in-memory conversation history
- Piper speech synthesis using language-specific voices
- Automatic playback when permitted by the browser, with a manual playback control
- API error handling for invalid audio, failed requests, and speech synthesis failures

## Limitations

- Language selection is manual; automatic language detection is not implemented.
- Voice activity detection and silence-based recording termination are not implemented.
- Playback interruption is not supported.
- Production latency metrics and benchmarking are not implemented.
- Automated backend and frontend tests are not included.
- The complete microphone-to-playback workflow has not been validated as a single end-to-end browser test.

## Technology Stack

| Component | Technology |
| --- | --- |
| Frontend | React 18, Vite 5, JavaScript |
| Backend | Python, FastAPI, Uvicorn |
| Speech-to-text | Faster-Whisper (`base` model by default) |
| Chat | Ollama (`qwen2.5:3b` by default) |
| Text-to-speech | Piper (`en_US-lessac-medium` and `hi_IN-rohan-medium`) |

## Prerequisites

The setup instructions target Windows and require:

- Python 3.11 and the Python launcher (`py`)
- Node.js and npm
- Ollama
- A browser with microphone access
- Network access to download models that are not already cached

## Setup

### 1. Create and activate the Python environment

In Windows PowerShell, run:

```powershell
Set-Location "C:\Users\hp\voice assistant"
if (-not (Test-Path .venv)) { py -3.11 -m venv .venv }
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
```

### 2. Start Ollama and download the chat model

If Ollama is not already running, start it in a separate PowerShell terminal:

```powershell
ollama serve
```

In another terminal, download the configured model once:

```powershell
ollama pull qwen2.5:3b
```

### 3. Start the backend

In a new PowerShell terminal:

```powershell
Set-Location "C:\Users\hp\voice assistant\backend"
..\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### 4. Start the frontend

In another PowerShell terminal:

```powershell
Set-Location "C:\Users\hp\voice assistant\frontend"
npm install
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/) in your browser. Allow microphone access when prompted to use voice input.

## Configuration

Configuration is defined in `backend/config.py` and can be overridden with environment variables.

| Variable | Default | Description |
| --- | --- | --- |
| `WHISPER_MODEL` | `base` | Faster-Whisper model size |
| `WHISPER_DEVICE` | `cpu` | Inference device (`cpu` or `cuda`) |
| `WHISPER_COMPUTE` | `int8` | Whisper compute type |
| `WHISPER_LANG` | `None` | Fallback language for direct service use; API requests default to English |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Ollama chat model |
| `OLLAMA_TIMEOUT` | `120` | Ollama request timeout in seconds |
| `PIPER_VOICE` | `en_US-lessac-medium` | English Piper voice |
| `PIPER_HINDI_VOICE` | `hi_IN-rohan-medium` | Hindi Piper voice; downloaded on first use if missing |
| `PIPER_SPEAKER` | `0` | Piper speaker ID |
| `PIPER_SPEED` | `1.0` | Piper speech speed scale |
| `MAX_AUDIO_MB` | `25` | Maximum audio upload size |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Allowed browser origins |
| `MAX_TURNS` | `20` | Maximum conversation turns retained per session |

## API Endpoints

All routes are defined in `backend/main.py`. Language inputs accept only `en` (English) and `hi` (Hindi). If omitted, the language defaults to English.

### `GET /api/health`

Checks whether Ollama is reachable and the configured model is available. The response status is `degraded` if either check fails.

### `POST /api/transcribe`

Accepts multipart form fields:

- `file` (required): audio file
- `language` (optional): `en` or `hi`

Returns the recognized text, detected language, and transcription metadata. An empty file returns HTTP 400, an oversized file returns HTTP 413, and transcription failures return HTTP 503.

### `POST /api/chat`

Accepts a JSON request:

```json
{
  "session_id": "abc123",
  "message": "Hello there",
  "language": "en"
}
```

Returns the assistant response, model and latency metadata, and a WAV audio payload when speech synthesis succeeds. Hindi responses are checked for Devanagari script, retried once if needed, and replaced with a Hindi fallback if the retry fails validation. If speech synthesis fails, the text response is still returned and `tts_error` describes the failure.

### `POST /api/voice-chat`

Accepts multipart form fields:

- `file` (required): recorded audio
- `session_id` (required): conversation identifier
- `language` (optional): `en` or `hi`

Returns the transcription, assistant response, and a WAV audio payload when speech synthesis succeeds.

## Usage

1. Start Ollama, the backend, and the frontend using the setup steps above.
2. Open `http://localhost:5173/`.
3. Select **English** or **हिन्दी**.
4. Type a message or record an audio message with the microphone button.
5. Use the Play control if browser autoplay is blocked.
6. Select **Clear conversation** to start a new chat with fresh conversation context.

## Troubleshooting

### Microphone access

- Allow microphone access when the browser prompts.
- Use `localhost` or `127.0.0.1`; microphone access may be restricted on other origins.
- Confirm the browser supports `MediaRecorder` if recording is unavailable.

### Transcription

- Check that the recording is not empty and is within the configured upload limit.
- Confirm the backend is running and the Faster-Whisper model is available or downloadable.
- Speak clearly and close to the microphone.

### Ollama

- Confirm Ollama is running with `ollama serve`.
- Check installed models with `ollama list` and verify the configured model is present.
- Check `GET /api/health` for service and model status.

### Speech synthesis

- Confirm `piper-tts` is installed in the backend environment.
- The Hindi voice (`hi_IN-rohan-medium`, approximately 63 MB) is downloaded on the first Hindi speech request. That request may take longer.
- If speech synthesis fails, check the backend terminal for details; the assistant text remains available in the response.

## Validation

The repository does not currently include an automated test suite. Use this manual checklist:

1. Start Ollama, the backend, and the frontend.
2. Check `GET /api/health`.
3. Send a text message in English and Hindi.
4. Record and send a short audio clip in each language.
5. Confirm transcription, assistant responses, and audio playback.