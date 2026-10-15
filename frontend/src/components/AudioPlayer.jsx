import { useRef, useState } from 'react'
import styles from './AudioPlayer.module.css'

/**
 * AudioPlayer — shows waveform bar visualisation and playback controls.
 * Accepts an audioUrl (blob URL from backend) or shows placeholder.
 * @param {Object}  props
 * @param {string}  props.audioUrl   blob:// or data: URL for audio
 * @param {boolean} props.isLoading  TTS is being generated
 */
export default function AudioPlayer({ audioUrl = null, isLoading = false }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(false)

  const handlePlay = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
  }

  if (!audioUrl && !isLoading) return null   // hidden when nothing to show

  return (
    <div className={styles.player} role="region" aria-label="Audio response">
      <div className={styles.inner}>
        {/* Label */}
        <span className={styles.label}>
          {isLoading ? 'Generating speech…' : 'Voice Response'}
        </span>

        {/* Waveform visualisation bars */}
        <div className={styles.waveform} aria-hidden="true">
          {Array.from({ length: 20 }).map((_, i) => (
            <span
              key={i}
              className={`${styles.bar} ${playing ? styles.barActive : ''} ${isLoading ? styles.barLoading : ''}`}
              style={{ animationDelay: `${(i * 0.07).toFixed(2)}s` }}
            />
          ))}
        </div>

        {/* Controls */}
        {!isLoading && audioUrl && (
          <>
            <button
              id="audio-play-button"
              className={styles.playBtn}
              onClick={handlePlay}
              aria-label={playing ? 'Pause audio' : 'Play audio response'}
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="4" width="4" height="16" rx="1"/>
                  <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              )}
            </button>

            <audio
              ref={audioRef}
              src={audioUrl}
              onPlay={() => { setPlaying(true); setError(false) }}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onError={() => { setError(true); setPlaying(false) }}
              aria-label="AI voice response audio"
            />
          </>
        )}

        {isLoading && (
          <span className={styles.loadingSpinner} aria-hidden="true" />
        )}
      </div>

      {error && (
        <p className={styles.error} role="alert">Audio playback failed.</p>
      )}
    </div>
  )
}
