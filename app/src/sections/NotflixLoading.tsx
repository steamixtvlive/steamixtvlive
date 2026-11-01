import { useEffect, useState } from 'react'
import NotflixLogo from '@/sections/NotflixLogo'
import { subscribeLoading, type LoadingState } from '@/lib/loading-bus'
import { useLang } from '@/lib/language'
import './notflix-loading.css'

const HINT_KEYS = ['loading.line1', 'loading.line2', 'loading.line3'] as const

/** Covers the shell while the first server answer is late, then steps down to a hairline rail
    for every later request so a slow stream never hides the picture. */
export default function NotflixLoading() {
  const { t } = useLang()
  const [state, setState] = useState<LoadingState>({ mode: 'idle', pending: 0 })
  const [hint, setHint] = useState(0)

  useEffect(() => subscribeLoading(setState), [])

  useEffect(() => {
    if (state.mode !== 'takeover') return
    const timer = window.setInterval(() => setHint((value) => (value + 1) % HINT_KEYS.length), 2600)
    return () => window.clearInterval(timer)
  }, [state.mode])

  if (state.mode === 'idle') return null

  if (state.mode === 'rail') {
    return <div className="nf-load-rail" aria-hidden="true"><i className="nf-load-rail__run" /></div>
  }

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
        <p className="nf-load__hint" key={hint}>{t(HINT_KEYS[hint])}</p>
      </div>
      <div className="nf-load__credit">RENDİR MEDİA</div>
    </div>
  )
}
