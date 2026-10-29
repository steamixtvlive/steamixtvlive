import { useCallback, useEffect, useRef, useState } from 'react'
import NotflixHome from '@/pages/NotflixHome'
import NotflixTemplatePage from '@/pages/NotflixTemplatePage'
import NotflixPlayer from '@/sections/NotflixPlayer'
import NotflixDiscover from '@/pages/NotflixDiscover'
import NotflixSidebar from '@/sections/NotflixSidebar'
import NotflixTopbar from '@/sections/NotflixTopbar'
import { NAV_ITEMS, PAGE_TITLES, type PageId } from '@/lib/navigation'
import type { VavooCatalog } from '@/lib/vavoo'
import { useNavigate } from 'react-router-dom'
import { preloadVodHome } from '@/lib/vod'
import { useLang } from '@/lib/language'
import { Trash2, CreditCard } from 'lucide-react'
import { deleteMemberAccount, logoutMember } from '@/lib/membership'

interface NotflixShellProps {
  catalog: VavooCatalog
  activationProfile?: { fullName: string; username: string; expiresAt: number } | null
}

const PAGE_SUBTITLES: Record<Exclude<PageId, 'live'>, string> = {
  home: 'Şablon · boş içerik alanı',
  subscribe: 'Şablon · boş içerik alanı',
  discover: 'Şablon · boş içerik alanı',
  continue: 'Şablon · boş içerik alanı',
  about: 'Şablon · boş içerik alanı',
  settings: 'Şablon · boş içerik alanı',
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
  const [subscriptionOpen, setSubscriptionOpen] = useState(false)
  const [watchWarning, setWatchWarning] = useState(false)
  const [tvMode, setTvMode] = useState(false)
  const [hasSubscription, setHasSubscription] = useState(() => Boolean(activationProfile && activationProfile.expiresAt > Date.now()))
  const [logoutError, setLogoutError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const bodyRef = useRef<HTMLElement | null>(null)

  const navigate = useCallback((nextPage: PageId) => {
    setPage(nextPage)
    setMobileOpen(false)
    if (bodyRef.current) bodyRef.current.scrollTop = 0
    if (nextPage === 'discover') void preloadVodHome().catch(() => {})
  }, [])

  useEffect(() => { if (language !== lang) setLang(language) }, [lang, language, setLang])

  useEffect(() => { document.documentElement.lang = language }, [language])

  useEffect(() => { setHasSubscription(Boolean(activationProfile && activationProfile.expiresAt > Date.now())) }, [activationProfile])

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
    try { await logoutMember(); window.location.reload() }
    catch (error) { setLogoutError(error instanceof Error ? error.message : 'Çıkış yapılamadı') }
  }

  async function handleDeleteAccount() {
    try { await deleteMemberAccount(); window.location.reload() }
    catch (error) { setDeleteError(error instanceof Error ? error.message : 'Hesap silme servisine ulaşılamadı') }
  }

  const subtitle =
    page === 'live'
      ? `${catalog.total.toLocaleString('tr-TR')} kanal · 4K dahil`
      : PAGE_SUBTITLES[page]

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
          title={activationProfile?.username ? `${t(`page.${page}`) || PAGE_TITLES[page]} · Hoş geldiniz ${activationProfile.username}` : (t(`page.${page}`) || PAGE_TITLES[page])}
          subtitle={subtitle}
          live={page === 'live'}
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
              hasSubscription ? <NotflixPlayer channels={catalog.channels} tvMode={tvMode} onSelectChannel={(channel) => routerNavigate(`/notflix/vavoo/${encodeURIComponent(channel.id)}`)} /> : <NotflixPlayer channels={catalog.channels} tvMode={tvMode} canWatch={false} onWatchBlocked={() => setWatchWarning(true)} />
            ) : page === 'home' ? (
              <NotflixHome />
            ) : page === 'discover' ? (
              <NotflixDiscover canWatch={hasSubscription} onWatchBlocked={() => setWatchWarning(true)} />
            ) : page === 'about' ? (
              <section className="nf-about"><span className="nf-sidebar__mark">N</span><h1>NOTFLİX</h1><p>Nedir Medya tarafından sunulan film, dizi ve canlı yayın deneyimi.</p><p>VOD kataloğu ve canlı yayınlar sağlayıcıların API’lerinden yüklenir.</p></section>
            ) : page === 'continue' ? (
              <NotflixContinue />
              ) : page === 'settings' ? (
              <section className="nf-settings"><h1>{t('settings.title') || 'Ayarlar'}</h1><label className="nf-settings__row"><span>{t('settings.language') || 'Dil'}</span><select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="tr">TR</option><option value="en">EN</option></select></label><label className="nf-settings__row"><span>TV Modu</span><input type="checkbox" checked={tvMode} onChange={(event) => setTvMode(event.target.checked)} /></label><p className="nf-settings__hint">TV Modu, yön tuşları ve Enter ile menü/kanal seçimi sağlar.</p><section className="nf-settings__danger"><h2>Kırmızı Bölge</h2><p>Hesap silme geri alınamaz.</p><button type="button" onClick={() => setDeleteOpen(true)}><Trash2 size={15}/> Hesabı Sil</button></section></section>
            ) : (
              page === 'subscribe' ? <section className="nf-settings"><h1>Abonelik</h1><p>{hasSubscription ? 'Aboneliğiniz aktif.' : 'Aktif abonelik bulunamadı.'}</p><button type="button" className="nf-vod-play" onClick={() => setSubscriptionOpen(true)}><CreditCard size={16} /> Paketleri incele</button></section> : <NotflixTemplatePage page={page} />
            )}
          </div>
        </main>
        {logoutError && <p role="alert" className="nf-vod-error">{logoutError}</p>}
        <button type="button" className="nf-shell__logout" onClick={() => void handleLogout()}>Çıkış Yap</button>
      </div>
      {deleteOpen && <div className="nf-pricing-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteOpen(false) }}><section className="nf-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="nf-delete-title" aria-describedby="nf-delete-warning"><h2 id="nf-delete-title">Hesabı Sil</h2><p id="nf-delete-warning">İşlem geri alınamaz, aboneliğiniz yanar. Hesabınızı silmek istediğinizden emin misiniz?</p>{deleteError && <p role="alert">{deleteError}</p>}<div><button type="button" onClick={() => setDeleteOpen(false)}>Vazgeç</button><button type="button" onClick={() => void handleDeleteAccount()}>Evet, hesabı sil</button></div></section></div>}
      {watchWarning && <div className="nf-pricing-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setWatchWarning(false) }}><section className="nf-delete-modal" role="dialog" aria-modal="true" aria-labelledby="nf-watch-block-title"><h2 id="nf-watch-block-title">Abonelik gerekli</h2><p>İçerikleri izleyebilmek için lütfen geçerli bir abonelik paketi satın alınız.</p><div><button type="button" onClick={() => setWatchWarning(false)}>Kataloğa dön</button><button type="button" onClick={() => { setWatchWarning(false); setSubscriptionOpen(true) }}><CreditCard size={15} /> Paketleri gör</button></div></section></div>}
      {subscriptionOpen && <div className="nf-pricing-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSubscriptionOpen(false) }}><section className="nf-pricing-modal" role="dialog" aria-modal="true"><button type="button" className="nf-pricing-close" onClick={() => setSubscriptionOpen(false)} aria-label="Kapat">×</button><h2>Abonelik paketleri</h2><div className="nf-pricing-note"><b>Aktivasyon adımları</b><ol><li>Shopier üzerinden dilediğiniz abonelik paketini satın alın.</li><li>Ödeme dekontunuzun veya ekran görüntünüzün kopyasını hazırlayın.</li><li>Notflix kullanıcı adınızı (<b>{activationProfile?.username || 'kayıt sırasında belirlediğiniz ad'}</b>) ve paket adını Telegram adresimize iletin.</li><li>Geliştirici ekibimiz bilgilerinizi doğrulayarak aboneliğinizi hesabınıza tanımlayıp başlatır.</li></ol></div><div className="nf-pricing-grid">{[{ name:'1 Aylık', href:'https://www.shopier.com/platool/49623989' },{ name:'3 Aylık', href:'https://www.shopier.com/platool/49624003' },{ name:'12 Aylık', href:'https://www.shopier.com/platool/49624023' }].map((plan) => <article key={plan.name}><h3>{plan.name}</h3><a href={plan.href} target="_blank" rel="noreferrer">Shopier’den satın al</a></article>)}</div><a href="https://t.me/streamsupport00" target="_blank" rel="noreferrer">Telegram destek: t.me/streamsupport00</a></section></div>}
    </div>
  )
}
