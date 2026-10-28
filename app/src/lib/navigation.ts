import { Compass, Crown, History, Info, Settings, Tv, type LucideIcon } from 'lucide-react'

export type PageId = 'home' | 'subscribe' | 'discover' | 'continue' | 'live' | 'about' | 'settings'

export interface NavItem {
  id: Exclude<PageId, 'home'>
  label: string
  shortLabel: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'subscribe', label: 'Abonelik', shortLabel: 'Abonelik', icon: Crown },
  { id: 'discover', label: 'Keşfet', shortLabel: 'Keşfet', icon: Compass },
  { id: 'continue', label: 'Kaldığın Yerden Devam Et', shortLabel: 'Devam Et', icon: History },
  { id: 'live', label: 'Canlı TV', shortLabel: 'Canlı TV', icon: Tv },
  { id: 'about', label: 'Hakkında', shortLabel: 'Hakkında', icon: Info },
  { id: 'settings', label: 'Ayarlar', shortLabel: 'Ayarlar', icon: Settings },
]

export const PAGE_TITLES: Record<PageId, string> = {
  home: 'Ana Sayfa',
  subscribe: 'Abonelik',
  discover: 'Keşfet',
  continue: 'Kaldığın Yerden Devam Et',
  live: 'Canlı TV',
  about: 'Hakkında',
  settings: 'Ayarlar',
}
