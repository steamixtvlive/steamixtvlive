import { Readable } from 'node:stream'
import { createHmac, randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import ffmpegPathStatic from 'ffmpeg-static'

/**
 * NOTFLIX VOD library.
 *
 * The provider is an Xtream-compatible panel. Its credentials and stream URLs
 * stay on the server; the browser only sees /api/vod/* endpoints and opaque
 * ids. The catalog is fetched once on boot and cached in memory.
 */

const PROVIDER_BASE = (process.env.MCLANX_URL || 'http://mclanx.store:8080').replace(/\/+$/, '')
const PROVIDER_USER = process.env.MCLANX_USER || 'Paris123'
const PROVIDER_PASS = process.env.MCLANX_PASS || 'Paris123'

let PROVIDER_HOST = 'mclanx.store'
try {
  PROVIDER_HOST = new URL(PROVIDER_BASE).hostname
} catch {
  // Keep the fallback host for image validation.
}

const CATALOG_TTL_MS = 6 * 60 * 60 * 1000
const DETAIL_TTL_MS = 45 * 60 * 1000
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000
const PAGE_SIZE = 42
const HOME_ROW_SIZE = 48
const MAX_TOKENS = 5000
const MAX_DETAILS = 350
const FETCH_TIMEOUT_MS = 60000
const RETRY_DELAY_MS = 45 * 1000
const URL_SECRET = randomBytes(32)

let ffmpegPath = null
try {
  if (ffmpegPathStatic && fs.existsSync(ffmpegPathStatic)) ffmpegPath = ffmpegPathStatic
} catch {
  // ffmpeg is optional; the stream proxy still works without transcoding.
}

const ADULT_RE = /(?:^|[\s._-])(?:adult|xxx|porn|erotik|erotic|18\+|brazzers|onlyfans)(?:$|[\s._-])/i
const SERIES_RE = /(?:^|[\s._-])(?:series|serie|dizi|diziler|tv\s*shows?)(?:$|[\s._-])/i
const MOVIE_RE = /(?:^|[\s._-])(?:vod|movie|movies|film|films|sinema|cinema)(?:$|[\s._-])/i

const CATEGORY_PRIORITY = [
  'yeni filmler',
  'yeni diziler',
  'filmler',
  'diziler',
  'aksiyon',
  'action',
  'macera',
  'adventure',
  'komedi',
  'comedy',
  'dram',
  'drama',
  'bilim kurgu',
  'sci-fi',
  'science fiction',
  'fantastik',
  'fantasy',
  'gerilim',
  'thriller',
  'korku',
  'horror',
  'suç',
  'suc',
  'crime',
  'romantik',
  'romance',
  'animasyon',
  'animation',
  'aile',
  'family',
  'belgesel',
  'documentary',
  'yerli',
  'türk',
  'turk',
  'yabancı',
  'yabanci',
  'çocuk',
  'cocuk',
  'kids',
  'tarih',
  'history',
  'savaş',
  'savas',
  'war',
  'western',
  'müzikal',
  'musical',
  'spor',
  'sport',
  'biyografi',
  'biography',
  'gizem',
  'mystery',
]

const LANGUAGE_NAMES = {
  tr: 'Türkçe',
  tur: 'Türkçe',
  en: 'English',
  eng: 'English',
  de: 'Deutsch',
  ger: 'Deutsch',
  deu: 'Deutsch',
  fr: 'Français',
  fre: 'Français',
  fra: 'Français',
  es: 'Español',
  spa: 'Español',
  it: 'Italiano',
  ita: 'Italiano',
  ar: 'العربية',
  ara: 'العربية',
  ru: 'Русский',
  rus: 'Русский',
  nl: 'Nederlands',
  pl: 'Polski',
  pt: 'Português',
  el: 'Ελληνικά',
  gre: 'Ελληνικά',
}

const state = {
  ready: false,
  loading: false,
  generatedAt: 0,
  expiresAt: 0,
  movies: [],
  series: [],
  movieById: new Map(),
  seriesById: new Map(),
  episodeById: new Map(),
  categories: [],
  rows: [],
  hero: [],
  error: '',
}

const progress = {
  active: false,
  percent: 0,
  message: 'Hazır',
  error: '',
  startedAt: 0,
  finishedAt: 0,
}

const detailCache = new Map()
const tokenStore = new Map()
let loadPromise = null
let heroPromise = null
let retryAt = 0
let retryTimer = null

function signValue(value) {
  return createHmac('sha256', URL_SECRET).update(String(value)).digest('base64url')
}

function verifySignedValue(value, signature) {
  if (!value || !signature) return false
  const expected = signValue(value)
  if (expected.length !== signature.length) return false
  let mismatch = 0
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index)
  }
  return mismatch === 0
}

function signedMediaUrl(url) {
  const encoded = encodeBase64Url(url)
  return `/api/vod/hls?u=${encoded}&s=${signValue(encoded)}`
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept, Authorization')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type')
}

function sendJson(res, status, data) {
  if (res.headersSent) return
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store, max-age=0',
    'access-control-allow-origin': '*',
  })
  res.end(body)
}

function sendText(res, status, text, type = 'text/plain; charset=utf-8') {
  if (res.headersSent) return
  res.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store, max-age=0',
    'access-control-allow-origin': '*',
  })
  res.end(text)
}

const LOGO_FALLBACK = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"></svg>',
)

function sendImageFallback(res) {
  if (res.headersSent) return
  res.writeHead(200, {
    'content-type': 'image/svg+xml',
    'content-length': LOGO_FALLBACK.length,
    'cache-control': 'public, max-age=60',
    'access-control-allow-origin': '*',
  })
  res.end(LOGO_FALLBACK)
}

function encodeBase64Url(value) {
  return Buffer.from(String(value), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function decodeBase64Url(value) {
  return Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function absoluteUrl(value, base = PROVIDER_BASE) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`
  try {
    const baseUrl = String(base || PROVIDER_BASE)
    return new URL(raw, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString()
  } catch {
    return ''
  }
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanCategoryName(value) {
  let name = normalizeText(value)
  if (!name) return 'Diğer'
  name = name.replace(/^\[[^\]]*\]\s*/g, '')
  name = name.replace(/^(?:VOD|MOVIES?|FILMS?|SERIES?|DIZI|DİZİ)\s*[|:·-]\s*/i, '')
  name = name.replace(/\s*[|]\s*(?:VOD|MOVIES?|FILMS?|SERIES?|DIZI|DİZİ)\s*$/i, '')
  name = name.replace(/\s+/g, ' ').trim()
  return name || 'Diğer'
}

function isAdultCategory(name) {
  return ADULT_RE.test(normalizeText(name))
}

function searchKey(value) {
  return normalizeText(value)
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

function nameSearchTerms(value) {
  const words = normalizeText(value).toLocaleLowerCase('tr').match(/[\p{L}\p{N}]+/gu) || []
  return words.filter((word) => word.length > 0)
}

function nameSearchScore(name, query) {
  const title = searchKey(name)
  const needle = searchKey(query)
  if (!title || !needle) return 0
  if (title === needle) return 1000
  if (title.startsWith(needle)) return 900
  if (title.includes(needle)) return 800

  const words = nameSearchTerms(name)
  const queryWords = nameSearchTerms(query)
  if (!queryWords.length) return 0
  const normalizedWords = words.map(searchKey)
  const exactWordMatches = queryWords.filter((word) => normalizedWords.some((entry) => entry === searchKey(word))).length
  const allWords = exactWordMatches === queryWords.length
  if (allWords) return 700 + exactWordMatches
  if (exactWordMatches > 0) return 400 + exactWordMatches * 10

  const compactName = words.map(searchKey)
  const covered = queryWords.filter((word) => compactName.some((entry) => entry.includes(searchKey(word)) || searchKey(word).includes(entry))).length
  if (covered === queryWords.length) return 300 + covered
  if (covered) return 100 + covered
  return 0
}

function bestMatchSearchScore(name, query) {
  const exactScore = nameSearchScore(name, query)
  if (exactScore) return exactScore
  const queryWords = nameSearchTerms(query).map(searchKey).filter(Boolean)
  const titleWords = nameSearchTerms(name).map(searchKey).filter(Boolean)
  if (!queryWords.length || !titleWords.length) return 0
  let matched = 0
  let total = 0
  for (const queryWord of queryWords) {
    let best = 0
    for (const titleWord of titleWords) {
      if (queryWord === titleWord) best = Math.max(best, 1)
      else if (queryWord.length >= 3 && titleWord.length >= 3 && (queryWord.startsWith(titleWord) || titleWord.startsWith(queryWord))) best = Math.max(best, 0.72)
      else if (queryWord.length >= 4 && titleWord.length >= 4) {
        const shared = [...queryWord].filter((character, index) => character === titleWord[index]).length
        best = Math.max(best, shared / Math.max(queryWord.length, titleWord.length))
      }
    }
    matched += best
    total += 1
  }
  const ratio = matched / total
  return ratio >= 0.62 ? Math.round(250 + ratio * 100) : 0
}

function normalizedCategoryLabel(name) {
  const key = searchKey(name)
  if (/^(?:tr)?yerlidiziler$/.test(key) || /^(?:tr)?(?:yerli)?diziler?$/.test(key) || /^(?:tr)?tvdizileri$/.test(key)) return 'Yerli Diziler'
  const weekday = '(?:pazartesi|sali|carsamba|persembe|cuma|cumartesi|pazar)'
  if (new RegExp(`^(?:tr)?${weekday}(?:dizileri|diziler|dizi|dizigunu)?$`).test(key)) return 'Yerli Diziler'
  return cleanCategoryName(name)
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, Math.floor(number)))
}

function parseYear(value, fallbackName = '') {
  const direct = String(value || '').match(/\b(19\d{2}|20\d{2})\b/)
  if (direct) return Number(direct[1])
  const fromName = String(fallbackName || '').match(/\(?\b(19\d{2}|20\d{2})\b\)?/)
  return fromName ? Number(fromName[1]) : 0
}

function parseRating(...values) {
  for (const value of values) {
    const number = Number(String(value ?? '').replace(',', '.'))
    if (Number.isFinite(number) && number > 0) {
      const normalized = number > 10 ? number / 10 : number
      return Math.round(normalized * 10) / 10
    }
  }
  return 0
}

function normalizeList(value) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    if (Array.isArray(value.data)) return value.data
    if (Array.isArray(value.items)) return value.items
    if (Array.isArray(value.results)) return value.results
    const objectValues = Object.values(value)
    if (objectValues.length > 0 && objectValues.every((entry) => entry && typeof entry === 'object')) {
      return objectValues
    }
  }
  return []
}

function normalizeGenres(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeText(entry?.name || entry)).filter(Boolean)
  }
  return String(value || '')
    .split(/[,/|]/)
    .map((entry) => normalizeText(entry))
    .filter(Boolean)
}

function firstImage(value) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string' && entry.trim()) return entry.trim()
      if (entry && typeof entry === 'object') {
        const nested = entry.url || entry.image || entry.path
        if (nested) return String(nested)
      }
    }
    return ''
  }
  if (value && typeof value === 'object') {
    return String(value.url || value.image || value.path || '')
  }
  return normalizeText(value)
}

function imageProxyUrl(value) {
  let url = firstImage(value)
  if (!url || url === 'adult') return ''
  if (url.startsWith('/t/p/')) url = `https://image.tmdb.org${url}`
  if (/^image\.tmdb\.org\//i.test(url)) url = `https://${url}`
  if (!/^https?:\/\//i.test(url)) return ''
  if (url.startsWith('https://image.tmdb.org/')) return url
  const encoded = encodeBase64Url(url)
  return `/api/vod/image?u=${encoded}&s=${signValue(encoded)}`
}

function providerUrl(pathOrUrl) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  return `${PROVIDER_BASE}${String(pathOrUrl).startsWith('/') ? '' : '/'}${pathOrUrl}`
}

function apiUrl(action, extra = {}) {
  const url = new URL(`${PROVIDER_BASE}/player_api.php`)
  url.searchParams.set('username', PROVIDER_USER)
  url.searchParams.set('password', PROVIDER_PASS)
  if (action) url.searchParams.set('action', action)
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

const PROVIDER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  accept: 'application/json, text/plain, */*',
}

const STREAM_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  accept: '*/*',
}

async function providerJson(action, extra = {}) {
  const response = await fetch(apiUrl(action, extra), {
    headers: PROVIDER_HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`Sağlayıcıya ulaşılamadı (${response.status})`)
  }
  const text = await response.text()
  if (!text.trim()) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Sağlayıcı geçersiz bir yanıt döndürdü')
  }
}

function rememberToken(kind, data) {
  const now = Date.now()
  for (const [token, entry] of tokenStore) {
    if (entry.expiresAt <= now) tokenStore.delete(token)
  }
  while (tokenStore.size >= MAX_TOKENS) {
    const oldest = tokenStore.keys().next().value
    if (!oldest) break
    tokenStore.delete(oldest)
  }
  const token = randomBytes(18).toString('hex')
  const payload = typeof data === 'string' ? { url: data } : { ...data }
  tokenStore.set(token, { kind, ...payload, expiresAt: now + TOKEN_TTL_MS })
  return token
}

function readToken(token) {
  const entry = tokenStore.get(token)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    tokenStore.delete(token)
    return null
  }
  return entry
}

function toTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1e12) return Math.floor(value)
    if (value > 1e9) return Math.floor(value * 1000)
    return 0
  }
  const text = String(value || '').trim()
  if (!text) return 0
  if (/^\d{10,13}$/.test(text)) return toTimestamp(Number(text))
  const parsed = Date.parse(text)
  return Number.isFinite(parsed) ? parsed : 0
}

function extensionFromUrl(value) {
  try {
    const path = new URL(value).pathname
    const match = path.match(/\.([a-z0-9]{2,8})$/i)
    return match ? match[1].toLowerCase() : ''
  } catch {
    return ''
  }
}

function normalizeCategoryEntries(raw) {
  const seen = new Set()
  const list = []
  for (const [index, entry] of normalizeList(raw).entries()) {
    const id = String(entry?.category_id ?? entry?.id ?? index)
    const name = normalizedCategoryLabel(entry?.category_name ?? entry?.name ?? entry?.title)
    if (!id || !name || isAdultCategory(name)) continue
    const key = `${id}:${name}`
    if (seen.has(key)) continue
    seen.add(key)
    list.push({ id, name })
  }
  return {
    list,
    map: new Map(list.map((entry) => [entry.id, entry.name])),
  }
}

function inferCatalogCategory(type, id, name, original) {
  const normalized = normalizeText(name).toLocaleLowerCase('tr')
  const isTurkishSeries = type === 'series' && /(?:uzak şehir|mehmed|fatih|kızılcık şerbeti|show|atv|now|trt|yerli|turkish)/i.test(normalized)
  if (isTurkishSeries) return { id: 'inferred:tr-series', name: 'Yerli Diziler' }
  if (/netflix/i.test(original || '')) return { id: `inferred:netflix:${id}`, name: /\btr\b|turk/i.test(original || '') ? 'TR Netflix' : 'Yabancı Netflix' }
  if (/(?:amazon|prime video)/i.test(original || '')) return { id: `inferred:prime:${id}`, name: 'Prime Video' }
  if (/(?:disney\+?|disney plus)/i.test(original || '')) return { id: `inferred:disney:${id}`, name: 'Disney+' }
  if (/max|hbo/i.test(original || '')) return { id: `inferred:max:${id}`, name: 'Max / HBO' }
  return null
}

function normalizeMovieItem(raw, categoryMap) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.stream_id ?? raw.id ?? raw.vod_id ?? '')
  const name = normalizeText(raw.name ?? raw.title ?? raw.o_name)
  if (!id || !name) return null
  if (isAdultCategory(name) || isAdultCategory(raw.category_name)) return null

  const categoryId = String(raw.category_id ?? raw.categoryId ?? '')
  const directSource = String(raw.direct_source || raw.directSource || '').trim()
  const sourceUrl = /^https?:\/\//i.test(directSource) ? directSource : ''
  const ext =
    String(raw.container_extension || raw.containerExtension || '').replace(/^\./, '').toLowerCase() ||
    extensionFromUrl(sourceUrl) ||
    'mp4'

  return {
    type: 'movie',
    id,
    name,
    poster: imageProxyUrl(raw.stream_icon || raw.cover || raw.cover_big || raw.movie_image || raw.poster),
    backdrop: imageProxyUrl(raw.backdrop_path || raw.backdrop || raw.movie_image || raw.stream_icon),
    categoryId,
    category: categoryMap.get(categoryId) || cleanCategoryName(raw.category_name) || 'Diğer',
    year: parseYear(raw.releasedate || raw.releaseDate || raw.year, name),
    rating: parseRating(raw.rating, raw.rating_5based),
    added: toTimestamp(raw.added),
    plot: normalizeText(raw.plot || raw.description || raw.overview),
    cast: normalizeText(raw.cast || raw.actors),
    director: normalizeText(raw.director),
    genre: normalizeGenres(raw.genre || raw.genres),
    country: normalizeText(raw.country),
    duration: normalizeText(raw.duration || raw.episode_run_time),
    ext,
    sourceUrl,
  }
}

function normalizeSeriesItem(raw, categoryMap) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.series_id ?? raw.id ?? '')
  const name = normalizeText(raw.name ?? raw.title ?? raw.o_name)
  if (!id || !name) return null
  if (isAdultCategory(name) || isAdultCategory(raw.category_name)) return null

  const original = normalizeText(raw.o_name || raw.original_name || raw.source || '')
  const inferredCategory = inferCatalogCategory('series', id, name, original) || (/^(?:TR\s*)?(?:PAZARTESI|SALI|CARSAMBA|PERSEMBE|CUMA|CUMARTESI|PAZAR)\s+DIZILERI$/i.test(categoryMap.get(String(raw.category_id ?? raw.categoryId ?? '')) || '') ? { id: 'inferred:tr-series', name: 'Yerli Diziler' } : null)
  const categoryId = inferredCategory?.id || String(raw.category_id ?? raw.categoryId ?? '')
  return {
    type: 'series',
    id,
    name,
    poster: imageProxyUrl(raw.cover || raw.cover_big || raw.stream_icon || raw.poster),
    backdrop: imageProxyUrl(raw.backdrop_path || raw.backdrop || raw.cover_big || raw.cover),
    categoryId,
    category: inferredCategory?.name || categoryMap.get(categoryId) || cleanCategoryName(raw.category_name) || 'Diğer',
    year: parseYear(raw.releaseDate || raw.releasedate || raw.year, name),
    rating: parseRating(raw.rating, raw.rating_5based),
    added: toTimestamp(raw.added),
    plot: normalizeText(raw.plot || raw.description || raw.overview),
    cast: normalizeText(raw.cast || raw.actors),
    director: normalizeText(raw.director),
    genre: normalizeGenres(raw.genre || raw.genres),
    country: normalizeText(raw.country),
    duration: normalizeText(raw.duration || raw.episode_run_time),
    ext: 'mp4',
    sourceUrl: '',
  }
}

async function fetchXtreamCatalog() {
  progress.message = 'Film ve dizi kategorileri alınıyor...'
  progress.percent = 10

  const [movieCategoriesResult, seriesCategoriesResult] = await Promise.allSettled([
    providerJson('get_vod_categories'),
    providerJson('get_series_categories'),
  ])

  const movieCategories = normalizeCategoryEntries(
    movieCategoriesResult.status === 'fulfilled' ? movieCategoriesResult.value : [],
  )
  const seriesCategories = normalizeCategoryEntries(
    seriesCategoriesResult.status === 'fulfilled' ? seriesCategoriesResult.value : [],
  )

  progress.message = 'Film kataloğu alınıyor...'
  progress.percent = 26

  let moviesRaw = []
  let seriesRaw = []
  let movieError = null
  let seriesError = null

  try {
    moviesRaw = normalizeList(await providerJson('get_vod_streams'))
  } catch (error) {
    movieError = error
  }

  progress.message = 'Dizi kataloğu alınıyor...'
  progress.percent = 52

  try {
    seriesRaw = normalizeList(await providerJson('get_series'))
  } catch (error) {
    seriesError = error
  }

  if (moviesRaw.length === 0 && seriesRaw.length === 0) {
    throw movieError || seriesError || new Error('Sağlayıcı VOD kataloğu boş')
  }

  progress.message = 'Film afişleri ve bilgileri hazırlanıyor...'
  progress.percent = 67

  const movieById = new Map()
  for (const raw of moviesRaw) {
    const item = normalizeMovieItem(raw, movieCategories.map)
    if (!item) continue
    if (!movieById.has(item.id)) movieById.set(item.id, item)
  }

  const seriesById = new Map()
  for (const raw of seriesRaw) {
    const item = normalizeSeriesItem(raw, seriesCategories.map)
    if (!item) continue
    if (!seriesById.has(item.id)) seriesById.set(item.id, item)
  }

  if (movieById.size === 0 && seriesById.size === 0) {
    throw new Error('Sağlayıcı kataloğunda oynatılabilir film veya dizi bulunamadı')
  }

  return {
    movies: [...movieById.values()],
    series: [...seriesById.values()],
    movieById,
    seriesById,
    episodeById: new Map(),
    movieCategories: movieCategories.list,
    seriesCategories: seriesCategories.list,
    source: 'xtream',
  }
}

