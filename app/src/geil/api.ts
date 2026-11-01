import type {
  GeilCatalogResponse,
  GeilFeatures,
  GeilItem,
  GeilItemResponse,
  GeilLiveResponse,
  GeilPlayback,
  GeilSource,
} from './types'

import { beginLoading, endLoading, markDelivered } from '@/lib/loading-bus'

async function requestJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  beginLoading()
  try {
    const response = await fetch(url, { signal })
    let data: unknown = null
    try {
      data = await response.json()
    } catch {
      throw new Error(`Sunucu yanıtı okunamadı (${response.status})`)
    }
    const payload = data as { ok?: boolean; error?: string }
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || `İstek başarısız (${response.status})`)
    }
    markDelivered()
    return data as T
  } finally {
    endLoading()
  }
}

export interface CatalogQuery {
  cursor?: string | number | null
  search?: string
  sort?: string
  limit?: number
  filter?: Record<string, string | undefined>
}

export async function fetchTmdbCatalog(
  type: 'video' | 'series',
  catalog: string,
  query: CatalogQuery = {},
  signal?: AbortSignal,
): Promise<GeilCatalogResponse> {
  const params = new URLSearchParams({ type, catalog })
  if (query.cursor !== undefined && query.cursor !== null && query.cursor !== '') params.set('cursor', String(query.cursor))
  if (query.search) params.set('search', query.search)
  if (query.sort) params.set('sort', query.sort)
  if (query.limit) params.set('limit', String(query.limit))
  for (const [key, value] of Object.entries(query.filter || {})) {
    if (value) params.set(`filter[${key}]`, value)
  }
  const data = await requestJson<GeilCatalogResponse>(`/api/geil/tmdb/catalog?${params}`, signal)
  return {
    items: Array.isArray(data.items) ? data.items : [],
    nextCursor: data.nextCursor ?? null,
    features: data.features || {},
  }
}

export async function fetchTmdbItem(type: string, id: string, signal?: AbortSignal): Promise<GeilItem> {
  const params = new URLSearchParams({ type, id })
  const data = await requestJson<GeilItemResponse>(`/api/geil/tmdb/item?${params}`, signal)
  return data.item
}

export async function fetchM3uItem(id: string, signal?: AbortSignal): Promise<GeilItem> {
  const params = new URLSearchParams({ id })
  const data = await requestJson<{ item: GeilItem }>(`/api/geil/vod/m3u/item?${params}`, signal)
  return data.item
}

export async function fetchM3uSeriesEpisodes(id: string, season?: number, signal?: AbortSignal): Promise<{ episodes: GeilItem[]; seasons: number[] }> {
  const params = new URLSearchParams({ id })
  if (season !== undefined) params.set('season', String(season))
  const data = await requestJson<{ seasons?: number[]; episodes: GeilItem[] }>(`/api/geil/vod/m3u/episodes?${params}`, signal)
  return { episodes: Array.isArray(data.episodes) ? data.episodes : [], seasons: data.seasons || [] }
}

export async function fetchLiveCatalog(
  query: CatalogQuery = {},
  signal?: AbortSignal,
): Promise<GeilLiveResponse> {
  const params = new URLSearchParams()
  if (query.cursor !== undefined && query.cursor !== null && query.cursor !== '') params.set('cursor', String(query.cursor))
  if (query.search) params.set('search', query.search)
  if (query.sort) params.set('sort', query.sort)
  if (query.limit) params.set('limit', String(query.limit))
  const group = query.filter?.group
  if (group) params.set('group', group)
  const data = await requestJson<GeilLiveResponse>(`/api/geil/live/catalog?${params}`, signal)
  return {
    items: Array.isArray(data.items) ? data.items : [],
    nextCursor: data.nextCursor ?? null,
    features: data.features || {},
  }
}

/** The ready-made national line-up needs every station of a country at once, so the group is read
    page by page instead of one page at a time like the infinite list. */
