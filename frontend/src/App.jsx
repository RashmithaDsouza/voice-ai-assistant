import { useEffect, useRef, useState } from 'react'
import styles from './App.module.css'
import ConversationArea from './components/ConversationArea.jsx'
import ErrorBanner from './components/ErrorBanner.jsx'
import MicrophoneButton from './components/MicrophoneButton.jsx'
import TextInput from './components/TextInput.jsx'

function newSessionId() {
  return globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}`
}

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.detail || `Request failed (${response.status}).`)
  }
  return payload
}

function timestamp() {
  return new Date().toISOString()
}

export default function App() {
  const [messages, setMessages] = useState([])
  const [processing, setProcessing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')
  const [backendStatus, setBackendStatus] = useState('Checking services')
    const [language, setLanguage] = useState('en')
  const sessionIdRef = useRef(newSessionId())
  const recorderRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/health', { signal: controller.signal })
      .then(readResponse)
      .then((health) => {
        if (!health.ollama?.online) setBackendStatus('Ollama offline')
        else if (!health.ollama.model_available) setBackendStatus('Model unavailable')
        else setBackendStatus('Ready')
      })
      .catch(() => {
        if (!controller.signal.aborted) setBackendStatus('Backend offline')
      })
    return () => controller.abort()
  }, [])

  const addAssistantResponse = (payload) => {
    const audioUrl = payload.audio_base64
      ? `data:audio/${payload.audio_format || 'wav'};base64,${payload.audio_base64}`
      : null

    setMessages((current) => [...current, {
      id: newSessionId(),
      role: 'assistant',
      text: payload.response || 'The assistant returned an empty response.',
      timestamp: timestamp(),
      audioUrl,
    }])

    if (payload.tts_error) setError(payload.tts_error)
    else if (!audioUrl) setError('No voice audio was returned. Check the backend TTS logs.')
  }

  const sendText = async (text) => {
    setError('')
    setProcessing(true)
    setMessages((current) => [...current, {
      id: newSessionId(), role: 'user', text, timestamp: timestamp(),
    }])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionIdRef.current, message: text, language }),
      })
      addAssistantResponse(await readResponse(response))
    } catch (requestError) {
      setError(requestError.message || 'The message could not be sent.')
    } finally {
      setProcessing(false)
    }
  }

  const sendVoice = async (audioBlob) => {
    setError('')
    setProcessing(true)
    const formData = new FormData()
    const extension = audioBlob.type.includes('ogg') ? 'ogg'
      : audioBlob.type.includes('mp4') ? 'mp4' : 'webm'
    formData.append('file', audioBlob, `recording.${extension}`)
    formData.append('session_id', sessionIdRef.current)
  formData.append('language', language)

    try {
      const response = await fetch('/api/voice-chat', { method: 'POST', body: formData })
      const payload = await readResponse(response)
      const transcript = payload.transcription?.text?.trim()
      if (transcript) {
        setMessages((current) => [...current, {
          id: newSessionId(), role: 'user', text: transcript, timestamp: timestamp(),
        }])
      }
      addAssistantResponse(payload)
    } catch (requestError) {
      setError(requestError.message || 'Voice input could not be processed.')
    } finally {
      setProcessing(false)
    }
  }

  const startRecording = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('This browser does not support microphone recording. Try a current version of Chrome or Edge.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = [
        'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4',
      ].find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks = []
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null
        setRecording(false)
        const audioBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        if (!audioBlob.size) {
          setError('No audio was recorded. Check microphone permission and try again.')
          return
        }
        void sendVoice(audioBlob)
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch (recordingError) {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setError(recordingError.message || 'Microphone access was denied.')
    }
  }

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  const toggleRecording = () => {
    if (recording) stopRecording()
    else void startRecording()
  }

  const clearConversation = () => {
    setMessages([])
    sessionIdRef.current = newSessionId()
    setError('')
  }

  const micState = processing ? 'processing' : recording ? 'listening' : 'idle'

  return (
    <div className={styles.layout}>
      <main className={styles.main}>
        <header className={styles.appHeader}>
          <div className={styles.brandGroup}>
            <span className={styles.brandMark} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="13" rx="3" />
                <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M9 22h6" />
              </svg>
            </span>
            <div>
              <h1 className={styles.brandTitle}>Voice Assistant</h1>
              <p className={styles.brandSubtitle}>Local speech, chat, and voice replies</p>
            </div>
          </div>
          <span className={styles.serviceStatus} aria-live="polite">
                      <div className={styles.languagePicker} role="group" aria-label="Assistant language">
                        <button
                          type="button"
                          className={language === 'en' ? styles.languageSelected : ''}
                          aria-pressed={language === 'en'}
                          onClick={() => setLanguage('en')}
                        >
                          English
                        </button>
                        <button
                          type="button"
                          className={language === 'hi' ? styles.languageSelected : ''}
                          aria-pressed={language === 'hi'}
                          onClick={() => setLanguage('hi')}
                        >
                          हिन्दी
                        </button>
                      </div>
            <span className={styles.statusDot} data-ready={backendStatus === 'Ready'} />
            {backendStatus}
          </span>
        </header>

        <ErrorBanner message={error} onDismiss={() => setError('')} />

        <section className={styles.conversationFrame} aria-label="Assistant conversation">
          {messages.length === 0 && !processing ? (
            <div className={styles.welcome}>
              <div className={styles.orbWrap} aria-hidden="true">
                <div className={styles.orbGlow} />
                <div className={styles.orb}><div className={styles.orbCore} /></div>
              </div>
              <h2 className={styles.title}>What can I help with?</h2>
              <p className={styles.subtitle}>Send a message or speak to start a conversation.</p>
            </div>
          ) : (
            <ConversationArea messages={messages} isLoading={processing} />
          )}
        </section>

        <footer className={styles.composerArea}>
          <div className={styles.composerRow}>
            <TextInput onSend={sendText} disabled={processing || recording} />
            <MicrophoneButton
              state={micState}
              onToggle={toggleRecording}
              disabled={processing}
            />
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              className={styles.clearChat}
              onClick={clearConversation}
              disabled={processing || recording}
            >
              Clear conversation
            </button>
          )}
        </footer>
      </main>
    </div>
  )
}