function hashId(value) {
  let hash = 2166136261
  const text = String(value)
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function parseM3uEntries(text) {
  const entries = []
  let meta = null
  for (const line of String(text || '').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('#EXTINF:')) {
      const comma = trimmed.indexOf(',')
      const header = comma >= 0 ? trimmed.slice(8, comma) : trimmed.slice(8)
      const title = comma >= 0 ? trimmed.slice(comma + 1).trim() : ''
      const attrs = {}
      header.replace(/([A-Za-z0-9_-]+)="([^"]*)"/g, (_match, key, value) => {
        attrs[key.toLowerCase()] = value
        return ''
      })
      meta = { attrs, title }
      continue
    }

    if (trimmed.startsWith('#')) continue
    if (!meta || !/^https?:\/\//i.test(trimmed)) continue
    entries.push({ attrs: meta.attrs, title: meta.title, url: trimmed })
    meta = null
  }
  return entries
}

function episodeNumberFromName(name) {
  const patterns = [
    /^(.*?)[\s._-]*[Ss](\d{1,2})[\s._-]*[Ee](\d{1,3})\b/,
    /^(.*?)[\s._-]*(\d{1,2})\.\s*Sezon\s*(\d{1,3})\.\s*Bölüm/i,
    /^(.*?)[\s._-]*Sezon\s*(\d{1,2})[\s._-]*Bölüm\s*(\d{1,3})/i,
  ]
  for (const pattern of patterns) {
    const match = String(name || '').match(pattern)
    if (match) {
      return {
        title: normalizeText(match[1]),
        season: Number(match[2]) || 1,
        episode: Number(match[3]) || 0,
      }
    }
  }
  return { title: normalizeText(name), season: 1, episode: 0 }
}

async function fetchProviderText(path) {
  const response = await fetch(providerUrl(path), {
    headers: {
      ...STREAM_HEADERS,
      accept: 'application/x-mpegURL, text/plain, */*',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(120000),
  })
  if (!response.ok) throw new Error(`Sağlayıcı listesi alınamadı (${response.status})`)
  const text = await response.text()
  if (!text.trim()) throw new Error('Sağlayıcı boş bir liste döndürdü')
  if (text.trimStart().startsWith('{')) throw new Error('Sağlayıcı M3U yerine geçersiz bir yanıt döndürdü')
  return text
}

async function fetchM3uCatalog() {
  progress.message = 'M3U kütüphanesi alınıyor...'
  progress.percent = 18

  const query = new URLSearchParams({
    username: PROVIDER_USER,
    password: PROVIDER_PASS,
    type: 'm3u_plus',
    output: 'ts',
  })
  const text = await fetchProviderText(`/get.php?${query.toString()}`)

  progress.message = 'M3U kayıtları ayrıştırılıyor...'
  progress.percent = 48

  const entries = parseM3uEntries(text)
  const movies = []
  const series = []
  const movieById = new Map()
  const seriesById = new Map()
  const episodeById = new Map()
  const movieCategoryMap = new Map()
  const seriesCategoryMap = new Map()
  const seriesEpisodeCounts = new Map()
  const seriesPoster = new Map()
  const seriesMeta = new Map()

  const movieCategories = new Map()
  const seriesCategories = new Map()

  function categoryFor(group, type) {
    const name = cleanCategoryName(group) || 'Diğer'
    if (isAdultCategory(name)) return null
    const id = `m3u:${type}:${hashId(name)}`
    const map = type === 'movie' ? movieCategories : seriesCategories
    if (!map.has(id)) map.set(id, { id, name })
    return { id, name }
  }

  for (const [index, entry] of entries.entries()) {
    let pathname = ''
    try {
      pathname = new URL(entry.url).pathname
    } catch {
      continue
    }

    if (/\/live\//i.test(pathname)) continue
    const group = entry.attrs['group-title'] || entry.attrs.group || ''
    if (isAdultCategory(`${group} ${entry.title}`)) continue

    const urlExt = extensionFromUrl(entry.url)
    const looksSeries =
      /\/series\//i.test(pathname) ||
      SERIES_RE.test(group) ||
      /(?:\bS\d{1,2}\s*E\d{1,3}\b|\bSezon\s*\d{1,2}\b|\bBölüm\s*\d{1,3}\b)/i.test(entry.title)
    const looksMovie =
      /\/movie\//i.test(pathname) ||
      MOVIE_RE.test(group) ||
      ['mp4', 'mkv', 'avi', 'mov', 'm4v', 'webm', 'wmv', 'flv'].includes(urlExt)

    if (!looksSeries && !looksMovie) continue

    if (looksSeries) {
      const parsed = episodeNumberFromName(entry.title)
      const seriesName = parsed.title || normalizeText(entry.title) || `Dizi ${index + 1}`
      const seriesKey = searchKey(seriesName) || hashId(seriesName)
      const seriesId = `m3u-s-${hashId(seriesKey)}`
      const category = categoryFor(group, 'series')
      if (!category) continue

      if (!seriesById.has(seriesId)) {
        seriesCategoryMap.set(seriesId, category)
        seriesById.set(seriesId, {
          type: 'series',
          id: seriesId,
          name: seriesName,
          poster: imageProxyUrl(entry.attrs['tvg-logo'] || entry.attrs.logo),
          backdrop: imageProxyUrl(entry.attrs['tvg-logo'] || entry.attrs.logo),
          categoryId: category.id,
          category: category.name,
          year: parseYear(entry.title, seriesName),
          rating: 0,
          added: 0,
          plot: '',
          cast: '',
          director: '',
          genre: [],
          country: '',
          duration: '',
          ext: urlExt || 'mp4',
          sourceUrl: '',
        })
        seriesPoster.set(seriesId, imageProxyUrl(entry.attrs['tvg-logo'] || entry.attrs.logo))
      }

      const episodeId = `m3u-e-${hashId(`${seriesId}:${parsed.season}:${parsed.episode}:${entry.url}`)}`
      if (!episodeById.has(episodeId)) {
        episodeById.set(episodeId, {
          id: episodeId,
          seriesId,
          title: parsed.episode ? `${parsed.episode}. Bölüm` : normalizeText(entry.title) || 'Bölüm',
          season: parsed.season || 1,
          episode: parsed.episode || 0,
          plot: '',
          duration: '',
          ext: urlExt || 'mp4',
          still: imageProxyUrl(entry.attrs['tvg-logo'] || entry.attrs.logo),
          sourceUrl: entry.url,
          subtitles: [],
        })
        seriesEpisodeCounts.set(seriesId, (seriesEpisodeCounts.get(seriesId) || 0) + 1)
        const seasonKey = parsed.season || 1
        const metaKey = `${seriesId}:${seasonKey}`
        if (!seriesMeta.has(metaKey)) seriesMeta.set(metaKey, { season: seasonKey, count: 0 })
        seriesMeta.get(metaKey).count += 1
      }
      continue
    }

    const category = categoryFor(group, 'movie')
    if (!category) continue
    const pathBase = pathname.split('/').pop() || ''
    const rawId = pathBase.replace(/\.[a-z0-9]{2,8}$/i, '') || hashId(entry.url)
    const id = `m3u-m-${hashId(rawId)}`
    if (movieById.has(id)) continue

    const name = normalizeText(entry.title)
    if (!name) continue
    const item = {
      type: 'movie',
      id,
      name,
      poster: imageProxyUrl(entry.attrs['tvg-logo'] || entry.attrs.logo),
      backdrop: imageProxyUrl(entry.attrs['tvg-logo'] || entry.attrs.logo),
      categoryId: category.id,
      category: category.name,
      year: parseYear(entry.title, name),
      rating: 0,
      added: 0,
      plot: '',
      cast: '',
      director: '',
      genre: [],
      country: '',
      duration: '',
      ext: urlExt || 'mp4',
      sourceUrl: entry.url,
    }
    movieById.set(id, item)
    movieCategoryMap.set(id, category)
  }

  for (const [seriesId, count] of seriesEpisodeCounts) {
    const item = seriesById.get(seriesId)
    if (!item) continue
    item.episodeCount = count
  }

  for (const item of movieById.values()) movies.push(item)
  for (const item of seriesById.values()) series.push(item)

  if (movies.length === 0 && series.length === 0) {
    throw new Error('M3U listesinde film veya dizi bulunamadı')
  }

  return {
    movies,
    series,
    movieById,
    seriesById,
    episodeById,
    movieCategories: [...movieCategories.values()],
    seriesCategories: [...seriesCategories.values()],
    source: 'm3u',
  }
}

function publicItem(item) {
  return {
    type: item.type,
    id: item.id,
    name: item.name,
    poster: item.poster,
    year: item.year,
    rating: item.rating,
    category: item.category,
    isNew: Boolean(item.isNew),
  }
}

function categoryPriority(name) {
  const key = normalizeText(name).toLocaleLowerCase('tr')
  const index = CATEGORY_PRIORITY.findIndex((entry) => key === entry || key.includes(entry))
  return index < 0 ? 1000 : index
}

function sortForRows(items) {
  return [...items].sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating
    if (b.added !== a.added) return b.added - a.added
    return a.name.localeCompare(b.name, 'tr')
  })
}

function sortForNew(items) {
  return [...items].sort((a, b) => {
    if (b.added !== a.added) return b.added - a.added
    if (b.rating !== a.rating) return b.rating - a.rating
    return a.name.localeCompare(b.name, 'tr')
  })
}

