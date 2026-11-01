import type { RouteState } from './router'
import {
  HomeIcon,
  LibraryIcon,
  TvIcon,
  SearchIcon,
  SettingsIcon,
} from './icons'
import { useLang } from '@/lib/language'
import NotflixLogo from '@/sections/NotflixLogo'

const MAIN_ITEMS = [
  { view: 'home', labelKey: 'nav.home', href: '#/', Icon: HomeIcon },
  { view: 'library', labelKey: 'nav.library', href: '#/library', Icon: LibraryIcon },
  { view: 'channels', labelKey: 'nav.channels', href: '#/channels', Icon: TvIcon },
  { view: 'search', labelKey: 'nav.search', href: '#/search', Icon: SearchIcon },
] as const

const BNAV_ITEMS = [
  { view: 'home', labelKey: 'nav.home', href: '#/', Icon: HomeIcon },
  { view: 'library', labelKey: 'nav.library', href: '#/library', Icon: LibraryIcon },
  { view: 'channels', labelKey: 'nav.channels', href: '#/channels', Icon: TvIcon },
  { view: 'search', labelKey: 'nav.search', href: '#/search', Icon: SearchIcon },
  { view: 'settings', labelKey: 'nav.settings', href: '#/settings', Icon: SettingsIcon },
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

export default function Sidebar({ route, menuOpen = false }: { route: RouteState; menuOpen?: boolean }) {
  const { t } = useLang()
  const mainActive = MAIN_ITEMS.findIndex((item) => isActive(route, item.view))
  const settingsActive = isActive(route, 'settings')
  const bnavActive = BNAV_ITEMS.findIndex((item) => isActive(route, item.view))

  return (
    <>
      <aside className="sidebar" data-zone="sidebar" role="navigation" aria-label="Main navigation" data-menu={menuOpen ? 'open' : undefined}>
        <div className="sidebar-dock">
          <a className="sidebar-brand" href="#/" aria-label={t('nav.menu')} aria-expanded={menuOpen}>
            <span className="brand-burger" aria-hidden="true"><i /><i /><i /></span>
            <span className="brand-text">
              <NotflixLogo className="sidebar-notflix-wordmark" />
            </span>
          </a>
          <nav className="sidebar-nav" aria-label="Main" style={{ '--nav-active': Math.max(0, mainActive) } as React.CSSProperties}>
            <div className={`nav-pill ${mainActive < 0 ? 'is-off' : ''}`} aria-hidden="true" />
            {MAIN_ITEMS.map(({ view, labelKey, href, Icon }) => (
              <a
                key={view}
                href={href}
                data-tab={view}
                className={`nav-item ${isActive(route, view) ? 'active' : ''}`}
                aria-label={t(labelKey)}
                aria-current={isActive(route, view) ? 'page' : undefined}
              >
                <Icon />
                <span>{t(labelKey)}</span>
              </a>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <a
              href="#/settings"
              data-tab="settings"
              className={`nav-item ${settingsActive ? 'active' : ''}`}
              aria-label={t('nav.settings')}
              aria-current={settingsActive ? 'page' : undefined}
            >
              <SettingsIcon />
              <span>{t('nav.settings')}</span>
            </a>
          </div>
        </div>
        {/* A collapsed rail is 64px of icons and nothing on it says whose they are. The pull names
            the drawer and offers itself as the handle; it is decoration, never a tap target. */}
        <span className="rail-pull" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </aside>

      <nav
        className="bnav"
        data-zone="bnav"
        role="navigation"
        aria-label="Bottom navigation"
        style={{ '--bnav-count': BNAV_ITEMS.length, '--bnav-active': Math.max(0, bnavActive) } as React.CSSProperties}
      >
        <div className={`bnav-pill ${bnavActive < 0 ? 'is-off' : ''}`} aria-hidden="true" />
        {BNAV_ITEMS.map(({ view, labelKey, href, Icon }) => (
          <a
            key={view}
            href={href}
            data-tab={view}
            className={`bnav-item ${isActive(route, view) ? 'active' : ''}`}
            aria-label={t(labelKey)}
            aria-current={isActive(route, view) ? 'page' : undefined}
          >
            <Icon size={22} />
            <span>{t(labelKey)}</span>
          </a>
        ))}
      </nav>
    </>
  )
}
