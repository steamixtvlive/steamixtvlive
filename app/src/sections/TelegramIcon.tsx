export default function TelegramIcon({ className = 'w-6 h-6 shrink-0' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#229ED9" />
      <path
        d="M17.6 7.4 6.9 11.6c-.5.2-.5.9.1 1.1l2.6.8 1 3.2c.2.5.8.5 1.1.1l1.5-1.8 2.7 2c.4.3.9.1 1-.4l1.8-7.9c.1-.6-.5-1-1.1-.5z"
        fill="#fff"
      />
    </svg>
  )
}
