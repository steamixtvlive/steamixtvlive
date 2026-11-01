import { useEffect, useState } from 'react'
import { useLang } from '@/lib/language'
import { clearAllData } from './storage'
import ShortcutsHelp from './ShortcutsHelp'
import { ClockIcon, DatabaseIcon, GlobeIcon, InfoIcon, SettingsIcon, TvIcon, TrashIcon } from './icons'

export default function SettingsView() {
  const { t, lang, setLang, languages, langNames } = useLang()
  const [confirmClear, setConfirmClear] = useState(false)
  const [notice, setNotice] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

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
        </section>

        <section className="s-group">
          <div className="s-group-head">
            <span className="s-gicon"><TvIcon size={16} /></span>
            <span className="s-group-title">{t('settings.devices')}</span>
          </div>
          <div className="s-item">
            <div className="s-item-nav">
              <div>
                <div className="s-sub">{t('settings.devicesDesc')}</div>
              </div>
            </div>
          </div>
          {['Google TV', 'Smart TV', 'TV Box', t('settings.devicesPc')].map((name) => (
            <div className="s-item" key={name}>
              <div className="s-item-nav">
                <div>
                  <div className="s-label">{name}</div>
                </div>
                <span className="s-value s-device-ok">{t('settings.devicesOk')}</span>
              </div>
            </div>
          ))}
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
            </div>
          </div>
          <div className="s-item">
            <div className="s-item-nav">
              <div>
                <div className="s-label">{t('settings.developer')}</div>
                <div className="s-sub">RENDIR MEDİA</div>
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
