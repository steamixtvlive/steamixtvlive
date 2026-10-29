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
  const [items, setItems] = useState<Array<{ id: string; title: string; poster: string; progress: number; href: string }>>([])
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

  return <section className="nf-vod-discover"><div className="nf-vod-section-title"><div><span className="nf-vod-kicker">İZLEME GEÇMİŞİ</span><h2>Kaldığın yerden devam et</h2></div>{selected.length > 0 && <button type="button" onClick={removeSelected}>Seçilenleri kaldır</button>}</div><div className="nf-vod-grid">{items.map((item) => <div className="nf-continue-card" key={item.id}><label><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}/><img src={item.poster} alt=""/><span>{item.progress}% izlendi</span></label><button type="button" onClick={() => { window.location.href = item.href }}>{item.title} · Devam et</button></div>)}</div>{items.length === 0 && <p>İzlemeye başladığınız içerikler burada görünür.</p>}</section>
}

export default function NotflixShell({ catalog, activationProfile }: NotflixShellProps) {
  const routerNavigate = useNavigate()
  const [page, setPage] = useState<PageId>('discover')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [language, setLanguage] = useState(() => { try { return localStorage.getItem('lang') || 'tr' } catch { return 'tr' } })
  const bodyRef = useRef<HTMLElement | null>(null)

  const navigate = useCallback((nextPage: PageId) => {
    setPage(nextPage)
    setMobileOpen(false)
    if (bodyRef.current) bodyRef.current.scrollTop = 0
    if (nextPage === 'discover') void preloadVodHome().catch(() => {})
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
    try { localStorage.setItem('lang', language) } catch { /* language selection remains in state */ }
  }, [language])

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
          title={activationProfile?.username ? `${PAGE_TITLES[page]} · Hoş geldiniz ${activationProfile.username}` : PAGE_TITLES[page]}
          subtitle={subtitle}
          live={page === 'live'}
          onToggleMenu={toggleMenu}
          onBack={() => navigate('discover')}
        />

        <main
          ref={bodyRef}
          className={`nf-shell__body ${page === 'live' ? 'is-live' : ''} ${page === 'discover' ? 'is-discover' : ''}`}
        >
          <div key={page} className={`nf-page-enter ${page === 'live' ? 'nf-page-enter--live' : ''} ${page === 'discover' ? 'nf-page-enter--discover' : ''}`}>
            {page === 'live' ? (
              <NotflixPlayer channels={catalog.channels} onSelectChannel={(channel) => routerNavigate(`/notflix/vavoo/${encodeURIComponent(channel.id)}`)} />
            ) : page === 'home' ? (
              <NotflixHome />
            ) : page === 'discover' ? (
              <NotflixDiscover />
            ) : page === 'about' ? (
              <section className="nf-about"><span className="nf-sidebar__mark">N</span><h1>NOTFLİX</h1><p>Nedir Medya tarafından sunulan film, dizi ve canlı yayın deneyimi.</p><p>VOD kataloğu ve canlı yayınlar sağlayıcıların API’lerinden yüklenir.</p></section>
            ) : page === 'continue' ? (
              <NotflixContinue />
            ) : (
              <NotflixTemplatePage page={page} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
