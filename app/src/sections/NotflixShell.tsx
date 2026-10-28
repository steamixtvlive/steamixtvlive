import { useRef, useState } from 'react'
import NotflixHome from '@/pages/NotflixHome'
import NotflixTemplatePage from '@/pages/NotflixTemplatePage'
import NotflixPlayer from '@/sections/NotflixPlayer'
import NotflixDiscover from '@/pages/NotflixDiscover'
import NotflixSidebar from '@/sections/NotflixSidebar'
import NotflixTopbar from '@/sections/NotflixTopbar'
import { PAGE_TITLES, type PageId } from '@/lib/navigation'
import type { VavooCatalog } from '@/lib/vavoo'
import { useNavigate } from 'react-router-dom'

interface NotflixShellProps {
  catalog: VavooCatalog
}

const PAGE_SUBTITLES: Record<Exclude<PageId, 'live'>, string> = {
  home: 'Şablon · boş içerik alanı',
  subscribe: 'Şablon · boş içerik alanı',
  discover: 'Şablon · boş içerik alanı',
  continue: 'Şablon · boş içerik alanı',
  about: 'Şablon · boş içerik alanı',
  settings: 'Şablon · boş içerik alanı',
}

export default function NotflixShell({ catalog }: NotflixShellProps) {
  const routerNavigate = useNavigate()
  const [page, setPage] = useState<PageId>('discover')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const bodyRef = useRef<HTMLElement | null>(null)

  function navigate(nextPage: PageId) {
    setPage(nextPage)
    setMobileOpen(false)
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }

  function toggleMenu() {
    if (window.matchMedia('(max-width: 900px)').matches) {
      setMobileOpen((value) => !value)
      return
    }
    setCollapsed((value) => !value)
  }

  const subtitle =
    page === 'live'
      ? `${catalog.total.toLocaleString('tr-TR')} kanal · Vavoo / MediaHubMX · 4K dahil`
      : PAGE_SUBTITLES[page]

  return (
    <div className={`nf-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <NotflixSidebar
        page={page}
        expanded={!collapsed || mobileOpen}
        mobileOpen={mobileOpen}
        onNavigate={navigate}
        onCloseMobile={() => setMobileOpen(false)}
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
          title={PAGE_TITLES[page]}
          subtitle={subtitle}
          live={page === 'live'}
          onToggleMenu={toggleMenu}
          onProfile={() => navigate('settings')}
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
            ) : (
              <NotflixTemplatePage page={page} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