function buildPublicCategories(data) {
  const movieCounts = new Map()
  const seriesCounts = new Map()
  for (const item of data.movies) movieCounts.set(item.categoryId, (movieCounts.get(item.categoryId) || 0) + 1)
  for (const item of data.series) seriesCounts.set(item.categoryId, (seriesCounts.get(item.categoryId) || 0) + 1)

  const categories = []
  const inferred = new Map()
  for (const item of [...data.movies, ...data.series]) {
    const name = item.category || ''
    if (/^TR Yerli Diziler$|^TR Netflix$|^Yabancı Netflix$|^Prime Video$|^Disney\+$|^Max \/ HBO$/i.test(name)) {
      const key = `${item.type}:${item.categoryId}`
      if (!inferred.has(key)) inferred.set(key, { key, id: item.categoryId, name, label: name, type: item.type, count: 0 })
      inferred.get(key).count += 1
    }
  }
  categories.push(...inferred.values())
  const localSeriesCount = seriesCounts.get('inferred:tr-series') || 0
  if (localSeriesCount > 0) {
    categories.push({
      key: 'series:inferred:tr-series',
      id: 'inferred:tr-series',
      name: 'Yerli Diziler',
      label: 'Yerli Diziler',
      type: 'series',
      count: localSeriesCount,
    })
  }
  for (const category of data.movieCategories) {
    const count = movieCounts.get(category.id) || 0
    if (count > 0) {
      categories.push({
        key: `movie:${category.id}`,
        id: category.id,
        name: category.name,
        label: category.name,
        type: 'movie',
        count,
      })
    }
  }
  for (const category of data.seriesCategories) {
    const count = seriesCounts.get(category.id) || 0
    if (count > 0) {
      categories.push({
        key: `series:${category.id}`,
        id: category.id,
        name: category.name,
        label: category.name,
        type: 'series',
        count,
      })
    }
  }

  const duplicateNames = new Set()
  const seenNames = new Map()
  for (const category of categories) {
    const key = searchKey(category.name)
    if (seenNames.has(key)) {
      duplicateNames.add(key)
    } else {
      seenNames.set(key, category.type)
    }
  }
  for (const category of categories) {
    if (duplicateNames.has(searchKey(category.name))) {
      category.label = `${category.name} · ${category.type === 'movie' ? 'Filmler' : 'Diziler'}`
    }
  }

  categories.sort((a, b) => {
  const curated = ['Yeni Filmler', 'Yeni Diziler', 'Yerli Diziler', 'TR Netflix', 'Yabancı Netflix']
    const aIndex = curated.findIndex((name) => a.name === name)
    const bIndex = curated.findIndex((name) => b.name === name)
    if (aIndex >= 0 || bIndex >= 0) {
      if (aIndex < 0) return 1
      if (bIndex < 0) return -1
      if (aIndex !== bIndex) return aIndex - bIndex
    }
    const priority = categoryPriority(a.name) - categoryPriority(b.name)
    if (priority !== 0) return priority
    if (b.count !== a.count) return b.count - a.count
    return a.name.localeCompare(b.name, 'tr')
  })

  return categories
}

function buildRows(data, categories) {
  const rows = []

  const newMovies = sortForNew(data.movies)
  if (newMovies.length > 0) {
    rows.push({
      key: 'new:movie',
      title: 'Yeni Filmler',
      type: 'movie',
      categoryId: 'all',
      count: newMovies.length,
      new: true,
      priority: -2,
      items: newMovies.slice(0, HOME_ROW_SIZE).map((item) => ({ ...publicItem(item), isNew: true })),
    })
  }

  const newSeries = sortForNew(data.series)
  if (newSeries.length > 0) {
    rows.push({
      key: 'new:series',
      title: 'Yeni Diziler',
      type: 'series',
      categoryId: 'all',
      count: newSeries.length,
      new: true,
      priority: -1,
      items: newSeries.slice(0, HOME_ROW_SIZE).map((item) => ({ ...publicItem(item), isNew: true })),
    })
  }

  for (const category of categories) {
    if (category.name === 'Yeni Filmler' || category.name === 'Yeni Diziler') continue
    const source = category.type === 'movie' ? data.movies : data.series
    const rowItems = sortForRows(source.filter((item) => item.categoryId === category.id || (category.id === 'inferred:tr-series' && item.type === 'series' && item.category === 'Yerli Diziler')))
    if (rowItems.length === 0) continue
    rows.push({
      key: category.key,
      title: category.label,
      type: category.type,
      categoryId: category.id,
      count: category.count,
      new: false,
      priority: categoryPriority(category.name),
      items: rowItems.slice(0, HOME_ROW_SIZE).map(publicItem),
    })
  }

  rows.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    if (a.type !== b.type) return a.type === 'movie' ? -1 : 1
    return a.title.localeCompare(b.title, 'tr')
  })

  return rows
}

