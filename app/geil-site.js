import { Readable } from 'node:stream'

import { GEIL, UA, applyLiveAddress, ownLiveAddress, proxyUrl, rewritePlaylist, signPayload, verifyPayload, warmLiveTable } from './geil-api.js'

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
 * Our mark, planted in the corner theirs stood. The flame and the old word are hidden and a script
 * puts our three lines and our name into that same slot: narrow bar, only the three lines; opened
 * bar, our name beside them.
 */
const BRAND_HIDE = 'a.sidebar-brand .brand-icon,a.sidebar-brand .brand-text,#app img[src*="fire-element"]'

/** Our own N mark, inlined so the frame never has to ask their server for a picture of a flame. */
const OUR_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' rx='13' fill='%23D90007'/%3E%3Cpath d='M16 33V15l16 18V15' stroke='%23fff' stroke-width='4.2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"

const BRAND_FONT = "@font-face{font-family:'Bebas Neue';font-style:normal;font-weight:400;font-display:swap;src:url(data:font/woff2;base64,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) format('woff2')}";

/* The splash draws the name in Bebas Neue with a hairline stroke and its own red bloom; the frame
   has never heard of that font, so the letters have to be fetched here too or they fall back to a
   plain narrow Arial and the mark stops being ours. */
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
  + '.nf-load__credit{position:absolute;left:50%;transform:translateX(-50%);bottom:max(20px,env(safe-area-inset-bottom));font-size:9.5px;font-weight:600;letter-spacing:.44em;white-space:nowrap;color:rgba(255,255,255,.32)}'
  + '.nf-load__skip{display:none;position:absolute;bottom:max(20px,env(safe-area-inset-bottom));right:max(18px,env(safe-area-inset-right));padding:9px 18px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(255,255,255,.05);color:rgba(255,255,255,.72);font-size:11px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;cursor:pointer}'
  + '.nf-load__skip.is-on{display:block}.nf-load__skip:hover,.nf-load__skip:focus{color:#fff;border-color:rgba(255,255,255,.34);outline:none}'
  + '@media (prefers-reduced-motion:reduce){.nf-load__word u,.nf-load__hint{animation:none}.nf-load__bloom{animation:none;opacity:.9}.nf-load__bar{animation:none;opacity:0}.nf-load__rail-run{animation:none;width:100%;opacity:.75}}'
  + '</style>'

const BRAND_SCRIPT = '<script>(function(){'
  // The player asks for subtitle files without credentials; our activation door then
  // answers with its own HTML page and the subtitle silently ends up empty. Put the
  // cookie back on requests that go to our own address only.
  + 'var OF=window.fetch;if(OF){window.fetch=function(i,x){try{var s=(i&&i.url)?String(i.url):String(i);if(new URL(s,location.href).origin===location.origin){x=Object.assign({},x,{credentials:"include"})}}catch(e){}return OF.call(window,i,x)}}'
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
  + 'function hard(){var v=document.getElementsByTagName("video");'
  + 'for(var i=0;i<v.length;i++){var x=v[i];if(x.nfLock)continue;x.nfLock=1;'
  + 'x.setAttribute("controlsList","nodownload noplaybackrate");x.setAttribute("disablePictureInPicture","");'
  + 'x.setAttribute("disableRemotePlayback","");'
  + 'x.addEventListener("contextmenu",function(e){e.preventDefault()},true)}}'
  /* Her sayfa yenilemede kimlik sahnesi: boyanabilecek ilk sey olsun diye body daha ilk
     satirinda kurulur. Uygulamanin kendi penceresinin icinde susar, orada zaten kendi
     splash'inin altindadir; cift sahne olmaz. Hareket istemeyen tarayici hiç beklemez. */
  + 'var EP="/api/geil/site/__activate",KEY="nf_key",SEEN="nf_splash_seen",LOST="nf_grant_lost",LINE_MS=2600,SPLASH_MS=10400,'
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
  + '<button type="button" class="nf-load__skip">Atla</button><div class="nf-load__credit">RENDİR MEDİA</div>\';'
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

