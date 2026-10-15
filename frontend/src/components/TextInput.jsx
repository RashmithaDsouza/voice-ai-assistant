import { useRef, useState } from 'react'
import styles from './TextInput.module.css'

/**
 * TextInput — text message composer with Send button.
 * @param {Object}   props
 * @param {Function} props.onSend      Called with (text: string)
 * @param {boolean}  props.disabled
 */
export default function TextInput({ onSend, disabled = false }) {
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    // Send on Enter; Shift+Enter = newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e) => {
    setValue(e.target.value)
    // Auto-grow textarea
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`
    }
  }

  const canSend = value.trim().length > 0 && !disabled

  return (
    <div className={styles.wrapper} role="form" aria-label="Type a message">
      <textarea
        id="text-input"
        ref={textareaRef}
        className={styles.textarea}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Type a message… (Enter to send)"
        disabled={disabled}
        rows={1}
        aria-label="Message input"
        aria-multiline="true"
      />
      <button
        id="send-button"
        className={styles.sendBtn}
        onClick={handleSend}
        disabled={!canSend}
        aria-label="Send message"
        title="Send message (Enter)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>
  )
}