export async function fetchAllLiveChannels(
  group: string,
  signal?: AbortSignal,
): Promise<{ items: GeilItem[]; features: GeilFeatures }> {
  const seen = new Set<string>()
  const items: GeilItem[] = []
  let features: GeilFeatures = {}
  let cursor: string | number | null = null
  for (let page = 0; page < 12; page += 1) {
    const data = await fetchLiveCatalog({ filter: { group }, cursor, limit: 300 }, signal)
    if (data.features) features = data.features
    for (const item of data.items) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      items.push(item)
    }
    cursor = data.nextCursor ?? null
    if (!cursor || !data.items.length) break
  }
  return { items, features }
}

export async function resolveLiveChannel(id: string, signal?: AbortSignal): Promise<GeilPlayback> {  return requestJson<GeilPlayback>(`/api/geil/live/resolve?id=${encodeURIComponent(id)}`, signal)
}

export async function fetchM3uGroups(signal?: AbortSignal): Promise<Array<{ id: string; name: string; count: number }>> {
  const data = await requestJson<{ groups: Array<{ id: string; name: string; count: number }> }>('/api/geil/vod/m3u/groups', signal)
  return Array.isArray(data.groups) ? data.groups : []
}

export async function fetchM3uItems(
  query: { group?: string; type?: string; search?: string; offset?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<{ items: GeilItem[]; total: number; hasMore: boolean }> {
  const params = new URLSearchParams()
  if (query.group) params.set('group', query.group)
  if (query.type) params.set('type', query.type)
  if (query.search) params.set('search', query.search)
  if (query.offset) params.set('offset', String(query.offset))
  if (query.limit) params.set('limit', String(query.limit))
  const data = await requestJson<{ items: GeilItem[]; total: number; hasMore: boolean }>(`/api/geil/vod/m3u/items?${params}`, signal)
  return {
    items: Array.isArray(data.items) ? data.items : [],
    total: Number(data.total || 0),
    hasMore: Boolean(data.hasMore),
  }
}

export async function signStreamUrl(url: string, signal?: AbortSignal): Promise<string> {
  const data = await requestJson<{ url: string }>(`/api/geil/proxy?url=${encodeURIComponent(url)}`, signal)
  return data.url
}

export async function fetchVodSources(type: string, id: string, signal?: AbortSignal): Promise<GeilSource[]> {
  const params = new URLSearchParams({ type, id })
  const data = await requestJson<{ sources: GeilSource[] }>(`/api/geil/vod/sources?${params}`, signal)
  return Array.isArray(data.sources) ? data.sources : []
}

export async function fetchVodSourcesForTypes(types: string[], id: string, signal?: AbortSignal): Promise<GeilSource[]> {
  const unique = [...new Set(types.filter(Boolean))]
  const results = await Promise.all(unique.map(async (type) => {
    try { return await fetchVodSources(type, id, signal) } catch { return [] }
  }))
  const byUrl = new Map<string, GeilSource>()
  for (const source of results.flat()) byUrl.set(source.url, source)
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  return [...byUrl.values()]
}

export async function resolveVodSource(
  type: string,
  id: string,
  url: string,
  signal?: AbortSignal,
): Promise<GeilPlayback> {
  const params = new URLSearchParams({ type, id, url })
  return requestJson<GeilPlayback>(`/api/geil/vod/resolve?${params}`, signal)
}

export interface RemoteSession {
  code: string
  token: string
  expiresIn: number
}

export async function createRemoteSession(): Promise<RemoteSession> {
  const response = await fetch('/api/geil/remote?action=session', { method: 'POST' })
  const data = await response.json().catch(() => null) as (RemoteSession & { ok?: boolean; error?: string }) | null
  if (!response.ok || !data || data.ok === false) throw new Error(data?.error || 'Kumanda oturumu açılamadı')
  return data
}

export async function pollRemoteCommands(code: string, token: string, cursor: number, signal?: AbortSignal): Promise<{ commands: Array<{ seq: number; command: string }>; cursor: number }> {
  const params = new URLSearchParams({ action: 'poll', code, token, cursor: String(cursor) })
  const response = await fetch(`/api/geil/remote?${params}`, { signal })
  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    throw new Error('Kumanda yanıtı okunamadı')
  }
  if (!response.ok) {
    const error = new Error((data as { error?: string })?.error || 'Kumanda oturumu kapalı') as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return data as { commands: Array<{ seq: number; command: string }>; cursor: number }
}

export async function sendRemoteCommand(code: string, command: string): Promise<void> {
  const response = await fetch('/api/geil/remote?action=command', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, command }),
  })
  const data = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null
  if (!response.ok || data?.ok === false) {
    // A 404 means the pairing timed out rather than the code being mistyped, and the remote page
    // says something different for each.
    throw Object.assign(new Error(data?.error || 'Komut gönderilemedi'), { status: response.status })
  }
}

