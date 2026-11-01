import { useEffect, useState } from 'react'
import { ExitFullscreenIcon, FullscreenIcon, RotateIcon } from './icons'
import { useLang } from '@/lib/language'

type ElementWithFs = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }
type DocumentWithFs = Document & { webkitExitFullscreen?: () => void; webkitFullscreenElement?: Element | null }

function currentFullscreenElement(): Element | null {
  const doc = document as DocumentWithFs
  return doc.fullscreenElement || doc.webkitFullscreenElement || null
}

function isSupported(): boolean {
  const doc = document as DocumentWithFs
  const root = document.documentElement as ElementWithFs
  return typeof root.requestFullscreen === 'function' || typeof root.webkitRequestFullscreen === 'function' || typeof doc.webkitExitFullscreen === 'function'
}

export default function SiteFullscreenButton() {
  const { t } = useLang()
  const [available, setAvailable] = useState(false)
  const [active, setActive] = useState(false)
  const [portrait, setPortrait] = useState(false)
  const [rolled, setRolled] = useState(false)

  useEffect(() => {
    setAvailable(isSupported())
    const onChange = () => setActive(Boolean(currentFullscreenElement()))
    const onResize = () => setPortrait(window.innerHeight > window.innerWidth)
    onChange()
    onResize()
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  if (!available) return null

  const toggle = () => {
    const doc = document as DocumentWithFs
    const root = document.documentElement as ElementWithFs
    if (currentFullscreenElement()) {
      if (typeof doc.exitFullscreen === 'function') void doc.exitFullscreen().catch(() => {})
      else doc.webkitExitFullscreen?.()
      return
    }
    if (typeof root.requestFullscreen === 'function') void root.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
    else root.webkitRequestFullscreen?.()
  }

  /* Turning the page sideways. Android lets a fullscreen page ask for landscape and the whole
     window follows; everywhere else that call is refused, so the page rolls itself instead and
     the viewer reads the same layout on its side. One press out, the next press back. */
  const roll = () => {
    const orientation = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void>; unlock?: () => void }) | undefined
    if (rolled) {
      orientation?.unlock?.()
      document.documentElement.classList.remove('site-landscape')
      setRolled(false)
      return
    }
    if (orientation?.lock) {
      orientation.lock('landscape').then(
        () => setRolled(false),
        () => { document.documentElement.classList.add('site-landscape'); setRolled(true) },
      )
      return
    }
    document.documentElement.classList.add('site-landscape')
    setRolled(true)
  }

  return (
    <>
      {active && portrait ? (
        <button
          type="button"
          className={`site-rotate ${rolled ? 'on' : ''}`}
          onClick={roll}
          aria-label={t('player.rotate')}
          aria-pressed={rolled}
          title={t('player.rotate')}
        >
          <RotateIcon size={18} />
        </button>
      ) : null}
      <button
        type="button"
        className={`site-fullscreen ${active ? 'on' : ''}`}
        onClick={toggle}
        aria-label={t('player.fullscreen')}
        aria-pressed={active}
        title={t('player.fullscreen')}
      >
        {active ? <ExitFullscreenIcon size={18} /> : <FullscreenIcon size={18} />}
      </button>
    </>
  )
}
