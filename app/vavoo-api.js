import { Readable } from 'node:stream'
import { randomUUID } from 'node:crypto'

/**
 * Vavoo / MediaHubMX proxy.
 *
 * The browser never talks to Vavoo directly. The API below keeps the addon
 * signature, catalog and short-lived stream URLs server-side, and exposes a
 * small same-origin surface for the NOTFLIX frontend. HLS playlists are
 * rewritten so every segment also stays same-origin (no mixed-content issues
 * when the site is served over HTTPS).
 */

const VAVOO_SITE = 'https://vavoo.cc'
const PING_URL = 'https://www.vavoo.tv/api/app/ping'
const CATALOG_PATH = '/mediahubmx-catalog.json'
const RESOLVE_PATH = '/mediahubmx-resolve.json'
const CATALOG_UA = 'MediaHubMX/2'
const STREAM_UA = 'VAVOO/2.6'
const LANGUAGE = 'tr'
const REGION = 'US'
const CLIENT_VERSION = '3.0.2'

const SIGNATURE_TTL_MS = 9 * 60 * 1000
const CATALOG_TTL_MS = 10 * 60 * 1000
const RESOLVE_TTL_MS = 2 * 60 * 1000
const MAX_CATALOG_PAGES = 40

let signatureState = { value: '', expiresAt: 0 }
let catalogState = { channels: [], byId: new Map(), totalRaw: 0, generatedAt: 0, expiresAt: 0 }
let catalogBuild = null
const resolveState = new Map()
const logoFailures = new Map()

const progress = {
  active: false,
  percent: 0,
  page: 0,
  raw: 0,
  total: 0,
  message: 'Hazır',
  error: '',
  startedAt: 0,
  finishedAt: 0,
}

function pingPayload() {
  const now = Date.now()
  return {
    reason: 'app-focus',
    locale: LANGUAGE,
    theme: 'dark',
    metadata: {
      device: { type: 'desktop', uniqueId: `notflix-${randomUUID()}` },
      os: { name: 'linux', version: 'Linux', abis: ['x64'], host: 'node' },
      app: { platform: 'electron' },
      version: { package: 'tv.vavoo.app', binary: '3.1.8', js: '3.1.8' },
    },
    appFocusTime: 0,
    playerActive: false,
    playDuration: 0,
    devMode: false,
    hasAddon: true,
    castConnected: false,
    package: 'tv.vavoo.app',
    version: '3.1.8',
    process: 'app',
    firstAppStart: now,
    lastAppStart: now,
    ipLocation: null,
    adblockEnabled: true,
    proxy: { supported: ['ss'], engine: 'Mu', enabled: false, autoServer: true },
    iap: { supported: false },
  }
}

async function getSignature(force = false) {
  if (!force && signatureState.value && Date.now() < signatureState.expiresAt) {
    return signatureState.value
  }

  const response = await fetch(PING_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'VAVOO/3.1.8' },
    body: JSON.stringify(pingPayload()),
    signal: AbortSignal.timeout(20000),
  })

  if (!response.ok) {
    throw new Error(`Vavoo ping failed (HTTP ${response.status})`)
  }

  const data = await response.json()
  if (!data?.addonSig) throw new Error('Vavoo ping did not return an addon signature')

  signatureState = { value: data.addonSig, expiresAt: Date.now() + SIGNATURE_TTL_MS }
  return signatureState.value
}

