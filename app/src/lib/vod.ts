export interface VodSubtitle {
  label: string
  language: string
  url: string
  format: string
}

export interface VodItem {
  type: 'movie' | 'series'
  id: string
  name: string
  poster: string
  backdrop?: string
  categoryId: string
  category: string
  year: number
  rating: string
  plot: string
  cast: string
  director: string
  genre: string[]
  country: string
  duration: string
  stream?: string
  subtitles?: VodSubtitle[]
  seasons?: VodSeason[]
  isNew?: boolean
}

export interface VodSeason {
  number: string
  episodes: VodEpisode[]
}

export interface VodEpisode {
  id: string
  number: number
  title: string
  plot: string
  still?: string
  stream: string
  subtitles: VodSubtitle[]
}

export interface VodCategory {
  id: string
  name: string
  label?: string
  type: 'movie' | 'series'
  count: number
}

export interface VodHome {
  ok: boolean
  ready: boolean
  totalMovies: number
  totalSeries: number
  categories: VodCategory[]
  rows: Array<{ key: string; title: string; type: 'movie' | 'series'; categoryId: string; count: number; items: VodItem[] }>
  hero: VodItem[]
  generatedAt: number
}

export interface VodListPage {
  ok: boolean
  type: 'movie' | 'series' | 'all'
  category: string
  page: number
  limit: number
  total: number
  hasMore: boolean
  items: VodItem[]
}

export type VodDetail = VodItem & Record<string, unknown>

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, headers: { accept: 'application/json' } })
  const payload = await response.json().catch(() => null) as ({ error?: string } | null)
  if (!response.ok) throw new Error(payload?.error || `VOD isteği başarısız (${response.status})`)
  return payload as T
}

export function fetchVodHome(signal?: AbortSignal): Promise<VodHome> {
  return request<VodHome>('/api/vod/home', signal)
}

export function fetchVodList(options: {
  type?: 'movie' | 'series' | 'all'
  category?: string
  page?: number
  limit?: number
  sort?: 'new' | 'name'
  query?: string
  signal?: AbortSignal
} = {}): Promise<VodListPage> {
  const params = new URLSearchParams()
  params.set('type', options.type || 'all')
  params.set('category', options.category || 'all')
  params.set('page', String(options.page || 1))
  params.set('limit', String(options.limit || 48))
  if (options.sort) params.set('sort', options.sort)
  if (options.query) params.set('q', options.query)
  return request<VodListPage>(`/api/vod/list?${params.toString()}`, options.signal)
}

export function fetchVodDetail(type: 'movie' | 'series', id: string, signal?: AbortSignal): Promise<VodDetail> {
  const params = new URLSearchParams({ type, id })
  return request<VodDetail>(`/api/vod/detail?${params.toString()}`, signal)
}

export function fetchVodStream(type: 'movie' | 'series', id: string, signal?: AbortSignal): Promise<{ stream: string; subtitles: VodSubtitle[]; title: string; poster: string }> {
  const params = new URLSearchParams({ type, id })
  return request(`/api/vod/play?${params.toString()}`, signal)
}

export function fetchVodEpisodeStream(id: string, signal?: AbortSignal): Promise<{ stream: string; subtitles: VodSubtitle[]; title: string; poster: string }> {
  const params = new URLSearchParams({ id })
  return request(`/api/vod/play-episode?${params.toString()}`, signal)
}

const vodCache = new Map<string, Promise<VodHome>>()

export function preloadVodHome(): Promise<VodHome> {
  const key = 'home-v1'
  let pending = vodCache.get(key)
  if (!pending) {
    pending = fetchVodHome().catch((error: unknown) => {
      vodCache.delete(key)
      throw error
    })
    vodCache.set(key, pending)
  }
  return pending
}
