/**
 * Steamix TV — Cloudflare Worker (tek dosya)
 *
 * Iki isi yapar:
 *  1) geil.to'nun kendi arayüzünü bu adresten servis eder (ayna). Içeriğe dokunmayız;
 *     sadece adresleri kendi kökenimize çeviririz ve marka yazısını değiştiririz.
 *  2) Yayın akislari http:// oldugu için tarayici onlari dogrudan isteyemez. Bu dosya
 *     o http atlamasini kendi tarafinda yapar ve yayini https olarak geri verir.
 *
 * Render'a giden tek sey bizim kendi kabugumuz kalir; video ve site kodu buradan akar.
 */

const GEIL = 'https://geil.to'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const STREAM = '/__s'
/* Bu dosya kendi imzasını kendi doğrular, o yüzden anahtarin sadece burada durmasi yeter:
   panelde bir gizli degisken acmaya gerek kalmasin diye sana ozel uretildi. Degistirmek
   istersen Cloudflare panelinde PROXY_SECRET adina bir deger ver — burdakini o ezer. */
const DEFAULT_SECRET = 'steamix-edge-e5261843eb7eb4cd0bd9c43dd017fe68b1cc'
/* Provider'in ham http kutulari (vod "Server B1" ve listemizde olmayan canlilar) Cloudflare'in
   cikis IP'sine 403 diyor, Almanya cikisina demiyor. Bu yuzden o adrester worker'dan degil
   kendi LXI hostingimizin imzali kapisindan akiyor: olcuim 2026-11-02 — kutu LXI cikisina
   200 + m3u8 verdi, Cloudflare cikisina 403. Hosting trafiği sinirsiz oldugu icin Render
   kotasina hicbir sey dusmuyor; Render yalnizca uygulamarin kendi dosyalarini servis ediyor.
   Site, listemizden gelen canlilar ve https kaynaklar yine worker'da durur. */
const BRIDGE_STREAM = 'https://notflixlive.lxi.be/s.php'
const BRIDGE_SECRET = 'notflix-geil-proxy-v1-7c4f2a9e'

const PROVIDER_HOSTS = /(?:https?:)?\/\/(?:(?:www\.)?geil\.(?:to|app|win))(?::\d+)?/gi
const ABSOLUTE_URL = /https?:\/\/[^\s"'\\<>)\]]+/gi
const NAMESPACES = /^https?:\/\/(?:www\.w3\.org|purl\.org|schemas\.[a-z]|localhost|127\.0\.0\.1)/i
const PLAY_PATH = /^\/(live|vod)\/play\//i

/* ---------------------------------------------------------------- imza ----- */
/* Sadece bizim imzaladigimiz adrese yayin verilir. Aksi halde bu dosya herkesin
   kullanabildigi acik bir proxy olur ve hesabimizi kapatirlar. */

const encoder = new TextEncoder()
const keyCache = new Map()

function toBase64Url(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(text) {
  const body = text.replace(/-/g, '+').replace(/_/g, '/')
  const padded = body + '='.repeat((4 - (body.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmacKey(secret) {
  let key = keyCache.get(secret)
  if (!key) {
    key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    keyCache.set(secret, key)
  }
  return key
}

/* Imzali adres kopyalanip baska bir yere yapistirilabilir. Sure koymazsak o adres sonsuza
   kadar calisir ve tek bir abone tum hesabi besler. 24 saat: bir film araliksiz biter, ama
   dun paylasilan link bugun olu. Kisaltirsan canli yayin ortada durur, dikkat. */
const TOKEN_TTL = 24 * 60 * 60 * 1000

/* Imza uretilirken sure buraya yazilir, cagiranin bunu hatirlamasina gerek kalmasin: iki
   yerden birisi sureyi unutursa o kapidan kopyalanan adres sonsuza kadar acik kalir.
   Aktivasyon belgesi ayni imzayla ama cok daha uzun omurlu imzalanir, o yuzden sure
   burada secimlik. */
async function signPayload(payload, secret, ttl = TOKEN_TTL) {
  const body = JSON.stringify({ ...payload, exp: Date.now() + ttl })
  const data = toBase64Url(encoder.encode(body))
  const signature = toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(data))))
  return `${data}.${signature}`
}

async function verifyPayload(token, secret) {
  const [data, signature] = String(token || '').split('.')
  if (!data || !signature) return null
  const expected = toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(data))))
  if (expected !== signature) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(data)))
    if (!payload || (payload.exp && Date.now() > payload.exp)) return null
    return payload
  } catch {
    return null
  }
}

async function streamUrl(url, headers) {
  const payload = { u: String(url) }
  if (headers && Object.keys(headers).length) payload.h = headers
  return `${BRIDGE_STREAM}?t=${encodeURIComponent(await signPayload(payload, BRIDGE_SECRET))}`
}

/* -------------------------------------------------- kendi kanal listemiz --- */
/* SAGLAYICININ KUTULARI http: tarayici onlari kendi basina isteyemiyor, her bayt bizim
   sunucudan geciyor ve kota orada akiyor. Abonenin kendi listesi ayni kanallarin https
   hali: adresi ondan verdigimizde videoyu tarayici dogrudan listeden cekiyor, bize yalnizca
   kucuk JSON kaliyor. Eslisme isimle degil numarayla: katalogdaki sayi kimlik, listedeki
   yayin kimliginin sayi on eki (9630 katalog kanalindan 9145'i listemizde). */

const LIVE_LIST = 'https://atakannn19833.lxi.be/vaybe.php?list=all.m3u'
const LIVE_LIST_TTL = 6 * 60 * 60 * 1000
const LIVE_RESOLVE = /\/live\/resolve$/i

let liveTable = { at: 0, ids: [], byId: new Map(), own: new Set() }
let liveLoading = null

/** Istenen kanal kimligi: ya yolun icinde (/live/play/12345) ya cozumleme sorusundaki adreste. */
function liveIdOf(pathname, search) {
  const inPath = String(pathname).match(/\/live\/play\/(\d{4,20})/i)
  if (inPath) return inPath[1]
  if (!LIVE_RESOLVE.test(pathname)) return ''
  const target = new URLSearchParams(search || '').get('url') || ''
  const inQuery = target.match(/\/live\/play\/(\d{4,20})/i)
  return inQuery ? inQuery[1] : ''
}

/** Numara ile baslayan tek bir yayin kimligi varsa onun adresi; yoksa bos string. */
function liveAddressOf(table, id) {
  let low = 0
  let high = table.ids.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (table.ids[mid] < id) low = mid + 1
    else high = mid
  }
  const full = table.ids[low]
  return full && full.startsWith(id) ? table.byId.get(full) || '' : ''
}

/** Liste 1,9 MB: bir isolate gunde bir kere indirir, arada bellekteki tablo kullanilir. */
async function loadLiveTable() {
  if (liveTable.byId.size && Date.now() < liveTable.at + LIVE_LIST_TTL) return liveTable
  if (liveLoading) return liveLoading
  liveLoading = (async () => {
    const response = await fetch(LIVE_LIST, {
      headers: { 'user-agent': UA, accept: 'text/plain,application/x-mpegurl' },
      signal: AbortSignal.timeout(60000),
    })
    if (!response.ok) throw new Error(`Kendi listesi alinamadi (${response.status})`)
    const lines = (await response.text()).split(/\r?\n/)
    const ids = []
    const byId = new Map()
    /* Yayin numaralarinin kisa hali: saglayicinin katalog kimligi listedeki yayin kimliginin
       sayi on ekidir. Bu kume "kanal bizde var, yani cekiyor" demektir — grup adi onemsiz. */
    const own = new Set()
    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].startsWith('#EXTINF')) continue
      let address = ''
      for (let j = i + 1; j < lines.length; j += 1) {
        const next = lines[j].trim()
        if (!next || next.startsWith('#')) continue
        address = next
        break
      }
      if (!address) continue
      let inner = ''
      try {
        inner = new URL(address).searchParams.get('url') || ''
      } catch {
        continue
      }
      const full = inner.match(/play\/([0-9a-z]{8,40})/i)
      if (!full || byId.has(full[1])) continue
      byId.set(full[1], address)
      ids.push(full[1])
      const numara = /^\d{6,}/.exec(full[1])
      if (numara) own.add(numara[0])
    }
    ids.sort()
    liveTable = { at: Date.now(), ids, byId, own }
    liveLoading = null
    return liveTable
  })()
  // Liste sunucusu ulasilamazsa eski tabloyla devam edilir: kanal yine acilir, adres eskisi gibi.
  try {
    return await liveLoading
  } catch {
    liveLoading = null
    return liveTable
  }
}

async function ownLiveAddress(pathname, search) {
  const id = liveIdOf(pathname, search)
  if (!id) return ''
  return liveAddressOf(await loadLiveTable(), id)
}

/** Cozumleme yanitindaki yayin adresini listemizdekilerle degistirir; arayuz o yaniti tanir. */
async function swapLiveAddress(text, pathname, search) {
  if (!LIVE_RESOLVE.test(pathname)) return text
  const address = await ownLiveAddress(pathname, search)
  if (!address) return text
  try {
    const data = JSON.parse(text)
    if (!data || typeof data.url !== 'string') return text
    data.url = address
    return JSON.stringify(data)
  } catch {
    return text
  }
}

/* --------------------------------------------------------------- ayna ------ */

/** Bir yanitin turu, yeniden yazim kuralini secmek icin kullanilir. */
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

/* ------------------------------------------------------- kenar onbellek --- */
/* Abonelerin hepsi ayni kanal listesini, ayni film kartini ister. Cloudflare bu
   cevabi kendinde tutarsa worker hic uyanmaz: ne istek sayisina girer ne CPU'ya
   — gunluk 100 bini yiyen sey o listeler degil, her tiklamada uyanan izlek.

   SURELER UYDURMA DEGIL: saglayicinin kendi addon manifestleri kactan saniye
   saklanacagini soyluyor. Olculen:
     /live/mhub-addon.json      -> cache {"catalog":300,"item":300}
     /vod/mhub-addon.json       -> cache {"source":300}
     /subtitle/mhub-addon.json  -> cache {"subtitle":86400}
   Biz canli listeye saglayicinin dedigi 300 saniyeyi veriyoruz (listeyi 3 saat
   saklamak olurdu; channels.json her 300 kanallik sayfayla REHBERI DE tasir,
   epg[{title,start,end}] — saatlerce bekleyen bir kopya ekranda "simdi yayinda"
   diye yanlis program yazar). Altyazi listesine 24 saat yerine 1 saat veriyoruz:
   sonradan eklenen Turkce altyazi bir gun boyunca "yok" gorunmesin.

   Sayfa kabugu ile oynatilan adresi ureten /live/resolve ve /vod/resolve
   disarda kalir (ikisi de .json ile bitmiyor). IMZALI ADRESLER 24 SAAT YASIYOR
   (TOKEN_TTL), o yuzden 3 saatlik saklama katalogdaki linki oldurmuyor.
   Yeni film/kanal eklenirse abone en fazla 3 saat sonra gorur. */

const EDGE_TTL = 3 * 60 * 60
const EDGE_TTL_LIVE = 5 * 60 /* saglayicinin beyani: 300 — rehber tazeligi icin daha fazlasi yasak */
const EDGE_TTL_SOURCE = 5 * 60 /* saglayicinin beyani: 300 */
const EDGE_TTL_SUBTITLE = 60 * 60 /* saglayici 86400 diyor; biz yeni altyazi icin kirpiyoruz */