/* ------------------------------------------------------ aktivasyon kapisi --- */

/* MUSTERIYE VERDIGIN TEK KOD. Degistirmek icin yalnizca bu satiri yaz; yeni kod buraya
   girdigin an eskisi olu. Kod bu dosyada durur ve tarayiciya hic gitmez — tarayici
   yalnizca "tamam / hatali" sonucunu gorur, sayfagi kimse okuyamaz. */
const ACT_CODE = 'FNNXZ62Z'
const ACTIVATE = '/__activate'
const ACT_COOKIE = 'nf_access'
const GRANT_TTL = 400 * 24 * 60 * 60 * 1000 /* tarayicilar 400 gunden uzun yasayan cooki'yi saklamayi reddeder */
const MAX_TRIES = 8 /* ayni IP art arda sekiz kez yanlis yazarsa yarim saat kapida bekler */
const COOLDOWN = 30 * 60 * 1000

/** Bos bir tarayici ile kodu girmis tarayici arasindaki tek fark: bu imzali belge. */
function makeGrant() {
  return signPayload({ a: 1, exp: Date.now() + GRANT_TTL })
}

function grantValid(token) {
  if (!token) return false
  const payload = verifyPayload(token)
  return !!payload && payload.a === 1 && (!payload.exp || payload.exp > Date.now())
}

function normalizeCode(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase()
}

function cookieValue(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
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
   Lax'a iniyor, yoksa tarayici cooki'yi sessizce cuba atardi. */
function isSecure(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  return proto ? proto === 'https' : !!req.socket.encrypted
}

function grantCookie(token, req) {
  return `${ACT_COOKIE}=${token}; Path=/; Max-Age=${Math.floor(GRANT_TTL / 1000)}; HttpOnly; ${isSecure(req) ? 'SameSite=None; Secure' : 'SameSite=Lax'}`
}

/* Veriler temizlendiğinde izin belgesi de silinir: belge sunucuda durduğu için sayfayı
   yenilemek yetmez, tarayıcıya "bu çerez artık yok" demek gerekir. */
function revokeCookie(req) {
  return `${ACT_COOKIE}=; Path=/; Max-Age=0; HttpOnly; ${isSecure(req) ? 'SameSite=None; Secure' : 'SameSite=Lax'}`
}

/* Deneme sayaci bellekte, yani her sunucu adasi kendi sayar: amaci kodu saniyede bin
   kez deneyerek bulmayi bosuna zorlastirmak, hesap kilidini musterinin üzerine yikmak degil. */
const attempts = new Map()

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'bilinmeyen'
}

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

function sendJson(res, status, data, cookie) {
  const body = JSON.stringify(data)
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body) }
  if (cookie) headers['set-cookie'] = cookie
  res.writeHead(status, headers)
  res.end(body)
}

