import { Readable } from 'node:stream'

import { GEIL, UA, proxyUrl, rewritePlaylist } from './geil-api.js'

/**
 * Same-origin mirror of the provider's own web player (geil.to).
 *
 * The mirrored player asks its addon for a stream and is handed a plain
 * http:// playlist. An https page cannot follow that, and nothing we do from
 * outside the frame can rewrite what the player fetches for itself, so every
 * byte the player touches is pulled through this mirror: the shell, its
 * modules, the addon JSON and the manifests all answer from our own origin.
 *
 * Media is not streamed by the mirror itself. Any http:// URL that appears in
 * an addon response — and the provider's own /live/play redirect — is turned
 * into a signed /api/geil/stream address, which follows the insecure redirect
 * server side and answers over https. The mirror only ever reaches the
 * provider's own hosts, so it is not a general open proxy.
 */

const PREFIX = '/api/geil/site'

const PROVIDER_HOST_ALL = /(?:https?:)?\/\/(?:(?:www\.)?geil\.to|(?:www\.)?geil\.app|(?:www\.)?geil\.win)(?::\d+)?/gi
const ABSOLUTE_URL = /https?:\/\/[^\s"'\\<>)\]]+/gi
const NAMESPACES = /^https?:\/\/(?:www\.w3\.org|purl\.org|schemas\.[a-z]|localhost|127\.0\.0\.1)/i

const FETCH_TIMEOUT_MS = 30000
const STATIC_TTL = 6 * 60 * 60 * 1000
const CACHE_ENTRIES = 48

const textCache = new Map()

function remember(key, value, bytes, ttl) {
  textCache.set(key, { value, bytes, expiresAt: Date.now() + ttl })
  for (const [k, entry] of textCache) {
    if (entry.expiresAt <= Date.now()) textCache.delete(k)
  }
  while (textCache.size > CACHE_ENTRIES) {
    const oldest = textCache.keys().next().value
    if (oldest === undefined) break
    textCache.delete(oldest)
  }
}

function recall(key) {
  const hit = textCache.get(key)
  if (!hit) return null
  if (hit.expiresAt <= Date.now()) {
    textCache.delete(key)
    return null
  }
  return hit.value
}

function mirrorPath(pathname) {
  const rest = pathname.slice(PREFIX.length)
  return rest.startsWith('/') ? rest : `/${rest}`
}

/**
 * The player is shown our mirror paths and hands them straight back in its
 * ?url= arguments, so they have to be turned into provider addresses again
 * before the request goes upstream.
 */
function unmirrorValue(value) {
  if (typeof value !== 'string') return value
  if (value.startsWith(`${PREFIX}/`) || value === PREFIX) return GEIL + (value.slice(PREFIX.length) || '/')
  return value
}

function unmirrorSearch(search) {
  if (!search) return search
  const params = new URLSearchParams(search)
  let changed = false
  for (const [key, value] of [...params]) {
    const original = value
    params.set(key, unmirrorValue(value))
    if (params.get(key) !== original) changed = true
  }
  if (!changed) return search
  const out = params.toString()
  return out ? `?${out}` : ''
}

function upstreamUrl(pathname, search) {
  const url = new URL(mirrorPath(pathname) || '/', GEIL)
  url.search = unmirrorSearch(search || '')
  return url.toString()
}

/** Provider addresses and doc-root asset paths have to answer from our origin. */
function toMirrorPaths(text) {
  return String(text)
    .replace(PROVIDER_HOST_ALL, PREFIX)
    .split('/vuma/').join(`${PREFIX}/vuma/`)
}

/** The mount block opens the addon at the site root; for the mirror it is the mirror prefix. */
function toMirrorMount(text) {
  return String(text).replace(
    /new URL\(\s*["']\/["']\s*,\s*location\.href\s*\)/g,
    `new URL("${PREFIX}/", location.href)`,
  )
}

/**
 * Addresses inside an addon response. Provider paths move to the mirror; an
 * http:// media host stays plain but is answered through the signed stream
 * proxy, because an https page may not fetch it itself.
 */
function toSafeUrls(text, baseUrl) {
  return String(text)
    .replace(ABSOLUTE_URL, (match) => {
      if (NAMESPACES.test(match)) return match
      let absolute = match
      try {
        absolute = new URL(match, baseUrl).toString()
      } catch {
        return match
      }
      if (/^https:\/\//i.test(absolute)) return match
      return proxyUrl(absolute, {})
    })
    .replace(/"\.\/([a-z0-9_-]{1,32})"/gi, (_m, id) => `"${PREFIX}/${id}"`)
}

function kindOf(pathname, contentType) {
  const ct = String(contentType || '').toLowerCase()
  if (ct.includes('json') || pathname.endsWith('.json')) return 'json'
  if (ct.includes('mpegurl') || /\.(m3u8?|m3u)$/.test(pathname)) return 'playlist'
  if (ct.includes('html') || pathname === '/' || pathname.endsWith('.html')) return 'html'
  if (ct.includes('javascript') || /\.(m?js|jsx)$/.test(pathname)) return 'script'
  if (ct.includes('css') || pathname.endsWith('.css')) return 'style'
  if (ct.startsWith('text/') || ct.includes('svg') || ct.includes('xml') || ct === '') return 'text'
  return 'binary'
}

function rewriteBody(kind, text, baseUrl) {
  if (kind === 'playlist') return rewritePlaylist(text, baseUrl, {})
  if (kind === 'json') return toSafeUrls(toMirrorPaths(text), baseUrl)
  if (kind === 'html') return toMirrorMount(toMirrorPaths(text))
  if (kind === 'script' || kind === 'style' || kind === 'text') return toMirrorPaths(text)
  return text
}

function sendBody(res, status, body, contentType, cacheControl) {
  res.writeHead(status, {
    'content-type': contentType,
    'cache-control': cacheControl,
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function sendEmpty(res, status, contentType, cacheControl) {
  res.writeHead(status, { 'content-type': contentType, 'cache-control': cacheControl })
  res.end()
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 256 * 1024) break
    chunks.push(chunk)
  }
  return size > 256 * 1024 ? null : Buffer.concat(chunks)
}

export function createGeilSiteApi() {
  return async function geilSiteApi(req, res, reqUrl) {
    const pathname = reqUrl.pathname
    const isHead = req.method === 'HEAD'
    if (!['GET', 'POST', 'HEAD'].includes(req.method)) {
      sendEmpty(res, 405, 'text/plain; charset=utf-8', 'no-store')
      return
    }
    if (pathname !== PREFIX && !pathname.startsWith(`${PREFIX}/`)) {
      sendEmpty(res, 404, 'text/plain; charset=utf-8', 'no-store')
      return
    }

    const rest = mirrorPath(pathname)

    // The player is handed these by name from the catalogue; answer with a redirect to
    // the signed media proxy so the insecure hop never reaches the browser.
    if (/^\/(live|vod)\/play\//i.test(rest)) {
      res.writeHead(302, { location: proxyUrl(`${GEIL}${rest}${reqUrl.search}`, {}), 'cache-control': 'no-store' })
      res.end()
      return
    }

    const target = upstreamUrl(pathname, reqUrl.search)
    const isStatic = rest.startsWith('/vuma/')
    const cacheKey = `GET ${target}`
    if (isStatic) {
      const hit = recall(cacheKey)
      if (hit !== null) {
        if (isHead) sendEmpty(res, 200, hit.contentType, 'public, max-age=86400')
        else sendBody(res, 200, hit.body, hit.contentType, 'public, max-age=86400')
        return
      }
    }

    const headers = {
      'user-agent': UA,
      accept: '*/*',
      'accept-language': 'tr-TR,tr;q=0.9,en;q=0.7',
      origin: GEIL,
      referer: `${GEIL}/`,
    }
    if (req.headers.range) headers.range = req.headers.range

    let upstream
    try {
      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['content-type']) {
        headers['content-type'] = req.headers['content-type']
      }
      upstream = await fetch(target, {
        method: req.method,
        headers,
        body: body || undefined,
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
    } catch (error) {
      if (isHead) sendEmpty(res, 502, 'text/plain; charset=utf-8', 'no-store')
      else sendBody(res, 502, `Ayna ulaşılamadı: ${error.message}`, 'text/plain; charset=utf-8', 'no-store')
      return
    }

    const contentType = upstream.headers.get('content-type') || ''
    const kind = kindOf(new URL(target).pathname, contentType)
    const status = upstream.status >= 200 ? upstream.status : 502

    if (isHead) {
      sendEmpty(res, status, contentType || 'application/octet-stream', isStatic ? 'public, max-age=86400' : 'no-cache')
      return
    }

    if (kind === 'binary') {
      if (!upstream.body) {
        res.writeHead(status, { 'content-type': contentType || 'application/octet-stream' })
        res.end()
        return
      }
      const responseHeaders = { 'content-type': contentType || 'application/octet-stream', 'cache-control': 'public, max-age=3600' }
      for (const header of ['content-length', 'content-range', 'accept-ranges']) {
        const value = upstream.headers.get(header)
        if (value) responseHeaders[header] = value
      }
      res.writeHead(status, responseHeaders)
      const stream = Readable.fromWeb(upstream.body)
      stream.on('error', () => { try { res.destroy() } catch {} })
      res.on('close', () => { try { stream.destroy() } catch {} })
      stream.pipe(res)
      return
    }

    let text
    try {
      text = await upstream.text()
    } catch (error) {
      sendBody(res, 502, `Ayna okunamadı: ${error.message}`, 'text/plain; charset=utf-8', 'no-store')
      return
    }
    const rewritten = rewriteBody(kind, text, upstream.url || target)
    const cacheControl = kind === 'playlist' || kind === 'json'
      ? 'no-store, max-age=0'
      : isStatic ? 'public, max-age=86400' : 'no-cache'
    const fallbackType = kind === 'json' ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8'
    if (isStatic && upstream.ok) remember(cacheKey, { body: rewritten, contentType: contentType || fallbackType }, Buffer.byteLength(rewritten), STATIC_TTL)
    sendBody(res, status, rewritten, contentType || fallbackType, cacheControl)
  }
}