function buildHero(data) {
  const moviePool = sortForNew(data.movies.filter((item) => item.poster))
  const seriesPool = sortForNew(data.series.filter((item) => item.poster))
  const picked = []
  const seen = new Set()

  for (const item of [...moviePool.slice(0, 4), ...seriesPool.slice(0, 4)]) {
    const key = `${item.type}:${item.id}`
    if (seen.has(key)) continue
    seen.add(key)
    picked.push({
      ...publicItem(item),
      plot: item.plot,
      genre: item.genre,
      backdrop: item.backdrop || item.poster,
      duration: item.duration,
    })
    if (picked.length >= 6) break
  }

  if (picked.length < 4) {
    for (const item of [...sortForRows(data.movies), ...sortForRows(data.series)]) {
      if (picked.length >= 6) break
      const key = `${item.type}:${item.id}`
      if (seen.has(key) || !item.poster) continue
      seen.add(key)
      picked.push({
        ...publicItem(item),
        plot: item.plot,
        genre: item.genre,
        backdrop: item.backdrop || item.poster,
        duration: item.duration,
      })
    }
  }

  return picked
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForHero() {
  if (!heroPromise) return state.hero
  return Promise.race([heroPromise.catch(() => state.hero), delay(8500).then(() => state.hero)])
}

async function enrichHero() {
  const base = state.hero
  if (base.length === 0) return base

  const enriched = await Promise.all(
    base.map(async (item) => {
      if (item.plot) return item
      try {
        const detail = await getDetail(item.type, item.id, false)
        return {
          ...item,
          plot: detail.plot || item.plot,
          genre: detail.genre?.length ? detail.genre : item.genre,
          backdrop: detail.backdrop || item.backdrop,
          year: detail.year || item.year,
          rating: detail.rating || item.rating,
          duration: detail.duration || item.duration,
        }
      } catch {
        return item
      }
    }),
  )

  if (state.hero === base) state.hero = enriched
  return enriched
}

function scheduleHeroEnrichment() {
  if (heroPromise) return heroPromise
  heroPromise = enrichHero()
    .catch(() => state.hero)
    .finally(() => {
      heroPromise = null
    })
  return heroPromise
}

async function loadCatalog(force = false) {
  if (state.loading && loadPromise) return loadPromise
  state.loading = true
  progress.active = true
  progress.percent = 4
  progress.message = 'VOD sağlayıcısına bağlanılıyor...'
  progress.error = ''
  progress.startedAt = Date.now()
  progress.finishedAt = 0

  try {
    let data
    let xtreamError = null
    try {
      data = await fetchXtreamCatalog()
    } catch (error) {
      xtreamError = error
      console.log(`[VOD] Xtream API unavailable: ${error.message}`)
      progress.message = 'Xtream API yanıt vermedi, M3U listesi deneniyor...'
      progress.percent = 14
    }

    if (!data) {
      try {
        data = await fetchM3uCatalog()
      } catch (m3uError) {
        throw new Error(
          xtreamError
            ? `VOD sağlayıcısına ulaşılamadı: ${xtreamError.message}`
            : m3uError.message,
        )
      }
    }

    progress.message = 'Kategoriler ve vitrin hazırlanıyor...'
    progress.percent = 84

    const categories = buildPublicCategories(data)
    const rows = buildRows(data, categories)
    const hero = buildHero(data)

    state.movies = data.movies
    state.series = data.series
    state.movieById = data.movieById
    state.seriesById = data.seriesById
    state.episodeById = data.episodeById
    state.categories = categories
    state.rows = rows
    state.hero = hero
    state.error = ''
    state.ready = true
    state.generatedAt = Date.now()
    state.expiresAt = Date.now() + CATALOG_TTL_MS
    retryAt = 0
    detailCache.clear()

    progress.percent = 100
    progress.message = `${data.movies.length.toLocaleString('tr-TR')} film ve ${data.series.length.toLocaleString('tr-TR')} dizi hazır`
    progress.finishedAt = Date.now()

    scheduleHeroEnrichment()

    console.log(
      `[VOD] catalog ready (${data.source}): ${data.movies.length} movies, ${data.series.length} series, ${categories.length} categories`,
    )

    return state
  } catch (error) {
    state.error = error?.message || 'VOD kataloğu yüklenemedi'
    progress.error = state.error
    progress.message = 'VOD kataloğu yüklenemedi'
    retryAt = Date.now() + RETRY_DELAY_MS
    console.log(`[VOD] catalog error: ${state.error}`)
    if (!state.ready) throw error
    return state
  } finally {
    state.loading = false
    progress.active = false
  }
}

async function ensureCatalog(force = false) {
  const fresh = state.ready && Date.now() < state.expiresAt
  if (!force && fresh) return state
  if (!state.ready && retryAt > Date.now()) {
    throw new Error(state.error || 'VOD sağlayıcısına ulaşılamıyor')
  }
  if (force && state.ready && !state.loading) {
    // Keep serving the cached catalog while a manual refresh runs.
    if (loadPromise) return loadPromise
  }
  if (loadPromise) return loadPromise

  loadPromise = loadCatalog(force).finally(() => {
    loadPromise = null
  })
  return loadPromise
}

function vodStatus() {
  return {
    ok: true,
    ready: state.ready,
    loading: state.loading,
    movies: state.movies.length,
    series: state.series.length,
    categories: state.categories.length,
    generatedAt: state.generatedAt,
    expiresAt: state.expiresAt,
    error: state.error,
    progress,
  }
}

async function homePayload() {
  await ensureCatalog()
  if (!state.ready) throw new Error(state.error || 'VOD kataloğu hazır değil')

  if (Date.now() >= state.expiresAt && !state.loading) {
    void ensureCatalog(true).catch(() => {})
  }

  return {
    ok: true,
    ready: true,
    totalMovies: state.movies.length,
    totalSeries: state.series.length,
    categories: state.categories,
    rows: state.rows,
    hero: state.hero,
    generatedAt: state.generatedAt,
  }
}

async function listPayload(reqUrl) {
  await ensureCatalog()
  if (!state.ready) throw new Error(state.error || 'VOD kataloğu hazır değil')

  const rawType = String(reqUrl.searchParams.get('type') || 'all')
  const type = ['movie', 'series', 'all'].includes(rawType) ? rawType : 'all'
  const category = String(reqUrl.searchParams.get('category') || 'all')
  const query = normalizeText(reqUrl.searchParams.get('q') || '')
  const providerSearch = query ? await providerSearchItems(query, type) : null
  const sort = String(reqUrl.searchParams.get('sort') || '')
  const page = clampNumber(reqUrl.searchParams.get('page'), 1, 100000, 1)
  const limit = clampNumber(reqUrl.searchParams.get('limit'), 1, 60, PAGE_SIZE)

  let pool =
    type === 'movie'
      ? state.movies
      : type === 'series'
        ? state.series
        : [...state.movies, ...state.series]

  if (category !== 'all') {
    pool = pool.filter((item) => item.categoryId === category)
  }

  if (query) {
    const needle = searchKey(query)
    const localResults = pool
      .map((item) => ({ item, score: bestMatchSearchScore(item.name, query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, 'tr', { sensitivity: 'base' }))
      .map((entry) => entry.item)
    const source = providerSearch?.length ? providerSearch : pool
    const providerResults = source
      .map((item) => ({ item, score: bestMatchSearchScore(item.name, query) || (needle && searchKey(item.name).includes(needle) ? 50 : 0) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, 'tr', { sensitivity: 'base' }))
      .map((entry) => entry.item)
    const combined = new Map()
    for (const item of [...localResults, ...providerResults]) combined.set(`${item.type}:${item.id}`, item)
    pool = [...combined.values()]
  }

  if (sort === 'relevance' && query) {
    pool = [...pool].sort((a, b) => bestMatchSearchScore(b.name, query) - bestMatchSearchScore(a.name, query) || a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' }))
  } else if (sort === 'new') {
    pool = sortForNew(pool)
  } else if (sort === 'name') {
    pool = [...pool].sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  } else {
    pool = sortForRows(pool)
  }

  const total = pool.length
  const start = (page - 1) * limit
  const items = pool.slice(start, start + limit).map(publicItem)

  return {
    ok: true,
    type,
    category,
    query,
    page,
    limit,
    total,
    hasMore: start + items.length < total,
    items,
  }
}

async function providerSearchItems(query, type) {
  const tasks = []
  if (type !== 'series') tasks.push(providerJson('get_vod_streams', { search: query }).then((raw) => normalizeList(raw).map((entry) => normalizeMovieItem(entry, new Map()))).catch(() => []))
  if (type !== 'movie') tasks.push(providerJson('get_series', { search: query }).then((raw) => normalizeList(raw).map((entry) => normalizeSeriesItem(entry, new Map()))).catch(() => []))
  const results = (await Promise.all(tasks)).flat().filter(Boolean)
  if (results.length) {
    const local = new Map([...state.movies, ...state.series].map((item) => [`${item.type}:${item.id}`, item]))
    const needle = searchKey(query)
    const normalized = results.map((item) => local.get(`${item.type}:${item.id}`) || item)
    const exact = normalized.filter((item) => bestMatchSearchScore(item.name, query) > 0 || searchKey(item.name).includes(needle))
    if (exact.length) return exact
  }
  const needle = searchKey(query)
  return [...state.movies, ...state.series].filter((item) => (type === 'all' || item.type === type) && (bestMatchSearchScore(item.name, query) > 0 || searchKey(item.name).includes(needle)))
}

function normalizeSubtitleEntries(raw, indexOffset = 0) {
  const entries = []
  const seen = new Set()

  function push(value, fallbackLabel = '') {
    if (value == null) return
    if (typeof value === 'string') {
      const url = absoluteUrl(value)
      if (!url) return
      const key = `${fallbackLabel}:${url}`
      if (seen.has(key)) return
      seen.add(key)
      entries.push({
        label: fallbackLabel || `Altyazı ${entries.length + 1}`,
        language: fallbackLabel,
        url,
        format: extensionFromUrl(url) || 'srt',
      })
      return
    }
    if (typeof value !== 'object') return

    const url = absoluteUrl(
      value.url || value.src || value.file || value.link || value.path || value.subtitle || value.sub,
    )
    if (!url) return

    let label = normalizeText(
      value.language_name ||
        value.language ||
        value.lang ||
        value.label ||
        value.name ||
        value.title ||
        fallbackLabel,
    )
    const languageKey = label.toLocaleLowerCase('tr').replace(/[^a-z]/g, '')
    if (LANGUAGE_NAMES[languageKey]) label = LANGUAGE_NAMES[languageKey]
    const key = `${label}:${url}`
    if (seen.has(key)) return
    seen.add(key)
    entries.push({
      label: label || `Altyazı ${entries.length + 1}`,
      language: label,
      url,
      format: String(value.format || value.ext || extensionFromUrl(url) || 'srt').replace(/^\./, ''),
    })
  }

  if (Array.isArray(raw)) {
    for (const value of raw) push(value)
  } else if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
        push(value, LANGUAGE_NAMES[key.toLowerCase()] || key)
      } else if (value && typeof value === 'object') {
        push({ ...value, language: value.language || value.lang || key }, key)
      }
    }
  } else if (typeof raw === 'string') {
    push(raw)
  }

  return entries.map((entry, index) => ({
    id: `${indexOffset + index}-${hashId(`${entry.label}:${entry.url}`)}`,
    label: entry.label || `Altyazı ${index + 1}`,
    language: entry.language || entry.label,
    format: entry.format || 'srt',
    url: subtitleProxyUrl(entry.url, entry.format),
  }))
}

function subtitleProxyUrl(url, format = '') {
  const token = rememberToken('subtitle', {
    url,
    format: String(format || extensionFromUrl(url) || 'srt').toLowerCase(),
  })
  return `/api/vod/subtitle?t=${token}`
}

function streamProxyUrl(url, ext = '') {
  if (!url) return ''
  const token = rememberToken('stream', {
    url,
    ext: String(ext || extensionFromUrl(url) || '').replace(/^\./, '').toLowerCase(),
  })
  return `/api/vod/stream?t=${token}`
}

function movieStreamUrl(id, ext) {
  const cleanId = String(id || '').replace(/[^0-9A-Za-z_-]/g, '')
  const cleanExt = String(ext || 'mp4').replace(/^\./, '').toLowerCase() || 'mp4'
  return `${PROVIDER_BASE}/movie/${encodeURIComponent(PROVIDER_USER)}/${encodeURIComponent(PROVIDER_PASS)}/${cleanId}.${cleanExt}`
}

function episodeStreamUrl(id, ext) {
  const cleanId = String(id || '').replace(/[^0-9A-Za-z_-]/g, '')
  const cleanExt = String(ext || 'mp4').replace(/^\./, '').toLowerCase() || 'mp4'
  return `${PROVIDER_BASE}/series/${encodeURIComponent(PROVIDER_USER)}/${encodeURIComponent(PROVIDER_PASS)}/${cleanId}.${cleanExt}`
}

function sourceExt(...values) {
  for (const value of values) {
    const ext = String(value || '')
      .replace(/^\./, '')
      .toLowerCase()
      .trim()
    if (ext && /^[a-z0-9]{2,8}$/.test(ext)) return ext
  }
  return 'mp4'
}

function normalizeDuration(value) {
  if (value == null) return ''
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    if (value >= 60) return `${Math.round(value / 60)} dk`
    return `${Math.round(value)} sn`
  }
  const text = normalizeText(value)
  if (!text) return ''
  if (/^\d+$/.test(text) && Number(text) >= 60) return `${Math.round(Number(text) / 60)} dk`
  return text
}

function flattenEpisodes(raw, baseSeason = 0) {
  const result = []
  if (!raw) return result
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue
      let season = toNumber(entry.season ?? entry.season_number ?? entry.season_num)
      if (!season) season = baseSeason || 1
      result.push({ ...entry, __season: season })
    }
    return result
  }
  if (typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw)) {
      const season = toNumber(key) || baseSeason || 1
      if (Array.isArray(value)) {
        for (const entry of value) {
          if (!entry || typeof entry !== 'object') continue
          result.push({
            ...entry,
            __season: toNumber(entry.season ?? entry.season_number) || season,
          })
        }
      } else if (value && typeof value === 'object') {
        result.push({ ...value, __season: season })
      }
    }
  }
  return result
}

function episodeLabel(entry, fallbackNumber) {
  const title = normalizeText(entry.title || entry.name)
  if (title) return title
  const number = toNumber(entry.episode_num ?? entry.episode ?? entry.ep ?? fallbackNumber)
  return number > 0 ? `${number}. Bölüm` : 'Bölüm'
}

function episodeNumber(entry, fallback) {
  const direct = toNumber(entry.episode_num ?? entry.episode ?? entry.ep ?? entry.number)
  if (direct > 0) return direct
  const text = String(entry.episode_num ?? entry.title ?? entry.name ?? '')
  const patterns = [/\bE(\d{1,4})\b/i, /(\d{1,4})\.\s*Bölüm/i, /\bBölüm\s*(\d{1,4})/i]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return Number(match[1]) || fallback
  }
  return fallback || 0
}

function similarFor(base, type, categoryId, limit = 14) {
  const same = type === 'movie' ? state.movies : state.series
  const other = type === 'movie' ? state.series : state.movies
  const picked = []
  const seen = new Set([`${base.type}:${base.id}`])

  function add(pool) {
    for (const item of pool) {
      if (picked.length >= limit) break
      const key = `${item.type}:${item.id}`
      if (seen.has(key) || !item.poster) continue
      seen.add(key)
      picked.push(publicItem(item))
    }
  }

  add(sortForRows(same.filter((item) => item.id !== base.id && item.categoryId === categoryId)))
  add(sortForRows(same.filter((item) => item.id !== base.id)))
  add(sortForRows(other))
  return picked
}

