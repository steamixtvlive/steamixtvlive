import { useEffect, useState } from 'react'
import { ExitFullscreenIcon, FullscreenIcon } from './icons'
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

  useEffect(() => {
    setAvailable(isSupported())
    const onChange = () => setActive(Boolean(currentFullscreenElement()))
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
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

  return (
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
  )
}
