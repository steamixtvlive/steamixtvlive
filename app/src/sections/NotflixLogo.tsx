import { LETTER_AT } from '@/lib/splash-timing'

const LETTERS = [
  { char: 'N', offset: '0.032em' },
  { char: 'O', offset: '0.010em' },
  { char: 'T', offset: '-0.004em' },
  { char: 'F', offset: '-0.008em' },
  { char: 'L', offset: '0.006em' },
  { char: 'İ', offset: '0.020em' },
  { char: 'X', offset: '0.038em' },
] as const

interface NotflixLogoProps {
  animated?: boolean
  className?: string
}

export default function NotflixLogo({ animated = false, className = '' }: NotflixLogoProps) {
  return (
    <h1
      className={`notflix-logo ${animated ? 'notflix-logo--animated' : ''} ${className}`.trim()}
      aria-label="NOTFLİX"
    >
      {LETTERS.map(({ char, offset }, index) => (
        <span
          key={`${char}-${index}`}
          /* Bebas Neue has no dotted capital İ, so the mark draws its own dot. */
          className={`notflix-logo__letter${char === 'İ' ? ' notflix-logo__letter--idot' : ''}`}
          style={{
            top: offset,
            animationDelay: animated ? `${LETTER_AT[index]}s` : undefined,
          }}
        >
          {char === 'İ' ? 'I' : char}
        </span>
      ))}
    </h1>
  )
}
