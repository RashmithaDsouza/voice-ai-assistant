import styles from './MessageBubble.module.css'

/**
 * MessageBubble — a single message in the conversation.
 * @param {Object} props
 * @param {'user'|'assistant'} props.role
 * @param {string} props.text
 * @param {string} props.timestamp  ISO string
 * @param {boolean} props.isLoading show typing skeleton
 */
export default function MessageBubble({ role, text, timestamp, isLoading = false }) {
  const isUser = role === 'user'

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <article
      className={`${styles.bubble} ${isUser ? styles.user : styles.assistant}`}
      aria-label={`${isUser ? 'You' : 'Assistant'}: ${isLoading ? 'typing' : text}`}
    >
      {!isUser && (
        <div className={styles.avatar} aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4Z"/>
          </svg>
        </div>
      )}

      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.typing} aria-label="Assistant is typing">
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        ) : (
          <>
            <p className={styles.text}>{text}</p>
            {timestamp && (
              <time className={styles.time} dateTime={timestamp}>{formattedTime}</time>
            )}
          </>
        )}
      </div>

      {isUser && (
        <div className={`${styles.avatar} ${styles.userAvatar}`} aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </div>
      )}
    </article>
  )
}