function detailCacheGet(key) {
  const entry = detailCache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    detailCache.delete(key)
    return null
  }
  return entry.data
}

function detailCacheSet(key, data) {
  while (detailCache.size >= MAX_DETAILS) {
    const oldest = detailCache.keys().next().value
    if (!oldest) break
    detailCache.delete(oldest)
  }
  detailCache.set(key, { data, expiresAt: Date.now() + DETAIL_TTL_MS })
  return data
}

async function getDetail(type, id, includeSimilar = true) {
  const key = `${type}:${id}`
  const cached = detailCacheGet(key)
  if (cached) return cached

  if (type === 'series') {
    const result = await seriesDetail(id)
    const partial = { ...result }
    void providerJson('get_series_info', { series_id: id }).then((raw) => {
      if (raw?.info && typeof raw.info === 'object') {
        const info = raw.info
        const full = { ...partial,
          plot: normalizeText(info.plot || info.description || info.overview || partial.plot),
          cast: normalizeText(info.cast || info.actors || partial.cast),
          director: normalizeText(info.director || partial.director),
          country: normalizeText(info.country || partial.country),
          genre: normalizeGenres(info.genre || info.genres || partial.genre),
          backdrop: resolveImage(info.backdrop_path, info.backdrop, info.cover_big, partial.backdrop, partial.poster),
          year: parseYear(info.releaseDate || info.releasedate || info.release_date || info.year, partial.name) || partial.year,
        }
        detailCacheSet(key, full)
      }
    }).catch(() => {})
    if (includeSimilar) result.similar = similarFor(result, 'series', result.categoryId)
    return detailCacheSet(key, result)
  }

  const result = await movieDetail(id)
  if (includeSimilar) result.similar = similarFor(result, 'movie', result.categoryId)
  return detailCacheSet(key, result)
}

function resolveImage(...values) {
  for (const value of values) {
    const raw = firstImage(value)
    if (!raw) continue
    if (raw.startsWith('/api/vod/')) return raw
    const proxied = imageProxyUrl(raw)
    if (proxied) return proxied
  }
  return ''
}

function youtubeId(value) {
  const text = normalizeText(value)
  if (!text) return ''
  const direct = text.match(/^[A-Za-z0-9_-]{11}$/)
  if (direct) return text
  const match = text.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/)
  return match ? match[1] : ''
}

function categoryIdOf(item) {
  return String(item?.categoryId || '')
}

async function movieDetail(id) {
  const base = state.movieById.get(String(id)) || null
  let raw = null
  let detailError = ''

  try {
    raw = await Promise.race([
      providerJson('get_vod_info', { vod_id: id }),
      delay(3500).then(() => { throw new Error('Film bilgileri kaynakta yavaş; katalog bilgileri gösteriliyor') }),
    ])
  } catch (error) {
    detailError = error?.message || 'Film bilgileri alınamadı'
  }

  const info = raw?.info && typeof raw.info === 'object' ? raw.info : {}
  const movieData = raw?.movie_data && typeof raw.movie_data === 'object' ? raw.movie_data : {}
  const merge = { ...movieData, ...info }
  const name = normalizeText(merge.name || merge.o_name || base?.name || `Film ${id}`)
  const ext = sourceExt(movieData.container_extension, info.container_extension, base?.ext, merge.container_extension)
  const direct = absoluteUrl(
    movieData.direct_source || info.direct_source || merge.direct_source || base?.sourceUrl || '',
  )
  const streamUrl = direct || movieStreamUrl(base?.id || id, ext)
  const rawSubtitles =
    info.subtitles || movieData.subtitles || raw?.subtitles || info.sub_titles || movieData.sub_titles || []
  const categoryId = categoryIdOf(base || { categoryId: movieData.category_id || info.category_id })

  const result = {
    ok: true,
    type: 'movie',
    id: String(base?.id || id),
    name,
    originalName: normalizeText(merge.o_name || merge.original_name || ''),
    poster: resolveImage(info.cover_big, info.movie_image, info.cover, base?.poster),
    backdrop: resolveImage(info.backdrop_path, info.backdrop, info.movie_image, base?.backdrop, base?.poster),
    year: parseYear(merge.releasedate || merge.release_date || merge.releaseDate || merge.year, name) || base?.year || 0,
    rating: parseRating(merge.rating, merge.rating_5based, merge.vote_average, base?.rating),
    category: normalizeText(merge.category_name || base?.category || 'Film'),
    categoryId,
    plot: normalizeText(merge.plot || merge.description || merge.overview || base?.plot),
    cast: normalizeText(merge.cast || merge.actors || base?.cast),
    director: normalizeText(merge.director || base?.director),
    country: normalizeText(merge.country || base?.country),
    production: normalizeText(
      merge.production || merge.production_company || merge.company || merge.studio || merge.country || base?.country,
    ),
    genre: normalizeGenres(merge.genre || merge.genres || base?.genre),
    duration: normalizeDuration(merge.duration || merge.episode_run_time || base?.duration),
    trailer: youtubeId(merge.youtube_trailer || merge.trailer),
    tmdbId: normalizeText(merge.tmdb_id || merge.tmdb || ''),
    subtitles: normalizeSubtitleEntries(rawSubtitles),
    stream: streamProxyUrl(streamUrl, ext),
    ext,
    detailError,
  }
  void providerJson('get_vod_info', { vod_id: id }).then((laterRaw) => {
    const laterInfo = laterRaw?.info && typeof laterRaw.info === 'object' ? laterRaw.info : {}
    if (!Object.keys(laterInfo).length) return
    const updated = {
      ...result,
      plot: normalizeText(laterInfo.plot || laterInfo.description || laterInfo.overview || result.plot),
      cast: normalizeText(laterInfo.cast || laterInfo.actors || result.cast),
      director: normalizeText(laterInfo.director || result.director),
      genre: normalizeGenres(laterInfo.genre || laterInfo.genres || result.genre),
      backdrop: resolveImage(laterInfo.backdrop_path, laterInfo.backdrop, laterInfo.movie_image, result.backdrop, result.poster),
      year: parseYear(laterInfo.releasedate || laterInfo.release_date || laterInfo.releaseDate || laterInfo.year, result.name) || result.year,
    }
    detailCacheSet(`movie:${id}`, updated)
  }).catch(() => {})
  return result
}

async function seriesDetail(id) {
  const base = state.seriesById.get(String(id)) || null
  const localEpisodes = [...state.episodeById.values()].filter((episode) => episode.seriesId === String(id))
  let raw = null
  let detailError = ''

  if (localEpisodes.length === 0) {
    try {
      raw = await Promise.race([
        providerJson('get_series_info', { series_id: id }),
        delay(4500).then(() => { throw new Error('Dizi bilgileri kaynakta yavaş; bulunan bölümler gösteriliyor') }),
      ])
    } catch (error) {
      detailError = error?.message || 'Dizi bilgileri alınamadı'
    }
  }

  const info = raw?.info && typeof raw.info === 'object' ? raw.info : {}
  const name = normalizeText(info.name || info.title || base?.name || `Dizi ${id}`)
  const rawEpisodes = raw?.episodes ? flattenEpisodes(raw.episodes) : []
  const episodes = []

  if (localEpisodes.length > 0) {
    for (const episode of localEpisodes) {
      const ext = sourceExt(episode.ext, base?.ext)
      const streamUrl = absoluteUrl(episode.sourceUrl) || episodeStreamUrl(episode.streamId || episode.id, ext)
      episodes.push({
        id: episode.id,
        title: normalizeText(episode.title) || 'Bölüm',
        season: toNumber(episode.season) || 1,
        episode: toNumber(episode.episode),
        plot: normalizeText(episode.plot),
        duration: normalizeDuration(episode.duration),
        still: resolveImage(episode.still, base?.poster),
        ext,
        stream: streamProxyUrl(streamUrl, ext),
        subtitles: normalizeSubtitleEntries(episode.subtitles || []),
      })
    }
  } else {
    for (const [index, entry] of rawEpisodes.entries()) {
      const episodeInfo = entry.info && typeof entry.info === 'object' ? entry.info : {}
      const season = toNumber(entry.__season || entry.season || entry.season_number || episodeInfo.season || episodeInfo.season_number) || 1
      const number = episodeNumber({ ...entry, ...episodeInfo }, index + 1)
      const ext = sourceExt(entry.container_extension, episodeInfo.container_extension, base?.ext)
      const streamId =
        entry.stream_id ??
        entry.streamId ??
        (entry.id != null && /^\d+$/.test(String(entry.id)) ? entry.id : '')
      const direct = absoluteUrl(entry.direct_source || episodeInfo.direct_source || '')
      const streamUrl = direct || (streamId ? episodeStreamUrl(streamId, ext) : '')
      episodes.push({
        id: String(entry.id ?? streamId ?? `${id}-${season}-${number}-${index}`),
        title: episodeLabel({ ...entry, ...episodeInfo }, number),
        season,
        episode: number,
        episodeNumber: number,
        seasonNumber: season,
        plot: normalizeText(episodeInfo.plot || entry.plot || ''),
        duration: normalizeDuration(episodeInfo.duration || entry.duration),
        still: resolveImage(episodeInfo.movie_image, episodeInfo.cover_big, entry.movie_image, entry.cover, base?.poster),
        ext,
        stream: streamProxyUrl(streamUrl, ext),
        subtitles: normalizeSubtitleEntries(
          episodeInfo.subtitles || entry.subtitles || entry.sub_titles || episodeInfo.sub_titles || [],
        ),
      })
    }
  }

  const getNumericEpisodePart = (episode, key) => {
    const value = String(episode.title || '').match(new RegExp(`(?:^|\\b)S?\\d{0,2}\\s*E(\\d{1,3})\\b`, 'i'))
    if (key === 'episode' && value) return Number(value[1]) || episode.episode || 0
    const part = String(episode.title || '').match(/S(\d{1,2})\s*E(\d{1,3})/i)
    if (key === 'season' && part) return Number(part[1]) || episode.season || 1
    return episode[key] || 0
  }
  episodes.sort((a, b) => getNumericEpisodePart(a, 'season') - getNumericEpisodePart(b, 'season') || getNumericEpisodePart(a, 'episode') - getNumericEpisodePart(b, 'episode') || a.title.localeCompare(b.title, 'tr', { numeric: true, sensitivity: 'base' }))

  const seasonsMap = new Map()
  for (const episode of episodes) {
    if (!seasonsMap.has(episode.season)) seasonsMap.set(episode.season, [])
    seasonsMap.get(episode.season).push(episode)
  }
  const seasons = [...seasonsMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([season, list]) => ({
      season,
      title: `${season}. Sezon`,
      episodeCount: list.length,
      episodes: list.map((episode) => ({ ...episode, seasonNumber: season, episodeNumber: getNumericEpisodePart(episode, 'episode') })),
    }))

  return {
    ok: true,
    type: 'series',
    id: String(base?.id || id),
    name,
    originalName: normalizeText(info.o_name || info.original_name || ''),
    poster: resolveImage(info.cover_big, info.cover, base?.poster),
    backdrop: resolveImage(info.backdrop_path, info.backdrop, info.cover_big, base?.backdrop, base?.poster),
    year: parseYear(info.releaseDate || info.releasedate || info.release_date || info.year, name) || base?.year || 0,
    rating: parseRating(info.rating, info.rating_5based, info.vote_average, base?.rating),
    category: normalizeText(info.category_name || base?.category || 'Dizi'),
    categoryId: categoryIdOf(base || { categoryId: info.category_id }),
    plot: normalizeText(info.plot || info.description || info.overview || base?.plot),
    cast: normalizeText(info.cast || info.actors || base?.cast),
    director: normalizeText(info.director || base?.director),
    country: normalizeText(info.country || base?.country),
    production: normalizeText(
      info.production || info.production_company || info.company || info.studio || info.country || base?.country,
    ),
    genre: normalizeGenres(info.genre || info.genres || base?.genre),
    duration: normalizeDuration(info.duration || info.episode_run_time || base?.duration),
    trailer: youtubeId(info.youtube_trailer || info.trailer),
    tmdbId: normalizeText(info.tmdb_id || info.tmdb || ''),
    episodeCount: episodes.length,
    seasons,
    subtitles: normalizeSubtitleEntries(
      info.subtitles || raw?.subtitles || info.sub_titles || [],
    ),
    detailError,
  }
}

