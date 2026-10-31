import { useEffect, useState } from 'react'
import { useLang } from '@/lib/language'
import { createRemoteSession, closeRemoteSession } from './api'
import { readTvMode, setTvMode } from './tv'
import { clearAllData } from './storage'
import ShortcutsHelp from './ShortcutsHelp'
import { ClockIcon, DatabaseIcon, GlobeIcon, InfoIcon, SettingsIcon, InviteIcon, TvIcon, TrashIcon } from './icons'

const SESSION_KEY = 'notflix_remote_session'

interface StoredSession {
  code: string
  token: string
  at: number
}

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    if (!parsed?.code || !parsed?.token) return null
    return parsed
  } catch { return null }
}

function storeSession(session: StoredSession | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch { /* storage may be unavailable */ }
  window.dispatchEvent(new CustomEvent('notflix-remote-session', { detail: { session: session ? { code: session.code, token: session.token } : null } }))
}

export default function SettingsView() {
  const { t, lang, setLang, languages, langNames } = useLang()
  const [tvMode, setTvModeState] = useState(readTvMode)
  const [session, setSession] = useState<StoredSession | null>(readSession)
  const [remoteBusy, setRemoteBusy] = useState(false)
  const [remoteError, setRemoteError] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [notice, setNotice] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const handler = (event: Event) => {
      const enabled = Boolean((event as CustomEvent<{ enabled?: boolean }>).detail?.enabled)
      setTvModeState(enabled)
    }
    window.addEventListener('notflix-tv-mode', handler)
    return () => window.removeEventListener('notflix-tv-mode', handler)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

  function toggleTvMode() {
    const next = !tvMode
    setTvModeState(next)
    setTvMode(next)
  }

  async function pairRemote() {
    if (remoteBusy) return
    setRemoteBusy(true)
    setRemoteError('')
    try {
      const created = await createRemoteSession()
      const next = { code: created.code, token: created.token, at: Date.now() }
      setSession(next)
      storeSession(next)
    } catch {
      setRemoteError(t('remote.invalid'))
    } finally {
      setRemoteBusy(false)
    }
  }

  async function stopRemote() {
    if (session) await closeRemoteSession(session.code, session.token)
    setSession(null)
    storeSession(null)
  }

  function openRemote() {
    if (!session) return
    const base = `${window.location.origin}${window.location.pathname}`
    window.open(`${base}#/remote?code=${encodeURIComponent(session.code)}`, '_blank', 'noopener')
  }

  async function clearCache() {
    try {
      sessionStorage.clear()
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
      }
    } catch { /* cache access may be blocked */ }
    setNotice(t('settings.cleared'))
  }

  function clearData() {
    clearAllData()
    void stopRemote()
    setConfirmClear(false)
    setNotice(t('settings.cleared'))
    setLang('tr')
  }

  return (
    <div className="settings-view">
      <div className="settings-head">
        <h1>{t('settings.title')}</h1>
        <div className="settings-meta">
          <span className="s-chip">NOTFLİX</span>
          <span className="s-chip">v8.0</span>
        </div>
      </div>

      <div className="settings-groups">
        <section className="s-group">
          <div className="s-group-head">
            <span className="s-gicon"><GlobeIcon size={16} /></span>
            <span className="s-group-title">{t('settings.app')}</span>
          </div>
          <div className="s-item">
            <div className="s-item-nav">
              <div>
                <div className="s-label">{t('settings.language')}</div>
                <div className="s-sub">{langNames[lang] || lang}</div>
              </div>
              <select className="sort-select" aria-label={t('settings.language')} value={lang} onChange={(event) => setLang(event.target.value)}>
                {languages.map((code: string) => (
                  <option key={code} value={code}>{langNames[code] || code}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="s-item">
            <div className="s-item-nav">
              <div>
                <div className="s-label">{t('settings.theme')}</div>
                <div className="s-sub">{t('settings.themeDark')}</div>
              </div>
              <span className="s-value">{t('settings.themeDark')}</span>
            </div>
          </div>
          <div className="s-item">
            <div className="s-item-nav">
              <div>
                <div className="s-label">{t('settings.tvMode')}</div>
                <div className="s-sub">{t('settings.tvModeDesc')}</div>
              </div>
              <button
                type="button"
                className={`s-toggle ${tvMode ? 'is-on' : ''}`}
                role="switch"
                aria-checked={tvMode}
                aria-label={t('settings.tvMode')}
                onClick={toggleTvMode}
              >
                <span />
              </button>
            </div>
          </div>
        </section>

        <section className="s-group">
          <div className="s-group-head">
            <span className="s-gicon"><TvIcon size={16} /></span>
            <span className="s-group-title">{t('settings.remote')}</span>
          </div>
          <div className="s-item">
            <div className="s-item-nav">
              <div>
                <div className="s-label">{t('settings.remote')}</div>
                <div className="s-sub">{session ? `${t('settings.remoteCode')}: ${session.code}` : t('settings.remoteDesc')}</div>
              </div>
              {session ? (
                <div className="s-remote-actions">
                  <button type="button" className="btn btn-primary" onClick={openRemote}>{t('settings.remoteOpen')}</button>
                  <button type="button" className="btn" onClick={() => { void stopRemote() }}>{t('settings.remoteStop')}</button>
                </div>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => { void pairRemote() }} disabled={remoteBusy}>
                  <InviteIcon size={16} /> {remoteBusy ? t('common.loading') : t('settings.remoteCreate')}
                </button>
              )}
            </div>
          </div>
          {session ? (
            <div className="s-item s-remote-hint">
              <div className="s-remote-code">{session.code}</div>
              <div className="s-sub">{t('settings.remoteHint')}</div>
            </div>
          ) : null}
          {remoteError ? <div className="s-item"><div className="s-sub s-error">{remoteError}</div></div> : null}
        </section>

        <section className="s-group">
          <div className="s-group-head">
            <span className="s-gicon"><SettingsIcon size={16} /></span>
            <span className="s-group-title">{t('settings.shortcuts')}</span>
          </div>
          <div className="s-item">
            <div className="s-item-nav">
              <div>
                <div className="s-label">{t('settings.shortcuts')}</div>
                <div className="s-sub">{t('settings.shortcutsDesc')}</div>
              </div>
              <button type="button" className="s-value s-value-btn" onClick={() => setShowHelp(true)}>
                <ClockIcon size={15} /> ?
              </button>
            </div>
          </div>
        </section>

        <section className="s-group">
          <div className="s-group-head">
            <span className="s-gicon"><DatabaseIcon size={16} /></span>
            <span className="s-group-title">{t('settings.data')}</span>
          </div>
          <div className="s-item">
            <div className="s-item-nav">
              <div>
                <div className="s-label">{t('settings.clearCache')}</div>
                <div className="s-sub">{t('settings.clearCacheDesc')}</div>
              </div>
              <button type="button" className="s-value s-value-btn" onClick={() => { void clearCache() }}>{t('common.clear')}</button>
            </div>
          </div>
          <div className="s-item">
            <div className="s-item-nav">
              <div>
                <div className="s-label">{t('settings.clearData')}</div>
                <div className="s-sub">{t('settings.clearDataDesc')}</div>
              </div>
              <button type="button" className="s-value s-value-btn s-danger" onClick={() => setConfirmClear(true)}>
                <TrashIcon size={15} /> {t('common.clear')}
              </button>
            </div>
          </div>
          {confirmClear ? (
            <div className="s-confirm" role="alertdialog" aria-label={t('settings.clearDataConfirm')}>
              <span>{t('settings.clearDataConfirm')}</span>
              <div className="s-confirm-actions">
                <button type="button" className="btn btn-primary" onClick={clearData}>{t('common.yes')}</button>
                <button type="button" className="btn" onClick={() => setConfirmClear(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          ) : null}
          {notice ? <div className="s-notice">{notice}</div> : null}
        </section>

        <section className="s-group">
          <div className="s-group-head">
            <span className="s-gicon"><InfoIcon size={16} /></span>
            <span className="s-group-title">{t('settings.about')}</span>
          </div>
          <div className="s-item">
            <div className="s-item-nav">
              <div>
                <div className="s-label">NOTFLİX</div>
                <div className="s-sub">{t('settings.aboutDesc')}</div>
              </div>
              <span className="s-value">v8.0</span>
            </div>
          </div>
          <div className="s-item">
            <div className="s-item-nav">
              <div>
                <div className="s-label">{t('settings.developer')}</div>
                <div className="s-sub">RENDER MEDIA</div>
              </div>
            </div>
          </div>
          <div className="s-item">
            <div className="s-item-nav">
              <div>
                <div className="s-label">{t('settings.infrastructure')}</div>
              </div>
              <span className="s-value">MediaHubMX</span>
            </div>
          </div>
        </section>
      </div>

      {showHelp ? <ShortcutsHelp onClose={() => setShowHelp(false)} /> : null}
    </div>
  )
}