async function activate(req, res) {
  let body = {}
  try {
    body = JSON.parse(String((await readBody(req)) || '') || '{}')
  } catch {
    body = {}
  }
  const ip = clientIp(req)
  if (coolingDown(ip)) {
    sendJson(res, 429, { ok: false, error: 'Çok fazla deneme yaptın. Yarım saat sonra tekrar dene.' })
    return
  }

  /* Tarayici verisi temizlendiginde ayni istek belgeyi de cubaya atar: kapi bir daha sorulur. */
  if (body.x === 1) {
    sendJson(res, 200, { ok: true }, revokeCookie(req))
    return
  }

  /* Tarayici verisi temizlenmeden cooki de silinirse (ozel mod, tarayici degisimi)
     hafizadaki belge geri getirilir; kod bir daha sorulmaz. */
  const savedToken = String(body.k || '')
  if (savedToken) {
    if (grantValid(savedToken)) {
      sendJson(res, 200, { ok: true }, grantCookie(savedToken, req))
    } else {
      sendJson(res, 403, { ok: false, error: 'Kayıtlı kod artık geçersiz.' })
    }
    return
  }

  if (normalizeCode(body.c) !== normalizeCode(ACT_CODE)) {
    noteFailure(ip)
    sendJson(res, 403, { ok: false, error: 'Aktivasyon kodu hatalı.' })
    return
  }
  attempts.delete(ip)
  const token = makeGrant()
  sendJson(res, 200, { ok: true, key: token }, grantCookie(token, req))
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
.nf-load__credit{position:absolute;left:50%;transform:translateX(-50%);bottom:max(20px,env(safe-area-inset-bottom));font-size:9.5px;font-weight:600;letter-spacing:.44em;white-space:nowrap;color:rgba(255,255,255,.32)}
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
<div class="nf-load__credit">RENDİR MEDİA</div>
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

function sendGate(res, isHead) {
  if (isHead) sendEmpty(res, 200, 'text/html; charset=utf-8', 'no-store')
  else sendBody(res, 200, GATE_HTML, 'text/html; charset=utf-8', 'no-store')
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
      // The provider's own https address (a subtitle file, for instance) would be a
      // cross-origin request with no CORS header on the answer; through the mirror it
      // is same-origin and the player stops failing.
      if (/^https?:\/\/(?:(?:www\.)?geil\.to|(?:www\.)?geil\.app|(?:www\.)?geil\.win)(?::\d+)?(?:[/?]|$)/i.test(absolute)) {
        const own = new URL(absolute)
        return PREFIX + own.pathname + own.search
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

function rewriteBody(kind, text, baseUrl, liveAddress = '') {
  if (kind === 'playlist') return rewritePlaylist(text, baseUrl, {})
  if (kind === 'json') return toSafeUrls(toMirrorPaths(applyLiveAddress(text, liveAddress)), baseUrl)
  if (kind === 'html') return toOurBrand(toMirrorMount(toMirrorPaths(text)))
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

    // Tek POST kapisi: kod buradan gecer, baska hicbir yol yazili istek kabul etmez.
    if (rest === ACTIVATE) {
      if (req.method !== 'POST') sendEmpty(res, 405, 'text/plain; charset=utf-8', 'no-store')
      else await activate(req, res)
      return
    }

    const granted = grantValid(cookieValue(req, ACT_COOKIE))

    // The player is handed these by name from the catalogue; answer with a redirect to
    // the signed media proxy so the insecure hop never reaches the browser. Our own list
    // already speaks https, so when the channel is in it the browser may go there itself.
    if (/^\/(live|vod)\/play\//i.test(rest)) {
      if (!granted) {
        sendBody(res, 403, 'Aktivasyon gerekiyor', 'text/plain; charset=utf-8', 'no-store')
        return
      }
      const own = await ownLiveAddress(rest, '')
      if (own) {
        res.writeHead(302, { location: own, 'cache-control': 'no-store' })
        res.end()
        return
      }
      res.writeHead(302, { location: proxyUrl(`${GEIL}${rest}${reqUrl.search}`, {}), 'cache-control': 'no-store' })
      res.end()
      return
    }

    /* Sayfa mi dosya mi, yukariya sormadan anlasilir: uzantisi olmayan her adres bir
       ekrandir. Kodsuz tarayici ekran yerine kapiyi gorur, dosyalar ise acik kalir
       (kapinin kendi giyimi de onlardan biri). */
    if (!granted && !/\.[a-z0-9]{2,5}$/i.test(rest)) {
      sendGate(res, isHead)
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
    const liveAddress = kind === 'json' ? await ownLiveAddress(rest, reqUrl.search) : ''
    const rewritten = rewriteBody(kind, text, upstream.url || target, liveAddress)
    if (kind === 'html') warmLiveTable()
    const cacheControl = kind === 'playlist' || kind === 'json'
      ? 'no-store, max-age=0'
      : isStatic ? 'public, max-age=86400' : 'no-store'
    const fallbackType = kind === 'json' ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8'
    if (isStatic && upstream.ok) remember(cacheKey, { body: rewritten, contentType: contentType || fallbackType }, Buffer.byteLength(rewritten), STATIC_TTL)
    sendBody(res, status, rewritten, contentType || fallbackType, cacheControl)
  }
}