/** Bu adres kenarda saklanir mi ve kactan saniye; 0 demek saklanmaz. */
function edgeTtlFor(pathname) {
  if (!/\.json$/i.test(pathname)) return 0
  if (/\/source\//i.test(pathname)) return EDGE_TTL_SOURCE
  if (/\/subtitle\//i.test(pathname)) return EDGE_TTL_SUBTITLE
  if (/\/live\/(?:catalog|item)\//i.test(pathname)) return EDGE_TTL_LIVE
  return EDGE_TTL
}

/**
 * Orijinal adresler bu adresle degistirilir. Bos birakirsak "/live" gibi yollar
 * kendiliginden dogru calisir, ama tek basina kalan marka adresi ("") bazi
 * yerlerde bos string olur ve oynaticinin kodu kirilir.
 */
function toOwnPaths(text, origin) {
  return String(text).replace(PROVIDER_HOSTS, origin)
}

/**
 * Aynadaki oynatici, katalogda gordugu kendi yolumuzu "?url=" icinde geri gonderir.
 * Yukariya giden istekte o yol tekrar geil.to adresi olmali.
 */
function upstreamSearch(search, origin) {
  if (!search) return ''
  const params = new URLSearchParams(search)
  let changed = false
  for (const [key, value] of [...params]) {
    if (!value) continue
    let fixed = null
    if (value.startsWith('/')) fixed = GEIL + value
    else if (value.startsWith(origin + '/')) fixed = GEIL + value.slice(origin.length)
    else if (value === origin) fixed = GEIL
    if (fixed) { params.set(key, fixed); changed = true }
  }
  if (!changed) return search
  const out = params.toString()
  return out ? `?${out}` : ''
}

/** Katalog/manifest yanitindaki adresler: http yayin imzali proxy'ye, gerisi kendi yolumuza. */
async function toSafeUrls(text, baseUrl, origin) {
  const source = String(text)
  if (!/http/i.test(source) && !/["']\.\//.test(source)) return toOwnPaths(source, origin)
  let out = ''
  let at = 0
  for (const match of source.matchAll(ABSOLUTE_URL)) {
    out += toOwnPaths(source.slice(at, match.index), origin)
    at = match.index + match[0].length
    const raw = match[0]
    let absolute = raw
    try { absolute = new URL(raw, baseUrl).toString() } catch { out += raw; continue }
    if (NAMESPACES.test(absolute)) { out += raw; continue }
    /* Saitenin KENDI https adresi (altyazi dosyasi gibi) tarayiciya oldugu gibi giderse
       istek karsi-koken olur ve cevapta CORS basligi yok: oynatici "Failed to fetch" yer.
       Aynanin yoluna cevrilirse bayt zaten bizim kapidan gectigi icin hata kalir. */
    if (/^https?:\/\/(?:(?:www\.)?geil\.(?:to|app|win))(?::\d+)?(?:[/?]|$)/i.test(absolute)) {
      try {
        const own = new URL(absolute)
        out += origin + own.pathname + own.search
      } catch {
        out += raw
      }
      continue
    }
    if (/^https:\/\//i.test(absolute)) { out += raw; continue }
    out += await streamUrl(absolute, null)
  }
  return (out + toOwnPaths(source.slice(at), origin)).replace(/"\.\/([a-z0-9_-]{1,40})"/gi, (_m, id) => `"${origin}/${id}"`)
}

/** Oynatma listesindeki her satir (ve her URI="...") imzali proxy adresine doner. */
async function rewritePlaylist(text, baseUrl) {
  const lines = String(text).split(/\r?\n/)
  const out = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { out.push(line); continue }
    if (trimmed.startsWith('#')) {
      const uris = [...line.matchAll(/URI="([^"]+)"/g)].map((m) => m[1])
      if (!uris.length) { out.push(line); continue }
      let fixed = line
      for (const uri of uris) {
        try { fixed = fixed.split(`URI="${uri}"`).join(`URI="${await streamUrl(new URL(uri, baseUrl).toString(), null)}"`) } catch { /* dokunma */ }
      }
      out.push(fixed)
      continue
    }
    try { out.push(await streamUrl(new URL(trimmed, baseUrl).toString(), null)) } catch { out.push(line) }
  }
  return out.join('\n')
}

/**
 * Our mark, planted in the corner theirs stood. The flame and the old word are hidden and a script
 * puts our three lines and our name into that same slot: narrow bar, only the three lines; opened
 * bar, our name beside them.
 */
const BRAND_HIDE = 'a.sidebar-brand .brand-icon,a.sidebar-brand .brand-text,#app img[src*="fire-element"]'
const OUR_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='13' fill='%23000000'/%3E%3Ctext x='32' y='47' font-family='Arial Black, Arial, sans-serif' font-size='46' font-weight='900' text-anchor='middle' fill='%23e50914'%3EN%3C/text%3E%3C/svg%3E"
const BRAND_FONT = "@font-face{font-family:'Bebas Neue';font-style:normal;font-weight:400;font-display:swap;src:url(data:font/woff2;base64,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) format('woff2')}";
const BRAND_STYLE = `<style>${BRAND_FONT}${BRAND_HIDE}{display:none!important}`
  /* Their rail is driven by one custom property: --open feeds the width, the label fade, the glass
     and the pill. Forcing only the width left a wide bar with no words and no way to shut. */
  + '.sidebar:hover,.sidebar:focus-within{--open:1}'
  /* Pressing our three lines is a shut command, not a hover: without this the pointer that just
     clicked stays on the rail and the hover rule above reopens it the instant the focus leaves. */
  + '.sidebar.nf-shut{--open:0!important}'
  + 'a.sidebar-brand{position:relative}'
  /* The mark hangs off the same number the rail widens itself with, so the two can never disagree:
     shut it sits centred in the strip, open it slides to the rail's own left padding and the name
     unfolds beside it. TV mode keeps the box wide and cuts it, so there the mark stays left. */
  + 'a.sidebar-brand .nf-brand{position:absolute;top:50%;left:calc(50% - var(--open) * (50% - 10px));'
  + 'transform:translate(calc(-50% * (1 - var(--open))),-50%);'
  + 'display:flex;align-items:center;justify-content:center;gap:0;pointer-events:none;'
  + 'transition:left .34s cubic-bezier(.22,.61,.36,1),transform .34s cubic-bezier(.22,.61,.36,1)}'
  + 'html.tv-mode a.sidebar-brand .nf-brand{left:10px;transform:translateY(-50%)}'
  + 'a.sidebar-brand .nf-burger{flex:0 0 auto;display:flex;flex-direction:column;justify-content:center;gap:5px;width:26px;height:26px}'
  + 'a.sidebar-brand .nf-burger i{display:block;height:3px;border-radius:2px;background:#e50914;box-shadow:0 0 10px rgba(229,9,20,.55)}'
  /* The name hangs beside the lines on its own hook: it takes no room in the mark, so nothing has
     to squash or clip it. Squashing with max-width hid it correctly but cut the bloom an eighth of
     a letter wide on every side, and that bloom is the whole curve. Out of flow it keeps its light
     and only fades, exactly like the labels beside it do. */
  + 'a.sidebar-brand .nf-word{position:absolute;left:calc(100% + 8px);top:50%;transform:translateY(-50%);'
  + 'display:flex;align-items:baseline;justify-content:flex-start;white-space:nowrap;opacity:var(--open);'
  + "font-family:'Bebas Neue','Arial Narrow','Arial Black',Impact,sans-serif;font-size:27px;font-weight:400;line-height:.82;letter-spacing:.004em;"
  + 'color:#e50914;-webkit-text-fill-color:#e50914;'
  /* Hedef logotip pik pik olculdu: govde harf yuksekliginin 0,15'i, harflar arasi bosluk 0,15'i.
     Bebas'in kendi govdesi 0,16 — bir de kalem cizilirse yazi hedeften agir kaliyor, o yuzden
     kalinlik yalnizca secilen yuzden gelir; isik dort katman olarak aynen devam eder. */
  + 'text-shadow:0 0 .07em rgba(229,9,20,.5),0 0 .215em rgba(229,9,20,.42),'
  + '0 .05em .5em rgba(229,9,20,.3),0 .09em .9em rgba(229,9,20,.26);transition:opacity .2s ease}'
  + 'a.sidebar-brand .nf-word u{display:inline-block;position:relative;margin:0 .017em;font:inherit;color:inherit;text-decoration:none}'
  + "a.sidebar-brand .nf-word u.nf-idot::after{content:'';position:absolute;left:50%;top:calc(-.0915em - max(.0385em,2px));width:.1015em;height:.1015em;margin-left:-.0508em;border-radius:2px;background:currentColor}"
  /* Her sayfa yenilemede ayni kimlik sahnesi: uygulamanin kendi splash'inden alinma sayilar,
     ayni harf harf giris, ayni isik ve ayni tek ray. Cakisma olmasin diye en uste cikar. */
  + '.nf-load{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;overflow:hidden;background:#04050a;'
  + "font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-user-select:none;user-select:none;transition:opacity .42s ease}"
  + '.nf-load.is-out{opacity:0}'
  + '.nf-load__bloom{position:absolute;inset:-30%;pointer-events:none;background:radial-gradient(ellipse 46% 38% at 50% 44%,rgba(229,9,20,.3) 0%,rgba(229,9,20,.07) 42%,transparent 70%),radial-gradient(ellipse 70% 55% at 50% 112%,rgba(120,12,30,.34) 0%,transparent 66%);animation:nfBloom 11s ease-in-out infinite alternate}'
  + '@keyframes nfBloom{from{opacity:.62;transform:scale(.97)}to{opacity:1;transform:scale(1.05)}}'
  + '.nf-load__grid{position:absolute;inset:0;pointer-events:none;background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 92px);-webkit-mask-image:radial-gradient(ellipse 60% 55% at 50% 48%,#000 0%,transparent 78%);mask-image:radial-gradient(ellipse 60% 55% at 50% 48%,#000 0%,transparent 78%);opacity:.5}'
  + '.nf-load__inner{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;padding:0 6vw}'
  + '.nf-load__mark{position:relative}'
  + ".nf-load__word{margin:0;font-family:'Bebas Neue','Arial Narrow',Impact,sans-serif;font-weight:400;font-size:clamp(54px,12.5vw,148px);line-height:.82;letter-spacing:.004em;color:#e50914;-webkit-text-fill-color:#e50914;text-shadow:0 0 .07em rgba(229,9,20,.5),0 0 .215em rgba(229,9,20,.42),0 .05em .5em rgba(229,9,20,.3),0 .09em .9em rgba(229,9,20,.26)}"
  + '.nf-load__word u{display:inline-block;position:relative;margin:0 .017em;font:inherit;color:inherit;text-decoration:none;animation:nfLetterIn .78s cubic-bezier(.18,.86,.24,1) both}'
  + '.nf-load__word u.nf-idot::after{content:"";position:absolute;left:50%;top:calc(-.0915em - max(.0385em,2px));width:.1015em;height:.1015em;margin-left:-.0508em;border-radius:2px;background:currentColor}'
  + '.nf-load__word u:nth-child(1){animation-delay:.04s}.nf-load__word u:nth-child(2){animation-delay:.1s}.nf-load__word u:nth-child(3){animation-delay:.16s}.nf-load__word u:nth-child(4){animation-delay:.22s}.nf-load__word u:nth-child(5){animation-delay:.28s}.nf-load__word u:nth-child(6){animation-delay:.34s}.nf-load__word u:nth-child(7){animation-delay:.4s}'
  + '@keyframes nfLetterIn{0%{opacity:0;transform:translateY(.34em) scale(1.16);filter:blur(14px)}60%{opacity:.9;filter:blur(2px)}100%{opacity:1;transform:none;filter:blur(0)}}'
  + '.nf-load__bar{position:absolute;top:-14%;bottom:-14%;left:-34%;width:28%;z-index:3;pointer-events:none;background:linear-gradient(100deg,transparent 0%,rgba(255,122,128,.55) 38%,rgba(255,240,240,.92) 50%,rgba(255,122,128,.55) 62%,transparent 100%);filter:blur(10px);mix-blend-mode:screen;animation:nfSweep 2.5s cubic-bezier(.55,0,.45,1) infinite}'
  + '@keyframes nfSweep{0%{transform:translateX(0);opacity:0}12%{opacity:1}88%{opacity:1}100%{transform:translateX(480%);opacity:0}}'
  + '.nf-load__rail{position:relative;width:min(320px,62vw);height:3px;margin-top:clamp(26px,4.4vh,48px);border-radius:3px;overflow:hidden;background:rgba(255,255,255,.1)}'
  + '.nf-load__rail-run{position:absolute;inset:0 auto 0 0;width:44%;border-radius:3px;background:linear-gradient(90deg,transparent,#e50914 35%,#ff6b72 55%,transparent);box-shadow:0 0 14px rgba(229,9,20,.55);animation:nfRail 1.5s cubic-bezier(.6,.05,.4,.95) infinite}'
  + '@keyframes nfRail{0%{transform:translateX(-110%)}100%{transform:translateX(255%)}}'
  + '.nf-load__hint{margin:clamp(18px,3vh,30px) 0 0;min-height:1.2em;font-size:clamp(10px,1.15vw,12px);font-weight:500;letter-spacing:.3em;text-transform:uppercase;text-align:center;color:rgba(255,255,255,.6)}'
  + '.nf-load__credit{position:absolute;left:50%;transform:translateX(-50%);bottom:max(20px,env(safe-area-inset-bottom));max-width:min(92vw,700px);font-size:9.5px;font-weight:600;letter-spacing:.26em;line-height:2.1;white-space:nowrap;text-align:center;color:rgba(255,255,255,.32)}'
  + '.nf-load__credit .tm{letter-spacing:0;margin-left:.45em;font-size:1.15em;opacity:.9}'
  /* Atla dugmesi sag altta; dar telefonda ikisi ayni satirda tokusuyor (320px olcildi: 8px
     ust uste). Damga o kadar darlikta bir satir yukari kalkar, genis ekranda yerinde kalir. */
  + '@media (max-width:400px){.nf-load__credit{bottom:calc(max(20px,env(safe-area-inset-bottom)) + 56px)}}'
  + '.nf-load__skip{display:none;position:absolute;bottom:max(20px,env(safe-area-inset-bottom));right:max(18px,env(safe-area-inset-right));padding:9px 18px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(255,255,255,.05);color:rgba(255,255,255,.72);font-size:11px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;cursor:pointer}'
  + '.nf-load__skip.is-on{display:block}.nf-load__skip:hover,.nf-load__skip:focus{color:#fff;border-color:rgba(255,255,255,.34);outline:none}'
  + '@media (prefers-reduced-motion:reduce){.nf-load__word u,.nf-load__hint{animation:none}.nf-load__bloom{animation:none;opacity:.9}.nf-load__bar{animation:none;opacity:0}.nf-load__rail-run{animation:none;width:100%;opacity:.75}}'
  + '</style>'
const BRAND_SCRIPT = '<script>(function(){'
  /* Oynatici alt yaziyi cercevesiz istiyor (fetch credentials:"omit"). Bizim kapimiziz:
     cerceve gitmeyen istek kodu gormez ve cevap kapi sayfasinin HTML'i olur — oynatici
     onu alt yazi sayar, ekran bos kalir. Kendi adresimizde cerceveyi zorla geri veriyoruz;
     ucuncu tarafa giden isteklere dokunulmaz, o yuzden bir sey sizmiyor. */
  + 'var OF=window.fetch;if(OF){window.fetch=function(i,x){try{var s=(i&&i.url)?String(i.url):String(i);if(new URL(s,location.href).origin===location.origin){x=Object.assign({},x,{credentials:"include"})}}catch(e){}return OF.call(window,i,x)}}'
  /* Kanal tahtasinin secimi tarayicida saklanir ve saglayici bos birakir. Sayfa artik
     kendi kategorimizle aciliyor: TURKIYE ULUSAL, siralamasi A-Z. Bu bir kere zorlanir
     (surum damgasiyle); abone sonradan baska ulke secerse secimine dokunulmaz. */
  + 'try{var PK="vuma_catalog_picks",MK="nf_picks_v",GE="geil-live/channels";'
  + 'var P=JSON.parse(localStorage.getItem(PK)||"{}")||{},C=P[GE]||{},F=C.filters||{};'
  + 'if(localStorage.getItem(MK)!=="2"){F.group="Türkiye Ulusal";C.sort="name";localStorage.setItem(MK,"2")}'
  + 'else if(!C.sort){C.sort="name"}'
  + 'C.filters=F;P[GE]=C;localStorage.setItem(PK,JSON.stringify(P))}catch(e){}'
  + "function plant(){var slot=document.querySelector('a.sidebar-brand');if(!slot)return false;"
  + "if(!slot.querySelector('.nf-brand')){var mark=document.createElement('span');mark.className='nf-brand';"
  + 'mark.innerHTML=\'<span class="nf-burger"><i></i><i></i><i></i></span><span class="nf-word">\''
  + '+\'<u>N</u><u>O</u><u>T</u><u>F</u><u>L</u><u class="nf-idot">I</u><u>X</u></span>\';'
  + 'slot.insertBefore(mark,slot.firstChild)}'
  + 'return true}'
  + 'var INFO=\'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg>\''
  + ',LOCK=\'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"></rect><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"></path></svg>\''
  + ',ROW=function(l,s,v){return \'<div class="s-item s-item-nav"><span class="s-label">\'+l+(s?\'<span class="s-sub">\'+s+\'</span>\':\'\')+\'</span>\'+(v?\'<span class="s-value">\'+v+\'</span>\':\'\')+\'</div>\'}'
  + ',GROUP=function(i,t,rows){var g=document.createElement(\'div\');g.className=\'s-group nf-own\';'
  + 'g.innerHTML=\'<div class="s-group-head"><span class="s-gicon">\'+i+\'</span><span class="s-group-title">\'+t+\'</span></div>\'+rows;return g};'
  + 'function about(){var box=document.querySelector(\'.settings-groups\');if(!box||box.querySelector(\'.nf-own\'))return;'
  + 'box.appendChild(GROUP(INFO,\'Hakkında\',ROW(\'NOTFLİX\',\'vavoo altyapısıyla çalışan özgün altyapı\',\'\')'
  + '+ROW(\'Geliştirici\',\'RENDIR MEDİA\',\'\')+ROW(\'Protokol\',\'\',\'MediaHubMX\')));'
  + 'box.appendChild(GROUP(LOCK,\'Lokasyon / Bölge\',ROW(\'Bölge\',\'\',\'Almanya\')+ROW(\'Tunnel\',\'\',\'Cloudflare\')))}'
  + 'function onSettings(){if(/setting/i.test(location.hash))about()}'
  // The rail is held open only while the focus sits inside it, so a choice has to hand the focus
  // back: otherwise the drawer stays wide for the whole page the choice just opened. The brand is
  // a link too, and pressing it used to park the focus on itself and leave the drawer wide open.
  + 'document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest(".nav-item,a.sidebar-brand"):null;if(!a)return;'
  + 'function shut(){var ae=document.activeElement;if(ae&&ae.blur&&ae.closest&&ae.closest(".sidebar"))ae.blur()}'
  + 'if(a.matches("a.sidebar-brand")){var sb=document.querySelector(".sidebar");'
  + 'if(sb){sb.classList.add("nf-shut");'
  + 'var off=function(){sb.classList.remove("nf-shut");sb.removeEventListener("pointerleave",off)};'
  + 'sb.addEventListener("pointerleave",off);setTimeout(off,900)}}'
  + 'shut();setTimeout(shut,90)});'
  /* Sag tik, surukle-birak ve oynaticinin "farkli kaydet" dugmesi yayini cakmanin en kolay
     yollari; burada kapaniyor. Gelistirici aracina karsi bunlarin hicbirisi durduruucu degil:
     asil kilit suresi dolan imza, yani birine yapistirilan adres bir gun sonra kendiliginden olu. */
  + 'function noMenu(e){var t=e.target,n=t&&t.tagName;'
  + 'if(n==="INPUT"||n==="TEXTAREA"||(t&&t.isContentEditable))return;e.preventDefault()}'
  + 'document.addEventListener("contextmenu",noMenu,true);'
  + 'document.addEventListener("dragstart",function(e){if(e.target&&e.target.tagName==="VIDEO")e.preventDefault()},true);'
  + 'document.addEventListener("keydown",function(e){var k=(e.key||"").toLowerCase();'
  + 'if(k==="f12"||((e.ctrlKey||e.metaKey)&&e.shiftKey&&(k==="i"||k==="j"||k==="c"||k==="k"))'
  + '||((e.ctrlKey||e.metaKey)&&!e.altKey&&(k==="u"||k==="s"||k==="p")))e.preventDefault()});'
  /* Kumandanin Geri tusu uygulamanin kendi ekranindan cikmaktir. Ayna bizden farkli bir adreste
     duruyorsa tarayici o belgenin tuslarini bize gostermiyor; geri tusu burada signale donusuyor
     ve uygulamanin kendi dinleyicisi (ProviderView) ekrani kapatir. */
  + 'document.addEventListener("keydown",function(e){if(window.self===window.top)return;'
  + 'if(e.key==="Escape"||e.key==="GoBack"||e.keyCode===10009){try{parent.postMessage("notflix-back","*")}catch(err){}}},true);'
  + 'function hard(){var v=document.getElementsByTagName("video");'
  + 'for(var i=0;i<v.length;i++){var x=v[i];if(x.nfLock)continue;x.nfLock=1;'
  + 'x.setAttribute("controlsList","nodownload noplaybackrate");x.setAttribute("disablePictureInPicture","");'
  + 'x.setAttribute("disableRemotePlayback","");'
  + 'x.addEventListener("contextmenu",function(e){e.preventDefault()},true)}}'
  /* Her sayfa yenilemede kimlik sahnesi: boyanabilecek ilk sey olsun diye body daha ilk
     satirinda kurulur. Uygulamanin kendi penceresinin icinde susar, orada zaten kendi
     splash'inin altindadir; cift sahne olmaz. Hareket istemeyen tarayici hiç beklemez. */
  + 'var EP="/__activate",KEY="nf_key",SEEN="nf_splash_seen",LOST="nf_grant_lost",LINE_MS=2600,SPLASH_MS=10400,'
  + 'LINES=["Sunucuya bağlanılıyor…","Katalog hazırlanıyor…","Yayın çizgileri denetleniyor…","Bağlanıldı"],'
  + 'WORD=\'<u>N</u><u>O</u><u>T</u><u>F</u><u>L</u><u class="nf-idot">I</u><u>X</u>\';'
  /* Kapı kendi splash'ini oynatıp sayfayı yeniliyor; site aynı ritüeli üst üste ikinci kez
     yaşatmasın diye tek kullanımlık bayrak bırakılır. */
  + 'var seen=false;try{seen=sessionStorage.getItem(SEEN)==="1";if(seen)sessionStorage.removeItem(SEEN)}catch(e){}'
  /* Site verileri silinince kendi kaydını siler ama belge sunucuda kalır; vedanın yenilemeden
     önce yetişmesi garanti edilemez. Belgesiz yakalanan sayfa veda edip kendini yeniler, böylece
     kod ekranı ilk temizlemede gelir. */
  + 'var leaving=false;(function(){var has=false;try{has=!!localStorage.getItem(KEY)}catch(e){has=true}'
  + 'if(has){try{sessionStorage.removeItem(LOST)}catch(e){}return}'
  + 'try{if(sessionStorage.getItem(LOST)==="1")return;sessionStorage.setItem(LOST,"1")}catch(e){}'
  + 'leaving=true;seen=false;'
  /* Yer degistirme ayni adrese yapilirsa tarayici bunu "ayni belge" sayiyor: adresin sonundaki
     #/... parasi yuklendigi icin yenileme hic olmuyor, sahne ekranda kili kalip Atla bosuna
     tikanirdi. reload() parayi umursamaz, belgeyi gercekten yeniden ister. */
  + 'function bye(){location.reload()}'
  + 'fetch(EP,{method:"POST",headers:{"content-type":"application/json"},body:\'{"x":1}\'}).then(bye,bye)})();'
  + 'function mount(){if(leaving||seen||window.self!==window.top||document.querySelector(".nf-load"))return true;if(!document.body)return false;'
  + 'var el=document.createElement("div");el.className="nf-load";el.setAttribute("role","status");'
  + 'el.innerHTML=\'<div class="nf-load__bloom"></div><div class="nf-load__grid"></div><div class="nf-load__inner">'
  + '<div class="nf-load__mark"><div class="nf-load__word" aria-label="NOTFLİX">\'+WORD+\'</div><span class="nf-load__bar"></span></div>'
  + '<div class="nf-load__rail"><i class="nf-load__rail-run"></i></div><p class="nf-load__hint">\'+LINES[0]+\'</p></div>'
  + '<button type="button" class="nf-load__skip">Atla</button><div class="nf-load__credit">RENDIR MEDİA 2027<span class="tm">™</span></div>\';'
  + 'document.body.appendChild(el);'
  + 'if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches){el.remove();return true}'
  + 'var i=0,h=el.querySelector(".nf-load__hint"),k=el.querySelector(".nf-load__skip"),t;'
  + 'function out(){clearInterval(t);el.classList.add("is-out");setTimeout(function(){el.remove()},460)}'
  + 'k.onclick=out;'
  + 't=setInterval(function(){i++;h.textContent=LINES[i];if(i>=LINES.length-1){clearInterval(t);k.classList.add("is-on")}},LINE_MS);'
  + 'setTimeout(out,SPLASH_MS);return true}'
  /* Site "verileri temizle" dediginde kendi kayitlarini siler; izin belgesi sunucuda kaldigi
     icin kod bir daha sorulmazdi. Silme anindan belgeden de vazgecis gonderilir. */
  + 'var sc=window.Storage&&window.Storage.prototype&&window.Storage.prototype.clear;'
  + 'if(sc){window.Storage.prototype.clear=function(){try{localStorage.removeItem(KEY)}catch(e){}'
  + 'try{fetch(EP,{method:"POST",headers:{"content-type":"application/json"},body:\'{"x":1}\'})}catch(e){}'
  + 'return sc.apply(this,arguments)}}'
  + 'document.addEventListener("click",function(ev){var n=ev.target;if(!n||!n.closest)return;'
  + 'var btn=n.closest(".confirm-actions .btn-danger");if(!btn)return;'
  + 'var md=btn.closest(".modal-bg");if(!md)return;var want=(md.getAttribute("aria-label")||"").trim();if(!want)return;'
  + 'var row=document.querySelector(".s-label-danger");if(!row||row.textContent.trim()!==want)return;'
  + 'try{localStorage.removeItem(KEY)}catch(e){}'
  + 'try{fetch(EP,{method:"POST",headers:{"content-type":"application/json"},body:\'{"x":1}\'})}catch(e){}'
  + '},true);'
  + 'var po=new MutationObserver(function(m,o){if(plant())o.disconnect()});'
  + 'po.observe(document.documentElement,{childList:true,subtree:true});'
  + 'var so=new MutationObserver(function(m,o){if(mount())o.disconnect()});'
  + 'so.observe(document.documentElement,{childList:true});'
  + 'new MutationObserver(function(){onSettings();hard()}).observe(document.documentElement,{childList:true,subtree:true});'
  + 'window.addEventListener("hashchange",function(){onSettings();setTimeout(onSettings,250);setTimeout(onSettings,800)});'
  + 'plant();onSettings();hard();mount();'
  + '})();</script>'

/** Marka: ateş logosu ve GEIL.TO yazisi gizlenir, isim ve vurgu rengi bize cevrilir. */
function toOurBrand(html) {
  return String(html)
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>NOTFLİX</title>')
    .replace(/brand:\s*\{\s*name:\s*(["'])GEIL\.TO\1/gi, (_m, q) => `brand: { name: ${q}NOTFLİX${q}`)
    .replace(/(logo|icon)\s*:\s*(["'])https?:\/\/[^"']*\.(?:png|jpg|jpeg|svg|webp)[^"']*\2/gi, (_m, key, q) => `${key}: ${q}${OUR_ICON}${q}`)
    .replace(/<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]*>/gi, `<link rel="icon" href="${OUR_ICON}">`)
    .replace(/GEIL\.TO/g, 'NOTFLİX')
    .replace(/#EB2B58/gi, '#E50914')
    .replace(/<\/head>/i, `${BRAND_STYLE}${BRAND_SCRIPT}</head>`)
}

function text(headers, value, status = 200) {
  return new Response(value, { status, headers: { 'content-type': headers, 'cache-control': 'no-store' } })
}

/* ----------------------------------------------------------- akis proxy ---- */

const SOURCE_HEADERS = new Set(['user-agent', 'referer', 'origin', 'accept', 'accept-language', 'cookie', 'authorization'])

async function handleStream(request, secret) {
  const url = new URL(request.url)
  const payload = await verifyPayload(url.searchParams.get('t'), secret)
  const target = payload && String(payload.u || '')
  if (!/^https?:\/\//i.test(target) || /^wss?:/i.test(target)) {
    return text('text/plain; charset=utf-8', 'Gecersiz akis anahtari', 403)
  }

  /* Yayın sunucuları kendi sayfalarından gelmeyen isteği kuşkulu buluyor: köprinin yaptığı
     ikiz istek origin/referer taşır, bu dosya taşımıyordu. Ev internetinden yine de geçiyordu,
     ama başka bir çıkış IP'sinde kapı yüzümüze kapanıyor. İmzada başlık taşınıyorsa o kazanır. */
  const headers = { 'user-agent': UA, accept: '*/*', origin: GEIL, referer: `${GEIL}/` }
  for (const [key, value] of Object.entries(payload.h || {})) {
    if (SOURCE_HEADERS.has(String(key).toLowerCase()) && typeof value === 'string') headers[key] = value
  }
  for (const key of ['range', 'if-range', 'if-none-match', 'if-modified-since']) {
    const value = request.headers.get(key)
    if (value) headers[key] = value
  }

  let upstream
  try {
    upstream = await fetch(target, { headers, redirect: 'follow', cf: { cacheTtl: 0 } })
  } catch (error) {
    return text('text/plain; charset=utf-8', `Akis baglanamadi: ${error && error.message}`, 502)
  }
  /* Yukarideki reddi 200 ile metin olarak geri verirsek oynatici "anlamadim" deyip
     DEMUXER hatasi veriyor; kullanici kendi suyunun mu, bizim kapimizin mi oldugunu
     ayirt edemiyor. Gercek kodu oldugu gibi iletelim. */
  if (!upstream.ok && upstream.status !== 206) {
    return text('text/plain; charset=utf-8', `Kaynak hatasi (${upstream.status})`, upstream.status)
  }

  const finalUrl = upstream.url || target
  const pathname = (new URL(finalUrl).pathname || '').toLowerCase()
  const contentType = upstream.headers.get('content-type') || ''
  const isPlaylist = /mpegurl/i.test(contentType) || pathname.endsWith('.m3u8') || pathname.endsWith('.m3u')

  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, HEAD, OPTIONS' }

  if (isPlaylist) {
    const body = await upstream.text()
    if (!body.trim()) return text('text/plain; charset=utf-8', 'Bos oynatma listesi', 502)
    return new Response(await rewritePlaylist(body, finalUrl), {
      status: 200,
      headers: { ...cors, 'content-type': 'application/vnd.apple.mpegurl; charset=utf-8', 'cache-control': 'no-store' },
    })
  }

  const sent = new Headers(cors)
  sent.set('content-type', contentType || 'application/octet-stream')
  for (const key of ['content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
    const value = upstream.headers.get(key)
    if (value) sent.set(key, value)
  }
  sent.set('cache-control', 'no-store')
  return new Response(upstream.body, { status: upstream.status, headers: sent })
}

/* ------------------------------------------------------ aktivasyon kapisi --- */

/* MUSTERiYE VERDIGIN TEK KOD. Degistirmek icin yalnizca bu satiri yaz; yeni kod buraya
   girdigin an eskisi olu. Kod bu dosyada durur ve tarayiciya hic gitmez — tarayici
   yalnizca "tamam / hatali" sonucunu gorur, sayfagi kimse okuyamaz. */
const ACT_CODE = 'FNNXZ62Z'
const ACTIVATE = '/__activate'
const ACT_COOKIE = 'nf_access'
const GRANT_TTL = 400 * 24 * 60 * 60 * 1000 /* tarayicilar 400 gunden uzun yasayan cooki'yi saklamayi reddeder */
const MAX_TRIES = 8 /* ayni IP art arda sekiz kez yanlis yazarsa yarim saat kapida bekler */
const COOLDOWN = 30 * 60 * 1000

/* Kimlik dogrulama tarayicida degil, burada yapilir. */
function normalizeCode(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase()
}

function cookieValue(request, name) {
  for (const part of String(request.headers.get('cookie') || '').split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    if (part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim())
      } catch {
        return ''
      }
    }
  }
  return ''
}

/* SameSite=None yalnizca https'te gecerli; yerel test http ile yapildigi icin orada
   Lax'a iniyor, yoksa tarayici cooki'yi sessizce cuba atardi.
   Aynayi Render gibi baska bir siteden cerceve icinde acarsek tarayici bu belgeden birini
   cerceveye hic vermiyor; o yuzden https'te belgenin bir de Partitioned kopyasi yazilir.
   Kopyalar ayni imzayi tasir, hangisi gelirse gelsin kapinin cevabi degismez. */
function grantCookie(token, url) {
  const life = `Path=/; Max-Age=${Math.floor(GRANT_TTL / 1000)}; HttpOnly`
  if (url.protocol !== 'https:') return [`${ACT_COOKIE}=${token}; ${life}; SameSite=Lax`]
  const plain = `${ACT_COOKIE}=${token}; ${life}; SameSite=None; Secure`
  return [plain, `${plain}; Partitioned`]
}

/* Veriler temizlendiğinde izin belgesi de silinir: belge sunucuda durduğu için sayfayı
   yenilemek yetmez, tarayıcıya "bu çerez artık yok" demek gerekir — iki kopyaya da. */
function revokeCookie(url) {
  if (url.protocol !== 'https:') return [`${ACT_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`]
  const plain = `${ACT_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=None; Secure`
  return [plain, `${plain}; Partitioned`]
}

async function isGranted(request, secret) {
  const token = cookieValue(request, ACT_COOKIE)
  if (!token) return false
  const payload = await verifyPayload(token, secret)
  return !!payload && payload.a === 1
}

/* Deneme sayaci bellekte, yani her sunucu adasi kendi sayar: amaci kodu saniyede bin
   kez deneyerek bulmayi bosuna zorlastirmak, hesap kilidini musterinin üzerine yikmak degil. */
const attempts = new Map()

function coolingDown(ip) {
  const hit = attempts.get(ip)
  if (!hit) return false
  if (hit.until > Date.now()) return true
  attempts.delete(ip)
  return false
}

function noteFailure(ip) {
  const hit = attempts.get(ip) || { count: 0, until: 0 }
  hit.count += 1
  if (hit.count >= MAX_TRIES) {
    hit.count = 0
    hit.until = Date.now() + COOLDOWN
  }
  attempts.set(ip, hit)
  if (attempts.size > 4096) attempts.delete(attempts.keys().next().value)
}

function json(value, status = 200, cookie = '') {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  for (const line of [].concat(cookie)) if (line) headers.append('set-cookie', line)
  return new Response(JSON.stringify(value), { status, headers })
}

async function handleActivate(request, secret, url) {
  let body
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const ip = request.headers.get('cf-connecting-ip') || 'bilinmeyen'
  if (coolingDown(ip)) {
    return json({ ok: false, error: 'Çok fazla deneme yaptın. Yarım saat sonra tekrar dene.' }, 429)
  }

  /* Tarayici verisi temizlendiginde ayni istek belgeyi de cubaya atar: kapi bir daha sorulur. */
  if (body.x === 1) return json({ ok: true }, 200, revokeCookie(url))

  /* Tarayici verisi temizlenmeden cooki de silinirse (ozel mod, tarayici degisimi)
     hafizadaki belge geri getirilir; kod bir daha sorulmaz. */
  const savedToken = String(body.k || '')
  if (savedToken) {
    const payload = await verifyPayload(savedToken, secret)
    if (payload && payload.a === 1) return json({ ok: true }, 200, grantCookie(savedToken, url))
    return json({ ok: false, error: 'Kayıtlı kod artık geçersiz.' }, 403)
  }

  if (normalizeCode(body.c) !== normalizeCode(ACT_CODE)) {
    noteFailure(ip)
    return json({ ok: false, error: 'Aktivasyon kodu hatalı.' }, 403)
  }
  attempts.delete(ip)
  const token = await signPayload({ a: 1 }, secret, GRANT_TTL)
  return json({ ok: true, key: token }, 200, grantCookie(token, url))
}

/* Kodu girmemis tarayici ayna yerine bu sayfayi gorur. Marka, splash'taki tarifin
   aynisidir: duz kirmizi dolgu, ince cizgi ve dort katman isik — harfler kalinlastirilmaz. */
const GATE_HTML = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>NOTFLİX</title>
<link rel="icon" href="${OUR_ICON}">
<style>${BRAND_FONT}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{display:flex;align-items:center;justify-content:center;padding:24px;background:#05060a;color:#fff;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-user-select:none;user-select:none}
body::before{content:'';position:fixed;inset:0;pointer-events:none;background:radial-gradient(62% 48% at 50% -6%,rgba(229,9,20,.3),transparent 72%),radial-gradient(48% 40% at 88% 104%,rgba(88,10,90,.22),transparent 70%),radial-gradient(46% 38% at 6% 100%,rgba(12,60,110,.24),transparent 72%)}
body::after{content:'';position:fixed;inset:0;pointer-events:none;opacity:.4;background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.045) 0 1px,transparent 1px 96px),repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 96px);-webkit-mask-image:radial-gradient(ellipse 72% 66% at 50% 46%,#000 0%,transparent 82%);mask-image:radial-gradient(ellipse 72% 66% at 50% 46%,#000 0%,transparent 82%)}
.nf-gate{position:relative;z-index:2;width:100%;max-width:430px;padding:clamp(28px,5.2vw,44px) clamp(22px,5.4vw,42px) clamp(24px,4.4vw,36px);text-align:center;border:1px solid rgba(255,255,255,.1);border-radius:26px;background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.018));box-shadow:0 40px 90px -34px rgba(0,0,0,.92),inset 0 1px 0 rgba(255,255,255,.09);backdrop-filter:blur(20px) saturate(150%);-webkit-backdrop-filter:blur(20px) saturate(150%)}
.nf-eyebrow{display:inline-flex;align-items:center;gap:8px;margin:0 0 clamp(16px,2.6vw,22px);padding:7px 13px;border:1px solid rgba(255,255,255,.13);border-radius:999px;background:rgba(255,255,255,.045);font-size:10px;font-weight:700;letter-spacing:.3em;text-transform:uppercase;color:rgba(255,255,255,.62)}
.nf-eyebrow i{width:6px;height:6px;border-radius:50%;background:#e50914;box-shadow:0 0 10px rgba(229,9,20,.85)}
.nf-gate h1{margin:0 0 14px;font-family:'Bebas Neue','Arial Narrow',Impact,sans-serif;font-weight:400;font-size:clamp(44px,12vw,80px);line-height:.82;letter-spacing:.004em;color:#e50914;-webkit-text-fill-color:#e50914;text-shadow:0 0 .07em rgba(229,9,20,.5),0 0 .215em rgba(229,9,20,.42),0 .05em .5em rgba(229,9,20,.3),0 .09em .9em rgba(229,9,20,.26)}
.nf-gate p{margin:0 0 clamp(22px,3.4vw,30px);font-size:14.5px;line-height:1.6;color:rgba(255,255,255,.66)}
.nf-field{position:relative}
.nf-gate input{display:block;width:100%;height:56px;padding:0 18px;font-family:inherit;font-size:16px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;text-align:center;color:#fff;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.14);border-radius:15px;outline:none;-webkit-user-select:text;user-select:text;transition:border-color .18s ease,background-color .18s ease,box-shadow .18s ease}
.nf-gate input::placeholder{font-weight:500;letter-spacing:.13em;text-transform:none;color:rgba(255,255,255,.3)}
.nf-gate input:focus{border-color:rgba(229,9,20,.75);background:rgba(229,9,20,.07);box-shadow:inset 0 0 0 1px rgba(229,9,20,.3)}
.nf-gate button{margin-top:14px;width:100%;height:56px;font-family:inherit;font-size:16.5px;font-weight:700;letter-spacing:.015em;color:#fff;background:linear-gradient(180deg,#f21420,#c30711);border:0;border-radius:15px;cursor:pointer;box-shadow:0 16px 34px -16px rgba(229,9,20,.8),inset 0 1px 0 rgba(255,255,255,.22);transition:filter .18s ease,background-image .18s ease}
.nf-gate button:hover:not(:disabled){filter:brightness(1.09)}
.nf-gate button:disabled{opacity:.5;cursor:default}
.nf-gate button:focus-visible{outline:1px solid rgba(255,255,255,.62);outline-offset:-4px}
.nf-gate .err{margin:14px 0 0;min-height:0;padding:11px 14px;font-size:13.5px;line-height:1.4;color:#ffa3aa;background:rgba(229,9,20,.1);border:1px solid rgba(229,9,20,.24);border-radius:12px}
.nf-gate .err:empty{display:none}
.nf-gate .nf-foot{margin:clamp(18px,2.8vw,24px) 0 0;font-size:11.5px;line-height:1.5;letter-spacing:.01em;color:rgba(255,255,255,.38)}
u{display:inline-block;position:relative;margin:0 .017em;font:inherit;color:inherit;text-decoration:none}
u.nf-idot::after{content:'';position:absolute;left:50%;top:calc(-.0915em - max(.0385em,2px));width:.1015em;height:.1015em;margin-left:-.0508em;border-radius:2px;background:currentColor}
@media (prefers-reduced-motion:reduce){.nf-gate input,.nf-gate button{transition:none}}
/* Uygulamanin kendi splash'iyle ayni sahne: harfler tek tek sis perdesinden cikar, isik yaziya
   çarpar, altta tek ray döner. Sayilar notflix-loading.css'ten alinmadir, iki ekran ayni kimligi
   tasin diye. */
.nf-load{position:fixed;inset:0;z-index:400;display:none;place-items:center;overflow:hidden;background:#04050a}
.nf-load.is-on{display:grid;animation:nfLoadIn .42s ease both}
@keyframes nfLoadIn{from{opacity:0}to{opacity:1}}
.nf-load__bloom{position:absolute;inset:-30%;pointer-events:none;background:radial-gradient(ellipse 46% 38% at 50% 44%,rgba(229,9,20,.3) 0%,rgba(229,9,20,.07) 42%,transparent 70%),radial-gradient(ellipse 70% 55% at 50% 112%,rgba(120,12,30,.34) 0%,transparent 66%);animation:nfBloom 11s ease-in-out infinite alternate}
@keyframes nfBloom{from{opacity:.62;transform:scale(.97)}to{opacity:1;transform:scale(1.05)}}
.nf-load__grid{position:absolute;inset:0;pointer-events:none;background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 92px);-webkit-mask-image:radial-gradient(ellipse 60% 55% at 50% 48%,#000 0%,transparent 78%);mask-image:radial-gradient(ellipse 60% 55% at 50% 48%,#000 0%,transparent 78%);opacity:.5}
.nf-load__inner{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;padding:0 6vw}
.nf-load__mark{position:relative}
.nf-load__word{margin:0;font-family:'Bebas Neue','Arial Narrow',Impact,sans-serif;font-weight:400;font-size:clamp(54px,12.5vw,148px);line-height:.82;letter-spacing:.004em;color:#e50914;-webkit-text-fill-color:#e50914;text-shadow:0 0 .07em rgba(229,9,20,.5),0 0 .215em rgba(229,9,20,.42),0 .05em .5em rgba(229,9,20,.3),0 .09em .9em rgba(229,9,20,.26)}
.nf-load__word u{animation:nfLetterIn .78s cubic-bezier(.18,.86,.24,1) both}
.nf-load__word u:nth-child(1){animation-delay:.04s}
.nf-load__word u:nth-child(2){animation-delay:.1s}
.nf-load__word u:nth-child(3){animation-delay:.16s}
.nf-load__word u:nth-child(4){animation-delay:.22s}
.nf-load__word u:nth-child(5){animation-delay:.28s}
.nf-load__word u:nth-child(6){animation-delay:.34s}
.nf-load__word u:nth-child(7){animation-delay:.4s}
@keyframes nfLetterIn{0%{opacity:0;transform:translateY(.34em) scale(1.16);filter:blur(14px)}60%{opacity:.9;filter:blur(2px)}100%{opacity:1;transform:none;filter:blur(0)}}
.nf-load__bar{position:absolute;top:-14%;bottom:-14%;left:-34%;width:28%;z-index:3;pointer-events:none;background:linear-gradient(100deg,transparent 0%,rgba(255,122,128,.55) 38%,rgba(255,240,240,.92) 50%,rgba(255,122,128,.55) 62%,transparent 100%);filter:blur(10px);mix-blend-mode:screen;animation:nfSweep 2.5s cubic-bezier(.55,0,.45,1) infinite}
@keyframes nfSweep{0%{transform:translateX(0);opacity:0}12%{opacity:1}88%{opacity:1}100%{transform:translateX(480%);opacity:0}}
.nf-load__rail{position:relative;width:min(320px,62vw);height:3px;margin-top:clamp(26px,4.4vh,48px);border-radius:3px;overflow:hidden;background:rgba(255,255,255,.1)}
.nf-load__rail-run{position:absolute;inset:0 auto 0 0;width:44%;border-radius:3px;background:linear-gradient(90deg,transparent,#e50914 35%,#ff6b72 55%,transparent);box-shadow:0 0 14px rgba(229,9,20,.55);animation:nfRail 1.5s cubic-bezier(.6,.05,.4,.95) infinite}
@keyframes nfRail{0%{transform:translateX(-110%)}100%{transform:translateX(255%)}}
.nf-load__hint{margin:clamp(18px,3vh,30px) 0 0;min-height:1.2em;font-size:clamp(10px,1.15vw,12px);font-weight:500;letter-spacing:.3em;text-transform:uppercase;text-align:center;color:rgba(255,255,255,.6);animation:nfHintIn .6s ease both}
@keyframes nfHintIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.nf-load__credit{position:absolute;left:50%;transform:translateX(-50%);bottom:max(20px,env(safe-area-inset-bottom));max-width:min(92vw,700px);font-size:9.5px;font-weight:600;letter-spacing:.26em;line-height:2.1;white-space:nowrap;text-align:center;color:rgba(255,255,255,.32)}
.nf-load__credit .tm{letter-spacing:0;margin-left:.45em;font-size:1.15em;opacity:.9}
@media (max-width:400px){.nf-load__credit{bottom:calc(max(20px,env(safe-area-inset-bottom)) + 56px)}}
/* Atla dugmesi uygulamanin kendi splash'indekiyle ayni yer ve ayni ince cizgili kutu:
   rituelin son adimina gelmeden kendini gostermez, kimse yarida kacirmaz. */
.nf-load__skip{display:none;position:absolute;bottom:max(20px,env(safe-area-inset-bottom));right:max(18px,env(safe-area-inset-right));padding:9px 18px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(255,255,255,.05);color:rgba(255,255,255,.72);font-family:inherit;font-size:11px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;cursor:pointer}
.nf-load__skip.is-on{display:block;animation:nfSkipIn .5s ease both}
.nf-load__skip:hover,.nf-load__skip:focus{color:#fff;border-color:rgba(255,255,255,.34);outline:none}
@keyframes nfSkipIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.nf-load.is-on,.nf-load__word u,.nf-load__hint{animation:none}.nf-load__bloom{animation:none;opacity:.9}.nf-load__bar{animation:none;opacity:0}.nf-load__rail-run{animation:none;width:100%;opacity:.75}}
</style>
</head>
<body>
<form class="nf-gate" id="g" autocomplete="off">
<span class="nf-eyebrow"><i aria-hidden="true"></i>Erişim</span>
<h1 aria-label="NOTFLİX"><u>N</u><u>O</u><u>T</u><u>F</u><u>L</u><u class="nf-idot">I</u><u>X</u></h1>
<p>İzlemeye başlamak için aktivasyon kodunu gir.</p>
<div class="nf-field"><input id="c" name="c" placeholder="Aktivasyon kodu" autocapitalize="characters" spellcheck="false" aria-label="Aktivasyon kodu"></div>
<button id="b" type="submit">Etkinleştir</button>
<p class="err" id="e" role="alert"></p>
<p class="nf-foot">Kod bir kez girilir; tarayıcı verilerin temizlenene kadar bir daha sorulmaz.</p>
</form>
<div class="nf-load" id="l" role="status" aria-live="polite">
<div class="nf-load__bloom" aria-hidden="true"></div>
<div class="nf-load__grid" aria-hidden="true"></div>
<div class="nf-load__inner">
<div class="nf-load__mark"><h1 class="nf-load__word" aria-label="NOTFLİX"><u>N</u><u>O</u><u>T</u><u>F</u><u>L</u><u class="nf-idot">I</u><u>X</u></h1><span class="nf-load__bar" aria-hidden="true"></span></div>
<div class="nf-load__rail" aria-hidden="true"><i class="nf-load__rail-run"></i></div>
<p class="nf-load__hint" id="h">Sunucuya bağlanılıyor…</p>
</div>
<button type="button" class="nf-load__skip" id="k">Atla</button>
<div class="nf-load__credit">RENDIR MEDİA 2027<span class="tm">™</span></div>
</div>
<script>(function(){
var KEY='nf_key',TRY='nf_tried',SEEN='nf_splash_seen',LINE_MS=2600,SPLASH_MS=10400,g=document.getElementById('g'),c=document.getElementById('c'),
b=document.getElementById('b'),e=document.getElementById('e'),l=document.getElementById('l'),h=document.getElementById('h'),k=document.getElementById('k'),
LINES=['Sunucuya bağlanılıyor…','Katalog hazırlanıyor…','Yayın çizgileri denetleniyor…','Bağlanıldı'];
function get(){try{return localStorage.getItem(KEY)}catch(err){return null}}
function put(v){try{if(v)localStorage.setItem(KEY,v)}catch(err){}}
function wipe(){try{localStorage.removeItem(KEY);sessionStorage.removeItem(TRY)}catch(err){}}
function seen(){try{return sessionStorage.getItem(TRY)==='1'}catch(err){return false}}
function mark(){try{sessionStorage.setItem(TRY,'1')}catch(err){}}
function say(m){e.textContent=m||'';c.focus()}
function wait(on){b.disabled=on;b.textContent=on?'Bekle…':'Etkinleştir'}
function send(p){return fetch('__activate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p)})
.then(function(r){return r.json()})
.catch(function(){return{ok:false,error:'Sunucuya ulaşılamadı. Tekrar dene.'}})}
/* Kapi açilirken bos bir ana ekrana düsmemek icin once kimlik ekrani: uygulamanin kendi
   splash'inin ayni sahnesi ve ayni calisan satirlari, ayni hizda. Hareket istemeyen tarayici
   beklemeden gecer. */
function enter(){
var calm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
g.style.display='none';l.classList.add('is-on');
try{sessionStorage.setItem(SEEN,'1')}catch(err){}
if(calm){location.reload();return}
var i=0,timer;
function out(){clearInterval(timer);location.reload()}
k.onclick=out;
timer=setInterval(function(){
i++;h.textContent=LINES[i];
if(i<LINES.length-1)return;
clearInterval(timer);k.classList.add('is-on');k.focus();
},LINE_MS);
setTimeout(out,SPLASH_MS)}
var saved=get();
if(saved&&!seen()){mark();send({k:saved}).then(function(d){if(d.ok){enter()}else{wipe();say('Kodu yeniden girmen gerekiyor.')}})}
g.addEventListener('submit',function(ev){
ev.preventDefault();
var code=c.value.trim();
if(!code){say('Kod boş bırakılamaz.');return}
wait(true);
send({c:code}).then(function(d){
if(d.ok){put(d.key);enter();return}
wait(false);
say(d.error||'Aktivasyon kodu hatalı.');c.select();
})});
g.addEventListener('keydown',function(ev){
if(ev.key==='ArrowDown'||ev.key==='ArrowRight'){b.focus();ev.preventDefault()}
else if(ev.key==='ArrowUp'||ev.key==='ArrowLeft'){c.focus();ev.preventDefault()}
});
c.focus();
})()</script>
</body>
</html>`

function gatePage() {
  return new Response(GATE_HTML, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })
}

/* ------------------------------------------------ kendi kategorimiz ------ */
/* SAGLAYICIDA "Turkiye Ulusal" DIE BIR GRUP YOK: bu kategori abonenin kendi listesi.
   Sira onun kurduyu sira (TRT 1'den baslar) ve her istasyonun en temiz goruntusu
   secilir — cunku saglayici ayni kanali alti-yedi kopya ile listeliyor ("ATV HD (3)",
   "4K TR: ATV" gibi) ve kirik Turkce yazimlara kadar iniyor ("TRT T RK").
   Kanal saglayicinin Turkiye kuyrugunda yoksa kategoride de yok: uydurma kanal
   adresi verip bos ekran gosteremeyiz. Kategori, sitenin kendi grup secim tahtasina
   yazilir; secilince adresi site kendisi sorar, cevabi biz kurariz. */

const NATIONAL_GROUP = 'Türkiye Ulusal'
const NATIONAL_TTL = 30 * 60 * 1000
const NATIONAL_PAGES = 8
/* Populerlik sirasi icin saglayicinin "trending" kopyasi uc sayfada yeterince buyuk. */
const NATIONAL_RANK_PAGES = 3
/* Kategori daima 200 kanal gosterir: abonenin kuyrugundaki istasyonlar once gelir, sonra
   elle secme yedek kuyruk (NATIONAL_EXTRA), en son saglayicinin Turkiye saydigi diger
   kanallar. Kuyrukta olup saglayicida hic olmayan istasyon (Sinema TV, Kabe, il
   kanallarinin cogu) uydurulmaz; yerini gercek bir kanal doldurur. */
const NATIONAL_TARGET = 200
const QUALITY_TOKEN = /\b(4k|uhd|2160p|full\s?hd|fhd|hd\+|hd|sd|hevc|x?265|1080p|720p|hq|lq)\b/gi
const NATIONAL_STATIONS = [
'TRT 1 HD',
  'TRT 2 HD',
  'TRT Haber',
  'TRT Spor|TRTSPOR',
  'TRT Spor Yıldız',
  'TRT Belgesel',
  'TRT Çocuk',
  'TRT Müzik',
  'TRT Türk',
  'TRT Avaz',
  'Star TV HD|Star',
  'Show TV HD|Show',
  'Kanal D HD|Kanal D',
  'ATV HD|ATV',
  'NOW TV HD|NOW|Fox TV|Fox',
  'TV8 HD|TV 8',
  'Kanal 7 HD|Kanal 7',
  'Beyaz TV HD|Beyaz',
  'TGRT Haber HD',
  'TV8,5 HD|TV8.5|TV 8.5',
  'Teve2 HD',
  '360 TV|360',
  'TLC Türkiye|TLC',
  'DMAX Türkiye|DMAX',
  'Flash Haber TV|Flash Haber',
  'Tele 1|Tele1',
  'Habertürk HD|Habertuerk',
  'CNN Türk HD|CNN Turk',
  'NTV HD|NTV',
  'A Haber HD',
  'Sözcü TV|Sozcu',
  'Halk TV|Halk',
  'TV100|TV 100',
  'KRT TV|KRT',
  '24 TV|24',
  'Ülke TV|Ulke',
  'Bloomberg HT',
  'TGRT Belgesel',
  'Ekotürk|Ekoturk',
  'A Para',
  'Sinema TV',
  'Sinema TV 2',
  'Sinema Aksiyon',
  'Sinema Aile',
  'Sinema Komedi',
  'Sinema Yerli',
  'FilmBox HD|Filmbox',
  'BeIN Movies Premiere HD|beIN Movies Premiere|BeeIN Movies Premiere',
  'BeIN Movies Stars HD|beIN Movies Stars',
  'BeIN Movies Action HD|beIN Movies Action',
  'BeIN Movies Family HD|beIN Movies Family',
  'BeIN Movies Comedy HD|beIN Movies Comedy',
  'Tivibu Sinema 1',
  'Tivibu Sinema 2',
  'S Cinema',
  'Smart Sinema',
  'Movie Smart Platin',
  'Movie Smart Gold',
  'Turkishtime Sinema',
  'Aksiyon Türk|Aksiyon Turkmovie',
  'BeIN Sports 1 HD|beIN Sports 1',
  'BeIN Sports 2 HD|beIN Sports 2',
  'BeIN Sports 3 HD|beIN Sports 3',
  'BeIN Sports 4 HD|beIN Sports 4',
  'BeIN Sports 5 HD|beIN Sports 5',
  'BeIN Sports Haber|beIN Sports Haber',
  'S Sport 1 HD|S Sport|S-SPORT 1',
  'S Sport 2 HD|S Sport 2',
  'S Sport Plus',
  'Tivibu Spor 1',
  'Tivibu Spor 2',
  'Tivibu Spor 3',
  'Tivibu Spor 4',
  'Exxen Spor 1|Exxen TV Spor 1',
  'Exxen Spor 2|Exxen Sports 2',
  'Exxen Spor 3|Exxen Sports 3',
  'Exxen Spor 4|Exxen Sports 4',
  'Smart Spor HD',
  'Spor Smart 2',
  'TRT Spor 2|TRT Spor Yildiz 2',
  'A Spor HD|A Spor',
  'TJK TV|TJK',
  'FB TV|FB',
  'GS TV|GS',
  'BJK TV|BJK',
  'Eurosport 1 HD',
  'Eurosport 2 HD',
  'Motorsport TV|Motorsport',
  'Fight Network',
  'Sports TV|Sports',
  'National Geographic HD|Nat Geo|National Geographic',
  'National Geographic Wild HD|Nat Geo Wild|National Geographic Wild',
  'Discovery Channel HD|Discovery',
  'Discovery Science HD',
  'Animal Planet HD',
  'BBC Earth HD|BBC Earth',
  'History Channel HD|History',
  'Love Nature HD',
  'Viasat History',
  'Viasat Explore',
  'Viasat Nature',
  'Crime + Investigation|Crime and Investigation|Crime Investigation',
  'Food Network',
  'HGTV',
  'Travel Channel|Travel',
  'ID Discovery|Investigation Discovery',
  'TRT Docu',
  'Da Vinci Kids',
  'CNN International',
  'BBC World News',
  'Al Jazeera English',
  'France 24 English|France 24',
  'DW English|DW',
  'Euronews Türkçe|Euronews Turkce|Euronews',
  'TRT World HD',
  'TRT Arabi',
  'TRT Kurdi',
  'TRT Int|TRT Turk',
  'TRT Müzik HD',
  'Kral TV|KRAL',
  'Kral Pop TV|Kral Pop',
  'Number One Türk|Number One|Number 1 Turk',
  'Number One TV|Number One|Number1 TV',
  'Power Türk|Power Turk',
  'Power TV',
  'Dream Türk|Dream Turk',
  'MTV Hits',
  'MTV 90s',
  'MTV 80s',
  'Club MTV',
  'Trace Urban',
  'Mezzo HD|Mezzo',
  'Deluxe Music',
  'Power Love',
  'Kral Akustik',
  'TRT Çocuk HD',
  'Cartoon Network',
  'Disney Channel',
  'Disney Junior',
  'Minika GO|Minika Go',
  'Minika Çocuk',
  'Boomerang HD|Boomerang',
  'Nick Jr.|Nick Jr',
  'Nickelodeon',
  'Duck TV|Duck',
  'Baby TV|Baby',
  'JimJam',
  'Tiji',
  'TRT Diyanet Çocuk',
  'Cartoonito',
  'Diyanet TV|Diyanet',
  'Diyanet Kur\'an|Diyanet Kurani|Kuran TV',
  'Dost TV|Dost',
  'Hilal TV|Hilal',
  'Semerkand TV|Semerkand',
  'Berat TV|Berat',
  'Vuslat TV|Vuslat',
  'Kabe Canlı (Mekke)|Kabe|Kaaba|Mekke',
  'Medine Canlı|Medine',
  'Olay TV (Karadeniz)|Olay TV|Olay',
  'Karadeniz TV|Karadeniz BRTV|Mavi Karadeniz',
  'Kontv|Kon TV',
  'Kanal 26',
  'Bursa Hakimiyet TV|Bursa Hakimiyet',
  'Edirne TV|Edirne',
  'Ordu TV|Ordu',
  'Ordu Medya TV|Ordu Medya',
  'TV 52|TV52',
  'Çay TV|Cay',
  'Güven TV|Guven',
  'Kadırga TV|Kadirga',
  'Akdeniz TV|Akdeniz',
  'Ege TV|Ege|Ege Turk TV',
  'Meltem TV|Meltem',
  'Mesudiye TV|Mesudiye',
  'Ünye TV|Unye',
  'Fatsa Güneş TV|Fatsa Gunes',
  'Denizli RTV|Denizli Deha TV',
  'Kayseri Mega TV|Kayseri|TV Kayseri',
  'Konya TV|Konya',
  'Van TV|Van',
  'Diyar TV|Diyar',
  'Line TV Bursa|Line TV',
  'DRT Denizli',
  'Antalya TV|Antalya',
  'Alanya TV|Alanya',
  'Manisa TV|Manisa|ETV Manisa',
  'Sakarya TV|Sakarya',
  'Kocaeli TV|Kocaeli',
  'Tek Rumeli TV|Tek Rumeli|Rumeli TV',
  'TGRT FM Görsel|TGRT FM',
  'Kral FM Görsel|Kral FM',
  'Power FM Görsel|Power FM',
  'Süper FM Görsel|Super FM',
  'Metro FM Görsel|Metro FM',
  'Alem FM Görsel|Alem FM',
  'Show Radyo Görsel|Show Radyo',
  'Joy Turk Görsel|Joy Turk|JoyTurk',
  'Slow Türk Görsel|Slow Turk',
  'TRT Nağme Görsel|TRT NAGME|TRT Nağme'
]

/* Kuyruktaki 200 istasyonun 72'sini saglayici hic tasimiyor (FilmBox, BeIN Movies Comedy,
   Tivibu Sinema, GS TV, CNN International, MTV...). Kategori yine 200 kalsin diye ardina
   elle secme ikinci bir kuyruk yazildi: hepsi saglayicida GERCEKTEN var, yayini kendi
   listemizde var ve adi bir kanal adi — film paketi, "MAC SAATI" yayini, kisi kanali degil.
   Sira mantikli: once ulusal spor ve haber, sonra sinema/cocuk/muzik, en son il kanallari.
   Saglayici bunlardan birini de kaldirirsa makine doldurmasi (asagidaki fillLineUp) devreye
   girer; kuyrukta oldugu hal hicbir yerde bulunmayan istasyon uydurulmaz. */
const NATIONAL_EXTRA = [
  'BeIN Sports MAX 1',
  'BeIN Sports MAX 2',
  'Exxen Spor 5|Exxen TV Spor 5',
  'Exxen Spor 6|Exxen TV Spor 6',
  'Exxen Spor 7|Exxen TV Spor 7',
  'Tivibu Spor 5',
  'Tabii Spor 3',
  'Tabii Spor 4',
  'Tabii Spor 5',
  'Tabii Spor 6',
  'HT Spor',
  'Ekol Spor',
  'Spor Smart',
  '24 Haber',
  'Kanal 24',
  'TVNET',
  'İlke TV',
  'Bengü Türk|BengüTürk|Bengu Türk',
  'Ekol TV',
  'Türk Haber TV|Turkhabet TV',
  'Euro Star',
  'A2',
  'Exxen TV',
  'TV 4',
  'Sinema 1002',
  'Sinema TV Aksiyon',
  'BeIN Series 1',
  'BeIN Series 3',
  'BeIN Gurme',
  'Discovery World',
  'Disney Junior|Disney Jr',
  'Pepee TV',
  'TRT 3',
  'Satranç TV',
  'Red Bull TV|Redbull TV',
  'Yaban',
  'TAY TV',
  'Power Türk',
  'Power Dance',
  'Power Türk Akustik|Powerturk Akustik',
  'Radio Rock',
  'NR1 Türk',
  'NR1 Damar',
  'Tatlıses TV|Tatlises TV',
  'Kent Türk',
  'Adana TV',
  'Mercan TV|Adıyaman Mercan TV',
  'Boğaz TV|Anakkale Boğaz TV',
  'Can TV',
  'BRT 1',
  'ETV Kayseri',
  'Gonca TV',
  'Güneydoğu TV',
  'HRT Akdeniz TV',
  'Hunat TV',
  'İz TV',
  'İzmir TV 35',
  'Kanal 33',
  'Kanal 58',
  'Kıbrıs Kanal T',
  'Koza TV',
  'Mersin EL TV',
  'Vizyon 58 TV Sivas',
  'Sun TV',
  'Tempo TV',
  'TV 264',
  'TV Kayseri',
  'Yeni Kocaeli TV',
  'Yol TV',
  'Zonguldak Kanal Z',
  'Aslan TV',
  'ATV Alanya',
  'Kare TV',
  'Life TV',
  'Finest TV',
  'Bilgilendirme',
  'Anadolu Dernek TV',
  'Ankara T RKIYEM TV|Ankara Türkiyem TV',
  'MimoCan TV',
  'Rehber TV',
  'Kudüs TV'
]

/** Saglayicinin kirik Turkce yazimlari tek yerde onarilir: harflerin ustunden dusen
    I/İ/U karakteri bosluk birakir ("S NEMA" = SİNEMA, "HABERT RK" = HABERTÜRK,
    "AK T TV" = AKİT TV, "M N KA GO" = MİNİKA GO, "DA VINC" = DA VINCI). */
function repairSpelling(value) {
  return String(value || '')
    .replace(/T ?RK\b/g, 'TÜRK')
    .replace(/AK T\b/g, 'AKİT')
    .replace(/M N KA/g, 'MİNİKA')
    .replace(/M Z K\b/g, 'MÜZİK')
    .replace(/\bLKE TV\b/g, 'İLKE TV')
    .replace(/S NEMA/g, 'SİNEMA')
    .replace(/\bAKS YON\b/g, 'AKSİYON')
    .replace(/\bA LE\b/g, 'AİLE')
    .replace(/\bYERL\b/g, 'YERLİ')
    .replace(/\bKOMED\b/g, 'KOMEDİ')
    .replace(/\bDA VINC\b/g, 'DA VINCI')
    /* Saglayici harfin hic düsmemis hallerini de yaziyor: altta kalan noktasiz kelimeler. */
    .replace(/\b(?:SOZCU SZC|S ZC SZC|SZC|SOZCU)\b/g, 'SÖZCÜ')
    .replace(/\bCOCUK\b/g, 'ÇOCUK')
    .replace(/\bDIYANET\b/g, 'DİYANET')
    .replace(/\bBUYUKSEHIR\b/g, 'BÜYÜKŞEHİR')
    .replace(/\bBELEDIYESI\b/g, 'BELEDİYESİ')
    .replace(/\bKARADENIZ\b/g, 'KARADENİZ')
    .replace(/\bEDIRNE\b/g, 'EDİRNE')
    .replace(/\bKOCAELI\b/g, 'KOCAELİ')
    .replace(/\bMAVI\b/g, 'MAVİ')
    .replace(/\bYENI\b/g, 'YENİ')
    .replace(/\bANAKKALE\b/g, 'ÇANAKKALE')
    .replace(/\bCAY\b/g, 'ÇAY')
    .replace(/\bDENIZLI\b/g, 'DENİZLİ')
    .replace(/\bGUNEYDOGU\b/g, 'GÜNEYDOĞU')
    .replace(/\bAKUSTIK\b/g, 'AKUSTİK')
    .replace(/\bKAYSERI\b/g, 'KAYSERİ')
    .replace(/\bIZMIR\b/g, 'İZMİR')
    .replace(/\bBENGU\b/g, 'BENGÜ')
    .replace(/\bEKO TURK\b/g, 'EKOTÜRK')
    .replace(/\bTIVIBUSPOR\b/g, 'TIVIBU SPOR')
}

/** "4K TR: ATV HD (3)" ile "ATV HEVC" ikisi de ATV'dir. */
function stationKey(name) {
  let value = repairSpelling(name).replace(/(\s*(?:\([^()]*\)|\[[^\]]*\]))+$/, '').trim()
  value = value.replace(/^\s*(?:4k|uhd|fhd|hd)?\s*(?:tr|turk|türk)\s*[:\-|]\s*/i, '')
  value = value.replace(QUALITY_TOKEN, ' ')
  return value.replace(/\s+/g, ' ').replace(/^[\s.\-_|[\]()]+|[\s.\-_|[\]()]+$/g, '').trim()
}

const TURKISH_FOLD = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' }

/** Isim eslestirmesi icin kiriksiz anahtar: nokta, parantez, kalite etiketi ve aksan duser. */
function foldKey(name) {
  const lower = stationKey(name).toLocaleLowerCase('tr')
  let out = ''
  for (const char of lower) {
    const folded = TURKISH_FOLD[char] || char
    if (/[a-z0-9]/.test(folded)) out += folded
  }
  return out
}

function qualityRank(name) {
  const upper = String(name || '').toUpperCase()
  if (/4K|UHD|2160P/.test(upper)) return 4
  if (/FHD|FULL HD|HD\+/.test(upper)) return 3
  if (/\bHD\b/.test(upper)) return 2
  if (/\bSD\b/.test(upper)) return 0
  return 1
}

/** Istenen istasyonun en temiz kopyasi; tam karsi yoksa bir tek yakin on ek kabul.
    Esit uzaklikta birden cok kopya varsa en iyi resimli ve yayini bizde olan secilir. */
function pickStation(pool, key, own = new Set()) {
  let best = null
  for (const entry of pool) {
    if (entry.key !== key) continue
    if (!best || variantScore(entry.item, own) > variantScore(best.item, own)) best = entry
  }
  if (best) return best.item
  let runner = null
  for (const entry of pool) {
    if (!(entry.key.startsWith(key) || key.startsWith(entry.key))) continue
    if (Math.min(entry.key.length, key.length) < 4) continue
    const distance = Math.abs(entry.key.length - key.length)
    if (!runner || distance < runner.distance) runner = { key: entry.key, item: entry.item, distance }
    else if (distance === runner.distance && variantScore(entry.item, own) > variantScore(runner.item, own)) {
      runner = { key: entry.key, item: entry.item, distance }
    }
  }
  return runner ? runner.item : null
}

/** Kopya secimi: once en iyi resim (4K > FHD > HD > etiketsiz), esitse yayini kendi
    listemizde olan kopya. Boylece "TRT SPOR SD" ile "TRT SPOR 4K" yanisira tek kanal
    durur ve abone en kotusunu HD gorecek sekilde en kalitelisini gorur. */
function variantScore(item, own) {
  return qualityRank(item.name) * 2 + (own.has(String(item.id)) ? 1 : 0)
}

/** Liste saglayicinin kopyalari arasindan tek kanala iner, abonenin verdigi siraya dizilir:
    once 200luk kuyruk, sonra elle secme yedek kuyruk, toplam 200'i gecmeden. */
function nationalLineUp(items, own = new Set()) {
  const pool = items.map((item) => ({ key: foldKey(item.name), item }))
  const taken = new Set()
  const out = []
  for (const station of NATIONAL_STATIONS.concat(NATIONAL_EXTRA)) {
    if (out.length >= NATIONAL_TARGET) break
    let hit = null
    /* Kuyruk satiri birden fazla yazim tasiyabilir ("Exxen Spor 1|Exxen TV Spor 1"):
       hepsi aranir, en iyi kopyasi secilir. Ayni kanalin baska satirdaki kopyasi
       (taken) tekrar listelenmez. */
    for (const alternative of station.split('|')) {
      const found = pickStation(pool, foldKey(alternative), own)
      if (!found || taken.has(found.id)) continue
      if (!hit || variantScore(found, own) > variantScore(hit, own)) hit = found
    }
    if (!hit) continue
    taken.add(hit.id)
    const key = foldKey(hit.name)
    if (key) taken.add(key)
    out.push(hit)
  }
  return out
}

/** Kategori 200'e tamamlanir. Kuyruklar (200luk liste + elle secme yedek liste) saglayicida
    bulundugu kadar dizilir; hala eksik varsa bu makine doldurmasi devreye girer. Once yayini
    kendi listemizde olan kanallar (onlar her zaman cekiyor), sonra saglayicinin Turkiye saydigi
    (.tr kuyruklu) HD uzeri kopyalar — saglayicinin populerlik sirasiyla, populairesi bilinmeyen
    A-Z ile en altta durur. SD etiketli kopya, film paketi ve yedek besleme aboneye gosterilmez.
    Hicbir yerde bulunmayan istasyon uydurulmaz; yerini gercek bir kanal doldurur. */
const FILL_JUNK = /\b(raw|feed|backup|kutu|uydu|kupe|h ?265|x ?265|\d+ ?fps|\d{3,4}p|horror|anima(l|tio)n|animaux|barbie|pokemon|patron|niloya|salon|office|mac saati|cinema|dream|global|kingbox|max|best|dinamik|showmax|moviesmart|dizismart|premi(er|um)|vizyon|loca|kral|kong|spider|transformer|paw|kocaay|masal|adibesa|nevizade|gadget|collerde|rokka)\b|\bcocuk \d\b/i

function tvgKey(item) {
  const tvg = String((item.ids && item.ids.tvg) || '')
  let out = ''
  for (const char of tvg.toLocaleLowerCase('tr')) if (/[a-z0-9]/.test(char)) out += char
  return out
}

const ALPHABET = (a, b) => stationKey(a.name).localeCompare(stationKey(b.name), 'tr', { numeric: true, sensitivity: 'base' })

function fillLineUp(items, takenList, target, ranks, own = new Set()) {
  const keys = new Set()
  const claim = (item) => {
    const key = foldKey(item.name)
    if (key) keys.add(key)
    const tvg = tvgKey(item)
    if (tvg) keys.add(tvg)
  }
  for (const item of takenList) claim(item)
  const isOwn = (item) => own.has(String(item.id))
  const byStation = new Map()
  for (const item of items) {
    /* Kendi listemizdeki kanal Turkiye kanali zaten; saglayicinin etiketine bakilmaz. */
    if (!isOwn(item) && !/\.tr$/i.test(String((item.ids && item.ids.tvg) || ''))) continue
    const rank = qualityRank(item.name)
    /* SD etiketli kopya doldurmada da kullanilmaz: abone "en kotusu HD" istiyor. */
    if (rank < 1 || FILL_JUNK.test(item.name)) continue
    const key = foldKey(item.name)
    if (!key || keys.has(key) || keys.has(tvgKey(item))) continue
    const held = byStation.get(key)
    if (!held || variantScore(item, own) > variantScore(held, own)) byStation.set(key, item)
  }
  const tier = (item) => (isOwn(item) ? 0 : qualityRank(item) >= 2 ? 1 : 2)
  const score = (item) => {
    const held = ranks.get(foldKey(item.name))
    return held === undefined ? Number.MAX_SAFE_INTEGER : held
  }
  const out = [...byStation.values()].sort((a, b) => tier(a) - tier(b) || score(a) - score(b) || ALPHABET(a, b))
  return out.slice(0, Math.max(0, target - takenList.length))
}

/* Turkiye kuyrugu ~900 kanal, saglayici sayfayi 300'de kesiyor: uc-dort istekte toplanir
   ve yarim saat bellekte tutulur — kategori her acilisinda saglayiciya yeniden gidilmez. */
const turkeyCache = new Map()

async function pullTurkeyPages(region, language, sort, stopAt) {
  const items = []
  let features = null
  for (let page = 0; page < stopAt; page += 1) {
    const params = new URLSearchParams({ region, language, sort, 'filter[group]': 'Turkey' })
    if (items.length) params.set('cursor', String(items.length))
    let data = null
    try {
      const response = await fetch(GEIL + '/live/catalog/live/channels.json?' + params, {
        headers: { 'user-agent': UA, accept: 'application/json', origin: GEIL, referer: GEIL + '/' },
        signal: AbortSignal.timeout(30000),
      })
      if (response.ok) data = await response.json()
    } catch { /* eski kopya ile devam */ }
    if (!data || !Array.isArray(data.items) || !data.items.length) break
    items.push(...data.items)
    if (!features) features = data.features || null
    if (!data.nextCursor) break
  }
  return { items, features }
}

/** Populerlik sirasi: ayni kanalin kopyalari arasindaki en iyi derece saklanir. */
function trendingRanks(items) {
  const ranks = new Map()
  items.forEach((item, index) => {
    const key = foldKey(item.name)
    if (!key) return
    const held = ranks.get(key)
    if (held === undefined || index < held) ranks.set(key, index)
  })
  return ranks
}

async function turkeyCatalog(region, language) {
  const cacheKey = region + '|' + language
  const held = turkeyCache.get(cacheKey)
  if (held && Date.now() < held.at + NATIONAL_TTL) return held
  const listed = await pullTurkeyPages(region, language, 'name', NATIONAL_PAGES)
  if (!listed.items.length) return held || { at: 0, items: [], features: null, national: [], fill: [] }
  const popular = await pullTurkeyPages(region, language, 'trending', NATIONAL_RANK_PAGES)
  /* Kendi listemiz gunde bir kez indirilir ve bellekte durur: yayini bizde olan kopya
     secilir, doldurma da onlardan once secilir — abone "her zaman çeken" kanal istiyor. */
  const { own } = await loadLiveTable()
  const national = nationalLineUp(listed.items, own)
  const fresh = {
    at: Date.now(),
    items: listed.items,
    features: listed.features,
    national,
    fill: fillLineUp(listed.items, national, NATIONAL_TARGET, trendingRanks(popular.items), own),
  }
  turkeyCache.set(cacheKey, fresh)
  return fresh
}

/** Sitenin grup secim tahtasi bu özellik listesinden doluyor: kendi satirimizi ekliyoruz.
    Eklenirse true; saglayici listeyi hic vermediyse false ve yanit oldugu gibi kalir. */
function offerNationalGroup(features) {
  const list = features && Array.isArray(features.filter) ? features.filter : []
  const group = list.find((entry) => entry && entry.id === 'group')
  if (!group) return false
  group.values = Array.isArray(group.values) ? group.values : []
  if (!group.values.some((entry) => entry && entry.id === NATIONAL_GROUP)) {
    group.values.push({ id: NATIONAL_GROUP, name: NATIONAL_GROUP })
  }
  return true
}

/** Liste bizim oldugu icin isimleri de biz temizliyoruz: yayindaki "(6)" varyanta sayari
    ve "[LIVE DURING EVENTS ONLY]" saglayicinin notu aboneye gorecek bir sey degil,
    "TRT T RK" ise saglayicinin kirik yazimi, "NICK JR HD HD" de iki kere yazilmis etiket,
    "4K TR: TRT 1 HD" de saglayicinin kendi dosya klasorunun adi — o kanalin adi degil. */
function prettyName(name) {
  const bare = repairSpelling(name)
    .replace(/^\s*(?:4K|UHD|FHD|HD)\s+[A-Z]{2}\s*:\s*/i, '')
    .replace(/(\s*(?:\([^()]*\)|\[[^\]]*\]))+$/, '')
    .replace(/\b(4K|UHD|FHD|HD\+|HD)\s+SD\b/gi, '$1')
    .replace(/\b(4K|UHD|FHD|HD\+|HD)\s+\1\b/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  return bare || String(name || '')
}

/** Normal kanal listesi saglayicidan geliyor; tahtaya kendi satirimizi burda taniyoruz.
    Baska tek bir karaktere dokunulmaz, cozulemeyen govde oldugu gibi gecer. */
function withNationalGroup(body) {
  try {
    const data = JSON.parse(body)
    if (!offerNationalGroup(data.features)) return body
    return JSON.stringify(data)
  } catch {
    return body
  }
}

const NATIONAL_REQUEST = /^\/live\/catalog\/(?:live\/)?channels\.json$/i

/**
 * "Türkiye Ulusal" secilince site aynı adresi bize soruyor; cevabi kendimiz kuruyoruz.
 * Item'lar saglayicinin kendi kopyalari (kimlik, logo, rehber oldugu gibi durur), sadece
 * liste bizim siramiz ve tek kopya. Adresler de ayni yeniden yazimdan gecer.
 */
async function nationalAnswer(request, url, origin, cacheKey, ctx) {
  const catalog = await turkeyCatalog(url.searchParams.get('region') || 'GB', url.searchParams.get('language') || 'tr')
  const lineUp = catalog.national.concat(catalog.fill)
  let items = lineUp
  const needle = foldKey(url.searchParams.get('search') || '')
  if (needle) items = lineUp.filter((entry) => foldKey(entry.name).includes(needle))
  const features = catalog.features || { search: true, sort: [], filter: [] }
  offerNationalGroup(features)
  const payload = { items: items.map((item) => ({ ...item, name: prettyName(item.name) })), nextCursor: null, features }
  const body = await toSafeUrls(JSON.stringify(payload), GEIL + '/live/catalog/live/channels.json', origin)
  const response = new Response(request.method === 'HEAD' ? null : body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': catalog.items.length ? `public, max-age=${EDGE_TTL_LIVE}` : 'no-store',
    },
  })
  if (catalog.items.length && request.method === 'GET') ctx.waitUntil(caches.default.put(cacheKey, response.clone()))
  return response
}

/* -------------------------------------------------------------- ana yol ---- */

export default {
  async fetch(request, env, ctx) {
    const secret = env.PROXY_SECRET || DEFAULT_SECRET
    const url = new URL(request.url)
    const origin = url.origin

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, HEAD, OPTIONS', 'access-control-max-age': '86400' },
      })
    }

    /* Tek POST kapisi: kod buradan gecer, baska hicbir yol yazili istek kabul etmez. */
    if (url.pathname === ACTIVATE) {
      if (request.method !== 'POST') return text('text/plain; charset=utf-8', 'Yalnizca POST', 405)
      return handleActivate(request, secret, url)
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return text('text/plain; charset=utf-8', 'Yalnizca GET')
    }

    if (url.pathname === STREAM) return handleStream(request, secret)

    const granted = await isGranted(request, secret)

    // Oynatici katalogdan bu adresleri isimle alir: http atlamasini tarayici gormesin.
    if (PLAY_PATH.test(url.pathname)) {
      if (!granted) return text('text/plain; charset=utf-8', 'Aktivasyon gerekiyor', 403)
      const own = await ownLiveAddress(url.pathname, '')
      if (own) return Response.redirect(own, 302)
      return Response.redirect(await streamUrl(GEIL + url.pathname + url.search, null), 302)
    }

    /* Sayfa mi dosya mi, yukariya sormadan anlasilir: uzantisi olmayan her adres bir
       ekrandir. Kodsuz tarayici ekran yerine kapiyi gorur, dosyalar ise acik kalir
       (kapinin kendi giyimi de onlardan biri). */
    if (!granted && !/\.[a-z0-9]{2,5}$/i.test(url.pathname)) return gatePage()

    /* Kendi kategorimiz secildiyse saglayiciya hic gidilmez: liste bizim. */
    if (NATIONAL_REQUEST.test(url.pathname) && url.searchParams.get('filter[group]') === NATIONAL_GROUP) {
      const key = new Request(origin + url.pathname + url.search, request)
      const stored = await caches.default.match(key)
      if (stored) return stored
      return await nationalAnswer(request, url, origin, key, ctx)
    }

    const target = GEIL + (url.pathname === '/' ? '/' : url.pathname) + upstreamSearch(url.search, origin)
    const isStatic = url.pathname.startsWith('/vuma/')
    const edge = caches.default
    const cacheKey = new Request(origin + url.pathname + url.search, request)
    const mayCache = isStatic || edgeTtlFor(url.pathname) > 0

    if (mayCache) {
      const hit = await edge.match(cacheKey)
      if (hit) return hit
    }

    let upstream
    try {
      upstream = await fetch(target, {
        headers: { 'user-agent': UA, accept: '*/*', 'accept-language': 'tr-TR,tr;q=0.9,en;q=0.7', origin: GEIL, referer: `${GEIL}/` },
        redirect: 'follow',
        signal: AbortSignal.timeout(30000),
      })
    } catch (error) {
      return text('text/plain; charset=utf-8', `Ayna ulasamadi: ${error && error.message}`)
    }

    const contentType = upstream.headers.get('content-type') || ''
    const kind = kindOf(new URL(target).pathname, contentType)
    const status = upstream.status >= 200 ? upstream.status : 502
    const fallbackType = kind === 'json' ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8'

    if (kind === 'binary') {
      const sent = new Headers()
      sent.set('content-type', contentType || 'application/octet-stream')
      sent.set('cache-control', 'public, max-age=3600')
      for (const key of ['content-length', 'content-range', 'accept-ranges']) {
        const value = upstream.headers.get(key)
        if (value) sent.set(key, value)
      }
      return new Response(upstream.body, { status, headers: sent })
    }

    let body = await upstream.text()
    if (kind === 'html') body = toOurBrand(toOwnPaths(body, origin))
    else if (kind === 'playlist') body = await rewritePlaylist(body, upstream.url || target)
    else if (kind === 'json') {
      const swapped = await swapLiveAddress(body, url.pathname, url.search)
      body = await toSafeUrls(NATIONAL_REQUEST.test(url.pathname) ? withNationalGroup(swapped) : swapped, upstream.url || target, origin)
    }
    else if (/geil\.(to|app|win)/i.test(body)) body = toOwnPaths(body, origin)

    // kabuk ilk kez acildiginda liste arka planda hazirlansin: ilk kanal 3 saniye beklemesin.
    if (kind === 'html') ctx.waitUntil(loadLiveTable().then(() => undefined, () => undefined))

    /* Kenarda saklanacak yanit: giysiler 30 gun, katalog JSON'lari 3 saat,
       rehber tasidiyi icin canli liste 60 saniye. Sayfa kabugu ve oynatilacak
       adresin ciktigi yollar no-store kalir. SAGLAYICI HATA VERDIYSE hicbir sey
       saklanmaz — aksine gecici bir 404 kenere yazilirsa abone 3 saat boyunca
       "kanal yok" gorur ve worker bir daha gercegi sormaz. */
    const edgeTtl = upstream.ok
      ? (isStatic ? 2592000 : (kind === 'json' ? edgeTtlFor(url.pathname) : 0))
      : 0
    const cacheControl = edgeTtl
      ? `public, max-age=${edgeTtl}${isStatic ? ', immutable' : ''}`
      : 'no-store'
    const response = new Response(request.method === 'HEAD' ? null : body, {
      status,
      headers: { 'content-type': contentType || fallbackType, 'cache-control': cacheControl },
    })
    if (mayCache && edgeTtl && upstream.ok && request.method === 'GET') ctx.waitUntil(edge.put(cacheKey, response.clone()))
    return response
  },
}
