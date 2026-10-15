import styles from './ErrorBanner.module.css'

/**
 * ErrorBanner — dismissable error notification strip.
 * @param {Object}   props
 * @param {string}   props.message
 * @param {Function} props.onDismiss
 */
export default function ErrorBanner({ message, onDismiss }) {
  if (!message) return null

  return (
    <div className={styles.banner} role="alert" aria-live="assertive">
      <div className={styles.inner}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <circle cx="12" cy="16" r="0.5" fill="currentColor" strokeWidth="0"/>
        </svg>
        <p className={styles.text}>{message}</p>
      </div>
      <button
        id="dismiss-error-button"
        className={styles.dismiss}
        onClick={onDismiss}
        aria-label="Dismiss error"
        title="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6"  y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}
