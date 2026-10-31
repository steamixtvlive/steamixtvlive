import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import NotflixLogo from '@/sections/NotflixLogo'
import { useLang } from '@/lib/language'
import { checkActivationCode } from '@/geil/storage'

export default function NotflixActivation({ onActivated }: { onActivated: () => void }) {
  const { t } = useLang()
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const shakeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (checking || !code.trim()) return
    setChecking(true)
    if (checkActivationCode(code)) {
      onActivated()
      return
    }
    setError(true)
    setChecking(false)
    shakeRef.current?.classList.remove('is-shaking')
    // The class is toggled off/on so the same mistake replays the animation.
    requestAnimationFrame(() => shakeRef.current?.classList.add('is-shaking'))
    inputRef.current?.select()
  }

  return (
    <div className="nf-activation fixed inset-0 z-[9999] overflow-hidden bg-black" aria-label={t('activation.title')}>
      <style>{`
        .nf-activation {
          isolation: isolate;
          display: grid;
          place-items: center;
          padding: clamp(24px, 5vw, 64px);
          font-family: 'Inter', sans-serif;
          animation: nfActivationIn .7s ease-out both;
        }
        .nf-activation__glow {
          position: absolute;
          inset: -20%;
          pointer-events: none;
          background:
            radial-gradient(ellipse at 50% 38%, rgba(229,9,20,.24) 0%, rgba(229,9,20,.06) 40%, transparent 68%),
            radial-gradient(ellipse at 50% 118%, rgba(110,0,0,.28), transparent 58%);
          animation: nfActivationGlow 9s ease-in-out infinite alternate;
        }
        .nf-activation__grain {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: .05;
          mix-blend-mode: screen;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E");
        }
        .nf-activation__card {
          position: relative;
          z-index: 2;
          width: min(520px, 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 22px;
          padding: clamp(28px, 5vw, 46px) clamp(22px, 5vw, 44px);
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 26px;
          background: linear-gradient(180deg, rgba(24,24,27,.92), rgba(9,9,11,.94));
          box-shadow: 0 40px 120px rgba(0,0,0,.7), 0 0 0 1px rgba(229,9,20,.06) inset;
          backdrop-filter: blur(20px);
          animation: nfActivationCard .8s cubic-bezier(.2,.8,.2,1) both;
        }
        .nf-activation__card.is-shaking { animation: nfActivationShake .42s cubic-bezier(.36,.07,.19,.97) both; }
        .nf-activation__brand { --notflix-logo-size: clamp(30px, 6vw, 44px); }
        .nf-activation__brand .notflix-logo { margin: 0; }
        .nf-activation__title {
          margin: 0;
          color: #fff;
          font-size: clamp(19px, 3.4vw, 25px);
          font-weight: 700;
          letter-spacing: -.01em;
          text-align: center;
          line-height: 1.25;
        }
        .nf-activation__sub {
          margin: -12px 0 0;
          color: rgba(255,255,255,.52);
          font-size: 13.5px;
          line-height: 1.55;
          text-align: center;
          max-width: 38ch;
        }
        .nf-activation__form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .nf-activation__field {
          display: flex;
          gap: 10px;
          align-items: stretch;
        }
        .nf-activation__input {
          flex: 1;
          min-width: 0;
          padding: 15px 18px;
          border: 1px solid rgba(255,255,255,.14);
          border-radius: 14px;
          background: rgba(255,255,255,.04);
          color: #fff;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 15px;
          letter-spacing: .22em;
          text-transform: uppercase;
          transition: border-color .2s ease, background .2s ease, box-shadow .2s ease;
        }
        .nf-activation__input::placeholder { color: rgba(255,255,255,.3); letter-spacing: .12em; }
        .nf-activation__input:focus {
          outline: none;
          border-color: rgba(229,9,20,.7);
          background: rgba(229,9,20,.06);
          box-shadow: 0 0 0 4px rgba(229,9,20,.14);
        }
        .nf-activation__input.has-error { border-color: rgba(229,9,20,.85); }
        .nf-activation__submit {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 0 22px;
          border: none;
          border-radius: 14px;
          background: linear-gradient(180deg, #e50914, #b0060f);
          color: #fff;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: .01em;
          cursor: pointer;
          white-space: nowrap;
          box-shadow: 0 14px 32px rgba(229,9,20,.28);
          transition: transform .2s ease, box-shadow .2s ease, filter .2s ease;
        }
        .nf-activation__submit:hover { transform: translateY(-1px); filter: brightness(1.07); }
        .nf-activation__submit:active { transform: translateY(0); }
        .nf-activation__submit:focus-visible { outline: 2px solid rgba(255,255,255,.7); outline-offset: 3px; }
        .nf-activation__submit:disabled { opacity: .55; cursor: default; transform: none; }
        .nf-activation__error {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #ff5c66;
          font-size: 12.5px;
          font-weight: 600;
          min-height: 18px;
          margin: 0;
        }
        .nf-activation__foot {
          display: flex;
          align-items: center;
          gap: 7px;
          color: rgba(255,255,255,.36);
          font-size: 11px;
          letter-spacing: .04em;
          text-align: center;
        }
        @keyframes nfActivationIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nfActivationGlow { from { opacity: .78; transform: scale(1); } to { opacity: 1; transform: scale(1.05); } }
        @keyframes nfActivationCard {
          from { opacity: 0; transform: translateY(18px) scale(.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes nfActivationShake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(4px); }
          30%, 50%, 70% { transform: translateX(-7px); }
          40%, 60% { transform: translateX(7px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .nf-activation, .nf-activation__card, .nf-activation__glow { animation: none !important; }
        }
        @media (max-width: 480px) {
          .nf-activation__field { flex-direction: column; }
          .nf-activation__submit { padding: 15px 22px; }
        }
      `}</style>

      <div className="nf-activation__glow" />
      <div className="nf-activation__grain" />

      <div className="nf-activation__card" ref={shakeRef}>
        <div className="nf-activation__brand">
          <NotflixLogo />
        </div>
        <h1 className="nf-activation__title">{t('activation.title')}</h1>
        <p className="nf-activation__sub">{t('activation.subtitle')}</p>

        <form className="nf-activation__form" onSubmit={submit}>
          <div className="nf-activation__field">
            <input
              ref={inputRef}
              className={`nf-activation__input${error ? ' has-error' : ''}`}
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase())
                if (error) setError(false)
              }}
              placeholder={t('activation.placeholder')}
              aria-label={t('activation.placeholder')}
              aria-invalid={error}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={24}
            />
            <button type="submit" className="nf-activation__submit" disabled={!code.trim()}>
              <span>{t('activation.submit')}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="nf-activation__error" role={error ? 'alert' : undefined}>
            {error ? `${t('activation.invalid')}` : ''}
          </p>
        </form>

        <div className="nf-activation__foot">
          <ShieldCheck size={13} aria-hidden="true" />
          <span>{t('activation.hint')}</span>
        </div>
      </div>
    </div>
  )
}
