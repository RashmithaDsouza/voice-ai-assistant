import styles from './MicrophoneButton.module.css'

/**
 * MicrophoneButton — large central button that controls voice recording.
 * @param {Object} props
 * @param {'idle'|'listening'|'processing'} props.state
 * @param {Function} props.onToggle
 * @param {boolean} props.disabled
 */
export default function MicrophoneButton({ state = 'idle', onToggle, disabled = false }) {
  const labels = {
    idle:       'Click to start speaking',
    listening:  'Listening… click to stop',
    processing: 'Processing your voice…',
  }
  const ariaLabel = labels[state] ?? 'Microphone'

  return (
    <div className={styles.wrapper}>
      {/* Ripple rings shown while listening */}
      {state === 'listening' && (
        <>
          <span className={`${styles.ring} ${styles.ring1}`} aria-hidden="true" />
          <span className={`${styles.ring} ${styles.ring2}`} aria-hidden="true" />
          <span className={`${styles.ring} ${styles.ring3}`} aria-hidden="true" />
        </>
      )}

      <button
        id="mic-button"
        className={`${styles.button} ${styles[state]}`}
        onClick={onToggle}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-pressed={state === 'listening'}
        title={ariaLabel}
      >
        {state === 'processing' ? (
          /* Spinner */
          <span className={styles.spinner} aria-hidden="true" />
        ) : state === 'listening' ? (
          /* Stop icon */
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="2"/>
          </svg>
        ) : (
          /* Microphone icon */
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4Z"/>
            <path d="M5 10a7 7 0 0 0 14 0M12 19v3M9 22h6"/>
            <style>{`path:nth-child(2),path:nth-child(3){fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}`}</style>
          </svg>
        )}
      </button>

      <p className={styles.hint}>{ariaLabel}</p>
    </div>
  )
}
