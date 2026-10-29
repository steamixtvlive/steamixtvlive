import { useCallback, useEffect, useRef, useState } from 'react'
import NotflixHome from '@/pages/NotflixHome'
import NotflixTemplatePage from '@/pages/NotflixTemplatePage'
import NotflixPlayer from '@/sections/NotflixPlayer'
import NotflixDiscover from '@/pages/NotflixDiscover'
import NotflixSidebar from '@/sections/NotflixSidebar'
import NotflixTopbar from '@/sections/NotflixTopbar'
import { NAV_ITEMS, localizedPageTitle, type PageId } from '@/lib/navigation'
import type { VavooCatalog } from '@/lib/vavoo'
import { useNavigate } from 'react-router-dom'
import { preloadVodHome } from '@/lib/vod'
import { useLang } from '@/lib/language'
import { Languages, Database } from 'lucide-react'
import { logoutMember } from '@/lib/membership'

interface NotflixShellProps {
  catalog: VavooCatalog
  activationProfile?: { fullName: string; username: string; expiresAt: number } | null
  onLogout?: () => void
}

const PAGE_SUBTITLES: Record<Exclude<PageId, 'live'>, string> = {
  home: 'Notflix',
  discover: 'Film ve dizileri keşfedin',
  continue: 'İzlemeye devam edin',
  about: 'Nedir Medya',
  settings: 'Hesap ve cihaz tercihleri',
}

function NotflixContinue() {
  const [items, setItems] = useState<Array<{ id: string; title: string; poster: string; progress: number; href: string; type?: 'movie' | 'series' }>>([])
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('notflix_continue') || '[]') as typeof items
      window.setTimeout(() => setItems(saved), 0)
    } catch { window.setTimeout(() => setItems([]), 0) }
  }, [])

  function removeSelected() {
    const next = items.filter((item) => !selected.includes(item.id))
    setItems(next)
    setSelected([])
    localStorage.setItem('notflix_continue', JSON.stringify(next))
  }

  useEffect(() => {
    const reloadItems = () => {
      try { setItems(JSON.parse(localStorage.getItem('notflix_continue') || '[]')) } catch { setItems([]) }
    }
    window.addEventListener('focus', reloadItems)
    return () => window.removeEventListener('focus', reloadItems)
  }, [])

  const mediaItems = items.filter((item) => item.type === 'movie' || item.type === 'series')
  return <section className="nf-vod-discover"><div className="nf-vod-section-title"><div><span className="nf-vod-kicker">İZLEME GEÇMİŞİ</span><h2>Kaldığın yerden devam et</h2></div>{selected.length > 0 && <button type="button" onClick={removeSelected}>Seçilenleri kaldır</button>}</div><div className="nf-vod-grid">{mediaItems.map((item) => <div className="nf-continue-card" key={item.id}><label><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}/><img src={item.poster} alt=""/><span>{item.progress}% izlendi</span></label><button type="button" onClick={() => { window.location.href = item.href }}>{item.title} · Devam et</button></div>)}</div>{mediaItems.length === 0 && <p>İzlemeye başladığınız içerikler burada görünür.</p>}</section>
}

