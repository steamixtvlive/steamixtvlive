import { useEffect, useState } from 'react'
import { useLang } from '@/lib/language'
import { useHashRoute } from './router'
import { sendRemoteCommand } from './api'

const CODE_KEY = 'notflix_remote_code'
const LINKED_KEY = 'notflix_remote_linked'

function readStored(key: string): string {
  try { return localStorage.getItem(key) || '' } catch { return '' }
}
function writeStored(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch { /* storage may be unavailable */ }
}

const DPAD: Array<{ command: string; label: string }> = [
  { command: 'up', label: '▲' },
  { command: 'left', label: '◀' },
  { command: 'ok', label: 'OK' },
  { command: 'right', label: '▶' },
  { command: 'down', label: '▼' },
]

export default function RemoteView() {
  const { t } = useLang()
  const route = useHashRoute()
  const [code, setCode] = useState(() => (route.query.get('code') || readStored(CODE_KEY) || '').replace(/\D/g, '').slice(0, 6))
  const [linked, setLinked] = useState(() => Boolean(code) && readStored(LINKED_KEY) === code)
  const [status, setStatus] = useState<'idle' | 'error' | 'expired'>('idle')
  const [busy, setBusy] = useState(false)
  const paired = /^\d{6}$/.test(code)

  useEffect(() => {
    writeStored(CODE_KEY, paired ? code : '')
    // The badge belongs to one specific code: edit it and the pairing claim is gone with it.
    if (linked && (!paired || readStored(LINKED_KEY) !== code)) { setLinked(false); writeStored(LINKED_KEY, '') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  async function press(command: string) {
    if (!paired || busy) return
    setBusy(true)
    try {
      await sendRemoteCommand(code, command)
      setStatus('idle')
      // The first command that lands is the proof of the pairing, so the viewer never has to
      // wonder whether the picture on the other side of the room is listening.
      setLinked(true)
      writeStored(LINKED_KEY, code)
    } catch (error) {
      const status = (error as { status?: number }).status
      if (status === 404) {
        setStatus('expired')
        setLinked(false)
        writeStored(LINKED_KEY, '')
      } else {
        setStatus('error')
      }
    } finally {
      window.setTimeout(() => setBusy(false), 120)
    }
  }

  function unlink() {
    setLinked(false)
    setStatus('idle')
    writeStored(LINKED_KEY, '')
  }

  return (
    <div className="remote-page">
      <div className="remote-card">
        <div className="remote-head">
          <span className="remote-mark">NOTFLİX</span>
          <h1>{t('remote.title')}</h1>
        </div>

        <div className="remote-pair">
          <label htmlFor="remote-code">{t('remote.enterCode')}{linked ? <span className="remote-linked">{t('remote.connected')}</span> : null}</label>
          <div className="remote-pair-row">
            <input
              id="remote-code"
              className="glass-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
            />
            <button type="button" className="btn btn-primary" onClick={() => { void press('ping') }} disabled={!paired || busy}>
              {t('remote.connect')}
            </button>
          </div>
          {status === 'expired' ? <span className="remote-note is-error">{t('remote.expired')}</span> : null}
          {status === 'error' ? <span className="remote-note is-error">{t('remote.invalid')}</span> : null}
          {linked ? (
            <button type="button" className="remote-note remote-unlink" onClick={unlink}>{t('settings.remoteStop')}</button>
          ) : null}
        </div>

        <div className={`remote-status ${status === 'error' ? 'is-error' : status === 'expired' ? 'is-error' : linked ? 'is-ok' : ''}`}>
          {status === 'error' ? t('remote.invalid') : status === 'expired' ? t('remote.expired') : linked ? t('remote.connected') : `${t('settings.remoteCode')}: ${code || '——'}`}
        </div>

        <div className="remote-pad">
          <button type="button" className="remote-btn remote-power" onClick={() => { void press('home') }} aria-label={t('remote.home')}>⌂</button>
          <button type="button" className="remote-btn" onClick={() => { void press('up') }} aria-label="up">{DPAD[0].label}</button>
          <button type="button" className="remote-btn remote-dpad-left" onClick={() => { void press('left') }} aria-label="left">{DPAD[1].label}</button>
          <button type="button" className="remote-btn remote-dpad-ok" onClick={() => { void press('ok') }} aria-label={t('remote.ok')}>{DPAD[2].label}</button>
          <button type="button" className="remote-btn remote-dpad-right" onClick={() => { void press('right') }} aria-label="right">{DPAD[3].label}</button>
          <button type="button" className="remote-btn" onClick={() => { void press('down') }} aria-label="down">{DPAD[4].label}</button>
        </div>
        <p className="remote-hint">{t('remote.dpadHint')}</p>

        <div className="remote-transport">
          <button type="button" className="remote-btn" onClick={() => { void press('rewind') }}>−10</button>
          <button type="button" className="remote-btn remote-play" onClick={() => { void press('playpause') }}>▶ ❚❚</button>
          <button type="button" className="remote-btn" onClick={() => { void press('forward') }}>+10</button>
        </div>

        <div className="remote-grid">
          <button type="button" className="remote-btn" onClick={() => { void press('back') }}>{t('remote.back')}</button>
          <button type="button" className="remote-btn" onClick={() => { void press('mute') }}>{t('remote.mute')}</button>
          <button type="button" className="remote-btn" onClick={() => { void press('voldown') }}>{t('remote.volume')} −</button>
          <button type="button" className="remote-btn" onClick={() => { void press('volup') }}>{t('remote.volume')} +</button>
          <button type="button" className="remote-btn" onClick={() => { void press('chdown') }}>{t('remote.channel')} −</button>
          <button type="button" className="remote-btn" onClick={() => { void press('chup') }}>{t('remote.channel')} +</button>
          <button type="button" className="remote-btn" onClick={() => { void press('subtitle') }}>{t('remote.subtitle')}</button>
          <button type="button" className="remote-btn" onClick={() => { void press('source') }}>{t('remote.source')}</button>
        </div>
      </div>
    </div>
  )
}
