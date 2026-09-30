export default function TelegramIcon({ className = 'w-6 h-6 shrink-0' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#229ED9" />
      <path
        d="M21 5.5 4 12c-.9.4-.9 1.6.1 1.9l4.4 1.4 1.7 5.3c.3.9 1.4 1 2 .2l2.7-3.3 4.6 3.4c.7.5 1.7.1 1.9-.8l2.9-13c.3-1.2-1-2.2-2.3-1.6z"
        fill="#fff"
      />
    </svg>
  )
}
