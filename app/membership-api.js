import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const GIFT_CODE = 'W&Q%*8M*Afree'
const COOKIE_NAME = 'notflix_session'
const SESSION_DAYS = 30
const MAX_BODY_BYTES = 16 * 1024

function json(res, status, payload, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers })
  res.end(JSON.stringify(payload))
}

function cookieHeaders(token, maxAge = SESSION_DAYS * 86400) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return { 'set-cookie': `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}` }
}

function sign(value, secret) { return createHmac('sha256', secret).update(value).digest('hex') }

async function bodyJson(req) {
  let data = ''
  for await (const part of req) {
    data += part
    if (Buffer.byteLength(data) > MAX_BODY_BYTES) throw new Error('Request body too large')
  }
  return data ? JSON.parse(data) : {}
}

function cookie(req, name) {
  const header = req.headers.cookie || ''
  for (const entry of header.split(';')) {
    const [key, ...parts] = entry.trim().split('=')
    if (key === name) return decodeURIComponent(parts.join('='))
  }
  return ''
}

function sessionToken(userId, secret) {
  const nonce = randomBytes(32).toString('hex')
  const content = `${userId}.${Date.now() + SESSION_DAYS * 86400000}.${nonce}`
  return `${content}.${sign(content, secret)}`
}

function parseSession(token, secret) {
  const parts = token.split('.')
  if (parts.length !== 4) return null
  const content = parts.slice(0, 3).join('.')
  const signature = Buffer.from(parts[3], 'hex')
  const expected = Buffer.from(sign(content, secret), 'hex')
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null
  const expiresAt = Number(parts[1])
  return Number.isFinite(expiresAt) && expiresAt > Date.now() ? { userId: parts[0], expiresAt } : null
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET_API_KEY
  const sessionSecret = process.env.NOTFLIX_SESSION_SECRET
  if (!url || !key || !sessionSecret) {
    const error = new Error('Supabase server configuration missing')
    error.code = 'CONFIG_MISSING'
    throw error
  }
  if (/^sb_publishable_/i.test(key) || /^eyJ[A-Za-z0-9_-]+\./.test(key) && process.env.SUPABASE_SERVICE_ROLE_KEY !== key) {
    const error = new Error('SUPABASE_SERVICE_ROLE_KEY must be a server-side secret key, not publishable/anon')
    error.code = 'WRONG_KEY_TYPE'
    throw error
  }
  return { url: url.replace(/\/$/, ''), key: key.trim(), sessionSecret: sessionSecret.trim() }
}

function validateAdmin(req) {
  const expected = process.env.NOTFLIX_ADMIN_KEY || ''
  const supplied = String(req.headers['x-notflix-admin-key'] || '')
  const a = Buffer.from(expected)
  const b = Buffer.from(supplied)
  return Boolean(expected && a.length === b.length && timingSafeEqual(a, b))
}

async function supa(path, config, options = {}) {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: config.key, authorization: `Bearer ${config.key}`, accept: 'application/json', ...(options.body ? { 'content-type': 'application/json', prefer: 'return=representation' } : {}), ...options.headers },
    signal: AbortSignal.timeout(12000),
  })
  const text = await response.text()
  let result = null
  try { result = text ? JSON.parse(text) : null } catch { result = { message: text.slice(0, 300) } }
  if (!response.ok) {
    const error = new Error(result?.message || result?.hint || `Supabase request failed (${response.status})`)
    error.status = response.status
    error.code = result?.code || 'SUPABASE_REST_ERROR'
    throw error
  }
  return result
}

async function readMemberByUsername(username, config) {
  const rows = await supa(`notflix_kullanicilar?kullanici_adi=eq.${encodeURIComponent(username)}&select=id,kullanici_adi,eposta,hediye_kodu_kullanildi,abonelik_bitis,abonelik_kaynagi,hwid,ip_adresi,son_gorulme,durum`, config)
  return rows?.[0] || null
}