export default function NotflixShell({ catalog, activationProfile, onLogout }: NotflixShellProps) {
  const { lang, setLang, t } = useLang()
  const routerNavigate = useNavigate()
  const [page, setPage] = useState<PageId>('discover')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const language = lang
  const setLanguage = setLang
  const [tvMode, setTvMode] = useState(false)
  const [clearDataOpen, setClearDataOpen] = useState(false)
  const bodyRef = useRef<HTMLElement | null>(null)

  const navigate = useCallback((nextPage: PageId) => {
    setPage(nextPage)
    setMobileOpen(false)
    if (bodyRef.current) bodyRef.current.scrollTop = 0
    if (nextPage === 'discover') void preloadVodHome().catch(() => {})
  }, [])

  useEffect(() => { if (language !== lang) setLang(language) }, [lang, language, setLang])

  useEffect(() => { document.documentElement.lang = language }, [language])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (mobileOpen) setMobileOpen(false)
        else navigate('discover')
        return
      }
      if ((event.altKey || event.metaKey) && event.key === 'ArrowLeft') {
        const index = NAV_ITEMS.findIndex((item) => item.id === page)
        navigate(NAV_ITEMS[(index - 1 + NAV_ITEMS.length) % NAV_ITEMS.length].id)
      }
      if ((event.altKey || event.metaKey) && event.key === 'ArrowRight') {
        const index = NAV_ITEMS.findIndex((item) => item.id === page)
        navigate(NAV_ITEMS[(index + 1) % NAV_ITEMS.length].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen, navigate, page])

  function toggleMenu() {
    if (window.matchMedia('(max-width: 900px)').matches) {
      setMobileOpen((value) => !value)
      return
    }
    setCollapsed((value) => !value)
  }

  async function handleLogout() {
    try { await logoutMember() } catch { /* Storage may be unavailable; leave the current app usable. */ }
    if (onLogout) { onLogout(); return }
    window.location.href = `${window.location.origin}/`
  }

  function handleClearData() {
    try {
      localStorage.removeItem('notflix_continue')
      localStorage.removeItem('notflix_hero_index')
      localStorage.removeItem('notflix_hero_day')
      sessionStorage.removeItem('notflix_live_country')
      sessionStorage.removeItem('notflix_splash_seen')
      setClearDataOpen(false)
      window.location.href = `${window.location.origin}/`
    } catch {
      setClearDataOpen(false)
    }
  }

  const subtitle =
    page === 'live'
      ? `${catalog.total.toLocaleString('tr-TR')} ${lang === 'en' ? 'channels · incl. 4K' : 'kanal · 4K dahil'}`
      : lang === 'en' ? `NOTFLIX · ${localizedPageTitle(page, 'en')}` : PAGE_SUBTITLES[page]

  return (
    <div className={`nf-shell ${collapsed ? 'is-collapsed' : ''}`}>
        <NotflixSidebar
        page={page}
        expanded={!collapsed || mobileOpen}
        mobileOpen={mobileOpen}
        onNavigate={navigate}
        onCloseMobile={() => setMobileOpen(false)}
        language={language}
        onLanguage={setLanguage}
        onLogout={() => void handleLogout()}
      />

      {mobileOpen && (
        <button
          type="button"
          className="nf-shell__scrim"
          onClick={() => setMobileOpen(false)}
          aria-label="Menüyü kapat"
          tabIndex={-1}
        />
      )}

      <div className="nf-shell__frame">
        <NotflixTopbar
          title={activationProfile?.username ? `${localizedPageTitle(page, lang)} · ${lang === 'en' ? 'Welcome' : 'Hoş geldiniz'} ${activationProfile.username}` : localizedPageTitle(page, lang)}
          subtitle={subtitle}
          live={page === 'live'}
          page={page}
          onToggleMenu={toggleMenu}
          onBack={() => navigate('discover')}
          language={language}
          onLanguage={setLanguage}
        />

        <main
          ref={bodyRef}
          className={`nf-shell__body ${page === 'live' ? 'is-live' : ''} ${page === 'discover' ? 'is-discover' : ''}`}
        >
          <div key={page} className={`nf-page-enter ${page === 'live' ? 'nf-page-enter--live' : ''} ${page === 'discover' ? 'nf-page-enter--discover' : ''}`}>
            {page === 'live' ? (
              <NotflixPlayer channels={catalog.channels} tvMode={tvMode} onSelectChannel={(channel) => routerNavigate(`/notflix/vavoo/${encodeURIComponent(channel.id)}`)} />
            ) : page === 'home' ? (
              <NotflixHome />
            ) : page === 'discover' ? (
              <NotflixDiscover />
            ) : page === 'about' ? (
              <section className="nf-about"><h1><span className="notflix-logo">NOTFLİX</span></h1><p>{lang === 'en' ? 'A film, series and live-streaming experience by Nedir Medya.' : 'Nedir Medya tarafından sunulan film, dizi ve canlı yayın deneyimi.'}</p><p>{lang === 'en' ? 'The VOD catalog and live broadcasts load from their configured sources.' : 'VOD kataloğu ve canlı yayınlar sağlayıcıların API’lerinden yüklenir.'}</p></section>
            ) : page === 'continue' ? (
              <NotflixContinue />
              ) : page === 'settings' ? (
              <section className="nf-settings"><div className="nf-settings__heading"><span className="nf-settings__icon"><Languages size={20}/></span><div><h1>{t('settings.title') || 'Ayarlar'}</h1><p>{lang === 'en' ? 'Playback and app preferences' : 'Oynatıcı ve uygulama tercihleri'}</p></div></div><label className="nf-settings__row"><span><Languages size={17}/>{t('settings.language') || 'Dil'}</span><select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="tr">Türkçe</option><option value="en">English</option></select></label><label className="nf-settings__row"><span><span className="nf-settings__tv-icon">TV</span>{lang === 'en' ? 'TV remote navigation' : 'TV kumandasıyla gezinme'}</span><input type="checkbox" checked={tvMode} onChange={(event) => setTvMode(event.target.checked)} /></label><p className="nf-settings__hint">{lang === 'en' ? 'Enable arrow keys and Enter for TV navigation.' : 'TV modunda menü ve kanalları yön tuşlarıyla kullanabilirsiniz.'}</p><section className="nf-settings__data"><span className="nf-settings__data-icon"><Database size={19}/></span><div><h2>{lang === 'en' ? 'Clear app data' : 'Uygulama verilerini temizle'}</h2><p>{lang === 'en' ? 'Remove watch history, continue watching and local preferences. Your activation remains.' : 'İzleme geçmişini, devam listesini ve yerel tercihleri siler. Aktivasyonunuz korunur.'}</p><button type="button" onClick={() => setClearDataOpen(true)}>{lang === 'en' ? 'Clear data' : 'Verileri temizle'}</button></div></section></section>
            ) : (
              <NotflixTemplatePage page={page} />
            )}
          </div>
        </main>
        <button type="button" className="nf-shell__logout" onClick={() => void handleLogout()}>{lang === 'en' ? 'Log out' : 'Çıkış Yap'}</button>
      </div>
      {clearDataOpen && <div className="nf-pricing-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setClearDataOpen(false) }}><section className="nf-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="nf-clear-title"><h2 id="nf-clear-title">{lang === 'en' ? 'Clear app data?' : 'Uygulama verileri temizlensin mi?'}</h2><p>{lang === 'en' ? 'Watch history and local preferences will be removed. Your gift-code activation will stay active.' : 'İzleme geçmişi ve yerel tercihler silinir. Hediye kodu aktivasyonunuz korunur.'}</p><div><button type="button" onClick={() => setClearDataOpen(false)}>{t('common.close')}</button><button type="button" onClick={handleClearData}>{lang === 'en' ? 'Clear data' : 'Verileri temizle'}</button></div></section></div>}
    </div>
  )
}
