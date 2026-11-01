import { useEffect, useState } from 'react'
import NotflixLogo from '@/sections/NotflixLogo'
import { subscribeLoading, type LoadingState } from '@/lib/loading-bus'
import { useLang } from '@/lib/language'
import './notflix-loading.css'

const HINT_KEYS = ['loading.line1', 'loading.line2', 'loading.line3'] as const
const HINT_MS = 2600

/** The ident is a cold-start ritual, not a spinner: it runs its full length on every reload and
    the shell only takes the screen once the clock is done. A viewer who has seen it a hundred
    times leaves early with the skip button, which the remote reaches like anything else. */
const INTRO_MS = 14_000

function introLength(): number {
  if (typeof window === 'undefined') return 0
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : INTRO_MS
}

/** Covers the shell while the wordmark plays and while the first server answer is late, then steps
    down to a hairline rail for every later request so a slow stream never hides the picture. */
export default function NotflixLoading({ intro: wantIntro = true }: { intro?: boolean }) {
  const { t } = useLang()
  const [state, setState] = useState<LoadingState>({ mode: 'idle', pending: 0, delivered: false })
  const [hint, setHint] = useState(0)
  const [intro, setIntro] = useState(() => wantIntro && introLength() > 0)

  // The gate and the shell share this one instance, so a viewer who has just typed their code
  // gets the ident from that moment — and the code screen is never covered by a running intro.
  useEffect(() => {
    setIntro(wantIntro && introLength() > 0)
  }, [wantIntro])

  useEffect(() => subscribeLoading(setState), [])

  useEffect(() => {
    if (!intro) return
    const timer = window.setTimeout(() => setIntro(false), introLength())
    return () => window.clearTimeout(timer)
  }, [intro])

  useEffect(() => {
    if (!intro && state.mode !== 'takeover') return
    document.documentElement.classList.add('splash-lock')
    return () => document.documentElement.classList.remove('splash-lock')
  }, [intro, state.mode])

  useEffect(() => {
    if (!(intro || state.mode === 'takeover')) return
    const timer = window.setInterval(() => setHint((value) => value + 1), HINT_MS)
    return () => window.clearInterval(timer)
  }, [intro, state.mode])

  // The three working lines carry the first part of the ident, then the screen sits on
  // 'connected' for the rest of it. A box that has not answered yet keeps the last line.
  const step = Math.min(hint, HINT_KEYS.length - 1)
  const connected = hint >= HINT_KEYS.length && state.delivered
  const hintKey = connected ? 'loading.connected' : HINT_KEYS[step]

  if (intro || state.mode === 'takeover') {
    return (
      <div className="nf-load" role="status" aria-live="polite">
        <div className="nf-load__bloom" aria-hidden="true" />
        <div className="nf-load__grid" aria-hidden="true" />
        <div className="nf-load__inner">
          <div className="nf-load__mark">
            <NotflixLogo className="nf-load__logo" />
            <span className="nf-load__bar" aria-hidden="true" />
          </div>
          <div className="nf-load__rail" aria-hidden="true">
            <i className="nf-load__rail-run" />
          </div>
          <p className="nf-load__hint" key={hintKey}>{t(hintKey)}</p>
        </div>
        {intro ? (
          <button type="button" className="nf-load__skip" onClick={() => setIntro(false)}>
            {t('splash.skip')}
          </button>
        ) : null}
        <div className="nf-load__credit">RENDİR MEDİA</div>
      </div>
    )
  }

  if (state.mode === 'rail') {
    return <div className="nf-load-rail" aria-hidden="true"><i className="nf-load-rail__run" /></div>
  }

  return null
}
