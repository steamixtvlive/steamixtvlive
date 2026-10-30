import { Readable } from 'node:stream'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * NOTFLIX / GEIL bridge.
 *
 * The browser only talks to this same-origin API. Live catalog + resolve calls
 * are made against geil.to's mHub v2 live addon, VOD metadata comes from the
 * public mHub TMDB addon, and VOD sources/resolution use geil.to's VOD addon.
 *
 * Every media URL is rewritten through /api/geil/stream. That keeps HTTP-only
 * IPTV streams working on an HTTPS deployment and lets us pass the referer
 * required by some VOD CDNs.
 */

const GEIL = 'https://geil.to'
const MHUB = 'https://www.mhub.mx'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const SECRET = process.env.GEIL_PROXY_SECRET || 'notflix-geil-proxy-v1-7c4f2a9e'

const LIVE_TTL = 60 * 1000
const LIVE_RESOLVE_TTL = 90 * 1000
const TMDB_TTL = 5 * 60 * 1000
const ITEM_TTL = 10 * 60 * 1000
const SOURCES_TTL = 10 * 60 * 1000
const VOD_RESOLVE_TTL = 2 * 60 * 1000

const liveCatalogCache = new Map()
const liveResolveCache = new Map()
const tmdbCache = new Map()
const itemCache = new Map()
const sourcesCache = new Map()
const vodResolveCache = new Map()

function cacheGet(map, key) {
  const hit = map.get(key)
  if (!hit) return null
  if (hit.expiresAt <= Date.now()) {
    map.delete(key)
    return null
  }
  return hit.value
}