function mediaHeaders(extra = {}) {
  return {
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    accept: '*/*',
    'accept-encoding': 'identity',
    ...extra,
  }
}

function applyMediaHeaders(res, upstream, url) {
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-expose-headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
    'cache-control': 'public, max-age=120',
  }
  const forward = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']
  for (const key of forward) {
    const value = upstream.headers.get(key)
    if (value) headers[key] = value
  }
  if (!headers['content-type']) {
    const ext = extensionFromUrl(url)
    headers['content-type'] =
      ext === 'mp4' || ext === 'm4v'
        ? 'video/mp4'
        : ext === 'webm'
          ? 'video/webm'
          : ext === 'mkv'
            ? 'video/x-matroska'
            : ext === 'ts'
              ? 'video/mp2t'
              : 'application/octet-stream'
  }
  res.writeHead(upstream.status === 206 ? 206 : 200, headers)
}

function mediaProxy(req, res, url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  const headers = mediaHeaders()
  if (req.headers.range) headers.range = String(req.headers.range)
  if (req.headers['if-none-match']) headers['if-none-match'] = String(req.headers['if-none-match'])

  fetch(url, { headers, redirect: 'follow', signal: controller.signal })
    .then(async (upstream) => {
      clearTimeout(timer)
      if (!upstream.ok && upstream.status !== 206) {
        sendText(res, upstream.status === 404 ? 404 : 502, `Yayın kaynağına ulaşılamadı (${upstream.status})`)
        return
      }

      const contentType = String(upstream.headers.get('content-type') || '').toLowerCase()
      const path = (() => {
        try {
          return new URL(url).pathname.toLowerCase()
        } catch {
          return ''
        }
      })()

      if (contentType.includes('mpegurl') || path.endsWith('.m3u8') || path.endsWith('.m3u')) {
        const text = await upstream.text()
        const body = rewritePlaylist(text, url)
        if (res.headersSent) return
        res.writeHead(200, {
          'content-type': 'application/vnd.apple.mpegurl; charset=utf-8',
          'cache-control': 'no-cache, no-store',
          'access-control-allow-origin': '*',
        })
        res.end(body)
        return
      }

      if (!upstream.body) {
        sendText(res, 502, 'Yayın kaynağı boş yanıt döndürdü')
        return
      }

      applyMediaHeaders(res, upstream, url)
      const body = Readable.fromWeb(upstream.body)
      body.on('error', () => {
        try {
          res.destroy()
        } catch {
          // Client is already gone.
        }
      })
      req.on('close', () => {
        controller.abort()
        body.destroy()
      })
      body.pipe(res)
    })
    .catch((error) => {
      clearTimeout(timer)
      if (res.headersSent) {
        try {
          res.destroy()
        } catch {
          // Ignore a closed response.
        }
        return
      }
      sendText(res, error?.name === 'AbortError' ? 504 : 502, 'Yayın kaynağına bağlanılamadı')
    })
}

function rewritePlaylist(text, baseUrl) {
  const base = new URL(baseUrl)
  const basePath = base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1)
  const origin = `${base.protocol}//${base.host}`
  const lines = String(text || '').replace(/\r/g, '').split('\n')
  const out = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      out.push(rawLine)
      continue
    }

    if (line.startsWith('#')) {
      out.push(
        rawLine.replace(/URI="([^"]+)"/g, (_match, value) => {
          const absolute = absoluteUrl(value, `${origin}${basePath}`)
          return absolute ? `URI="${signedMediaUrl(absolute)}"` : _match
        }),
      )
      continue
    }

    const absolute = absoluteUrl(line, `${origin}${basePath}`)
    out.push(absolute ? signedMediaUrl(absolute) : line)
  }

  return out.join('\n')
}

function decodeSubtitleBuffer(buffer, contentType = '') {
  const charsetMatch = String(contentType).match(/charset=([^;]+)/i)
  const charset = charsetMatch ? charsetMatch[1].trim().toLowerCase() : ''
  const candidates = []
  if (charset === 'windows-1254' || charset === 'iso-8859-9' || charset === 'latin5') {
    candidates.push('windows-1254')
  }
  candidates.push('utf-8', 'windows-1254')

  for (const candidate of candidates) {
    try {
      const decoded = new TextDecoder(candidate, { fatal: false }).decode(buffer)
      if (!decoded.includes('\uFFFD')) return decoded.replace(/^\uFEFF/, '')
    } catch {
      // Try the next decoder.
    }
  }

  return buffer.toString('utf8').replace(/^\uFEFF/, '')
}

function timestampToVtt(match) {
  const hours = String(match[1] || '0').padStart(2, '0')
  const minutes = String(match[2] || '0').padStart(2, '0')
  const seconds = String(match[3] || '0').padStart(2, '0')
  const millis = String(match[4] || '0').padEnd(3, '0').slice(0, 3)
  return `${hours}:${minutes}:${seconds}.${millis}`
}

function srtToVtt(text) {
  const normalized = String(text || '').replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '')
  const blocks = normalized.split(/\n{2,}/)
  const out = []

  for (const block of blocks) {
    const lines = block.split('\n').filter((line) => line.trim().length > 0)
    if (lines.length === 0) continue

    const timeIndex = lines.findIndex((line) => line.includes('-->'))
    if (timeIndex < 0) continue

    const timing = lines[timeIndex].replace(
      /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/,
      (_m, h1, m1, s1, ms1, h2, m2, s2, ms2) =>
        `${timestampToVtt([null, h1, m1, s1, ms1])} --> ${timestampToVtt([null, h2, m2, s2, ms2])}`,
    )

    const textLines = lines.slice(timeIndex + 1).map((line) => line.replace(/<[^>]+>/g, ''))
    if (textLines.length === 0) continue
    out.push(`${timing}\n${textLines.join('\n')}`)
  }

  return `WEBVTT\n\n${out.join('\n\n')}\n`
}

function assToVtt(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let index = 0

  for (const line of lines) {
    if (!/^Dialogue:/i.test(line)) continue
    const parts = line.slice(line.indexOf(':') + 1).split(',')
    if (parts.length < 10) continue
    const start = parts[1].trim()
    const end = parts[2].trim()
    const body = parts.slice(9).join(',').replace(/\{[^}]*\}/g, '').replace(/\\N/gi, '\n').trim()
    if (!start || !end || !body) continue
    const toSeconds = (value) => {
      const match = value.match(/(\d+):(\d{2}):(\d{2})[.:](\d{1,3})/)
      if (!match) return null
      return `${match[1].padStart(2, '0')}:${match[2]}:${match[3]}.${match[4].padEnd(3, '0').slice(0, 3)}`
    }
    const startVtt = toSeconds(start)
    const endVtt = toSeconds(end)
    if (!startVtt || !endVtt) continue
    index += 1
    out.push(`${startVtt} --> ${endVtt}\n${body}`)
  }

  return `WEBVTT\n\n${out.join('\n\n')}\n`
}

function toVtt(text, format = '') {
  const trimmed = String(text || '').replace(/^\uFEFF/, '').trimStart()
  if (/^WEBVTT/i.test(trimmed)) return trimmed
  if (/\[Script Info\]|^Dialogue:/im.test(trimmed) || String(format).toLowerCase() === 'ass') {
    return assToVtt(trimmed)
  }
  return srtToVtt(trimmed)
}

async function subtitlePayload(entry) {
  let text = entry.content || ''
  let contentType = entry.contentType || ''

  if (!text && entry.url) {
    const response = await fetch(entry.url, {
      headers: mediaHeaders(),
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    })
    if (!response.ok) throw new Error(`Altyazı kaynağına ulaşılamadı (${response.status})`)
    contentType = response.headers.get('content-type') || ''
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > 8 * 1024 * 1024) throw new Error('Altyazı dosyası çok büyük')
    text = decodeSubtitleBuffer(buffer, contentType)
  }

  if (!text) throw new Error('Altyazı içeriği boş')
  return toVtt(text, entry.format || '')
}

