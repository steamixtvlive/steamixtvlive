import { NAV_ITEMS, type PageId } from '@/lib/navigation'
import NotflixLogo from '@/sections/NotflixLogo'

interface NotflixSidebarProps {
  page: PageId
  expanded: boolean
  mobileOpen: boolean
  onNavigate: (page: PageId) => void
  onCloseMobile: () => void
}

export default function NotflixSidebar({
  page,
  expanded,
  mobileOpen,
  onNavigate,
  onCloseMobile,
}: NotflixSidebarProps) {
  return (
    <aside className={`nf-sidebar ${expanded ? 'is-expanded' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}>
      <a
        className="nf-sidebar__brand"
        href="#home"
        onClick={(event) => {
          event.preventDefault()
          onNavigate('home')
          onCloseMobile()
        }}
        aria-label="NOTFLİX ana sayfa"
      >
        <span className="nf-sidebar__mark" aria-hidden="true">N</span>
        <span className="nf-sidebar__wordmark">
          <NotflixLogo />
        </span>
      </a>

      <div className="nf-sidebar__rule" />

      <nav className="nf-nav" aria-label="Ana menü">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = page === item.id
          return (
            <button
              key={item.id}
              type="button"
              className={`nf-nav__item ${active ? 'is-active' : ''}`}
              onClick={() => {
                onNavigate(item.id)
                onCloseMobile()
              }}
              aria-current={active ? 'page' : undefined}
              title={item.label}
            >
              <span className="nf-nav__icon">
                <Icon size={20} strokeWidth={1.8} />
              </span>
              <span className="nf-nav__label">{item.label}</span>
              <span className="nf-nav__short">{item.shortLabel}</span>
              {item.id === 'live' && (
                <span className="nf-nav__live" aria-label="Canlı">
                  <i />
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="nf-sidebar__footer">
        <span className="nf-sidebar__status">
          <i />
          Yayın aktif
        </span>
        <span className="nf-sidebar__version">NOTFLİX · 2027</span>
      </div>
    </aside>
  )
}
