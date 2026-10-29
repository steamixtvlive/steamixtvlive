import { Compass, History, Info, Settings, Tv, type LucideIcon } from 'lucide-react'

export type PageId = 'home' | 'discover' | 'continue' | 'live' | 'about' | 'settings'

export interface NavItem {
  id: Exclude<PageId, 'home'>
  label: string
  shortLabel: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'discover', label: 'Keşfet', shortLabel: 'Keşfet', icon: Compass },
  { id: 'continue', label: 'Kaldığın Yerden Devam Et', shortLabel: 'Devam Et', icon: History },
  { id: 'live', label: 'Canlı TV', shortLabel: 'Canlı TV', icon: Tv },
  { id: 'about', label: 'Hakkında', shortLabel: 'Hakkında', icon: Info },
  { id: 'settings', label: 'Ayarlar', shortLabel: 'Ayarlar', icon: Settings },
]

export const PAGE_TITLES: Record<PageId, string> = {
  home: 'Ana Sayfa',
  discover: 'Keşfet',
  continue: 'Kaldığın Yerden Devam Et',
  live: 'Canlı TV',
  about: 'Hakkında',
  settings: 'Ayarlar',
}

const NAV_TR: Record<PageId, string> = {
  home: 'Ana Sayfa', discover: 'Keşfet', continue: 'Kaldığın Yerden Devam Et', live: 'Canlı TV', about: 'Hakkında', settings: 'Ayarlar',
}

const NAV_EN: Record<PageId, string> = {
  home: 'Home', discover: 'Discover', continue: 'Continue Watching', live: 'Live TV', about: 'About', settings: 'Settings',
}

export function localizedPageTitle(page: PageId, language: string): string {
  return (language === 'en' ? NAV_EN : NAV_TR)[page]
}

export function localizedNavigation(language: string): NavItem[] {
  const labels = language === 'en' ? NAV_EN : NAV_TR
  return NAV_ITEMS.map((item) => ({ ...item, label: labels[item.id], shortLabel: item.id === 'continue' ? (language === 'en' ? 'Continue' : 'Devam Et') : labels[item.id] }))
}
