import type { RouteState } from './router'
import { goBack } from './router'
import {
  HomeIcon,
  LibraryIcon,
  TvIcon,
  SocialIcon,
  SearchIcon,
  SettingsIcon,
} from './icons'

const MAIN_ITEMS = [
  { view: 'home', label: 'Anasayfa', href: '#/', Icon: HomeIcon },
  { view: 'library', label: 'Kitaplık', href: '#/library', Icon: LibraryIcon },
  { view: 'channels', label: 'Kanallar', href: '#/channels', Icon: TvIcon },
  { view: 'social', label: 'Social', href: '#/social', Icon: SocialIcon },
  { view: 'search', label: 'Ara', href: '#/search', Icon: SearchIcon },
] as const

const BNAV_ITEMS = [
  { view: 'home', label: 'Anasayfa', href: '#/', Icon: HomeIcon },
  { view: 'library', label: 'Kitaplık', href: '#/library', Icon: LibraryIcon },
  { view: 'channels', label: 'Kanallar', href: '#/channels', Icon: TvIcon },
  { view: 'search', label: 'Ara', href: '#/search', Icon: SearchIcon },
  { view: 'settings', label: 'Ayarlar', href: '#/settings', Icon: SettingsIcon },
] as const

function isActive(route: RouteState, view: string): boolean {
  if (view === 'home') return route.view === 'home' || route.view === 'catalog' || route.view === 'item'
  return route.view === view
}

export function BrandMark() {
  return (
    <svg className="brand-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="notflixMark" gradientUnits="userSpaceOnUse" x1="8" y1="10" x2="40" y2="40">
          <stop stopColor="#FF3D44" />
          <stop offset="1" stopColor="#D90007" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="13" fill="url(#notflixMark)" />
      <path d="M16 33V15l16 18V15" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function NotflixSidebarMark() {
  return (
    <svg className="nf-sidebar-mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="9" fill="#050505" />
      <path d="M17 32V16h5l7 9v-9h5v16h-5l-7-9v9z" fill="#E50914" />
    </svg>
  )
}

export default function Sidebar({ route }: { route: RouteState }) {
  const mainActive = MAIN_ITEMS.findIndex((item) => isActive(route, item.view))
  const settingsActive = isActive(route, 'settings')
  const bnavActive = BNAV_ITEMS.findIndex((item) => isActive(route, item.view))

  return (
    <>
      <aside className="sidebar" data-zone="sidebar" role="navigation" aria-label="Main navigation">
        <div className="sidebar-dock">
          <a className="sidebar-brand" href="#/" aria-label="Anasayfa">
            <NotflixSidebarMark />
            <span className="brand-text sidebar-notflix-wordmark">NOTFLİX</span>
          </a>
          {route.view === 'item' ? <button className="geil-detail-back" type="button" onClick={() => goBack()} aria-label="Önceki sayfaya dön">‹ <span>Geri</span></button> : null}
          <nav className="sidebar-nav" aria-label="Main" style={{ '--nav-active': Math.max(0, mainActive) } as React.CSSProperties}>
            <div className={`nav-pill ${mainActive < 0 ? 'is-off' : ''}`} aria-hidden="true" />
            {MAIN_ITEMS.map(({ view, label, href, Icon }) => (
              <a
                key={view}
                href={href}
                data-tab={view}
                className={`nav-item ${isActive(route, view) ? 'active' : ''}`}
                aria-label={label}
                aria-current={isActive(route, view) ? 'page' : undefined}
              >
                <Icon />
                <span>{label}</span>
              </a>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <a
              href="#/settings"
              data-tab="settings"
              className={`nav-item ${settingsActive ? 'active' : ''}`}
              aria-label="Ayarlar"
              aria-current={settingsActive ? 'page' : undefined}
            >
              <SettingsIcon />
              <span>Ayarlar</span>
            </a>
          </div>
        </div>
      </aside>

      <nav
        className="bnav"
        data-zone="bnav"
        role="navigation"
        aria-label="Bottom navigation"
        style={{ '--bnav-count': BNAV_ITEMS.length, '--bnav-active': Math.max(0, bnavActive) } as React.CSSProperties}
      >
        <div className={`bnav-pill ${bnavActive < 0 ? 'is-off' : ''}`} aria-hidden="true" />
        {BNAV_ITEMS.map(({ view, label, href, Icon }) => (
          <a
            key={view}
            href={href}
            data-tab={view}
            className={`bnav-item ${isActive(route, view) ? 'active' : ''}`}
            aria-label={label}
            aria-current={isActive(route, view) ? 'page' : undefined}
          >
            <Icon size={22} />
            <span>{label}</span>
          </a>
        ))}
      </nav>
    </>
  )
}
