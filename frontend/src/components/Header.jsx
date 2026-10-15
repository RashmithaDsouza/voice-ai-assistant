import styles from './Header.module.css'

export default function Header() {

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.logo}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <rect x="9" y="2" width="6" height="13" rx="3" />
            <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M9 22h6" />
          </svg>
        </div>
        <div className={styles.titles}>
          <h2>Voice AI Assistant</h2>
        </div>
      </div>


    </header>
  )
}