async function rpc(name, args, config) {
  const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: config.key, authorization: `Bearer ${config.key}`, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(12000) })
  const text = await response.text()
  let value = null
  try { value = text ? JSON.parse(text) : null } catch { value = { message: text.slice(0, 300) } }
  if (!response.ok) { const error = new Error(value?.message || value?.hint || `Supabase RPC failed (${response.status})`); error.status = response.status; error.code = value?.code || 'SUPABASE_RPC_ERROR'; throw error }
  return value
}

async function readMemberById(id, config) {
  const rows = await supa(`notflix_kullanicilar?id=eq.${encodeURIComponent(id)}&select=id,kullanici_adi,eposta,hediye_kodu_kullanildi,abonelik_bitis,abonelik_kaynagi,hwid,ip_adresi,son_gorulme,durum`, config)
  return rows?.[0] || null
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return forwarded || req.socket.remoteAddress || null
}

function deviceHash(req, secret) {
  const deviceId = String(req.headers['x-notflix-device'] || '').slice(0, 256)
  return deviceId ? sign(deviceId, secret) : ''
}

async function loadActiveSession(req, config) {
  const token = cookie(req, COOKIE_NAME)
  const parsed = parseSession(token, config.sessionSecret)
  if (!parsed) return null
  const row = await readMemberById(parsed.userId, config)
  const user = row ? { ...row, id: row.id, username: row.kullanici_adi, email: row.eposta, subscription_expires_at: row.abonelik_bitis, device_fingerprint_hash: row.hwid, first_ip: row.ip_adresi, active: row.durum === 'aktif', banned: row.durum === 'bloklu' } : null
  if (!user || !user.active || user.banned) return null
  if (Date.now() > parsed.expiresAt) return null
  const requestedDevice = deviceHash(req, config.sessionSecret)
  if (user.device_fingerprint_hash && requestedDevice !== user.device_fingerprint_hash) return null
  const ip = clientIp(req)
  if (user.first_ip && normalizeIp(user.first_ip) !== normalizeIp(ip)) {
    const changedIp = await supa(`notflix_kullanicilar?id=eq.${encodeURIComponent(user.id)}`, config, { method: 'PATCH', body: JSON.stringify({ ip_adresi: ip, son_gorulme: new Date().toISOString() }) })
    if (changedIp?.[0]?.ip_adresi) user.first_ip = changedIp[0].ip_adresi
  }
  return user
}

function normalizeIp(value) { return String(value || '').replace(/^::ffff:/i, '') }

async function createUser({ username, email, password }, req, config) {
  if (!/^[a-zA-Z0-9_.-]{4,20}$/.test(username || '') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '') || typeof password !== 'string' || password.length < 8 || password.length > 12 || !/[!@#$%^&*(),.?":{}|<>_\-]/.test(password)) {
    const err = new Error('Username, email or password does not meet policy'); err.status = 400; throw err
  }
  const ip = clientIp(req)
  const hwid = deviceHash(req, config.sessionSecret)
  const passwordHash = await rpc('notflix_sifre_hashle', { p_sifre: password }, config)
  const inserted = await supa('notflix_kullanicilar', config, { method: 'POST', body: JSON.stringify([{ kullanici_adi: username, sifre_hash: passwordHash, eposta: email, hwid: hwid || null, ip_adresi: ip, son_gorulme: new Date().toISOString() }]) })
  const member = inserted?.[0]
  if (!member) throw new Error('Kullanıcı kaydı oluşturulamadı')
  return { ...member, username: member.kullanici_adi, email: member.eposta, id: member.id, subscription_expires_at: member.abonelik_bitis, device_fingerprint_hash: member.hwid, first_ip: member.ip_adresi, active: member.durum === 'aktif', banned: member.durum === 'bloklu' }
}

async function authenticatePassword(username, password, config) {
  const rows = await rpc('notflix_sifre_dogrula', { p_kullanici_adi: username, p_sifre: password }, config)
  const user = Array.isArray(rows) ? rows[0] : rows
  if (!user || user.durum !== 'aktif') { const error = new Error('Kullanıcı adı/şifre hatalı ya da hesap bloklu.'); error.status = 401; throw error }
  return { ...user, id: user.id, username: user.kullanici_adi, email: user.eposta, subscription_expires_at: user.abonelik_bitis, device_fingerprint_hash: user.hwid, first_ip: user.ip_adresi, active: user.durum === 'aktif', banned: user.durum === 'bloklu' }
}