async function imageProxy(req, res, url) {
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(14000),
    })

    if (!response.ok || !response.body) {
      sendImageFallback(res)
      return
    }

    const contentType = String(response.headers.get('content-type') || '').toLowerCase()
    if (contentType && !contentType.startsWith('image/')) {
      sendImageFallback(res)
      return
    }

    if (res.headersSent) return
    res.writeHead(200, {
      'content-type': contentType || 'image/jpeg',
      'cache-control': 'public, max-age=86400',
      'access-control-allow-origin': '*',
    })
    Readable.fromWeb(response.body).pipe(res)
  } catch {
    sendImageFallback(res)
  }
}

function transcodeMedia(req, res, url) {
  if (!ffmpegPath || req.method === 'HEAD') {
    mediaProxy(req, res, url)
    return
  }

  const args = [
    '-nostdin',
    '-hide_banner',
    '-loglevel',
    'error',
    '-user_agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    '-i',
    url,
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-ac',
    '2',
    '-movflags',
    'frag_keyframe+empty_moov',
    '-f',
    'mp4',
    'pipe:1',
  ]

  let child
  try {
    child = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })
  } catch {
    mediaProxy(req, res, url)
    return
  }

  let started = false
  let finished = false
  const timer = setTimeout(() => {
    if (!started) {
      finished = true
      try {
        child.kill('SIGKILL')
      } catch {
        // Ignore.
      }
      mediaProxy(req, res, url)
    }
  }, 20000)

  child.stdout.on('data', (chunk) => {
    if (finished) return
    if (!started) {
      started = true
      clearTimeout(timer)
      if (!res.headersSent) {
        res.writeHead(200, {
          'content-type': 'video/mp4',
          'cache-control': 'no-store',
          'access-control-allow-origin': '*',
        })
      }
    }
    try {
      res.write(chunk)
    } catch {
      finished = true
      child.kill('SIGKILL')
    }
  })

  child.on('error', () => {
    clearTimeout(timer)
    if (!started) {
      finished = true
      mediaProxy(req, res, url)
    }
  })

  child.on('exit', () => {
    clearTimeout(timer)
    if (finished) return
    finished = true
    if (!started) {
      mediaProxy(req, res, url)
      return
    }
    if (!res.writableEnded) {
      try {
        res.end()
      } catch {
        // Ignore.
      }
    }
  })

  req.on('close', () => {
    clearTimeout(timer)
    if (!finished) {
      finished = true
      try {
        child.kill('SIGKILL')
      } catch {
        // Ignore.
      }
    }
  })
}

function startPreload() {
  const run = () => {
    if (state.loading || loadPromise) return
    void ensureCatalog().catch(() => {})
  }

  run()
  if (retryTimer) return
  retryTimer = setInterval(() => {
    if (!state.ready && !state.loading && Date.now() >= retryAt) run()
  }, 60 * 1000)
  retryTimer.unref?.()
}

export function createVodApi(options = {}) {
  if (options.preload !== false) {
    setTimeout(startPreload, 50).unref?.()
  }

  return async function vodApi(req, res) {
    setCors(res)

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    let reqUrl
    try {
      reqUrl = new URL(req.url || '/', 'http://localhost')
    } catch {
      sendJson(res, 400, { ok: false, error: 'Geçersiz istek' })
      return
    }

    const pathname = reqUrl.pathname

    try {
      if (pathname === '/api/vod/health') {
        sendJson(res, 200, {
          ok: true,
          ready: state.ready,
          loading: state.loading,
          provider: PROVIDER_HOST,
          ffmpeg: Boolean(ffmpegPath),
          movies: state.movies.length,
          series: state.series.length,
          uptime: Math.round(process.uptime()),
        })
        return
      }

      if (pathname === '/api/vod/status') {
        sendJson(res, 200, { ...vodStatus(), provider: PROVIDER_HOST })
        return
      }

      if (pathname === '/api/vod/home') {
        const data = await homePayload()
        sendJson(res, 200, data)
        return
      }

      if (pathname === '/api/vod/list') {
        const data = await listPayload(reqUrl)
        sendJson(res, 200, data)
        return
      }

      if (pathname === '/api/vod/detail') {
        const type = String(reqUrl.searchParams.get('type') || 'movie')
        const id = String(reqUrl.searchParams.get('id') || '')
        if (!['movie', 'series'].includes(type) || !id) {
          sendJson(res, 400, { ok: false, error: 'Film veya dizi kimliği gerekli' })
          return
        }
        await ensureCatalog()
        const exists = type === 'movie' ? state.movieById.has(id) : state.seriesById.has(id)
        if (!exists) {
          sendJson(res, 404, { ok: false, error: 'İçerik bulunamadı' })
          return
        }
        const data = await getDetail(type, id, true)
        sendJson(res, 200, data)
        return
      }

      if (pathname === '/api/vod/play' || pathname === '/api/vod/play-episode') {
        await ensureCatalog()
        if (pathname.endsWith('play-episode')) {
          const id = String(reqUrl.searchParams.get('id') || '')
          const cachedEpisode = state.episodeById.get(id)
          let episode = cachedEpisode

          if (!episode) {
            const seriesId = String(reqUrl.searchParams.get('series_id') || '')
            if (!seriesId || !state.seriesById.has(seriesId)) {
              sendJson(res, 404, { ok: false, error: 'Bölüm bulunamadı' })
              return
            }
            const detail = await seriesDetail(seriesId)
            episode = detail.seasons.flatMap((season) => season.episodes).find((entry) => entry.id === id) || null
          }

          if (!episode?.stream) {
            sendJson(res, 404, { ok: false, error: 'Bölüm yayını bulunamadı' })
            return
          }
          sendJson(res, 200, {
            ok: true,
            title: episode.title,
            poster: episode.still || '',
            stream: episode.stream,
            subtitles: episode.subtitles || [],
          })
          return
        }

        const type = String(reqUrl.searchParams.get('type') || 'movie')
        const id = String(reqUrl.searchParams.get('id') || '')
        if (!['movie', 'series'].includes(type) || !id) {
          sendJson(res, 400, { ok: false, error: 'Film veya dizi kimliği gerekli' })
          return
        }

        const detail = await getDetail(type, id, false)
        const firstEpisode = type === 'series'
          ? detail.seasons?.flatMap((season) => season.episodes)[0]
          : null
        const stream = type === 'series' ? firstEpisode?.stream : detail.stream
        const subtitles = type === 'series' ? firstEpisode?.subtitles || [] : detail.subtitles || []
        if (!stream) {
          sendJson(res, 404, { ok: false, error: 'Yayın adresi bulunamadı' })
          return
        }
        sendJson(res, 200, { ok: true, title: type === 'series' ? firstEpisode?.title || detail.name : detail.name, poster: detail.poster, stream, subtitles })
        return
      }

      if (pathname === '/api/vod/refresh') {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Sadece POST' })
          return
        }
        const requiredKey = process.env.VOD_REFRESH_KEY
        if (requiredKey && reqUrl.searchParams.get('key') !== requiredKey) {
          sendJson(res, 403, { ok: false, error: 'Yetkisiz' })
          return
        }
        void ensureCatalog(true).catch(() => {})
        sendJson(res, 202, { ok: true, ...vodStatus() })
        return
      }

      if (pathname === '/api/vod/image') {
        const encoded = reqUrl.searchParams.get('u') || ''
        const signature = reqUrl.searchParams.get('s') || ''
        if (!verifySignedValue(encoded, signature)) {
          sendImageFallback(res)
          return
        }
        let url = ''
        try {
          url = decodeBase64Url(encoded)
        } catch {
          sendImageFallback(res)
          return
        }
        if (!/^https?:\/\//i.test(url)) {
          sendImageFallback(res)
          return
        }
        await imageProxy(req, res, url)
        return
      }

      if (pathname === '/api/vod/hls') {
        const encoded = reqUrl.searchParams.get('u') || ''
        const signature = reqUrl.searchParams.get('s') || ''
        if (!verifySignedValue(encoded, signature)) {
          sendText(res, 403, 'Geçersiz medya imzası')
          return
        }
        let url = ''
        try {
          url = decodeBase64Url(encoded)
        } catch {
          sendText(res, 400, 'Geçersiz medya adresi')
          return
        }
        if (!/^https?:\/\//i.test(url)) {
          sendText(res, 400, 'Geçersiz medya adresi')
          return
        }
        mediaProxy(req, res, url)
        return
      }

      if (pathname === '/api/vod/stream') {
        const token = reqUrl.searchParams.get('t') || ''
        const entry = readToken(token)
        if (!entry || entry.kind !== 'stream' || !entry.url) {
          sendText(res, 404, 'Yayın bağlantısının süresi dolmuş')
          return
        }
        const transcode = ['1', 'true', 'yes'].includes(
          String(reqUrl.searchParams.get('transcode') || '').toLowerCase(),
        )
        const ext = String(entry.ext || '').toLowerCase()
        const isHls = ext === 'm3u8' || ext === 'm3u' || /\.m3u8?(?:\?|$)/i.test(entry.url)
        if (isHls) {
          mediaProxy(req, res, entry.url)
          return
        }
        if (transcode) {
          transcodeMedia(req, res, entry.url)
          return
        }
        mediaProxy(req, res, entry.url)
        return
      }

      if (pathname === '/api/vod/subtitle') {
        const token = reqUrl.searchParams.get('t') || ''
        const entry = readToken(token)
        if (!entry || entry.kind !== 'subtitle') {
          sendText(res, 404, 'Altyazı bağlantısının süresi dolmuş')
          return
        }
        const vtt = await subtitlePayload(entry)
        if (res.headersSent) return
        res.writeHead(200, {
          'content-type': 'text/vtt; charset=utf-8',
          'cache-control': 'public, max-age=3600',
          'access-control-allow-origin': '*',
        })
        res.end(vtt)
        return
      }

      sendJson(res, 404, { ok: false, error: 'Bilinmeyen VOD uç noktası' })
    } catch (error) {
      const message = error?.message || 'VOD isteği başarısız'
      if (!res.headersSent) {
        sendJson(res, state.ready ? 500 : 503, {
          ok: false,
          ready: state.ready,
          error: message,
          progress,
        })
      }
    }
  }
}
