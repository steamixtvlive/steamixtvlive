export type MediaType = 'video' | 'series' | 'live' | 'page'

export interface GeilImageSet {
  poster?: string
  thumbnail?: string
  logo?: string
  backdrops?: string[]
}

export interface GeilCastMember {
  name: string
  role?: string
  image?: string
  directory?: { type?: string; catalogId?: string } | null
}

export interface GeilVideo {
  url: string
  name?: string
  languages?: string[]
}

export interface GeilEpgEntry {
  title: string
  start: string
  end: string
}

export interface GeilSubtitle {
  url: string
  language?: string
  name?: string
  format?: string
}

export interface GeilCatalogRef {
  id: string
  type?: string
  name?: string
  description?: string
  items?: GeilItem[]
}

export interface GeilItem {
  id: string
  type: MediaType
  name: string
  description?: string
  releaseDate?: string
  ratings?: Record<string, number>
  images?: GeilImageSet
  genres?: string[]
  runtime?: number
  cast?: GeilCastMember[]
  videos?: GeilVideo[]
  catalogs?: GeilCatalogRef[]
  season?: number
  episode?: number
  status?: string
  countries?: string[]
  originalName?: string
  ids?: Record<string, string>
  tags?: string[]
  epg?: GeilEpgEntry[] | null
  url?: string
  _addonId?: string
  _catalogId?: string
}

export interface GeilFeatureValue {
  id: string
  name: string
}

export interface GeilFeature {
  id: string
  name: string
  multiselect?: boolean
  values?: GeilFeatureValue[]
}

export interface GeilFeatures {
  search?: boolean
  sort?: GeilFeatureValue[]
  filter?: GeilFeature[]
}

export interface GeilCatalogResponse {
  ok?: boolean
  items: GeilItem[]
  nextCursor?: string | number | null
  features?: GeilFeatures
}

export interface GeilItemResponse {
  ok?: boolean
  item: GeilItem
}

export interface GeilLiveResponse {
  ok?: boolean
  items: GeilItem[]
  nextCursor?: string | number | null
  features?: GeilFeatures
}

export interface GeilSource {
  url: string
  name: string
  quality?: string
  languages?: string[]
  subtitles?: GeilSubtitle[]
  size?: number | null
}

export interface GeilPlayback {
  ok?: boolean
  url: string
  format?: string | null
  live?: boolean
  quality?: string | null
  headers?: Record<string, string>
  subtitles?: GeilSubtitle[]
}

export interface PlayerState {
  open: boolean
  title: string
  subtitle?: string
  isLive: boolean
  streamUrl: string
  streamHeaders?: Record<string, string>
  subtitles?: GeilSubtitle[]
  sources?: Array<{ name: string; url: string; id?: string }>
  sourceIndex?: number
  poster?: string
  item?: GeilItem | null
  channels?: GeilItem[]
  channelIndex?: number
  onNext?: (() => void) | null
  onPrev?: (() => void) | null
}

export interface SourceModalState {
  item: GeilItem
  sources: GeilSource[]
  loading: boolean
  error?: string
}
