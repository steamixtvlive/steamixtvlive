import { useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/language'
import { navigate } from './router'
import { isBackKey } from './tv'

// The provider site, answered from a same-origin path (see app/geil-site.js) or from the
// Cloudflare worker when one is configured. Either way every stream address inside it has
// already been turned into a signed media-proxy path, so the frame never asks the browser
// for an http:// resource it would refuse to load.
const EDGE = (import.meta.env.VITE_GEIL_EDGE_URL || '').trim().replace(/\/+$/, '')
const SITE_PATH = EDGE ? `${EDGE}/` : '/api/geil/site/'

export default function ProviderView() {
  const { t } = useLang()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!ready) return
    const frame = frameRef.current
    const doc = frame?.contentDocument
    // The frame is ours to talk to while it is on our own address: its remote keys die inside
    // its own document, so the back key has to be caught there. A worker address is a different
    // origin and the browser will not let us listen — their site drives its own remote there.
    const onKeyDown = (event: KeyboardEvent) => {
      if (isBackKey(event)) navigate('#/')
    }
    doc?.addEventListener('keydown', onKeyDown)
    // A TV remote has no cursor; the first arrow press should already drive the provider site.
    frame?.focus({ preventScroll: true })
    return () => {
      doc?.removeEventListener('keydown', onKeyDown)
    }
  }, [ready])

  function reload() {
    const frame = frameRef.current
    if (!frame) return
    setReady(false)
    frame.src = `${SITE_PATH}?r=${Date.now()}`
  }

  return (
    <div className="provider-page">
      <iframe
        ref={frameRef}
        className={`provider-frame ${ready ? 'is-ready' : ''}`}
        src={SITE_PATH}
        title={t('settings.providerSite')}
        allow="fullscreen; autoplay; encrypted-media; picture-in-picture; clipboard-write"
        onLoad={() => setReady(true)}
      />
      {!ready ? <div className="provider-wait">{t('common.loading')}</div> : null}
      <div className="provider-bar">
        <button type="button" className="provider-btn" onClick={reload}>{t('site.reload')}</button>
        <button type="button" className="provider-btn" onClick={() => navigate('#/')}>{t('common.close')}</button>
      </div>
    </div>
  )
}