async function vavooPost(path, body) {
  let lastError = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const signature = await getSignature(attempt > 0)
    const response = await fetch(`${VAVOO_SITE}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'mediahubmx-signature': signature,
        'user-agent': CATALOG_UA,
        accept: '*/*',
        'accept-language': LANGUAGE,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })

    if ((response.status === 401 || response.status === 403) && attempt < 2) {
      signatureState = { value: '', expiresAt: 0 }
      lastError = new Error(`Vavoo signature rejected (HTTP ${response.status})`)
      continue
    }

    const text = await response.text()
    if (!response.ok) {
      throw new Error(`Vavoo request failed (HTTP ${response.status}): ${text.slice(0, 180)}`)
    }

    try {
      return JSON.parse(text)
    } catch {
      throw new Error('Vavoo returned an invalid JSON response')
    }
  }

  throw lastError || new Error('Vavoo request failed')
}

const NAME_FIXES = [
  [/\bBENG\s+T\s+RK\b/g, 'BENGÜ TÜRK'],
  [/\bBENGU\s+TURK\b/g, 'BENGÜ TÜRK'],
  [/\bBENGUTURK\b/g, 'BENGÜ TÜRK'],
  [/\bCNN\s+T\s+RK(\+)?\b/g, 'CNN TÜRK$1'],
  [/\bHABER\s+T\s+RK(\+)?\b/g, 'HABER TÜRK$1'],
  [/\bHABERT\s+RK\b/g, 'HABERTÜRK'],
  [/\bDREAM\s+T\s+RK\b/g, 'DREAM TÜRK'],
  [/\bEKIN\s+T\s+RK\b/g, 'EKİN TÜRK'],
  [/\bAFYON\s+T\s+RK\b/g, 'AFYON TÜRK'],
  [/\bTRT\s+T\s+RK\b/g, 'TRT TÜRK'],
  [/\bTRT\s+M\s+Z\s+K\b/g, 'TRT MÜZİK'],
  [/\bTRT\s+KURD[Iİ]?\b/g, 'TRT KURDİ'],
  [/\bTRT\s+COCUK\b/g, 'TRT ÇOCUK'],
  [/\bTRT\s+OCUK\b/g, 'TRT ÇOCUK'],
  [/\bTRT\s+DIYANET\b/g, 'TRT DİYANET'],
  [/\bS\s+NEMA\b/g, 'SİNEMA'],
  [/\bV\s+ZYON\b/g, 'VİZYON'],
  [/\bAKS\s+YON\b/g, 'AKSİYON'],
  [/\bB\s+L\s+MKURGU\b/g, 'BİLİMKURGU'],
  [/\bYE\s+IL\s+AM\b/g, 'YEŞİLÇAM'],
  [/\bSOZCU\b/g, 'SÖZCÜ'],
  [/\bM\s+N\s+KA\b/g, 'MİNİKA'],
  [/\bMINIKA\b/g, 'MİNİKA'],
  [/\bCOCUK\b/g, 'ÇOCUK'],
  [/\bKOY\s+TV\b/g, 'KÖY TV'],
  [/\bKUDUS\b/g, 'KUDÜS'],
  [/\bLALEGUL\b/g, 'LÂLEGÜL'],
  [/\bSIRINLER\b/g, 'ŞİRİNLER'],
  [/\bISVI\s+RE\b/g, 'İSVİÇRE'],
  [/\bESK\s+EH\s+R\b/g, 'ESKİŞEHİR'],
  [/\bK\s+MARAS\b/g, 'KAHRAMANMARAŞ'],
  [/\bANAKKALE\b/g, 'ÇANAKKALE'],
  [/\bANLIURFA\b/g, 'ŞANLIURFA'],
  [/\bD\s+Ğ\s+N\b/g, 'DİĞİN'],
  [/\bSAT\s*7\s+TURK\b/g, 'SAT 7 TÜRK'],
  [/(^|\s)LKE\s+TV\b/g, '$1ÜLKE TV'],
  [/\bULKE\s*TV\b/g, 'ÜLKE TV'],
  [/\bULKETV\b/g, 'ÜLKE TV'],
  [/\bT\s+RKIYEM\b/g, 'TÜRKİYEM'],
  [/\bTURKIYE\b/g, 'TÜRKİYE'],
  [/\bT\s+RK\b/g, 'TÜRK'],
  [/\bM\s+Z\s+K\b/g, 'MÜZİK'],
  [/\bTURK\b/g, 'TÜRK'],
]

function fixTurkishName(value) {
  let name = String(value || '')
  for (const [pattern, replacement] of NAME_FIXES) {
    name = name.replace(pattern, replacement)
  }
  return name
}

function cleanDisplayName(raw) {
  let name = String(raw || '').trim()

  name = name.replace(/(?:\s|^)(?:CANLI\s*){2,}.*$/i, '')
  name = name.replace(/(?:4K|UHD|FHD|HD|SD|HEVC|H\.?265|\d{3,4}P|CANLI|LIVE)+$/i, '').trim()
  name = name.replace(/\s*\.(?:c|s|b)\s*$/i, '')
  name = name.replace(/^4K\s*TR\s*:\s*/i, '')
  name = name.replace(/\s*\((?:360P|480P|720P|1080P|H\.?265|HEVC|UHD|HD|SD|FEED|TURKEY|\d+\s*FPS)\)\s*/gi, ' ')
  name = name.replace(/\s*\[[^\]]*\]\s*/g, ' ')
  for (let round = 0; round < 3; round += 1) {
    name = name.replace(/\s+\b(?:FHD\+?|HD\+?|SD|HEVC|H\.?265|RAW|4K|UHD)\b\s*$/gi, '')
  }
  name = name.replace(/\s+\d{3,4}P\b/gi, '')
  name = name.replace(/\s+\d+\s*FPS\b/gi, '')
  name = name.replace(/\s+/g, ' ').trim()
  name = fixTurkishName(name)
  name = name.replace(/\bMUZIK\b/g, 'MÜZİK')
  name = name.replace(/\s+/g, ' ').trim()

  return name.toLocaleUpperCase('tr')
}

function nameKey(name) {
  return fixTurkishName(name)
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

/**
 * Dedupe key used to keep exactly one entry per channel. It ignores common
 * "TV" suffixes and spelling variants so "SHOW", "SHOW TV" and "SHOW HD"
 * collapse into one channel instead of filling the list with duplicates.
 */
function channelKey(value) {
  let key = nameKey(cleanDisplayName(value))
  key = key.replace(/europa/g, 'avrupa')
  key = key.replace(/tv$/, '')
  return key
}

const CHANNEL_PRIORITY = [
  // Ulusal — requested order
  'trt1', 'atv', 'kanald', 'show', 'star', 'now', 'tv8', 'tv85',
  'trt2', 'trtturk', 'trtavaz', 'trtkurdi', 'trtworld', 'beyaz',
  'teve2', '24', '360', 'a2', 'fox', 'tv100',
  'kanal7', 'kanal23', 'kanal24', 'kanal26', 'kanal32', 'kanal33',
  'kanal34', 'kanal35', 'kanal42', 'kanal43', 'kanal44', 'kanal47',
  'kanal48', 'kanal54', 'kanal55', 'kanal56', 'kanal57', 'kanal58',
  'kanal59', 'kanal60', 'kanal61', 'kanal62', 'kanal63', 'kanal64',
  'kanal65', 'kanal66', 'kanal67', 'kanal68',

  // Haber
  'trthaber', 'ahaber', 'haberglobal', 'cnnturk', 'ntv', 'sozcu',
  'halktv', 'tele1', 'krt', 'tvnet', 'bloomberght', 'haberturk',

  // Spor
  'beinsports1', 'beinsports2', 'beinsports3', 'beinsports4', 'beinsports5',
  'beinsportsmax1', 'beinsportsmax2', 'beinsports4kfeedkutu', 'beinsports4kfeeduydu',
  'ssport', 'ssport2', 'ssportplus', 'tivibuspor1', 'tivibuspor2', 'tivibuspor3',
  'exxensports1', 'exxensports2', 'exxensports3', 'exxentv',
  'tabiispor1', 'tabiispor2', 'trtspor', 'trtspor2', 'aspor',
  'fb', 'gs', 'tjk', 'eurosport1', 'eurosport2', 'sports',

  // Belgesel
  'trtbelgesel', 'nationalgeographic', 'nationalgeographicwild',
  'discoverychannel', 'discovery', 'history', 'viasathistory',
  'dmax', 'tlc', 'animalplanet', 'bbcearth', 'davinci',

  // Müzik
  'trtmuzik', 'powerturk', 'kral', 'number1', 'nr1damar', 'dreamturk',

  // Sinema & dizi
  'beinmoviespremiere', 'beinmoviesstars', 'beinmoviesturk',
  'sinema', 'sinematv2', 'sinematvaksiyon', 'sinemakomed', 'epicdrama',

  // Çocuk
  'trtcocuk', 'cartoonnetwork', 'disneychannel', 'disneyjunior', 'minika',
  'minikaocuk', 'minikago', 'nickelodeon', 'boomerang', 'cbeebies',
]
const CHANNEL_RANKS = new Map(CHANNEL_PRIORITY.map((key, index) => [key, index]))


const FEATURED_NAMES = [
  'TRT 1', 'ATV', 'SHOW TV', 'STAR TV', 'KANAL D', 'NOW TV', 'TV8',
  'TRT HABER', 'TRT SPOR', 'A HABER', 'A SPOR', 'HABER GLOBAL', 'CNN TÜRK',
  'NTV', '24', 'TV 100', 'TEVE2', 'BEYAZ TV', 'FOX', 'TLC', 'DMAX',
  'BEIN SPORTS 1', 'BEIN SPORTS 2', 'BEIN SPORTS 3', 'BEIN SPORTS MAX 1',
  'S SPORT', 'TIVIBU SPOR 1', 'EXXEN SPORTS 1', 'TABII SPOR 1', 'EUROSPORT 1',
  'EUROSPORT 2', 'FB TV', 'GS TV', 'TJK TV', 'TRT BELGESEL', 'TRT ÇOCUK',
  'CARTOON NETWORK', 'DISNEY CHANNEL', 'NATIONAL GEOGRAPHIC', 'DISCOVERY CHANNEL',
  'TRT MÜZİK', 'POWER TÜRK TV', 'KRAL TV', 'TRT WORLD', 'TRT AVAZ', 'TRT TÜRK',
  'BEIN GURME', '24 KITCHEN', 'TRT 2', 'TRT KURDİ', 'TRT DİYANET',
]
const FEATURED_KEYS = new Set(FEATURED_NAMES.map(channelKey))

function classifyChannel(name, rawNames) {
  const haystack = `${name} ${rawNames.join(' ')}`.toLocaleUpperCase('tr')

  if (/(?:^|\s)(?:EBA|TRT EBA)(?:\s|$)/.test(haystack)) return 'Eğitim'
  if (/(?:SPOR|SPORT|EUROSPORT|BEIN|EXXEN|TIVIBU|TABII|S-SPORT|NBA|FB TV|GS TV|TJK|SARAN|IDMAN|FIGHT|BOX OFFICE)/.test(haystack)) return 'Spor'
  if (/(?:HABER|NEWS|CNN|NTV|BLOOMBERG|DHA|SÖZCÜ|SOZCU|GLOBAL|KRT|HALK TV|TELE 1|TV NET|TVNET|HABERTÜRK|HABERTURK)/.test(haystack)) return 'Haber'
  if (/(?:SINEMA|SİNEMA|CINEMA|MOVIE|FILM|DIZI|DİZİ|SERIES|CINE|MAX|EPIC|DRAMA|YESILCAM|YEŞİLÇAM|SALON)/.test(haystack)) return 'Sinema & Dizi'
  if (/(?:COCUK|ÇOCUK|CARTOON|DISNEY|NICK|BABY|MINIKA|MİNİKA|PEPEE|PEPE|CAILLOU|MASAL|ANIMASYON|ANIMATION|POKEMON|SÜNGER|SUNGER|KUKULI|NILOYA)/.test(haystack)) return 'Çocuk'
  if (/(?:MUZIK|MÜZİK|MUSIC|RADYO|RADIO|FM(?:\s|$)|POWER|KRAL|NUMBER|NR1|NR 1|AKUSTIK|AKUSTİK|POP|SLOW|DAMAR)/.test(haystack)) return 'Müzik'
  if (/(?:BELGESEL|DOCU|DOCUMENTARY|DISCOVERY|NAT GEO|NATIONAL GEOGRAPHIC|HISTORY|VIASAT|BBC EARTH|LOVE NATURE|ANIMAL PLANET|DMAX|TLC|DA VINCI)/.test(haystack)) return 'Belgesel'
  if (/(?:GURME|KITCHEN|OUTDOOR|AUTOMOTO|EXPLORE|YASAM|YAŞAM)/.test(haystack)) return 'Yaşam'
  if (/(?:DIYANET|DİYANET|KURAN|KUR'AN|DINI|DİNİ|SEMERKAND|REHBER|HZ\.?\s|VUSLAT)/.test(haystack)) return 'Dinî'
  if (/(?:KANAL\s+\d{1,2}|TV\s+\d{2,3}|YEREL|MERKEZ TV|BELEDIYESI|BELEDİYESİ)/.test(haystack)) return 'Yerel'

  return 'Ulusal'
}

function qualityOf(rawName) {
  if (/\b4K\b|\bUHD\b/i.test(rawName)) return '4K'
  if (/\bFHD\b|\b1080P\b/i.test(rawName)) return 'FHD'
  if (/\bHD\b|\b720P\b|\b1080I\b/i.test(rawName)) return 'HD'
  if (/\bHEVC\b|\bH\.?265\b/i.test(rawName)) return 'HEVC'
  if (/\bSD\b|\b576P\b|\b480P\b|\b360P\b/i.test(rawName)) return 'SD'
  return 'CANLI'
}

const QUALITY_SCORE = {
  '4K': 1000,
  FHD: 820,
  HD: 680,
  HEVC: 520,
  CANLI: 420,
  SD: 240,
}

function variantScore(entry) {
  const raw = entry.raw
  let score = QUALITY_SCORE[qualityOf(raw)] || 0
  if (/\s*\.c\s*$/i.test(raw)) score += 40
  else if (/\s*\.s\s*$/i.test(raw)) score += 30
  else if (/\s*\.b\s*$/i.test(raw)) score += 20
  if (entry.item.logo) score += 8
  if (entry.item.epg?.length) score += 4
  if (/\bRAW\b/i.test(raw)) score += 2
  return score
}

function turkishScore(value) {
  return (String(value).match(/[ÇĞİÖŞÜ]/g) || []).length
}

const CATEGORY_ORDER = [
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
]
const CATEGORY_RANK = new Map(CATEGORY_ORDER.map((name, index) => [name, index]))

function channelPriority(channel) {
  const key = channelKey(channel.name)
  const rank = CHANNEL_RANKS.get(key)
  if (rank !== undefined) return rank
  const fourK = channel.quality === '4K' || /\b4K\b|\bUHD\b/i.test(channel.name)
  return fourK ? -1 : 9999
}

function compareChannels(a, b) {
  const categoryDiff =
    (CATEGORY_RANK.get(a.category) ?? 99) - (CATEGORY_RANK.get(b.category) ?? 99)
  if (categoryDiff !== 0) return categoryDiff

  const priorityDiff = channelPriority(a) - channelPriority(b)
  if (priorityDiff !== 0) return priorityDiff

  if (a.featured !== b.featured) return a.featured ? -1 : 1
  return a.name.localeCompare(b.name, 'tr')
}

const COUNTRY_ALIASES = new Map([
  ['tr', 'Turkey'], ['turkey', 'Turkey'], ['türkiye', 'Turkey'],
  ['de', 'Germany'], ['germany', 'Germany'], ['deutschland', 'Germany'],
  ['fr', 'France'], ['france', 'France'],
  ['nl', 'Netherlands'], ['netherlands', 'Netherlands'], ['holland', 'Netherlands'],
  ['gb', 'United Kingdom'], ['uk', 'United Kingdom'], ['united kingdom', 'United Kingdom'],
  ['us', 'United States'], ['usa', 'United States'], ['united states', 'United States'],
  ['it', 'Italy'], ['italy', 'Italy'], ['es', 'Spain'], ['spain', 'Spain'],
  ['pl', 'Poland'], ['poland', 'Poland'], ['be', 'Belgium'], ['belgium', 'Belgium'],
  ['at', 'Austria'], ['austria', 'Austria'], ['ch', 'Switzerland'], ['switzerland', 'Switzerland'],
])

function normalizeCountry(value) {
  const raw = String(value || '').trim()
  if (!raw) return 'Turkey'
  return COUNTRY_ALIASES.get(raw.toLowerCase()) || raw
}

function normalizeChannels(rawItems) {
  const grouped = new Map()

  for (const item of rawItems) {
    if (!item?.url || !item?.ids?.id) continue
    const display = cleanDisplayName(item.name)
    if (!display) continue
    const key = channelKey(display)
    if (!key) continue
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push({ item, raw: String(item.name || ''), display })
  }

  const channels = []
  const sourceById = new Map()
  const sourceByVariantId = new Map()

  for (const variants of grouped.values()) {
    const sorted = [...variants].sort((a, b) => variantScore(b) - variantScore(a))
    const best = sorted[0]
    if (!best) continue

    const displayVariant = [...variants]
      .sort((a, b) => turkishScore(b.display) - turkishScore(a.display) || a.display.length - b.display.length)[0]
    const logoVariant = variants.find((entry) => entry.item.logo)
    const epgVariant = variants.find((entry) => entry.item.epg?.length)
    const name = displayVariant?.display || best.display
    const rawNames = variants.map((entry) => entry.raw)
    const logoUrl = logoVariant?.item.logo || ''

    const epg = (epgVariant?.item.epg || [])
      .map((slot) => ({
        start: Number(slot?.start) || 0,
        stop: Number(slot?.stop) || 0,
        title: String(slot?.name || '').trim(),
      }))
      .filter((slot) => slot.start > 0 && slot.stop > slot.start && slot.title)
      .sort((a, b) => a.start - b.start)
      .slice(0, 8)

    const id = String(best.item.ids.id)
    const qualityVariants = sorted.map((entry) => ({
      id: String(entry.item.ids.id),
      name: entry.display,
      quality: qualityOf(entry.raw),
      sourceUrl: String(entry.item.url),
    }))
    channels.push({
      id,
      name,
      originalName: String(displayVariant?.raw || best.raw || item?.name || name),
      logo: logoUrl ? `/api/vavoo/logo?u=${encodeBase64Url(logoUrl)}` : '',
      category: classifyChannel(name, rawNames),
      quality: qualityOf(best.raw),
      featured: FEATURED_KEYS.has(channelKey(name)),
      epg,
      qualityVariants,
      country: normalizeCountry(best.item.group || best.item.country || best.item.countryCode || best.item.category || (String(best.raw).match(/(?:^|\b)([A-Z]{2})\s*:/)?.[1])),
    })
    sourceById.set(id, String(best.item.url))
    for (const variant of qualityVariants) sourceByVariantId.set(variant.id, variant.sourceUrl)
  }

  const preferredOrder = new Map([
    ['trt1', 0], ['show', 1], ['atv', 2], ['kanald', 3], ['star', 4], ['now', 5], ['tv8', 6],
  ])
  channels.sort((a, b) => {
    const aPriority = preferredOrder.get(channelKey(a.name))
    const bPriority = preferredOrder.get(channelKey(b.name))
    if (aPriority !== undefined || bPriority !== undefined) {
      if (aPriority === undefined) return 1
      if (bPriority === undefined) return -1
      if (aPriority !== bPriority) return aPriority - bPriority
    }
    return compareChannels(a, b)
  })
  const byId = new Map(channels.map((channel) => [channel.id, channel]))

  return { channels, byId, sourceById, sourceByVariantId, totalRaw: rawItems.length }
}

async function buildCatalog() {
  progress.active = true
  progress.percent = 6
  progress.page = 0
  progress.raw = 0
  progress.total = 0
  progress.message = 'Vavoo sunucusuna bağlanılıyor...'
  progress.error = ''
  progress.startedAt = Date.now()
  progress.finishedAt = 0

  try {
    const signature = await getSignature()
    if (!signature) throw new Error('Vavoo imzası alınamadı')

    let cursor = null
    let pages = 0
    let rawCount = 0
    const items = []
    const seenItemKeys = new Set()
    const catalogGroups = new Set()

    do {
      progress.message = `Kanal kataloğu alınıyor · ${pages + 1}. sayfa`
      progress.percent = Math.min(88, 18 + pages * 17)

      const page = await vavooPost(CATALOG_PATH, {
        language: LANGUAGE,
        region: REGION,
        catalogId: 'iptv',
        id: 'iptv',
        adult: false,
        search: '',
        sort: '',
        filter: {},
        cursor,
        clientVersion: CLIENT_VERSION,
      })

      const pageItems = Array.isArray(page?.items) ? page.items : []
      rawCount += pageItems.length
      pages += 1

      for (const item of pageItems) {
        const group = item?.group || item?.country || item?.countryCode || item?.category
        if (group) catalogGroups.add(String(group))
        if (item?.type === 'iptv' && item?.url && item?.ids?.id) {
          const key = `${item.ids.id}:${item.url}`
          if (!seenItemKeys.has(key)) { seenItemKeys.add(key); items.push(item) }
        }
      }

      progress.page = pages
      progress.raw = rawCount
      cursor = page?.nextCursor || null
      } while (cursor && pages < MAX_CATALOG_PAGES)

    if (items.length === 0) throw new Error('Vavoo tüm-ülke kataloğu sonuç döndürmedi; doğru ülke kataloğu filtresi doğrulanamadı.')

    progress.message = 'Logolar ve EPG bilgileri eşleştiriliyor...'
    progress.percent = 92

    const normalized = normalizeChannels(items)
    if (normalized.channels.length === 0) throw new Error('Kanal listesi oluşturulamadı')

    progress.percent = 100
    progress.total = normalized.channels.length
    progress.message = `${normalized.channels.length} kanal hazır`
    progress.finishedAt = Date.now()

    return {
      ...normalized,
      countries: [...new Set(normalized.channels.map((channel) => channel.country))].sort(),
      groups: [...catalogGroups].sort(),
      generatedAt: Date.now(),
      expiresAt: Date.now() + CATALOG_TTL_MS,
    }
  } catch (error) {
    progress.error = error?.message || 'Katalog yüklenemedi'
    progress.message = 'Katalog yüklenemedi'
    throw error
  } finally {
    progress.active = false
  }
}

async function getCatalog(force = false) {
  const fresh = catalogState.channels.length > 0 && Date.now() < catalogState.expiresAt

  if (!force && fresh) {
    return catalogState
  }

  if (catalogBuild) return catalogBuild

  catalogBuild = buildCatalog()
    .then((state) => {
      catalogState = state
      console.log(`[VAVOO] catalog ready: ${state.channels.length} unique channels (${state.totalRaw} records)`)
      return state
    })
    .catch((error) => {
      console.log(`[VAVOO] catalog error: ${error.message}`)
      if (catalogState.channels.length > 0) return catalogState
      throw error
    })
    .finally(() => {
      catalogBuild = null
    })

  return catalogBuild
}

async function resolveChannel(channel, force = false) {
  const cached = resolveState.get(channel.id)
  if (!force && cached && Date.now() < cached.expiresAt) return cached

  const data = await vavooPost(RESOLVE_PATH, {
    language: LANGUAGE,
    region: REGION,
    url: channel.sourceUrl,
    clientVersion: CLIENT_VERSION,
  })

  const entries = Array.isArray(data) ? data : [data]
  const urls = []
  for (const entry of entries) {
    const url = entry?.url || entry?.stream || entry?.sources?.[0]?.url
    if (typeof url === 'string' && /^https?:\/\//i.test(url) && !urls.includes(url)) urls.push(url)
  }

  if (urls.length === 0) throw new Error('Vavoo bu kanal için yayın adresi döndürmedi')

  const resolved = {
    id: channel.id,
    name: channel.name,
    urls,
    expiresAt: Date.now() + RESOLVE_TTL_MS,
  }

  resolveState.set(channel.id, resolved)
  return resolved
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

function proxied(url) {
  return `/api/vavoo/hls?u=${encodeBase64Url(url)}`
}

function rewritePlaylist(playlist, baseUrl) {
  const rewriteUri = (value) => {
    try {
      return proxied(new URL(value, baseUrl).toString())
    } catch {
      return value
    }
  }

  return playlist
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri) => `URI="${rewriteUri(uri)}"`)
      }
      return rewriteUri(trimmed)
    })
    .join('\n')
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

async function handleChannels(res) {
  const state = await getCatalog()
  sendJson(res, 200, {
    ok: true,
    source: 'Vavoo / MediaHubMX',
      group: 'all',
    total: state.channels.length,
    rawTotal: state.totalRaw,
    generatedAt: state.generatedAt,
    channels: state.channels,
  })
}

async function handleStatus(res) {
  const fresh = catalogState.channels.length > 0 && Date.now() < catalogState.expiresAt
  sendJson(res, 200, {
    ok: true,
    ...progress,
    cached: fresh,
    total: progress.total || catalogState.channels.length,
  })
}

async function handleResolve(reqUrl, res) {
  const id = reqUrl.searchParams.get('id') || ''
  const refresh = reqUrl.searchParams.get('refresh') === '1'
  const requestedQuality = reqUrl.searchParams.get('quality') || ''

  if (!id) {
    sendJson(res, 400, { ok: false, error: 'Kanal kimliği gerekli' })
    return
  }

  const state = await getCatalog()
  const channel = state.byId.get(id)
  if (!channel) {
    sendJson(res, 404, { ok: false, error: 'Kanal bulunamadı' })
    return
  }

  // Channel source URLs are intentionally kept server-side and never exposed
  // in the public /channels payload.
  let sourceUrl = state.sourceById?.get(id)
  let resolvedId = id
  if (requestedQuality) {
    const base = state.channels.find((entry) => entry.id === id || entry.qualityVariants?.some((variant) => variant.id === id))
    const variant = base?.qualityVariants?.find((entry) => entry.id === id && entry.quality === requestedQuality)
    if (variant) {
      resolvedId = variant.id
      sourceUrl = state.sourceByVariantId?.get(variant.id) || variant.sourceUrl || sourceUrl
    }
  }
  if (!sourceUrl) {
    sendJson(res, 409, { ok: false, error: 'Kanal kaynağı hazır değil' })
    return
  }

  const resolved = await resolveChannel({ id: resolvedId, name: channel.name, sourceUrl }, refresh)
  const streams = resolved.urls.map(proxied)

  sendJson(res, 200, {
    ok: true,
    id: channel.id,
    name: channel.name,
    stream: streams[0],
    streams,
    expiresAt: resolved.expiresAt,
  })
}

async function handleHls(req, res, reqUrl) {
  const encoded = reqUrl.searchParams.get('u') || ''
  if (!encoded) {
    sendText(res, 400, 'Missing stream URL')
    return
  }

  let target = ''
  try {
    target = decodeBase64Url(encoded)
  } catch {
    sendText(res, 400, 'Invalid stream URL')
    return
  }

  if (!/^https?:\/\//i.test(target)) {
    sendText(res, 400, 'Invalid stream protocol')
    return
  }

  const headers = {
    'user-agent': STREAM_UA,
    accept: '*/*',
    referer: (() => {
      try { return `${new URL(target).origin}/` } catch { return 'https://vavoo.to/' }
    })(),
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
    sendText(res, 502, `Stream connection failed: ${error.message}`)
    return
  }

  if (!upstream.ok && upstream.status !== 206) {
    sendText(res, upstream.status || 502, `Upstream stream error (${upstream.status})`)
    return
  }

  const contentType = upstream.headers.get('content-type') || ''
  const isPlaylist = /mpegurl|x-mpegURL/i.test(contentType)
    || new URL(target).pathname.toLowerCase().endsWith('.m3u8')
    || new URL(target).pathname.toLowerCase().endsWith('.m3u')

  if (isPlaylist) {
    const playlist = await upstream.text()
    const rewritten = rewritePlaylist(playlist, upstream.url || target)
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
  stream.on('error', () => {
    try { res.destroy() } catch {}
  })
  res.on('close', () => {
    try { stream.destroy() } catch {}
  })
  stream.pipe(res)
}

/**
 * Vavoo logos are a cosmetic enhancement. If their host is unreachable we
 * answer with a transparent image instead of an error, so the UI keeps its
 * initial-letter tile and the browser console stays clean.
 */
const LOGO_FALLBACK = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"></svg>',
)

function sendLogoFallback(res) {
  res.writeHead(200, {
    'content-type': 'image/svg+xml',
    'content-length': LOGO_FALLBACK.length,
    'cache-control': 'public, max-age=60',
    'access-control-allow-origin': '*',
  })
  res.end(LOGO_FALLBACK)
}

async function handleLogo(res, reqUrl) {
  const encoded = reqUrl.searchParams.get('u') || ''
  if (!encoded) {
    sendText(res, 400, 'Missing logo URL')
    return
  }

  let target = ''
  try {
    target = decodeBase64Url(encoded)
  } catch {
    sendText(res, 400, 'Invalid logo URL')
    return
  }

  let parsed
  try {
    parsed = new URL(target)
  } catch {
    sendText(res, 400, 'Invalid logo URL')
    return
  }

  // Vavoo's catalog currently serves every logo from this host. Keep the
  // proxy constrained so it cannot be used as an open SSRF endpoint.
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'logo.huhu.to') {
    sendText(res, 403, 'Logo host not allowed')
    return
  }

  const failedUntil = logoFailures.get(parsed.hostname) || 0
  if (Date.now() < failedUntil) {
    sendLogoFallback(res)
    return
  }

  let upstream
  try {
    upstream = await fetch(parsed.toString(), {
      headers: { 'user-agent': 'Mozilla/5.0', accept: 'image/*' },
      signal: AbortSignal.timeout(6000),
    })
  } catch {
    logoFailures.set(parsed.hostname, Date.now() + 5 * 60 * 1000)
    sendLogoFallback(res)
    return
  }

  if (!upstream.ok || !upstream.body) {
    logoFailures.set(parsed.hostname, Date.now() + 60 * 1000)
    sendLogoFallback(res)
    return
  }

  res.writeHead(200, {
    'content-type': upstream.headers.get('content-type') || 'image/png',
    'cache-control': 'public, max-age=86400',
    'access-control-allow-origin': '*',
  })
  Readable.fromWeb(upstream.body).pipe(res)
}

export function createVavooApi() {
  return async function vavooApi(req, res) {
    setCors(res)

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const reqUrl = new URL(req.url || '/', 'http://localhost')

    try {
    if (reqUrl.pathname === '/api/vavoo/health') {
        sendJson(res, 200, {
          ok: true,
          service: 'vavoo',
          site: VAVOO_SITE,
          group: 'all',
          catalog: {
            channels: catalogState.channels.length,
            countries: [...new Set(catalogState.channels.map((channel) => channel.country))],
            raw: catalogState.totalRaw,
            generatedAt: catalogState.generatedAt,
            expiresAt: catalogState.expiresAt,
          },
          progress,
        })
        return
      }

      if (reqUrl.pathname === '/api/vavoo/status') {
        await handleStatus(res)
        return
      }

      if (reqUrl.pathname === '/api/vavoo/channels') {
        await handleChannels(res)
        return
      }

      if (reqUrl.pathname === '/api/vavoo/resolve') {
        await handleResolve(reqUrl, res)
        return
      }

      if (reqUrl.pathname === '/api/vavoo/hls') {
        await handleHls(req, res, reqUrl)
        return
      }

      if (reqUrl.pathname === '/api/vavoo/logo') {
        await handleLogo(res, reqUrl)
        return
      }

      sendJson(res, 404, { ok: false, error: 'API endpoint not found' })
    } catch (error) {
      console.log(`[VAVOO-API] ${reqUrl.pathname}: ${error.message}`)
      if (!res.headersSent) {
        sendJson(res, 502, { ok: false, error: error.message || 'Vavoo servisine ulaşılamadı' })
      } else {
        try { res.end() } catch {}
      }
    }
  }
}
