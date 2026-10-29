export interface VavooEpgSlot {
  start: number
  stop: number
  title: string
}

export interface VavooChannel {
  id: string
  name: string
  logo: string
  category: string
  quality: string
  featured: boolean
  epg: VavooEpgSlot[]
  qualityVariants?: Array<{ id: string; name: string; quality: string }>
  country?: string
}

export interface VavooCatalog {
  ok: boolean
  source: string
  group: string
  total: number
  rawTotal: number
  generatedAt: number
  channels: VavooChannel[]
}

export interface VavooResolve {
  ok: boolean
  id: string
  name: string
  stream: string
  streams: string[]
  expiresAt: number
}

export interface VavooStatus {
  ok: boolean
  active: boolean
  percent: number
  page: number
  raw: number
  total: number
  message: string
  error: string
  cached?: boolean
}

export const CATEGORY_ORDER = [
  'Ulusal',
  'Haber',
  'Spor',
  'Belgesel',
  'Müzik',
  'Yerel',
  'Sinema & Dizi',
  'Çocuk',
  'Yaşam',
  'Dinî',
  'Eğitim',
] as const

const FEATURED_CATEGORY = 'Tüm Kanallar'

export { FEATURED_CATEGORY }

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    throw new Error(response.ok ? 'Sunucu geçersiz bir yanıt döndürdü' : `Sunucu hatası (${response.status})`)
  }

  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error
    throw new Error(message || `Sunucu hatası (${response.status})`)
  }

  return data as T
}

export async function loadVavooCatalog(signal?: AbortSignal): Promise<VavooCatalog> {
  const response = await fetch('/api/vavoo/channels', {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal,
    cache: 'no-store',
  })
  return readJson<VavooCatalog>(response)
}

export async function loadVavooStatus(signal?: AbortSignal): Promise<VavooStatus> {
  const response = await fetch('/api/vavoo/status', {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal,
    cache: 'no-store',
  })
  return readJson<VavooStatus>(response)
}

export async function resolveVavooChannel(id: string, refresh = false, signal?: AbortSignal): Promise<VavooResolve> {
  const params = new URLSearchParams({ id })
  if (refresh) params.set('refresh', '1')

  const response = await fetch(`/api/vavoo/resolve?${params.toString()}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal,
    cache: 'no-store',
  })
  return readJson<VavooResolve>(response)
}

export function resolveVavooVariant(baseId: string, quality: string, signal?: AbortSignal): Promise<VavooResolve> {
  const params = new URLSearchParams({ id: baseId, quality })
  return fetch(`/api/vavoo/resolve?${params.toString()}`, { signal, headers: { accept: 'application/json' }, cache: 'no-store' })
    .then(readJson<VavooResolve>)
}

export function getNowNext(channel: VavooChannel, at = Date.now() / 1000): {
  now: VavooEpgSlot | null
  next: VavooEpgSlot | null
} {
  const now = channel.epg.find((slot) => slot.start <= at && slot.stop > at) || null
  const next = channel.epg.find((slot) => slot.start > at) || null
  return { now, next }
}

export function channelInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'N'
  const first = Array.from(trimmed)[0] || 'N'
  if (first === '4') return '4K'
  return first.toLocaleUpperCase('tr')
}

export function formatEpgTime(seconds: number): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Istanbul',
    }).format(new Date(seconds * 1000))
  } catch {
    const date = new Date(seconds * 1000)
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }
}

export function searchKey(value: string): string {
  return value
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/i̇/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '')
}

export function pickDefaultChannel(channels: VavooChannel[]): VavooChannel | null {
  if (channels.length === 0) return null
  return (
    channels.find((channel) => channel.name === 'TRT 1') ||
    channels.find((channel) => channel.name.replace(/\s+/g, ' ').startsWith('TRT 1')) ||
    channels.find((channel) => channel.name === 'TRT') ||
    channels.find((channel) => channel.featured && channel.category === 'Ulusal') ||
    channels.find((channel) => channel.featured) ||
    channels[0]
  )
}
