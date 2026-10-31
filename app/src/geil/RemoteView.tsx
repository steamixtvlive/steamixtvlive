import { useState } from 'react'
import { useLang } from '@/lib/language'
import { useHashRoute } from './router'
import { sendRemoteCommand } from './api'

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
  const [code, setCode] = useState(() => (route.query.get('code') || '').replace(/\D/g, '').slice(0, 6))
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [busy, setBusy] = useState(false)

  async function press(command: string) {
    if (!/^\d{6}$/.test(code) || busy) return
    setBusy(true)
    try {
      await sendRemoteCommand(code, command)
      setStatus('ok')
    } catch {
      setStatus('error')
    } finally {
      window.setTimeout(() => setBusy(false), 120)
    }
  }

  return (
    <div className="remote-page">
      <div className="remote-card">
        <div className="remote-head">
          <span className="remote-mark">NOTFLİX</span>
          <h1>{t('remote.title')}</h1>
        </div>
        {!/^\d{6}$/.test(code) ? (
          <div className="remote-pair">
            <label htmlFor="remote-code">{t('remote.enterCode')}</label>
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
            <button type="button" className="btn btn-primary" onClick={() => press('ok')}>{t('remote.connect')}</button>
          </div>
        ) : (
          <>
            <div className={`remote-status ${status === 'error' ? 'is-error' : status === 'ok' ? 'is-ok' : ''}`}>
              {status === 'error' ? t('remote.invalid') : status === 'ok' ? t('remote.connected') : `${t('settings.remoteCode')}: ${code}`}
            </div>
            <div className="remote-pad">
              <button type="button" className="remote-btn remote-power" onClick={() => press('home')} aria-label={t('remote.home')}>⌂</button>
              <button type="button" className="remote-btn" onClick={() => press('up')} aria-label="up">{DPAD[0].label}</button>
              <button type="button" className="remote-btn remote-dpad-left" onClick={() => press('left')} aria-label="left">{DPAD[1].label}</button>
              <button type="button" className="remote-btn remote-dpad-ok" onClick={() => press('ok')} aria-label={t('remote.ok')}>{DPAD[2].label}</button>
              <button type="button" className="remote-btn remote-dpad-right" onClick={() => press('right')} aria-label="right">{DPAD[3].label}</button>
              <button type="button" className="remote-btn" onClick={() => press('down')} aria-label="down">{DPAD[4].label}</button>
            </div>
            <div className="remote-grid">
              <button type="button" className="remote-btn" onClick={() => press('back')}>{t('remote.back')}</button>
              <button type="button" className="remote-btn" onClick={() => press('playpause')}>▶ ❚❚</button>
              <button type="button" className="remote-btn" onClick={() => press('mute')}>{t('remote.mute')}</button>
              <button type="button" className="remote-btn" onClick={() => press('chup')}>{t('remote.channel')} +</button>
              <button type="button" className="remote-btn" onClick={() => press('voldown')}>{t('remote.volume')} −</button>
              <button type="button" className="remote-btn" onClick={() => press('volup')}>{t('remote.volume')} +</button>
              <button type="button" className="remote-btn" onClick={() => press('chdown')}>{t('remote.channel')} −</button>
              <button type="button" className="remote-btn" onClick={() => { setCode(''); setStatus('idle') }}>✕</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