export async function closeRemoteSession(code: string, token: string): Promise<void> {
  await fetch(`/api/geil/remote?action=close&code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {})
}

export function imageUrl(url: string | undefined | null, size: 'small' | 'medium' | 'large' | 'original' = 'medium'): string {
  if (!url) return ''
  if (!url.includes('image.tmdb.org/t/p/')) return url
  const replacement = size === 'small' ? 'w342' : size === 'medium' ? 'w780' : 'original'
  return url.replace(/\/t\/p\/[^/]+\//, `/t/p/${replacement}/`)
}

export function backdropUrl(item: GeilItem | null | undefined, size: 'small' | 'medium' | 'large' | 'original' = 'large'): string {
  if (!item) return ''
  return imageUrl(item.images?.backdrops?.[0] || item.images?.poster, size)
}

export function posterUrl(item: GeilItem | null | undefined, size: 'small' | 'medium' | 'large' | 'original' = 'medium'): string {
  if (!item) return ''
  return imageUrl(item.images?.poster || item.images?.thumbnail, size)
}

export function yearOf(item: GeilItem | null | undefined): string {
  return item?.releaseDate ? String(item.releaseDate).slice(0, 4) : ''
}

export function runtimeLabel(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds)) return ''
  const minutes = Math.round(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours > 0 ? `${hours} sa ${rest} dk` : `${minutes} dk`
}

export function ratingOf(item: GeilItem | null | undefined): string {
  const ratings = item?.ratings || {}
  const value = ratings.tmdb ?? ratings.imdb ?? Object.values(ratings)[0]
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : ''
}

export function channelName(name: string): string {
  return String(name || '').replace(/\s*\(\d+\)\s*$/, '').trim() || name
}

export function channelQuality(name: string): string {
  const upper = String(name || '').toUpperCase()
  if (/\b(4K|UHD)\b/.test(upper)) return '4K'
  if (/\bFHD\b/.test(upper)) return 'FHD'
  if (/\bHD\b/.test(upper)) return 'HD'
  if (/\bSD\b/.test(upper)) return 'SD'
  return ''
}

export function channelNumber(name: string): string {
  const match = /\((\d+)\)\s*$/.exec(String(name || ''))
  return match ? match[1] : ''
}

const QUALITY_TOKEN = /\b(4k|uhd|2160p|full\s?hd|fhd|hd\+|hd|sd|hevc|x?265|1080p|720p|hq|lq)\b/gi

/** The station behind a stream name: "4K TR: ATV HD (3)" and "ATV HEVC" are both ATV. */
export function channelStation(name: string): string {
  let value = channelName(name)
  value = value.replace(/^\s*(?:4k|uhd|fhd|hd)?\s*(?:tr|turk|türk)\s*[:\-|]\s*/i, '')
  // The provider files 'TRT TÜRK' as 'TRT T RK' — the Ü is dropped, not the rest of the word.
  value = value.replace(/\bT ?RK\b/g, 'TÜRK')
  value = value.replace(QUALITY_TOKEN, ' ')
  return value.replace(/\s+/g, ' ').replace(/^[\s.\-_|[\]()]+|[\s.\-_|[\]()]+$/g, '').trim()
}

export function qualityRank(name: string): number {
  const upper = String(name || '').toUpperCase()
  if (/4K|UHD|2160P/.test(upper)) return 4
  if (/FHD|FULL HD|HD\+/.test(upper)) return 3
  if (/\bHD\b/.test(upper)) return 2
  if (/\bSD\b/.test(upper)) return 0
  return 1
}

/** The live provider lists every station once per quality variant — "KANAL (7)", "KANAL (6)"… —
    and the viewer came to this list in the order its own editor put it, which is the order they
    expect to find a station in and the order the remote's channel dial steps through. So the rows
    are collapsed to one per station, best picture first, and left exactly where the list put them.
    Only an order the viewer picks themselves rearranges the page. */
export function normalizeLiveChannels(items: GeilItem[], sort = ''): GeilItem[] {
  const byStation = new Map<string, GeilItem>()
  for (const channel of items) {
    const key = channelStation(channel.name).toLocaleLowerCase('tr') || channel.id
    const held = byStation.get(key)
    if (!held || qualityRank(channel.name) > qualityRank(held.name)) byStation.set(key, channel)
  }
  const unique = [...byStation.values()]
  if (sort !== 'name') return unique
  // A provider decorates some stations (".BLACK", "[[ TELEKOM SPORT ]]"); comparing the decorated
  // string files them under punctuation, so the alphabet is keyed on the first real word.
  const sortKey = (name: string) => channelStation(name).replace(/^[^\p{L}\p{N}]+/u, '')
  return unique.sort((a, b) =>
    sortKey(a.name).localeCompare(sortKey(b.name), 'tr', { numeric: true, sensitivity: 'base' }),
  )
}

export function initialOf(name: string): string {
  return (String(name || '?').replace(/^[^\p{L}\p{N}]+/u, '')[0] || '?').toUpperCase()
}

const CHANNEL_COLORS = [
  '#48244c', '#4c3924', '#3b4c24', '#4c2824', '#4c2e24', '#3b244c',
  '#244c48', '#4c3a24', '#2c244c', '#244c28', '#4c2432', '#24404c',
]

export function channelColor(name: string): string {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) >>> 0
  return CHANNEL_COLORS[hash % CHANNEL_COLORS.length]
}

export function formatClock(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

export function remainingLabel(end: string): string {
  const endAt = new Date(end).getTime()
  if (!Number.isFinite(endAt)) return ''
  const minutes = Math.max(0, Math.round((endAt - Date.now()) / 60000))
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    return `${hours} sa ${minutes % 60} dk kaldı`
  }
  return `${minutes} dk kaldı`
}

export function currentEpg(item: GeilItem | null | undefined): { entry: GeilEpgEntryLike | null; progress: number } {
  const entries = Array.isArray(item?.epg) ? item!.epg! : []
  const now = Date.now()
  const entry = entries.find((candidate) => {
    const start = new Date(candidate.start).getTime()
    const end = new Date(candidate.end).getTime()
    return Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end
  }) || entries.find((candidate) => new Date(candidate.end).getTime() > now) || null
  if (!entry) return { entry: null, progress: 0 }
  const start = new Date(entry.start).getTime()
  const end = new Date(entry.end).getTime()
  const progress = end > start ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : 0
  return { entry, progress }
}

interface GeilEpgEntryLike {
  title: string
  start: string
  end: string
}

export function mergeFeatures(...features: Array<GeilFeatures | undefined | null>): GeilFeatures {
  const result: GeilFeatures = { search: false, sort: [], filter: [] }
  for (const feature of features) {
    if (!feature) continue
    if (feature.search) result.search = true
    if (feature.sort?.length) result.sort = feature.sort
    if (feature.filter?.length) result.filter = feature.filter
  }
  return result
}
