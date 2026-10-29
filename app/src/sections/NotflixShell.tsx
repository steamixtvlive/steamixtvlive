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
import { Trash2 } from 'lucide-react'
import { getLocalMembership, logoutMember } from '@/lib/membership'

interface NotflixShellProps {
  catalog: VavooCatalog
  activationProfile?: { fullName: string; username: string; expiresAt: number } | null
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
    const handler = (event: StorageEvent) => {
      if (event.key === 'notflix_continue' && event.newValue) {
        try { setItems(JSON.parse(event.newValue)) } catch { /* ignore malformed saved state */ }
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  return <section className="nf-vod-discover"><div className="nf-vod-section-title"><div><span className="nf-vod-kicker">İZLEME GEÇMİŞİ</span><h2>Kaldığın yerden devam et</h2></div>{selected.length > 0 && <button type="button" onClick={removeSelected}>Seçilenleri kaldır</button>}</div><div className="nf-vod-grid">{items.filter((item) => item.type === 'movie' || item.type === 'series').map((item) => <div className="nf-continue-card" key={item.id}><label><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}/><img src={item.poster} alt=""/><span>{item.progress}% izlendi</span></label><button type="button" onClick={() => { window.location.href = item.href }}>{item.title} · Devam et</button></div>)}</div>{items.filter((item) => item.type === 'movie' || item.type === 'series').length === 0 && <p>İzlemeye başladığınız içerikler burada görünür.</p>}</section>
}

export default function NotflixShell({ catalog, activationProfile }: NotflixShellProps) {
  const { lang, setLang, t } = useLang()
  const routerNavigate = useNavigate()
  const [page, setPage] = useState<PageId>('discover')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const language = lang
  const setLanguage = setLang
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [tvMode, setTvMode] = useState(false)
  const [hasSubscription, setHasSubscription] = useState(true)
  const bodyRef = useRef<HTMLElement | null>(null)

  const navigate = useCallback((nextPage: PageId) => {
    setPage(nextPage)
    setMobileOpen(false)
    if (bodyRef.current) bodyRef.current.scrollTop = 0
    if (nextPage === 'discover') void preloadVodHome().catch(() => {})
  }, [])

  useEffect(() => { if (language !== lang) setLang(language) }, [lang, language, setLang])

  useEffect(() => { document.documentElement.lang = language }, [language])

  useEffect(() => { setHasSubscription(true) }, [activationProfile])

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
    try { await logoutMember() } finally { window.location.reload() }
  }

  async function handleDeleteAccount() {
    try {
      const local = getLocalMembership()
      if (local?.tier === 'premium') {
        try {
          const old = JSON.parse(localStorage.getItem('notflix_premium_revoked') || '[]') as Array<{ code: string; revokedAt: number }>
          localStorage.setItem('notflix_premium_revoked', JSON.stringify([...old, { code: local.code, revokedAt: Date.now() }]))
        } catch { /* best effort device tombstone */ }
      }
      await logoutMember()
      window.location.reload()
    }
    catch { window.location.reload() }
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
          freeActive={hasSubscription}
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
              <section className="nf-about"><span className="nf-sidebar__mark">N</span><h1>NOTFLİX</h1><p>{lang === 'en' ? 'A film, series and live-streaming experience by Nedir Medya.' : 'Nedir Medya tarafından sunulan film, dizi ve canlı yayın deneyimi.'}</p><p>{lang === 'en' ? 'The VOD catalog and live broadcasts load from their configured sources.' : 'VOD kataloğu ve canlı yayınlar sağlayıcıların API’lerinden yüklenir.'}</p></section>
            ) : page === 'continue' ? (
              <NotflixContinue />
              ) : page === 'settings' ? (
              <section className="nf-settings"><h1>{t('settings.title') || 'Ayarlar'}</h1><label className="nf-settings__row"><span>{t('settings.language') || 'Dil'}</span><select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="tr">TR</option><option value="en">EN</option></select></label><label className="nf-settings__row"><span>{lang === 'en' ? 'TV Mode' : 'TV Modu'}</span><input type="checkbox" checked={tvMode} onChange={(event) => setTvMode(event.target.checked)} /></label><p className="nf-settings__hint">{lang === 'en' ? 'Use arrows and Enter to navigate.' : 'TV Modu, yön tuşları ve Enter ile menü/kanal seçimi sağlar.'}</p><section className="nf-settings__danger"><h2>{t('settings.red_zone')}</h2><p>{t('settings.delete_warning')}</p><button type="button" onClick={() => setDeleteOpen(true)}><Trash2 size={15}/> {t('settings.delete_account')}</button></section></section>
            ) : (
              <NotflixTemplatePage page={page} />
            )}
          </div>
        </main>
        <button type="button" className="nf-shell__logout" onClick={() => void handleLogout()}>{lang === 'en' ? 'Log out' : 'Çıkış Yap'}</button>
      </div>
      {deleteOpen && <div className="nf-pricing-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteOpen(false) }}><section className="nf-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="nf-delete-title" aria-describedby="nf-delete-warning"><h2 id="nf-delete-title">{t('settings.delete_account')}</h2><p id="nf-delete-warning">{lang === 'en' ? 'The local profile and code will be removed. A premium code is blocked on this device after deletion; the free gift code may be used again.' : 'Bu cihazdaki kayıt ve kod silinir. Premium kodu silme sonrası bu cihazda tekrar kullanılamaz; hediye kodu yeniden kullanılabilir.'}</p><div><button type="button" onClick={() => setDeleteOpen(false)}>{t('common.close')}</button><button type="button" onClick={() => void handleDeleteAccount()}>{t('settings.delete_account')}</button></div></section></div>}
    </div>
  )
}
