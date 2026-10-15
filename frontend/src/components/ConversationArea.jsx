import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble.jsx'
import styles from './ConversationArea.module.css'

/**
 * ConversationArea — scrollable list of messages with empty state.
 * @param {Object}   props
 * @param {Array}    props.messages      Array of {id, role, text, timestamp}
 * @param {boolean}  props.isLoading     Show assistant typing indicator
 */
export default function ConversationArea({ messages = [], isLoading = false }) {
  const bottomRef = useRef(null)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const isEmpty = messages.length === 0 && !isLoading

  return (
    <section
      className={styles.area}
      aria-label="Conversation history"
      aria-live="polite"
      aria-relevant="additions"
    >
      {isEmpty ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon} aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
              <path d="M12 2a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4Z"/>
              <path d="M5 10a7 7 0 0 0 14 0"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
              <line x1="9"  y1="22" x2="15" y2="22"/>
            </svg>
          </div>
          <h2 className={styles.emptyTitle}>Ready to listen</h2>
          <p className={styles.emptyText}>
            Press the microphone button to speak, or type a message below.
          </p>
        </div>
      ) : (
        <div className={styles.messageList}>
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              text={msg.text}
              timestamp={msg.timestamp}
            />
          ))}
          {isLoading && (
            <MessageBubble role="assistant" isLoading />
          )}
          <div ref={bottomRef} aria-hidden="true" />
        </div>
      )}
    </section>
  )
}