async function membershipStatus(user) {
  const expires = user.subscription_expires_at ? Date.parse(user.subscription_expires_at) : 0
  return { username: user.username, hasSubscription: Number.isFinite(expires) && expires > Date.now(), subscriptionExpiresAt: user.subscription_expires_at || null, banned: !user.active || user.banned }
}

export function createMembershipApi() {
  return async function membershipApi(req, res) {
    let config
    try {
      config = supabaseConfig()
      const url = new URL(req.url || '/', 'http://localhost')
      const route = url.pathname

      if (req.method === 'GET' && route === '/api/membership/health') {
        try {
          const response = await fetch(`${config.url}/rest/v1/notflix_kullanicilar?select=id&limit=0`, {
            headers: { apikey: config.key, authorization: `Bearer ${config.key}`, accept: 'application/json' },
            signal: AbortSignal.timeout(10000),
          })
          const text = await response.text()
          let details = null
          try { details = text ? JSON.parse(text) : null } catch { details = { message: 'Non-JSON response from Supabase REST' } }
          if (!response.ok) {
            console.error(`[MEMBERSHIP-HEALTH] Supabase ${response.status} ${details?.code || ''} ${details?.message || ''}`)
            return json(res, 503, { ok: false, supabaseStatus: response.status, supabaseCode: details?.code || 'UNKNOWN', supabaseMessage: safeDiagnostic(details?.message) })
          }
          return json(res, 200, { ok: true, database: 'reachable', table: 'notflix_kullanicilar' })
        } catch (error) {
          return json(res, 503, { ok: false, code: 'SUPABASE_NETWORK_ERROR', message: safeDiagnostic(error.message) })
        }
      }

      if (route.startsWith('/api/admin/membership/')) {
        if (!validateAdmin(req)) return json(res, 403, { error: 'Admin yetkisi yok.' })
        if (req.method === 'PATCH' && route === '/api/admin/membership/status') {
          const body = await bodyJson(req)
          const username = String(body.username || '').trim()
          const blocked = ['off', 'iptal', 'bloklu', 'banned'].includes(String(body.status || '').toLowerCase())
          if (!username || !['aktif', 'off', 'iptal', 'bloklu', 'banned'].includes(String(body.status || '').toLowerCase())) return json(res, 400, { error: 'Kullanıcı adı ve status=aktif|off|iptal girin.' })
          const changed = await supa(`notflix_kullanicilar?kullanici_adi=eq.${encodeURIComponent(username)}`, config, { method: 'PATCH', body: JSON.stringify({ durum: blocked ? 'bloklu' : 'aktif' }) })
          if (!changed?.length) return json(res, 404, { error: 'Kullanıcı bulunamadı.' })
          return json(res, 200, { ok: true, kullanici_adi: changed[0].kullanici_adi, durum: changed[0].durum })
        }
        if (req.method === 'POST' && route === '/api/admin/membership/manual-subscription') {
          const body = await bodyJson(req)
          const username = String(body.username || '').trim()
          const months = Number(body.months)
          if (!username || ![1, 3, 12].includes(months)) return json(res, 400, { error: 'Kullanıcı adı ve 1/3/12 ay paketi gerekli.' })
          const target = await readMemberByUsername(username, config)
          if (!target) return json(res, 404, { error: 'Kullanıcı bulunamadı.' })
          const base = Math.max(Date.now(), target.abonelik_bitis ? Date.parse(target.abonelik_bitis) : 0)
          const expiresAt = new Date(base + months * 30 * 86400000).toISOString()
          await supa(`notflix_kullanicilar?id=eq.${encodeURIComponent(target.id)}`, config, { method: 'PATCH', body: JSON.stringify({ abonelik_bitis: expiresAt, abonelik_kaynagi: `Shopier ${months} Ay` }) })
          return json(res, 200, { ok: true, kullanici_adi: username, abonelik_bitis: expiresAt })
        }
        return json(res, 404, { error: 'Admin endpoint bulunamadı.' })
      }

      if (req.method === 'POST' && route === '/api/membership/register') {
        const body = await bodyJson(req)
        const user = await createUser(body, req, config)
        const token = sessionToken(user.id, config.sessionSecret)
        return json(res, 200, { username: user.username }, cookieHeaders(token))
      }

      if (req.method === 'POST' && route === '/api/membership/login') {
        const body = await bodyJson(req)
        const user = await authenticatePassword(body.username, body.password, config)
        const ip = clientIp(req)
        const hwid = deviceHash(req, config.sessionSecret)
        if (!hwid) return json(res, 400, { error: 'Cihaz belirteci alınamadı.' })
        if (user.device_fingerprint_hash && user.device_fingerprint_hash !== hwid) return json(res, 403, { error: 'Bu hesap başka bir cihazla eşleştirilmiş.' })
        await supa(`notflix_kullanicilar?id=eq.${encodeURIComponent(user.id)}`, config, { method: 'PATCH', body: JSON.stringify({ ip_adresi: ip, hwid: user.device_fingerprint_hash || hwid || null, son_gorulme: new Date().toISOString() }) })
        const token = sessionToken(user.id, config.sessionSecret)
        return json(res, 200, { username: user.username }, cookieHeaders(token))
      }

      if (req.method === 'GET' && route === '/api/membership/status') {
        const user = await loadActiveSession(req, config)
        if (!user) return json(res, 401, { error: 'Oturum bulunamadı veya hesap bloklu.' })
        return json(res, 200, await membershipStatus(user))
      }

      if (req.method === 'POST' && route === '/api/membership/redeem-gift') {
        const body = await bodyJson(req)
        if (String(body.code || '') !== GIFT_CODE) return json(res, 400, { error: 'Hediye kodu geçersiz.' })
        const username = String(body.username || '').trim()
        if (!username) return json(res, 400, { error: 'Kullanıcı adını girin.' })
        const hwid = deviceHash(req, config.sessionSecret)
        if (!hwid) return json(res, 400, { error: 'Cihaz belirteci alınamadı.' })
        const rows = await rpc('notflix_hediye_kodu_kullan', { p_kullanici_adi: username, p_hwid: hwid, p_ip: clientIp(req), p_kod: String(body.code || '') }, config)
        const member = Array.isArray(rows) ? rows[0] : rows
        if (!member) return json(res, 403, { error: 'Hediye kodu kullanılamadı; hesap bloklu, kod daha önce kullanılmış veya cihaz bağlı.' })
        const token = sessionToken(member.id, config.sessionSecret)
        return json(res, 200, { username: member.kullanici_adi, hasSubscription: true, subscriptionExpiresAt: member.abonelik_bitis, banned: false }, cookieHeaders(token))
      }

      if (req.method === 'POST' && route === '/api/membership/logout') return json(res, 200, { ok: true }, cookieHeaders('', 0))

      if (req.method === 'DELETE' && route === '/api/membership/delete-account') {
        const user = await loadActiveSession(req, config)
        if (!user) return json(res, 401, { error: 'Oturum bulunamadı veya hesap bloklu.' })
        await supa(`notflix_kullanicilar?id=eq.${encodeURIComponent(user.id)}`, config, { method: 'DELETE' })
        return json(res, 200, { ok: true }, cookieHeaders('', 0))
      }

      return json(res, 404, { error: 'Membership endpoint not found' })
    } catch (error) {
      const status = error.status || (error.message === 'Request body too large' ? 413 : 503)
      const code = error.code || (status === 503 ? 'MEMBERSHIP_UNAVAILABLE' : 'MEMBERSHIP_REQUEST_ERROR')
      console.error(`[MEMBERSHIP] ${req.method} ${req.url}: ${code} ${error.message}`)
      return json(res, status, { error: status === 503 ? 'Membership service is unavailable or not configured' : error.message, code })
    }
  }
}

function safeDiagnostic(message) {
  return String(message || 'Supabase request failed').replace(/(?:sbp_|eyJ)[A-Za-z0-9._-]+/g, '[REDACTED]').slice(0, 180)
}
