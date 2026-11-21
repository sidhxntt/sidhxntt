import styles from "./Stage.module.css";

/** "Back to homepage" pill shown above either device. */
export function BackLink() {
  return (
    <a className={styles.back} href="/">
      <span className={styles.backIcon} aria-hidden>
        <svg viewBox="0 0 16 16">
          <path d="M9.5 3.5 5 8l4.5 4.5" />
        </svg>
      </span>
      Back to homepage
    </a>
  );
}