function cacheSet(map, key, value, ttl) {
  map.set(key, { value, expiresAt: Date.now() + ttl })
  if (map.size > 240) {
    const oldest = map.keys().next().value
    if (oldest !== undefined) map.delete(oldest)
  }
  return value
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store, max-age=0',
    'access-control-allow-origin': '*',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store, max-age=0',
    'access-control-allow-origin': '*',
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'user-agent': UA,
      accept: 'application/json,text/plain,*/*',
      'accept-language': 'tr-TR,tr;q=0.9,en;q=0.7',
      ...(options.headers || {}),
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(options.timeout || 18000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Upstream ${response.status}${detail ? `: ${detail.slice(0, 140)}` : ''}`)
  }
  return response.json()
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

function signPayload(payload) {
  const data = encodeBase64Url(JSON.stringify(payload))
  const sig = createHmac('sha256', SECRET).update(data).digest('base64url')
  return `${data}.${sig}`
}

function verifyPayload(token) {
  const [data, sig] = String(token || '').split('.')
  if (!data || !sig) return null
  const expected = createHmac('sha256', SECRET).update(data).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    return JSON.parse(decodeBase64Url(data))
  } catch {
    return null
  }
}

function proxyUrl(url, headers = null) {
  const payload = { u: String(url) }
  if (headers && typeof headers === 'object' && Object.keys(headers).length) payload.h = headers
  return `/api/geil/stream?t=${encodeURIComponent(signPayload(payload))}`
}

function rewritePlaylist(playlist, baseUrl, inheritedHeaders) {
  const rewrite = (value) => {
    try {
      return proxyUrl(new URL(value, baseUrl).toString(), inheritedHeaders)
    } catch {
      return value
    }
  }

  return String(playlist)
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri) => `URI="${rewrite(uri)}"`)
      }
      return rewrite(trimmed)
    })
    .join('\n')
}

function allowedSourceHeaders(headers) {
  const result = {}
  if (!headers || typeof headers !== 'object') return result
  const allowed = new Set(['user-agent', 'referer', 'origin', 'accept', 'accept-language', 'cookie', 'authorization'])
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value !== 'string') continue
    const lower = key.toLowerCase()
    if (!allowed.has(lower)) continue
    result[lower] = value.slice(0, 2048)
  }
  return result
}

/* -------------------------------------------------------------------------- */
/* Live addon                                                                  */
/* -------------------------------------------------------------------------- */

function liveCatalogUrl(params) {
  const url = new URL('/live/catalog/live/channels.json', GEIL)
  const cursor = params.get('cursor')
  const search = params.get('search')?.trim()
  const sort = params.get('sort')
  const group = params.get('group')
  const limit = Math.min(300, Math.max(1, Number(params.get('limit') || 300) || 300))
  if (cursor) url.searchParams.set('cursor', cursor)
  if (search) url.searchParams.set('search', search)
  if (sort === 'trending' || sort === 'name') url.searchParams.set('sort', sort)
  if (group) url.searchParams.set('filter[group]', group)
  url.searchParams.set('limit', String(limit))
  return url.toString()
}

async function getLiveCatalog(params) {
  const url = liveCatalogUrl(params)
  const cached = cacheGet(liveCatalogCache, url)
  if (cached) return cached
  const data = await fetchJson(url, { headers: { origin: GEIL, referer: `${GEIL}/` } })
  const items = Array.isArray(data?.items)
    ? data.items.map((item) => ({
        id: String(item.id || ''),
        name: String(item.name || ''),
        type: 'live',
        tags: Array.isArray(item.tags) ? item.tags : [],
        ids: item.ids || {},
        epg: Array.isArray(item.epg) ? item.epg : null,
        url: item.url || null,
      })).filter((item) => item.id && item.name)
    : []
  const value = {
    items,
    nextCursor: data?.nextCursor ?? null,
    features: data?.features || {},
  }
  return cacheSet(liveCatalogCache, url, value, LIVE_TTL)
}

async function handleLiveCatalog(reqUrl, res) {
  const data = await getLiveCatalog(reqUrl.searchParams)
  sendJson(res, 200, { ok: true, ...data })
}

async function resolveLive(id) {
  const cached = cacheGet(liveResolveCache, id)
  if (cached) return cached
  const target = `${GEIL}/live/play/${encodeURIComponent(id)}`
  const data = await fetchJson(`${GEIL}/live/resolve?url=${encodeURIComponent(target)}`, {
    headers: { origin: GEIL, referer: `${GEIL}/` },
    timeout: 20000,
  })
  if (!data?.url) throw new Error('Live source did not return a stream')
  const value = {
    url: data.url,
    name: data.name || '',
    live: data.live !== false,
    format: data.format || 'hls',
    headers: allowedSourceHeaders(data.headers),
  }
  return cacheSet(liveResolveCache, id, value, LIVE_RESOLVE_TTL)
}

async function handleLiveResolve(reqUrl, res) {
  const id = (reqUrl.searchParams.get('id') || '').trim()
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) {
    sendJson(res, 400, { ok: false, error: 'Geçersiz kanal kimliği' })
    return
  }
  const data = await resolveLive(id)
  sendJson(res, 200, {
    ok: true,
    id,
    name: data.name,
    live: data.live,
    format: data.format,
    url: proxyUrl(data.url, data.headers),
  })
}

/* -------------------------------------------------------------------------- */
/* TMDB addon                                                                  */
/* -------------------------------------------------------------------------- */

const TMDB_CATALOG_RE = /^[a-zA-Z0-9_]{1,120}$/

function tmdbCatalogUrl(type, catalog, params) {
  const url = new URL(`/tmdb/catalog/${type}/${catalog}.json`, MHUB)
  const allowed = ['cursor', 'search', 'sort', 'limit']
  for (const key of allowed) {
    const value = params.get(key)
    if (value) url.searchParams.set(key, value)
  }
  for (const key of ['genre', 'year', 'originalLanguage']) {
    const value = params.get(`filter[${key}]`)
    if (value) url.searchParams.set(`filter[${key}]`, value)
  }
  url.searchParams.set('language', 'tr-TR')
  return url.toString()
}

async function handleTmdbCatalog(reqUrl, res) {
  const type = reqUrl.searchParams.get('type') === 'series' ? 'series' : 'video'
  const catalog = reqUrl.searchParams.get('catalog') || (type === 'series' ? 'series' : 'movie')
  if (!TMDB_CATALOG_RE.test(catalog)) {
    sendJson(res, 400, { ok: false, error: 'Geçersiz katalog' })
    return
  }
  const url = tmdbCatalogUrl(type, catalog, reqUrl.searchParams)
  const cached = cacheGet(tmdbCache, url)
  if (cached) {
    sendJson(res, 200, { ok: true, ...cached })
    return
  }
  const data = await fetchJson(url)
  const value = {
    items: Array.isArray(data?.items) ? data.items : [],
    nextCursor: data?.nextCursor ?? null,
    features: data?.features || {},
  }
  cacheSet(tmdbCache, url, value, TMDB_TTL)
  sendJson(res, 200, { ok: true, ...value })
}

async function handleTmdbItem(reqUrl, res) {
  const type = ['video', 'series', 'page'].includes(reqUrl.searchParams.get('type') || '')
    ? reqUrl.searchParams.get('type')
    : 'video'
  const id = (reqUrl.searchParams.get('id') || '').trim()
  if (!/^[A-Za-z0-9:_-]{1,120}$/.test(id)) {
    sendJson(res, 400, { ok: false, error: 'Geçersiz içerik kimliği' })
    return
  }
  const url = `${MHUB}/tmdb/item/${type}/${encodeURIComponent(id)}.json?language=tr-TR`
  const cached = cacheGet(itemCache, url)
  if (cached) {
    sendJson(res, 200, { ok: true, item: cached })
    return
  }
  const data = await fetchJson(url)
  cacheSet(itemCache, url, data, ITEM_TTL)
  sendJson(res, 200, { ok: true, item: data })
}

/* -------------------------------------------------------------------------- */
/* VOD addon                                                                   */
/* -------------------------------------------------------------------------- */

const VOD_TYPES = new Set(['video', 'series'])
const VOD_ID_RE = /^[A-Za-z0-9:_-]{1,140}$/

async function getSources(type, id) {
  const key = `${type}:${id}`
  const cached = cacheGet(sourcesCache, key)
  if (cached) return cached
  const url = `${GEIL}/vod/source/${type}/${encodeURIComponent(id)}.json`
  const data = await fetchJson(url, {
    headers: { origin: GEIL, referer: `${GEIL}/` },
    timeout: 22000,
  })
  const sources = (Array.isArray(data?.sources) ? data.sources : [])
    .filter((source) => source && typeof source.url === 'string' && /^https?:\/\//i.test(source.url))
    .map((source) => ({
      url: source.url,
      name: source.name || 'Server',
      quality: source.quality || '',
      languages: Array.isArray(source.languages) ? source.languages : [],
      size: source.size || null,
    }))
  return cacheSet(sourcesCache, key, sources, SOURCES_TTL)
}

async function handleVodSources(reqUrl, res) {
  const type = reqUrl.searchParams.get('type') || ''
  const id = (reqUrl.searchParams.get('id') || '').trim()
  if (!VOD_TYPES.has(type) || !VOD_ID_RE.test(id)) {
    sendJson(res, 400, { ok: false, error: 'Geçersiz içerik' })
    return
  }
  const sources = await getSources(type, id)
  sendJson(res, 200, { ok: true, sources })
}

async function clientFetchChain(sourceUrl) {
  let data = await fetchJson(`${GEIL}/vod/resolve?url=${encodeURIComponent(sourceUrl)}`, {
    headers: { origin: GEIL, referer: `${GEIL}/` },
    timeout: 25000,
  })

  let hops = 0
  while (data && data.clientFetch) {
    hops += 1
    if (hops > 12) throw new Error('Kaynak çözümleme zinciri çok uzun')
    const cf = data.clientFetch
    if (!cf || !/^https?:\/\//i.test(String(cf.url || ''))) throw new Error('Geçersiz kaynak adresi')

    const headers = { 'user-agent': UA, ...(cf.headers || {}) }
    const target = await fetch(cf.url, {
      method: cf.method || 'GET',
      headers,
      body: cf.body || undefined,
      redirect: cf.redirect || 'follow',
      signal: AbortSignal.timeout(22000),
    })

    const contentType = target.headers.get('content-type') || ''
    const isText = /text\/|json|xml|javascript|xhtml|mpegurl/i.test(contentType)
    let body
    let encoding
    if (isText) {
      body = await target.text()
      encoding = 'utf-8'
    } else {
      body = Buffer.from(await target.arrayBuffer()).toString('base64')
      encoding = 'base64'
    }

    const responseHeaders = {}
    target.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') return
      responseHeaders[key] = value
    })

    const posted = await fetch(`${GEIL}/vod/client-fetch`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': UA,
        origin: GEIL,
        referer: `${GEIL}/`,
      },
      body: JSON.stringify({
        id: cf.id,
        status: target.status,
        url: target.url || cf.url,
        headers: responseHeaders,
        body,
        encoding,
      }),
      signal: AbortSignal.timeout(25000),
    })
    if (!posted.ok) throw new Error(`Kaynak çözümleme başarısız (${posted.status})`)
    data = await posted.json()
  }

  if (!data || typeof data !== 'object' || !data.url) throw new Error('Kaynak akış adresi bulunamadı')
  return {
    url: data.url,
    headers: allowedSourceHeaders(data.headers),
    format: data.format || null,
    live: data.live === true,
    quality: data.quality || null,
    subtitles: Array.isArray(data.subtitles) ? data.subtitles : [],
  }
}

async function handleVodResolve(reqUrl, res) {
  const type = reqUrl.searchParams.get('type') || ''
  const id = (reqUrl.searchParams.get('id') || '').trim()
  const sourceUrl = (reqUrl.searchParams.get('url') || '').trim()
  if (!VOD_TYPES.has(type) || !VOD_ID_RE.test(id) || !/^https?:\/\//i.test(sourceUrl)) {
    sendJson(res, 400, { ok: false, error: 'Geçersiz kaynak' })
    return
  }

  const sources = await getSources(type, id)
  if (!sources.some((source) => source.url === sourceUrl)) {
    sendJson(res, 403, { ok: false, error: 'Kaynak bu içeriğe ait değil' })
    return
  }

  const cached = cacheGet(vodResolveCache, sourceUrl)
  if (cached) {
    sendJson(res, 200, { ok: true, ...cached, url: proxyUrl(cached.url, cached.headers) })
    return
  }

  const resolved = await clientFetchChain(sourceUrl)
  cacheSet(vodResolveCache, sourceUrl, resolved, VOD_RESOLVE_TTL)
  sendJson(res, 200, {
    ok: true,
    url: proxyUrl(resolved.url, resolved.headers),
    format: resolved.format,
    live: resolved.live,
    quality: resolved.quality,
    subtitles: resolved.subtitles,
  })
}

/* -------------------------------------------------------------------------- */
/* Stream proxy                                                                */
/* -------------------------------------------------------------------------- */

async function handleStream(req, res, reqUrl) {
  const token = reqUrl.searchParams.get('t') || ''
  const payload = verifyPayload(token)
  if (!payload || !/^https?:\/\//i.test(String(payload.u || ''))) {
    sendText(res, 403, 'Geçersiz akış anahtarı')
    return
  }

  const target = payload.u
  const inheritedHeaders = allowedSourceHeaders(payload.h)
  const headers = {
    'user-agent': UA,
    accept: '*/*',
    ...inheritedHeaders,
  }
  if (req.headers.range) headers.range = req.headers.range

  let upstream
  try {
    upstream = await fetch(target, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
    })
  } catch (error) {
    sendText(res, 502, `Akış bağlantısı kurulamadı: ${error.message}`)
    return
  }

  if (!upstream.ok && upstream.status !== 206) {
    sendText(res, upstream.status || 502, `Kaynak akış hatası (${upstream.status})`)
    return
  }

  const pathname = (() => {
    try { return new URL(upstream.url || target).pathname.toLowerCase() } catch { return '' }
  })()
  const contentType = upstream.headers.get('content-type') || ''
  const isPlaylist = /mpegurl|x-mpegurl/i.test(contentType)
    || pathname.endsWith('.m3u8')
    || pathname.endsWith('.m3u')

  if (isPlaylist) {
    const playlist = await upstream.text()
    if (!playlist.trim()) {
      sendText(res, 502, 'Boş oynatma listesi')
      return
    }
    const rewritten = rewritePlaylist(playlist, upstream.url || target, inheritedHeaders)
    sendText(res, 200, rewritten, 'application/vnd.apple.mpegurl; charset=utf-8')
    return
  }

  const responseHeaders = {
    'content-type': contentType || 'application/octet-stream',
    'cache-control': 'no-store, max-age=0',
    'access-control-allow-origin': '*',
  }
  const contentLength = upstream.headers.get('content-length')
  const contentRange = upstream.headers.get('content-range')
  const acceptRanges = upstream.headers.get('accept-ranges')
  if (contentLength) responseHeaders['content-length'] = contentLength
  if (contentRange) responseHeaders['content-range'] = contentRange
  if (acceptRanges) responseHeaders['accept-ranges'] = acceptRanges

  res.writeHead(upstream.status, responseHeaders)
  if (!upstream.body) {
    res.end()
    return
  }

  const stream = Readable.fromWeb(upstream.body)
  stream.on('error', () => { try { res.destroy() } catch {} })
  res.on('close', () => { try { stream.destroy() } catch {} })
  stream.pipe(res)
}

/* -------------------------------------------------------------------------- */
/* Router                                                                      */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* M3U VOD (mclanx)                                                           */
/* -------------------------------------------------------------------------- */

const M3U_URL = 'http://mclanx.store:8080/get.php?username=hkRAoyqU&password=masbSHSs&type=m3u_plus&output=ts'
const M3U_TTL = 10 * 60 * 1000
let m3uCache = { items: null, expiresAt: 0, building: null }

function parseM3uAttributes(line) {
  const attrs = {}
  const regex = /([a-zA-Z0-9_-]+)="([^"]*)"/g
  let match
  while ((match = regex.exec(line)) !== null) attrs[match[1]] = match[2]
  return attrs
}

async function getM3uVodItems() {
  if (m3uCache.items && m3uCache.expiresAt > Date.now()) return m3uCache.items
  if (m3uCache.building) return m3uCache.building

  m3uCache.building = (async () => {
    const response = await fetch(M3U_URL, { signal: AbortSignal.timeout(60000) })
    if (!response.ok) throw new Error(`M3U kaynağı alınamadı (${response.status})`)
    const text = await response.text()
    const lines = text.split(/\r?\n/)
    const items = []
    let index = 0
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].trim()
      if (!line.startsWith('#EXTINF')) continue
      let url = ''
      for (let j = i + 1; j < lines.length; j += 1) {
        const next = lines[j].trim()
        if (!next || next.startsWith('#')) continue
        url = next
        break
      }
      if (!url || (!url.includes('/movie/') && !url.includes('/series/'))) continue

      const attrs = parseM3uAttributes(line)
      const commaIndex = line.lastIndexOf(',')
      const display = commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : ''
      const name = attrs['tvg-name'] || display || `İçerik ${index + 1}`
      const group = attrs['group-title'] || 'Diğer'
      if (/adult|xxx|\+18/i.test(group)) continue

      const type = url.includes('/series/') ? 'series' : 'video'
      items.push({
        id: `m3u-${index}`,
        type,
        name,
        images: { poster: attrs['tvg-logo'] || '' },
        genres: [group],
        _group: group,
        url,
      })
      index += 1
    }

    m3uCache.items = items
    m3uCache.expiresAt = Date.now() + M3U_TTL
    m3uCache.building = null
    return items
  })()

  try {
    return await m3uCache.building
  } catch (error) {
    m3uCache.building = null
    throw error
  }
}

async function handleM3uGroups(res) {
  const items = await getM3uVodItems()
  const counts = new Map()
  for (const item of items) counts.set(item._group, (counts.get(item._group) || 0) + 1)
  const groups = [...counts.entries()]
    .map(([name, count]) => ({ id: name, name, count }))
    .sort((a, b) => b.count - a.count)
  sendJson(res, 200, { ok: true, groups })
}

async function handleM3uItems(reqUrl, res) {
  const items = await getM3uVodItems()
  const group = reqUrl.searchParams.get('group') || ''
  const type = reqUrl.searchParams.get('type') || ''
  const search = (reqUrl.searchParams.get('search') || '').trim().toLowerCase()
  const offset = Math.max(0, Number(reqUrl.searchParams.get('offset') || 0) || 0)
  const limit = Math.min(60, Math.max(1, Number(reqUrl.searchParams.get('limit') || 24) || 24))

  let filtered = items
  if (group) filtered = filtered.filter((item) => item._group === group)
  if (type === 'video' || type === 'series') filtered = filtered.filter((item) => item.type === type)
  if (search) filtered = filtered.filter((item) => item.name.toLowerCase().includes(search))

  const page = filtered.slice(offset, offset + limit)
  sendJson(res, 200, {
    ok: true,
    items: page,
    total: filtered.length,
    offset,
    limit,
    hasMore: offset + limit < filtered.length,
  })
}

async function handleM3uItem(reqUrl, res) {
  const id = (reqUrl.searchParams.get('id') || '').trim()
  const items = await getM3uVodItems()
  const item = items.find((entry) => entry.id === id)
  if (!item) {
    sendJson(res, 404, { ok: false, error: 'İçerik bulunamadı' })
    return
  }
  sendJson(res, 200, { ok: true, item })
}

export function createGeilApi() {
  return async function geilApi(req, res) {
    setCors(res)
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const reqUrl = new URL(req.url || '/', 'http://localhost')
    const path = reqUrl.pathname

    try {
      if (path === '/api/geil/health') {
        sendJson(res, 200, { ok: true, service: 'notflix-geil', time: Date.now() })
        return
      }
      if (path === '/api/geil/live/catalog') {
        await handleLiveCatalog(reqUrl, res)
        return
      }
      if (path === '/api/geil/live/resolve') {
        await handleLiveResolve(reqUrl, res)
        return
      }
      if (path === '/api/geil/tmdb/catalog') {
        await handleTmdbCatalog(reqUrl, res)
        return
      }
      if (path === '/api/geil/tmdb/item') {
        await handleTmdbItem(reqUrl, res)
        return
      }
      if (path === '/api/geil/vod/sources') {
        await handleVodSources(reqUrl, res)
        return
      }
      if (path === '/api/geil/vod/resolve') {
        await handleVodResolve(reqUrl, res)
        return
      }
      if (path === '/api/geil/stream') {
        await handleStream(req, res, reqUrl)
        return
      }
      if (path === '/api/geil/vod/m3u/groups') {
        await handleM3uGroups(res)
        return
      }
      if (path === '/api/geil/vod/m3u/items') {
        await handleM3uItems(reqUrl, res)
        return
      }
      if (path === '/api/geil/vod/m3u/item') {
        await handleM3uItem(reqUrl, res)
        return
      }
      if (path === '/api/geil/proxy') {
        const url = (reqUrl.searchParams.get('url') || '').trim()
        if (!/^https?:\/\//i.test(url)) { sendJson(res, 400, { ok: false, error: 'Geçersiz adres' }); return }
        sendJson(res, 200, { ok: true, url: proxyUrl(url, {}) })
        return
      }
      sendJson(res, 404, { ok: false, error: 'Bilinmeyen GEIL uç noktası' })
    } catch (error) {
      console.error(`[GEIL] ${path}: ${error.message}`)
      if (!res.headersSent) sendJson(res, 502, { ok: false, error: error.message || 'Sağlayıcıya ulaşılamadı' })
      else {
        try { res.destroy() } catch {}
      }
    }
  }
}
