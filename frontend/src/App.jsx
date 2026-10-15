import { useState, useRef, useEffect } from 'react'
import Header from './components/Header.jsx'
import ConversationArea from './components/ConversationArea.jsx'
import ErrorBanner from './components/ErrorBanner.jsx'
import AudioPlayer from './components/AudioPlayer.jsx'
import styles from './App.module.css'

const SESSION_STORAGE_KEY = 'voice-assistant-session-id'

function createSessionId() {
  return window.crypto.randomUUID()
}

async function readApiResponse(response) {
  const result = await response.json()
  if (!response.ok) {
    const detail = result?.detail
    const message = typeof detail === 'string'
      ? detail
      : detail
        ? JSON.stringify(detail)
        : `Request failed (${response.status})`
    throw new Error(message)
  }
  return result
}

function decodeAudio(audioBase64) {
  const binary = window.atob(audioBase64)
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
}

export default function App() {
  const [messages, setMessages] = useState([])
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [audioUrl, setAudioUrl] = useState('')
  const [responseAudioUrl, setResponseAudioUrl] = useState('')
  const [sessionId, setSessionId] = useState(() => {
    const savedSessionId = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (savedSessionId) return savedSessionId
    const newSessionId = createSessionId()
    window.localStorage.setItem(SESSION_STORAGE_KEY, newSessionId)
    return newSessionId
  })
  const recorder = useRef(null)
  const chunks = useRef([])
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const inputRef = useRef(null)
  const sendAfterRecording = useRef(false)
  const discardRecording = useRef(false)

  useEffect(() => {
    if (!recording) return
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(timerRef.current)
  }, [recording])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  useEffect(() => () => {
    if (responseAudioUrl) URL.revokeObjectURL(responseAudioUrl)
  }, [responseAudioUrl])

  async function startRecording() {
    try {
      setError('')
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone unavailable. Use localhost or HTTPS.')
      }
      if (!window.MediaRecorder) {
        throw new Error('Audio recording is not supported by this browser.')
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunks.current = []
      const mediaRecorder = new MediaRecorder(stream)
      recorder.current = mediaRecorder

      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) chunks.current.push(event.data)
      }
      mediaRecorder.onstop = () => {
        const audio = new Blob(chunks.current, { type: mediaRecorder.mimeType })
        stream.getTracks().forEach(track => track.stop())
        setRecording(false)
        if (!discardRecording.current && audio.size > 0) {
          const url = URL.createObjectURL(audio)
          setAudioUrl(previous => {
            if (previous) URL.revokeObjectURL(previous)
            return url
          })
          if (sendAfterRecording.current) {
            void sendVoiceMessage(audio)
          }
        } else if (sendAfterRecording.current) {
          setError('No audio was recorded. Please try again.')
        }
        sendAfterRecording.current = false
        discardRecording.current = false
      }
      mediaRecorder.start()
      setSeconds(0)
      setRecording(true)
    } catch (err) {
      setError(err.message || 'Could not access microphone. Check browser permission.')
    }
  }

  function stopRecording(send = false, discard = false) {
    sendAfterRecording.current = send
    discardRecording.current = discard
    if (recorder.current?.state === 'recording') recorder.current.stop()
    setRecording(false)
  }

  async function sendMessage(event) {
    event?.preventDefault()
    const value = text.trim()
    if (!value || processing) return

    setMessages(previous => [...previous, {
      id: Date.now(),
      role: 'user',
      text: value,
      timestamp: new Date().toISOString()
    }])
    setText('')
    setProcessing(true)
    setError('')
    setResponseAudioUrl('')

    try {
      const result = await readApiResponse(await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: value })
      }))
      setMessages(previous => [...previous, {
        id: Date.now() + 1,
        role: 'assistant',
        text: result.response,
        timestamp: new Date().toISOString()
      }])
      if (result.audio_base64) {
        setResponseAudioUrl(decodeAudio(result.audio_base64))
      }
      if (result.tts_error) setError(result.tts_error)
    } catch (err) {
      setError(err.message || 'Could not send your message.')
    } finally {
      setProcessing(false)
    }
  }

  async function sendVoiceMessage(audio) {
    if (!audio.size) {
      setError('No audio was recorded. Please try again.')
      return
    }

    const extension = audio.type.includes('mp4')
      ? 'mp4'
      : audio.type.includes('ogg')
        ? 'ogg'
        : 'webm'
    const formData = new FormData()
    formData.append('file', audio, `recording.${extension}`)
    formData.append('session_id', sessionId)

    setProcessing(true)
    setError('')
    setResponseAudioUrl('')
    try {
      const result = await readApiResponse(await fetch('/api/voice-chat', {
        method: 'POST',
        body: formData
      }))
      const transcription = result.transcription?.text?.trim()
      if (!transcription) {
        throw new Error('The backend returned no transcription.')
      }
      setMessages(previous => [
        ...previous,
        {
          id: Date.now(),
          role: 'user',
          text: transcription,
          timestamp: new Date().toISOString()
        },
        {
          id: Date.now() + 1,
          role: 'assistant',
          text: result.response,
          timestamp: new Date().toISOString()
        }
      ])
      if (result.audio_base64) {
        setResponseAudioUrl(decodeAudio(result.audio_base64))
      }
      if (result.tts_error) setError(result.tts_error)
    } catch (err) {
      setError(err.message || 'Could not process your recording.')
    } finally {
      setProcessing(false)
    }
  }

  function clearConversation() {
    setMessages([])
    setText('')
    setError('')
    const newSessionId = createSessionId()
    window.localStorage.setItem(SESSION_STORAGE_KEY, newSessionId)
    setSessionId(newSessionId)
    setAudioUrl(previous => {
      if (previous) URL.revokeObjectURL(previous)
      return ''
    })
    setResponseAudioUrl('')
  }

  function deleteRecording() {
    setAudioUrl(previous => {
      if (previous) URL.revokeObjectURL(previous)
      return ''
    })
  }

  const timerDisplay = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <div className={styles.layout}>
      {/* Background glow effects */}
      <div className={`${styles.glow} ${styles.glowOne}`} />
      <div className={`${styles.glow} ${styles.glowTwo}`} />
      <div className={`${styles.glow} ${styles.glowThree}`} />

      <Header />

      <main className={styles.main}>
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

        {/* Chat area or welcome */}
        <section className={styles.content}>
          {messages.length > 0 ? (
            <ConversationArea messages={messages} isLoading={processing} />
          ) : (
            <div className={styles.welcome}>
              <div className={styles.orbWrap}>
                <div className={styles.orbGlow} />
                <div className={styles.orb}>
                  <span className={styles.orbCore} />
                </div>
              </div>
              <h1 className={styles.title}>AI Chatbot</h1>
              <p className={styles.subtitle}>Ask anything</p>
            </div>
          )}
        </section>

        <AudioPlayer audioUrl={responseAudioUrl} />

        {/* Recorded audio preview */}
        {audioUrl && (
          <div className={styles.recordedAudio}>
            <span>Recorded audio</span>
            <audio controls src={audioUrl} />
            <button onClick={deleteRecording}>Delete</button>
          </div>
        )}

        {/* Composer / Input area */}
        <section className={styles.bottomPanel}>
          <div className={styles.composer}>
            <form onSubmit={sendMessage} className={styles.inputForm}>
              <textarea
                ref={inputRef}
                value={text}
                onChange={event => setText(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Ask anything..."
                rows={1}
                aria-label="Type your message"
                disabled={processing || recording}
              />
              <div className={styles.toolbar}>
                <div className={styles.tools}>
                  <button type="button" className={styles.iconBtn} title="Attach file" disabled={processing || recording}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                  <button type="button" className={styles.iconBtn} title="Web search" disabled={processing || recording}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
                    </svg>
                  </button>
                  <span className={styles.sep} />
                  <button type="button" className={styles.iconBtn} title="AI Settings" disabled={processing || recording}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="M12 20V10M18 20V4M6 20v-4" />
                    </svg>
                  </button>
                  <button type="button" className={styles.iconBtn} title="Code mode" disabled={processing || recording}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                    </svg>
                  </button>
                </div>

                <div className={styles.rightTools}>
                  <button
                    type="button"
                    className={`${styles.micSmall} ${recording ? styles.micSmallActive : ''}`}
                    onClick={recording ? stopRecording : startRecording}
                    disabled={processing}
                    title={recording ? 'Stop recording' : 'Start voice input'}
                  >
                    {recording ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="9" y="2" width="6" height="13" rx="3" />
                        <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M9 22h6" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>



          {/* Footer */}
          <footer className={styles.footer}>
            {messages.length > 0 && (
              <button onClick={clearConversation} disabled={processing}>Clear chat</button>
            )}
          </footer>
        </section>
      </main>

      {/* ========= RECORDING OVERLAY ========= */}
      {recording && (
        <div className={styles.overlay}>
          <div className={styles.bigMicShell}>
            <div className={styles.bigRing} />
            <div className={styles.bigRingPulse} />
            <div className={styles.bigMic}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="2" width="6" height="13" rx="3" />
                <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M9 22h6" />
              </svg>
            </div>
          </div>

          <div className={styles.timer}>
            <span className={styles.liveDot} />
            <span>{timerDisplay}</span>
          </div>
          <p className={styles.recLabel}>Recording in progress...</p>

          <div className={styles.actions}>
            <button className={styles.btnDelete} onClick={() => { stopRecording(false, true); deleteRecording() }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
              Delete
            </button>
            <button className={styles.btnStop} onClick={stopRecording}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
              </svg>
              Stop
            </button>
            <button className={styles.btnSend} onClick={() => { stopRecording(true) }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
              </svg>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}