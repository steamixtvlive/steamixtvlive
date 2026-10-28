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
  startDelay?: number
  stagger?: number
  className?: string
}

export default function NotflixLogo({
  animated = false,
  startDelay = 0.8,
  stagger = 0.4,
  className = '',
}: NotflixLogoProps) {
  return (
    <h1
      className={`notflix-logo ${animated ? 'notflix-logo--animated' : ''} ${className}`.trim()}
      aria-label="NOTFLİX"
    >
      {LETTERS.map(({ char, offset }, index) => (
        <span
          key={`${char}-${index}`}
          className="notflix-logo__letter"
          style={{
            top: offset,
            animationDelay: animated
              ? `${startDelay + index * stagger + (index >= 3 ? 0.18 : 0)}s`
              : undefined,
          }}
        >
          {char}
        </span>
      ))}
    </h1>
  )
}
