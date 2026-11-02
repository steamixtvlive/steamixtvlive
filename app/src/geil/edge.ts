// Markalı ayna iki yerde duruyor: kullanıcının kendi Cloudflare hesabındaki worker'da (varsayılan)
// ve Render'in kendi yolunda (/api/geil/site/). Worker varsayılan çünkü video tarayıcıyı doğrudan
// kanal listesinden çekiyor; Render'ın ~5 GB aylik kotası ancak canlı kanallar oradan geçerse doluyor.
// Render yoluna dönmek için VITE_GEIL_EDGE_URL değişkenine "render" yazılır; başka bir adres
// yazılırsa ayna oradan açılır.
const WORKER_URL = 'https://notflix-proxy.steamixtvlive.workers.dev'
const configured = (import.meta.env.VITE_GEIL_EDGE_URL || '').trim().replace(/\/+$/, '')
const EDGE = configured === 'render' ? '' : (configured || WORKER_URL)

export const SITE_URL = EDGE ? `${EDGE}/` : '/api/geil/site/'
export const ACTIVATE_URL = EDGE ? `${EDGE}/__activate` : '/api/geil/site/__activate'

// Çerçevenin kökeni: postMessage'i yalnızca kendi aynamızdan gelen sinyale açmak için gerekiyor.
// Render yolunda çerçeve uygulamayla aynı kökeni paylaşır, o yüzden orada kendi adresimiz yazılır.
export const SITE_ORIGIN = EDGE || window.location.origin
