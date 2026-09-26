import { useEffect, useRef, useState } from 'react'
import { ShoppingCart, Check, Mail, CreditCard, PlayCircle, Trophy, Clapperboard, Tv, MonitorPlay, Smartphone, Download, Gamepad2, Wifi, X, Menu, AlertTriangle, Gauge, Star, MessageCircleQuestion } from 'lucide-react'
import AnimatedBackground from '@/sections/AnimatedBackground'
import RendirBadge from '@/sections/RendirBadge'

const APK_URL = 'https://www.dropbox.com/scl/fi/ea03ji1fcyfbyfwa36qmg/SteamixTV_v1.0.45_release.apk?rlkey=vq913dphoasqera46s9oqlgqf&st=bo3ywj8i&dl=1'
const MOBIL_APK_URL = 'https://www.dropbox.com/scl/fi/ea03ji1fcyfbyfwa36qmg/SteamixTV_v1.0.45_release.apk?rlkey=vq913dphoasqera46s9oqlgqf&st=bo3ywj8i&dl=1'

function mobilMi() {
  try {
    return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
  } catch {
    return false
  }
}

const PLANS = [
  { name: '1 AYLIK', price: '300 TL', perMonth: 'ayda 300 TL', link: 'https://www.shopier.com/platool/49623989', features: ['Yüzlerce canlı kanal', 'Yüzlerce film & dizi arşivi', '4K çözünürlük', '3 cihaz desteği', 'Hızlı aktivasyon', '7/24 destek'] },
  { name: '3 AYLIK', price: '600 TL', perMonth: 'ayda sadece 200 TL', link: 'https://www.shopier.com/platool/49624003', popular: true, features: ['Yüzlerce canlı kanal', 'Yüzlerce film & dizi arşivi', '4K çözünürlük', '3 cihaz desteği', 'Hızlı kurulum desteği', '7/24 destek', 'En Popüler Seçim'] },
  { name: '12 AYLIK', price: '1.200 TL', perMonth: 'ayda sadece 100 TL', link: 'https://www.shopier.com/platool/49624023', features: ['Yüzlerce canlı kanal', 'Yüzlerce film & dizi arşivi', '4K çözünürlük', '3 cihaz desteği', 'Yıllık fiyat avantajı', 'Öncelikli destek', 'Hızlı aktivasyon', '7/24 destek'] },
]

const POSTERS = ['poster01.jpg', 'poster02.jpg', 'poster03.jpg', 'poster04.jpg', 'poster05.jpg', 'poster06.jpg', 'poster07.jpg', 'poster08.jpg', 'poster10.jpg', 'poster11.jpg', 'poster12.jpg', 'poster13.jpg']

function PlanKarti({ p, onSec }: { p: typeof PLANS[0]; onSec: (p: typeof PLANS[0]) => void }) {
  return (
    <div className={`relative rounded-2xl p-4 border transition-all duration-300 hover:-translate-y-1 flex flex-col ${p.popular ? 'border-[#0099ff]/60 bg-gradient-to-b from-[#0099ff]/[0.14] to-[#0099ff]/[0.02] shadow-[0_0_45px_rgba(0,153,255,0.18)]' : 'border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] hover:border-white/25 hover:shadow-[0_0_30px_rgba(0,153,255,0.1)]'}`}>
      <div className={`absolute top-0 inset-x-0 h-1 rounded-t-2xl ${p.popular ? 'bg-gradient-to-r from-[#0099ff] via-blue-400 to-purple-500' : 'bg-gradient-to-r from-white/15 to-white/5'}`} />
      {p.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-[#0099ff] to-purple-500 text-white text-[10px] font-bold tracking-wide whitespace-nowrap shadow-lg shadow-[#0099ff]/40 ring-2 ring-[#0099ff]/20">
          En Popüler
        </div>
      )}
      <div className="text-center mb-3 mt-1">
        <p className="text-[10px] font-semibold text-gray-400 tracking-[0.25em] uppercase mb-1.5">{p.name}</p>
        <div className="text-3xl font-extrabold bg-gradient-to-r from-[#0099ff] to-purple-400 bg-clip-text text-transparent mb-0.5 drop-shadow-[0_0_15px_rgba(0,153,255,0.35)]">{p.price}</div>
        <p className="text-[10px] text-gray-500">{p.perMonth}</p>
      </div>
      <div className="h-px bg-white/10 mb-3" />
      <ul className="space-y-1.5 mb-4 flex-1">
        {p.features.map((f, i) => (
          <li key={i} className="flex items-center gap-2 text-[11px] text-gray-300">
            <span className="w-3.5 h-3.5 rounded-full bg-[#0099ff]/15 flex items-center justify-center shrink-0">
              <Check className="w-2 h-2 text-[#0099ff]" />
            </span>{f}
          </li>
        ))}
      </ul>
      <button onClick={() => onSec(p)}
        className="block w-full py-2.5 rounded-xl bg-gradient-to-r from-[#0099ff] via-blue-500 to-purple-600 text-white font-bold text-xs tracking-wide text-center hover:shadow-[0_0_25px_rgba(0,153,255,0.5)] hover:scale-[1.02] active:scale-[0.97] transition-all flex items-center justify-center gap-2">
        <ShoppingCart className="w-4 h-4" />Satın Al
      </button>
    </div>
  )
}

const TESTLER = [
  {
    id: '3saat', etiket: 'Hızlı başlangıç', ad: '3 Saatlik Ücretsiz Test', fiyat: '0 TL', sure: '/ 3 saat',
    aciklama: 'Steamix TV ile ilk kez tanışanlar için ücretsiz hızlı deneme seçeneğidir.',
    ozellikler: ['3 saatlik erişim süresi', 'Görüntü ve ses kontrolü', 'Cihaz uyumluluğu denemesi', 'Kurulum desteği'],
    buton: 'Ücretsiz Test İste',
    konu: '3 Saatlik Ücretsiz Test İstiyorum',
    govde: 'Merhaba, 3 saatlik ücretsiz test yayını istiyorum.\nCihazım: ',
  },
  {
    id: '12saat', etiket: 'Kısa deneme', ad: '12 Saatlik Ücretsiz Test', fiyat: '0 TL', sure: '/ 12 saat',
    aciklama: 'Yarım gün boyunca farklı saatlerde yayını denemek isteyenler için ücretsiz seçenektir.',
    ozellikler: ['12 saatlik erişim süresi', 'Sabah ve akşam kontrolü', 'Kanal geçiş hızı denemesi', 'Kurulum desteği'],
    buton: 'Ücretsiz Test İste',
    konu: '12 Saatlik Ücretsiz Test İstiyorum',
    govde: 'Merhaba, 12 saatlik ücretsiz test yayını istiyorum.\nCihazım: ',
  },
  {
    id: '24saat', etiket: 'Tüm saatlerde dene', ad: '24 Saatlik Ücretsiz Test', fiyat: '0 TL', sure: '/ 24 saat',
    aciklama: 'Normal paketi ilk kez kendi cihazında denemek isteyenler için ücretsiz başlangıç seçeneğidir.',
    ozellikler: ['Normal paket testi', 'Görüntü ve ses kontrolü', 'Cihaz uyumluluğu denemesi', 'Kurulum desteği'],
    buton: 'Ücretsiz Test İste',
    konu: '24 Saatlik Ücretsiz Test İstiyorum',
    govde: 'Merhaba, 24 saatlik ücretsiz test yayını istiyorum.\nCihazım: ',
  },
  {
    id: '7gun', etiket: 'Özel VIP deneyimi', ad: '7 Günlük VIP Strong Test', fiyat: '250 TL', sure: '/ 7 gün', vip: true,
    aciklama: 'VIP Strong altyapısını bir hafta boyunca farklı gün ve saatlerde ayrıntılı şekilde değerlendirmek isteyenler için özel test seçeneğidir.',
    ozellikler: ['7 günlük VIP Strong deneyimi', 'Yoğun saatlerde uzun süreli kontrol', 'Geniş kullanım senaryosu', 'Kurulum sırasında hızlı destek'],
    buton: 'VIP Strong Test İste',
    konu: '7 Günlük VIP Strong Test İstiyorum',
    govde: 'Merhaba, 7 günlük VIP Strong test yayını istiyorum.\nCihazım: ',
  },
]

const STATS = [
  { icon: Tv, value: 5000, suffix: '+', label: 'Canlı TV Kanalı' },
  { icon: Clapperboard, value: 20000, suffix: '+', label: 'Film & Dizi Arşivi' },
  { icon: MonitorPlay, value: 100, suffix: '%', label: '4K Maç Keyfi' },
  { icon: Wifi, value: 24, suffix: '/7', label: 'Kesintisiz Yayın' },
]

const YORUMLAR = [
  { ad: 'Murat A.', yer: '🇩🇪 Berlin, Almanya', yazi: "Almanya'da 10 yıldır yaşıyorum, Türk kanallarını bu kadar net hiç izleyememiştim. TRT, Show, ATV, Star TV hepsi mükemmel geliyor. Fiyat da gayet makul, tavsiye ederim." },
  { ad: 'Zeynep D.', yer: '🇹🇷 İstanbul, Türkiye', yazi: "Önce 1 aylığına denedim, beğenince 3 aylığa geçtim. Hem canlı hem arşiv var. Yıllığa da geçmeyi düşünüyorum, içerik gerçekten çok zengin." },
  { ad: 'Hakan Y.', yer: '🇳🇱 Rotterdam, Hollanda', yazi: "Kurulum 10 dakika sürdü, destek gece 2'de bile anında yanıtladı. Hollanda'dan Süper Lig'i 4K izliyorum. Daha önce kullandıklarımın çok ötesinde." },
  { ad: 'Serkan T.', yer: '🇩🇪 Frankfurt, Almanya', yazi: "Şampiyonlar Ligi maçlarını artık çanak anten olmadan izliyorum. Spor kanallarının hepsi var ve hiç donmuyor. Gerçekten çok iyi bir hizmet." },
  { ad: 'Ayşe N.', yer: '🇹🇷 Ankara, Türkiye', yazi: "Samsung Smart TV'ye uygulamayı indirip giriş yaptım, oldu bitti. Eşim de çocuklar da çok memnun. Çizgi filmler, haberler, diziler — her şey var." },
  { ad: 'Burak E.', yer: '🇫🇷 Paris, Fransa', yazi: "Paris'ten alıyorum, Avrupa paketi çok iyi. Hem Türk kanalları hem Fransız kanalları var. Fiyat makul, arkadaşlarıma da önerdim." },
  { ad: 'Elif R.', yer: '🇹🇷 İzmir, Türkiye', yazi: "Dizi hastasıyım ve yerli dizilerin tamamını anlık takip ediyorum. Canlı yayınların yanında arşiv de var, kaçırdığım bölümleri sonradan izleyebiliyorum." },
  { ad: 'Kadir Y.', yer: '🇧🇪 Brüksel, Belçika', yazi: "Belçika'da 4 kişilik aileyiz, herkesin farklı zevki var. Çocuklar çizgi film, eşim dizi, ben futbol — hepsini aynı abonelikle izliyoruz." },
  { ad: 'Selin U.', yer: '🇩🇪 Münih, Almanya', yazi: "4K'yı test etmek için önce ücretsiz deneme aldım, kalite gerçekten çok iyi. Hemen yıllık pakete geçtim, pişman değilim." },
  { ad: 'Emre O.', yer: '🇹🇷 Bursa, Türkiye', yazi: "Bir sorun yaşadım, yazdım, 10 dakika içinde çözüldü. Bu kadar hızlı destek beklemiyordum. Teknik bilgisi olmayan biri bile rahatlıkla kullanabilir." },
  { ad: 'Özlem P.', yer: '🇳🇱 Amsterdam, Hollanda', yazi: "Diğer platformları iptal ettim, bu abonelikle devam ediyorum. İkisinden ucuz ve Türkçe kanal arşivi çok daha geniş. Tavsiye ederim." },
  { ad: 'Deniz V.', yer: '🇹🇷 Antalya, Türkiye', yazi: "Mobilde de çok iyi çalışıyor. Telefona uygulamayı kurdum, dışarıda maç izledim. Eve döndükten sonra TV'den devam ettim." },
]

const SSS = [
  { s: 'Aboneliği nasıl satın alırım?', c: 'Paketler bölümünden size uygun planın Satın Al butonuna basın, Shopier üzerinden ödemeyi tamamlayın ve ekran görüntüsünü mail adresimize gönderin. Onay sonrası giriş bilgileriniz en kısa sürede teslim edilir.' },
  { s: 'Kurulum zor mu, kaç dakika sürer?', c: 'Hayır. Uygulamayı indirip size gönderilen giriş bilgileriyle oturum açmanız yeterli. Ortalama 10 dakikada rutin bir kurulum ile izlemeye başlarsınız, takıldığınız yerde 7/24 destek yanınızda.' },
  { s: 'Hangi cihazlarda çalışır?', c: 'Android telefon, tablet, Smart TV, TV Box, Windows Bluestacks emülatör gibi cihazlarda çalışır. En az 100 Mbps internet ve donanımı iyi güncel bir cihaz önerilir.' },
  { s: 'Yayınlar donuyor mu?', c: 'Sunucumuz 4K kapasitelidir ve donanımınıza uygun çözünürlükteki kanalı seçtiğinizde takılma yaşamazsınız. Kanallar çözünürlüğe göre sınıflandırılmıştır.' },
  { s: 'Test yayını var mı?', c: 'Evet. 3 saatlik, 12 saatlik ve 24 saatlik ücretsiz test seçenekleri ile 7 günlük VIP test mevcuttur. Test bölümünden talebinizi iletebilirsiniz.' },
  { s: 'Ödeme güvenli mi?', c: 'Ödemeler Shopier altyapısıyla alınır, kart bilgileriniz bize ulaşmaz. Dekontu mail ile iletmeniz yeterlidir.' },
  { s: 'Aboneliğimi nasıl yenilerim?', c: 'Siteye gidip Paketleri İncele seçeneğine tıklayarak yeni dönem planınızı seçip aynı adımlarla yenileyebilirsiniz.' },
]

const KANALLAR = ['beIN Sports 1', 'TRT 1', 'TV8 HD', 'ATV', 'S Sport 1', 'Tabii Spor 1', 'TLC', 'NTV']
const FILMLER = ['Aksiyon', 'Komedi', 'Dram', 'Korku', 'Bilim Kurgu', 'Animasyon', 'Yerli', 'Romantik']

function Counter({ value, suffix }: { value: number; suffix: string }) {
  const [n, setN] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !started.current) {
        started.current = true
        const t0 = performance.now()
        const dur = 1800
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / dur)
          setN(Math.floor(value * (1 - Math.pow(1 - p, 3))))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
        obs.disconnect()
      }
    }, { threshold: 0.3 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [value])
  return <span ref={ref}>{n.toLocaleString('tr-TR')}{suffix}</span>
}

function MiniEkran({ kucuk = false }: { kucuk?: boolean }) {
  const items = kucuk ? KANALLAR.slice(0, 4) : KANALLAR
  return (
    <div className="absolute inset-0">
      {/* Ekran 1: kanallar */}
      <div className="absolute inset-0 p-2" style={{ animation: 'ekranDon 12s ease-in-out infinite' }}>
        <div className="flex items-center gap-1 mb-1.5">
          <span className="text-[7px] font-bold text-white bg-[#0099ff] rounded px-1 py-0.5">CANLI TV</span>
          <span className="text-[7px] font-bold text-gray-500 bg-white/10 rounded px-1 py-0.5">FİLMLER</span>
          <span className="text-[7px] font-bold text-gray-500 bg-white/10 rounded px-1 py-0.5">DİZİLER</span>
        </div>
        <div className="space-y-1">
          {items.map((k, i) => (
            <div key={k} className={`flex items-center gap-1.5 rounded px-1.5 ${kucuk ? 'py-1' : 'py-1.5'} ${i === 1 ? 'bg-[#0099ff]/30 border border-[#0099ff]/50' : 'bg-white/5'}`}>
              <div className={`rounded ${kucuk ? 'w-5 h-3.5' : 'w-8 h-5'} bg-gradient-to-br ${i % 3 === 0 ? 'from-[#0099ff] to-blue-700' : i % 3 === 1 ? 'from-purple-500 to-purple-800' : 'from-emerald-500 to-emerald-800'}`} />
              <span className={`${kucuk ? 'text-[7px]' : 'text-[10px]'} text-gray-200 font-medium truncate`}>{k}</span>
              {i === 1 && <PlayCircle className={`${kucuk ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} text-[#0099ff] ml-auto shrink-0`} />}
            </div>
          ))}
        </div>
      </div>
      {/* Ekran 2: filmler */}
      <div className="absolute inset-0 p-2" style={{ animation: 'ekranDon 12s ease-in-out infinite', animationDelay: '4s', opacity: 0 }}>
        <div className="flex items-center gap-1 mb-1.5">
          <span className="text-[7px] font-bold text-gray-500 bg-white/10 rounded px-1 py-0.5">CANLI TV</span>
          <span className="text-[7px] font-bold text-white bg-[#0099ff] rounded px-1 py-0.5">FİLMLER</span>
          <span className="text-[7px] font-bold text-gray-500 bg-white/10 rounded px-1 py-0.5">DİZİLER</span>
        </div>
        <div className={`grid ${kucuk ? 'grid-cols-3' : 'grid-cols-4'} gap-1`}>
          {FILMLER.slice(0, kucuk ? 6 : 8).map((f, i) => (
            <div key={f} className={`rounded bg-gradient-to-br ${i % 4 === 0 ? 'from-rose-600 to-rose-900' : i % 4 === 1 ? 'from-amber-500 to-orange-800' : i % 4 === 2 ? 'from-cyan-500 to-blue-800' : 'from-violet-500 to-purple-800'} ${kucuk ? 'h-9' : 'h-14'} flex items-end p-1`}>
              <span className={`${kucuk ? 'text-[6px]' : 'text-[8px]'} text-white font-semibold`}>{f}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Ekran 3: maç */}
      <div className="absolute inset-0" style={{ animation: 'ekranDon 12s ease-in-out infinite', animationDelay: '8s', opacity: 0 }}>
        <img src="/images/login.jpg" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" style={{ animation: 'livePulse 1.5s ease-in-out infinite' }} />
          <span className={`${kucuk ? 'text-[7px]' : 'text-[9px]'} text-white font-bold tracking-widest`}>CANLI MAÇ</span>
        </div>
        <div className="absolute bottom-1.5 inset-x-1.5">
          <div className="flex justify-between text-[8px] text-white font-bold mb-0.5"><span>GS 2 - 1 FB</span><span>78'</span></div>
          <div className="h-1 rounded bg-white/20 overflow-hidden"><div className="h-full w-3/4 bg-gradient-to-r from-[#0099ff] to-purple-500" /></div>
        </div>
      </div>
    </div>
  )
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [seciliPlan, setSeciliPlan] = useState<typeof PLANS[0] | null>(null)
  const [seciliTest, setSeciliTest] = useState<typeof TESTLER[0] | null>(null)
  const [planSlide, setPlanSlide] = useState(0)
  const planTrackRef = useRef<HTMLDivElement>(null)

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col relative overflow-hidden">
      <AnimatedBackground />
      {/* Işıklı status barı */}
      <div className="fixed top-0 inset-x-0 z-50 h-[3px] bg-white/5 overflow-hidden">
        <style>{`@keyframes statusSweep { 0% { transform: translateX(-100%) } 100% { transform: translateX(400%) } }`}</style>
        <div className="h-full w-1/4 bg-gradient-to-r from-transparent via-[#0099ff] to-purple-500 shadow-[0_0_15px_rgba(0,153,255,0.9)]" style={{ animation: 'statusSweep 3s linear infinite' }} />
      </div>
      <div className="absolute inset-0 overflow-hidden">
        <style>{`@keyframes slowPanRight { 0% { transform: translateX(-150px) } 50% { transform: translateX(150px) } 100% { transform: translateX(-150px) } }
        @keyframes marquee { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }
        @keyframes floatGlow { 0%,100% { opacity: 0.5 } 50% { opacity: 1 } }
        @keyframes livePulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }
        @keyframes scanMove { 0% { top: -10% } 100% { top: 110% } }
        @keyframes ekranDon { 0%,28% { opacity: 1 } 33%,94% { opacity: 0 } 100% { opacity: 1 } }
        @keyframes dokunma { 0%,100% { transform: translate(0,0) scale(1); opacity: 0.8 } 25% { transform: translate(14px,10px) scale(0.9); opacity: 1 } 50% { transform: translate(-10px,16px) scale(0.9); opacity: 1 } 75% { transform: translate(6px,-8px) scale(1); opacity: 0.8 } }
        @keyframes kumandaBas { 0%,100% { transform: translateY(0) } 10%,30% { transform: translateY(-6px) rotate(-4deg) } 40%,60% { transform: translateY(0) } 70%,90% { transform: translateY(-6px) rotate(4deg) } }
        @keyframes paketVurgu { 0%,100% { box-shadow: 0 0 8px rgba(0,153,255,0.35) } 50% { box-shadow: 0 0 26px rgba(0,153,255,0.8), 0 0 46px rgba(168,85,247,0.35) } }`}</style>
        <div className="absolute" style={{
          top: '-165px', bottom: '-165px', left: '-165px', right: '-165px',
          backgroundImage: 'url(/images/login.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'brightness(0.5) blur(1px)',
          animation: 'slowPanRight 60s ease-in-out infinite',
        }} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/70" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-[#0099ff]/10 rounded-full blur-[150px]" />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Navigasyon */}
      <nav className="sticky top-[3px] z-40 backdrop-blur-md bg-black/50 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <a href="#top" className="flex items-center gap-2">
            <img src="/images/steamix-logo.jpg" alt="" className="w-8 h-8 rounded-lg" />
            <span className="text-base md:text-lg font-bold text-white tracking-wider" style={{ fontFamily: 'Orbitron, sans-serif' }}>Steamix <span className="text-[#0099ff]">TV</span></span>
            <RendirBadge />
          </a>
          <div className="hidden md:flex items-center gap-1 text-sm">
            <a href="#test" className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all">Test</a>
            <a href="#cihazlar" className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all">Cihazlar</a>
            <a href="#icerik" className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all">İçerik</a>
            <a href="#uygulama" className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all">Uygulama</a>
            <button onClick={() => { setPlanSlide(0); setPlanModal(true) }} className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all" style={{ animation: 'paketVurgu 2.2s ease-in-out infinite' }}>Paketleri İncele</button>
            <a href="#test" className="ml-2 px-4 py-1.5 rounded-lg text-sm text-white bg-gradient-to-r from-[#0099ff] to-blue-600 hover:shadow-[0_0_20px_rgba(0,153,255,0.5)] transition-all">Test Al</a>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-gray-300">
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-white/10 bg-black/70 px-4 py-3 space-y-1 text-sm">
            {[['Test', '#test'], ['Cihazlar', '#cihazlar'], ['İçerik', '#icerik'], ['Uygulama', '#uygulama']].map(([t, h]) => (
              <a key={h} href={h} onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/5">{t}</a>
            ))}
            <button onClick={() => { setMenuOpen(false); setPlanSlide(0); setPlanModal(true) }} className="block w-full text-left px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/5" style={{ animation: 'paketVurgu 2.2s ease-in-out infinite' }}>Paketleri İncele</button>
          </div>
        )}
      </nav>

      {/* Hero */}
      <div id="top" className="relative z-10 flex-1 flex items-center px-4 md:px-12 py-10 md:py-14">
        <div className="w-full flex flex-col md:flex-row items-center gap-10 md:gap-14 max-w-6xl mx-auto">
          <div className="flex-1 text-center md:text-left">
        <div className="inline-flex items-center gap-2 mb-5 px-4 py-1.5 rounded-full bg-[#0099ff]/10 border border-[#0099ff]/30">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-gray-300 tracking-widest uppercase">Canlı • Yüzlerce Kanal • Yüzlerce Film & Dizi</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          Steamix <span className="text-[#0099ff]">TV</span>
        </h1>
        <p className="text-lg md:text-2xl text-gray-300 leading-relaxed font-light">
          Sınırsız eğlence, kesintisiz keyif.
        </p>
        <p className="text-sm md:text-base text-gray-400 mt-3 leading-relaxed max-w-xl mx-auto md:mx-0">
          Süper Lig dahil dünyadan tüm kanalları izleyeceksiniz. 4K Ultra HD kalitesinde
          binlerce film, dizi ve VOD içeriği. Dilediğin zaman, dilediğin yerde izle.
        </p>
          <div className="flex items-center justify-center md:justify-start gap-4 mt-8">
            <button onClick={() => { setPlanSlide(0); setPlanModal(true) }} className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#0099ff] to-blue-600 text-white font-semibold text-sm hover:shadow-[0_0_30px_rgba(0,153,255,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all">
              Paketleri İncele
            </button>
          <a href="#test" className="px-6 py-3 rounded-xl bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition-all flex items-center gap-2">
            <PlayCircle className="w-4 h-4" />Test Yayını Al
          </a>
        </div>
        <div className="flex items-center justify-center md:justify-start gap-4 mt-10">
          <div className="relative w-20 h-[3px] bg-white/5 overflow-hidden rounded-full">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0099ff] to-transparent opacity-100 rounded-full shadow-[0_0_12px_rgba(0,153,255,1)]"
              style={{ animation: 'lightSweep 2s ease-in-out infinite' }} />
          </div>
          <span className="text-xs text-gray-400 tracking-widest uppercase">RENDIR MEDİA</span>
          <style>{`@keyframes lightSweep { 0%,100% { transform: translateX(-100%) } 50% { transform: translateX(100%) } }`}</style>
        </div>
          </div>
          <div className="flex-1 w-full max-w-xl">
            <div className="relative rounded-3xl overflow-hidden border border-white/15 shadow-[0_0_60px_rgba(0,153,255,0.3),0_0_120px_rgba(168,85,247,0.15)] hover:scale-[1.02] transition-transform duration-500">
              <img src="/images/hero-aile.jpg" alt="Steamix TV" className="w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/50 via-transparent to-transparent pointer-events-none" />
              <div className="absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/20 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* İstatistik barı */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 md:py-10 w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map(s => (
            <div key={s.label} className="rounded-2xl p-5 border border-white/10 bg-white/5 text-center hover:border-[#0099ff]/40 hover:shadow-[0_0_25px_rgba(0,153,255,0.15)] transition-all" style={{ animation: 'floatGlow 3s ease-in-out infinite' }}>
              <s.icon className="w-6 h-6 text-[#0099ff] mx-auto mb-2" />
              <div className="text-2xl md:text-3xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                <Counter value={s.value} suffix={s.suffix} />
              </div>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Slogan bandı */}
      <div className="relative z-10 border-y border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden py-3">
        <div className="flex whitespace-nowrap gap-8 w-max" style={{ animation: 'marquee 30s linear infinite' }}>
          {[0, 1].map(k => (
            <div key={k} className="flex gap-8 text-sm text-gray-300 tracking-widest uppercase">
              <span>⚽ Süper Lig</span><span className="text-[#0099ff]">•</span>
              <span>🏆 Şampiyonlar Ligi</span><span className="text-[#0099ff]">•</span>
              <span>🎬 Sinema Salonu</span><span className="text-[#0099ff]">•</span>
              <span>📺 Yüzlerce Canlı Kanal</span><span className="text-[#0099ff]">•</span>
              <span>🍿 Yüzlerce Film & Dizi</span><span className="text-[#0099ff]">•</span>
              <span>📡 4K Ultra HD</span><span className="text-[#0099ff]">•</span>
            </div>
          ))}
        </div>
      </div>

      {/* Test alanı */}
      <div id="test" className="relative z-10 max-w-6xl mx-auto px-4 py-8 md:py-10 w-full">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Check className="w-4 h-4 text-green-400" />
          <span className="text-xs text-gray-300 tracking-widest uppercase">Satın almadan önce gerçek deneyim</span>
        </div>
        <div className="text-center mb-6">
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            IPTV Teste: Önce Deneyin, <span className="text-[#0099ff]">Sonra Karar Verin</span>
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed max-w-2xl mx-auto">
            IPTV teste, paket satın almadan önce görüntü kalitesini, kanal geçişlerini ve sunucu
            kararlılığını kendi cihazınızda görmenizi sağlar. Normal paketimizi 24 saat boyunca ücretsiz
            deneyebilir, size uygun olup olmadığına gerçek kullanım koşullarında karar verebilirsiniz.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 mb-8">
          {['24 saat ücretsiz', 'Kolay kurulum', 'Tüm cihazlarda', 'Hızlı destek'].map(b => (
            <span key={b} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">{b}</span>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {TESTLER.map(t => (
            <div key={t.id} className={`relative rounded-2xl p-5 border transition-all duration-300 hover:scale-[1.03] flex flex-col ${t.vip ? 'border-purple-500/60 bg-purple-500/5 shadow-lg shadow-purple-500/10' : 'border-white/10 bg-white/5'}`}>
              <p className="text-[11px] text-gray-500 tracking-widest uppercase mb-2">{t.etiket}</p>
              <h3 className="text-base font-bold text-white mb-1">{t.ad}</h3>
              <div className="mb-3"><span className="text-2xl font-extrabold text-[#0099ff]">{t.fiyat}</span><span className="text-xs text-gray-500"> {t.sure}</span></div>
              <p className="text-[11px] text-gray-400 leading-relaxed mb-4 flex-1">{t.aciklama}</p>
              <ul className="space-y-1.5 mb-5">
                {t.ozellikler.map(o => (
                  <li key={o} className="flex items-center gap-2 text-[11px] text-gray-300">
                    <Check className="w-3 h-3 text-green-400 shrink-0" />{o}
                  </li>
                ))}
              </ul>
              <button onClick={() => setSeciliTest(t)}
                className={`block w-full py-2.5 rounded-xl font-semibold text-xs text-center transition-all ${t.vip ? 'bg-gradient-to-r from-purple-500 to-purple-700 text-white hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]' : 'bg-gradient-to-r from-[#0099ff] to-blue-600 text-white hover:shadow-[0_0_20px_rgba(0,153,255,0.4)]'}`}>
                {t.buton}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/10 max-w-2xl mx-auto">
          <p className="text-xs text-gray-400 leading-relaxed text-center">
            <span className="text-[#0099ff] font-semibold">Kısa cevap:</span> İlk kez deneyecekseniz 24 saatlik ücretsiz
            IPTV teste seçeneğiyle başlayın. Günün farklı saatlerinde yayın açarak görüntü kalitesini,
            ses uyumunu ve sunucu kararlılığını kontrol edin.
          </p>
        </div>
      </div>

      {/* Cihaz sahnesi */}
      <div id="cihazlar" className="relative z-10 max-w-6xl mx-auto px-4 py-8 md:py-10 w-full">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Kumandayla Koltuktan, <span className="text-[#0099ff]">Dokunarak Cebinden</span>
          </h2>
          <p className="text-sm text-gray-500 max-w-xl mx-auto">TV'de maç, telefonda dizi — Steamix TV arayüzü her ekranda aynı akıcılıkta.</p>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-center gap-10 md:gap-14">
          {/* TV + kumanda */}
          <div className="flex items-end gap-4">
            <div className="flex flex-col items-center">
              <div className="relative rounded-xl overflow-hidden bg-black border-[6px] border-gray-900 shadow-[0_0_50px_rgba(0,153,255,0.35),0_0_120px_rgba(168,85,247,0.2)] w-72 md:w-[26rem]">
                <div className="relative aspect-video bg-[#0a0f1e]">
                  <MiniEkran />
                  <div className="absolute inset-x-0 h-8 bg-gradient-to-b from-[#0099ff]/20 to-transparent pointer-events-none" style={{ animation: 'scanMove 4s linear infinite' }} />
                </div>
              </div>
              <div className="w-14 h-4 bg-gray-900 rounded-b-lg" />
              <div className="w-44 h-1.5 bg-gray-900 rounded-full mt-1 shadow-[0_5px_20px_rgba(0,0,0,0.8)]" />
              <p className="text-xs text-gray-400 mt-3 text-center">Kanallar değişiyor, maç başlıyor…<br />TV'de yayın hiç durmaz</p>
            </div>
            {/* Kumanda */}
            <div className="hidden sm:flex flex-col items-center gap-2 pb-8" style={{ animation: 'kumandaBas 5s ease-in-out infinite' }}>
              <div className="w-12 rounded-2xl bg-gradient-to-b from-gray-800 to-gray-950 border border-white/15 p-2 space-y-1.5 shadow-[0_0_25px_rgba(0,153,255,0.25)]">
                <div className="w-6 h-6 mx-auto rounded-full bg-red-500/80" />
                <div className="grid grid-cols-3 gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                    <div key={n} className={`w-2.5 h-2.5 rounded-full mx-auto ${n === 5 ? 'bg-[#0099ff] shadow-[0_0_8px_rgba(0,153,255,0.9)]' : 'bg-white/20'}`} />
                  ))}
                </div>
                <div className="flex justify-center gap-1">
                  <div className="w-2.5 h-4 rounded bg-white/20" />
                  <div className="w-2.5 h-4 rounded bg-white/20" />
                </div>
              </div>
              <p className="text-[10px] text-gray-500 text-center">Kumandayla<br />kanal değiştir</p>
            </div>
          </div>
          {/* Telefon + dokunma */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="relative rounded-[2rem] overflow-hidden bg-black border-[5px] border-gray-900 shadow-[0_0_45px_rgba(168,85,247,0.35)] w-40 md:w-48">
                <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-16 h-4 bg-black rounded-full z-10 border border-white/10" />
                <div className="relative aspect-[9/18] bg-[#0a0f1e]">
                  <MiniEkran kucuk />
                </div>
                <div className="absolute w-8 h-8 rounded-full border-2 border-[#0099ff] bg-[#0099ff]/20 shadow-[0_0_15px_rgba(0,153,255,0.8)] pointer-events-none" style={{ animation: 'dokunma 5s ease-in-out infinite', top: '55%', left: '60%' }} />
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center">Parmağınla dokun,<br />filmler kayarak gelsin</p>
            </div>
          </div>
        </div>
        <div className="mt-10 max-w-2xl mx-auto">
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#0099ff]/[0.1] to-purple-500/[0.06] border border-[#0099ff]/30 shadow-[0_0_30px_rgba(0,153,255,0.15)]" style={{ animation: 'floatGlow 3s ease-in-out infinite' }}>
            <p className="text-xs md:text-sm text-gray-300 leading-relaxed text-center">
              <span className="text-[#0099ff] font-bold">📡 Çözünürlüğe göre sınıflı yayın:</span> yayınlarımız
              çözünürlük kalitesine göre sınıflandırılmıştır. Çözünürlük kanallarını kendinize göre sınıflayıp
              favorileyin, böylece donanımınızın desteklediği kanalları favoriledikten sonra liste karmaşıklığının önüne geçmiş olursunuz.
            </p>
          </div>
        </div>
      </div>

      {/* Sinema vitrini */}
      <div id="icerik" className="relative z-10 max-w-6xl mx-auto px-4 pb-8 md:pb-10 w-full">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Sinema Salonu <span className="text-[#0099ff]">Evinizde</span>
          </h2>
          <p className="text-sm text-gray-500 max-w-xl mx-auto">Vizyondan arşive binlerce film, kaldığınız yerden devam eden diziler — hepsi tek abonelikte.</p>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {POSTERS.map(p => (
            <div key={p} className="group relative rounded-xl overflow-hidden border border-white/10 hover:border-[#0099ff]/50 hover:scale-[1.04] hover:shadow-[0_0_25px_rgba(0,153,255,0.25)] transition-all duration-300">
              <img src={`/images/${p}`} alt="" loading="lazy" className="w-full aspect-[2/3] object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      </div>

      {/* Müşterilerimiz Ne Diyor */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 pb-8 md:pb-10 w-full">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Müşterilerimiz <span className="text-[#0099ff]">Ne Diyor?</span>
          </h2>
          <p className="text-sm text-gray-500 max-w-xl mx-auto">Avrupa'dan Türkiye'ye binlerce mutlu izleyici — hız, kalite ve destek farkıyla.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {YORUMLAR.map(y => (
            <div key={y.ad} className="rounded-2xl p-5 border border-white/10 bg-white/5 hover:border-[#0099ff]/40 hover:shadow-[0_0_25px_rgba(0,153,255,0.12)] transition-all flex flex-col">
              <div className="flex gap-1 mb-3">
                {[0, 1, 2, 3, 4].map(i => (
                  <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-xs text-gray-300 leading-relaxed flex-1">"{y.yazi}"</p>
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/10">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0099ff] to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {y.ad.split(' ').map(k => k[0]).join('')}
                </div>
                <div>
                  <p className="text-xs text-white font-semibold">{y.ad}</p>
                  <p className="text-[11px] text-gray-500">{y.yer}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SSS */}
      <div className="relative z-10 max-w-3xl mx-auto px-4 pb-8 md:pb-10 w-full">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Sık Sorulan <span className="text-[#0099ff]">Sorular</span>
          </h2>
        </div>
        <div className="space-y-3">
          {SSS.map((q, i) => (
            <details key={i} className="group rounded-2xl border border-white/10 bg-white/5 open:border-[#0099ff]/40 transition-all">
              <summary className="flex items-center gap-3 p-4 cursor-pointer list-none">
                <MessageCircleQuestion className="w-5 h-5 text-[#0099ff] shrink-0" />
                <span className="text-sm text-white font-semibold flex-1">{q.s}</span>
                <span className="text-[#0099ff] group-open:rotate-45 transition-transform text-lg leading-none">+</span>
              </summary>
              <p className="px-4 pb-4 pl-12 text-xs text-gray-400 leading-relaxed">{q.c}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Uygulama */}
      <div id="uygulama" className="relative z-10 max-w-xl mx-auto px-4 py-8 md:py-10 w-full">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Steamix TV <span className="text-[#0099ff]">Uygulaması</span>
          </h2>
          <p className="text-sm text-gray-500">Telefon ve TV kutusu için resmi oynatıcımız</p>
        </div>
        <div className="p-5 rounded-xl bg-gradient-to-br from-[#0099ff]/10 to-purple-500/5 border border-[#0099ff]/20 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <img src="/images/steamix-logo.jpg" alt="Steamix TV" className="w-16 h-16 rounded-2xl shadow-[0_0_25px_rgba(0,153,255,0.5)]" style={{ animation: 'floatGlow 3s ease-in-out infinite' }} />
              <span className="absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 rounded-md bg-green-500 text-white text-[9px] font-bold shadow">APK</span>
            </div>
            <div>
              <p className="text-sm text-gray-200 font-semibold mb-1 flex items-center gap-2">Steamix TV <span className="text-[10px] text-gray-500 font-normal">Android • v1.0.45</span></p>
              <div className="flex items-center gap-1 mb-1">
                {[0, 1, 2, 3, 4].map(i => (
                  <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                ))}
                <span className="text-[10px] text-gray-500 ml-1">22 MB • Türkçe</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Abonelik bağlantınızla giriş yapın: yüzlerce canlı kanal, yüzlerce film ve dizi,
                4K kalite, kumanda ve dokunmatik uyumu.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['Android', 'Telefon & Tablet'], ['TV', 'Smart TV & Box'], ['4K', 'Ultra HD']].map(([t, a]) => (
              <div key={t} className="rounded-lg bg-white/5 border border-white/10 py-2">
                <p className="text-xs text-white font-bold">{t}</p>
                <p className="text-[10px] text-gray-500">{a}</p>
              </div>
            ))}
          </div>
          <a href={mobilMi() ? MOBIL_APK_URL : APK_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-sm hover:shadow-[0_0_25px_rgba(34,197,94,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all">
            <Download className="w-4 h-4" /> Steamix TV'yi İndir (APK)
          </a>
          <p className="text-[11px] text-gray-500 text-center leading-relaxed">
            Bilinmeyen kaynaklara izin verip tek dokunuşla kurun, izlemeye başlayın.
          </p>
          <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/[0.08] to-transparent border border-purple-500/20 border-l-4 border-l-purple-500/60">
            <p className="text-[11px] text-gray-300 leading-relaxed text-center">
              Aboneliğiniz ayrıca <span className="text-white font-semibold">TiviMate</span>, <span className="text-white font-semibold">Televizio</span> ve <span className="text-white font-semibold">İMPlayer</span> uygulamalarında da geçerlidir. Gönül rahatlığıyla izleyebilirsiniz.
            </p>
          </div>
        </div>
      </div>

      {/* Alt bilgi */}
      <div className="relative z-10 text-center pb-10 pt-4">
        <span className="text-xs text-gray-400 tracking-widest uppercase">RENDIR MEDİA</span>
      </div>

      {/* Plan modalı */}
      {planModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPlanModal(false)} />
          <div className="relative z-10 bg-gradient-to-b from-gray-900 to-gray-950 rounded-3xl p-4 md:p-5 max-w-5xl w-full border border-white/10 shadow-2xl shadow-[#0099ff]/10">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                <CreditCard className="w-5 h-5 text-[#0099ff]" /> Paketleri İncele
              </h2>
              <button onClick={() => setPlanModal(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mb-3">Sana uygun planı seç — ödeme sonrası giriş bilgilerin en kısa sürede teslim edilir.</p>
            <div ref={planTrackRef}
              onScroll={(e) => {
                const el = e.currentTarget
                const first = el.children[0] as HTMLElement | undefined
                const w = first ? first.offsetWidth + 12 : el.clientWidth
                const i = Math.round(el.scrollLeft / w)
                setPlanSlide(Math.min(PLANS.length - 1, Math.max(0, i)))
              }}
              style={{ scrollbarWidth: 'none' }}
              className="flex md:grid md:grid-cols-3 gap-3 items-stretch pt-2 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none [&::-webkit-scrollbar]:hidden -mx-1 px-1">
              {PLANS.map(p => (
                <div key={p.name} className="min-w-[86%] sm:min-w-[70%] md:min-w-0 snap-center shrink-0 md:shrink">
                  <PlanKarti p={p} onSec={(pl) => { setPlanModal(false); setSeciliPlan(pl) }} />
                </div>
              ))}
            </div>
            <div className="flex md:hidden items-center justify-center gap-2 mt-3">
              {PLANS.map((pl, i) => (
                <button key={pl.name} aria-label={pl.name}
                  onClick={() => {
                    const el = planTrackRef.current
                    if (!el) return
                    const first = el.children[0] as HTMLElement | undefined
                    const w = first ? first.offsetWidth + 12 : el.clientWidth
                    el.scrollTo({ left: i * w, behavior: 'smooth' })
                  }}
                  className={`h-1.5 rounded-full transition-all ${planSlide === i ? 'w-6 bg-[#0099ff]' : 'w-1.5 bg-white/20'}`} />
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 mt-4 pt-3 border-t border-white/10 text-[10px] text-gray-500">
              <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-[#0099ff]" />Shopier ile güvenli ödeme</span>
              <span className="flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5 text-[#0099ff]" />Hızlı aktivasyon</span>
              <span className="flex items-center gap-1.5"><MessageCircleQuestion className="w-3.5 h-3.5 text-[#0099ff]" />7/24 destek</span>
            </div>
          </div>
        </div>
      )}

      {/* Satın alma bilgi modalı */}
      {seciliPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSeciliPlan(null)} />
          <div className="relative z-10 bg-gradient-to-b from-gray-900 to-gray-950 rounded-3xl p-6 md:p-8 max-w-lg w-full border border-white/10 shadow-2xl shadow-[#0099ff]/10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-full bg-[#0099ff]/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#0099ff]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>LÜTFEN OKUYUN</h2>
                <p className="text-xs text-gray-500">{seciliPlan.name} • {seciliPlan.price}</p>
              </div>
            </div>
            <div className="space-y-3 mb-6">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0099ff]/[0.08] to-transparent border border-[#0099ff]/20 border-l-4 border-l-[#0099ff]/60">
                <p className="text-xs text-gray-300 leading-relaxed">
                  Satın aldıktan sonra <span className="text-[#0099ff] font-semibold">steamixgame@yandex.com</span> mail
                  adresine satın aldığınıza dair ekran görüntüsü atın; yönetici onayının ardından abonelik giriş
                  bilgileriniz en kısa sürede size teslim edilir ve size özel oynatıcı bağlantınız mail üzerinden
                  gönderilir — bağlantıyla birlikte aşağıdaki uygulamamızın apk'sını indirip kullanabilirsiniz.
                  Ayrıca <span className="text-white font-semibold">TiviMate</span>, <span className="text-white font-semibold">Televizio</span> ve <span className="text-white font-semibold">İMPlayer</span> uygulamalarında da gönül rahatlığıyla izleyebilirsiniz. Shopier resmi
                  kuralları gereği abonelikler sınırlıdır; tamamlanan abonelik yalnızca bir defaya mahsus tekrar
                  alınabilir. Steamix TV'yi cihazlarınızda oynatabilmek için en az 100 Mbps internet hızı ve güncel
                  donanımlı bir akıllı televizyon ya da TV Box kullanmanız şarttır, aksi halde donma ve takılmalar donanım yetersizliğinden ve ağ alt yapınızın zayıf olmasından kaynaklanır.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <a href={seciliPlan.link} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#0099ff] to-blue-600 text-white font-semibold text-sm text-center hover:shadow-[0_0_25px_rgba(0,153,255,0.5)] transition-all flex flex-col items-center justify-center gap-0.5">
                <span className="flex items-center gap-2"><ShoppingCart className="w-4 h-4" />Satın Al</span>
                <span className="text-[10px] font-normal text-white/70 tracking-wide pointer-events-none select-none">shopier'e git</span>
              </a>
              <button onClick={() => setSeciliPlan(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition-all">
                Hayır, Vazgeçtim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test modalı */}
      {seciliTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSeciliTest(null)} />
          <div className="relative z-10 bg-gradient-to-b from-gray-900 to-gray-950 rounded-3xl p-6 md:p-8 max-w-lg w-full border border-white/10 shadow-2xl shadow-[#0099ff]/10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-full bg-[#0099ff]/15 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-[#0099ff]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>{seciliTest.ad}</h2>
                <p className="text-xs text-gray-500">{seciliTest.fiyat} {seciliTest.sure}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">{seciliTest.aciklama}</p>
            <ul className="space-y-2 mb-5">
              {seciliTest.ozellikler.map(o => (
                <li key={o} className="flex items-center gap-2 text-xs text-gray-300">
                  <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />{o}
                </li>
              ))}
            </ul>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-5">
              <p className="text-xs text-gray-400 leading-relaxed">
                {seciliTest.id === '7gun' ? (
                  <>Önce aşağıdaki butonla ödemeyi tamamlayın, ardından satın aldığınıza dair ekran görüntüsünü{' '}
                    <span className="text-[#0099ff] font-semibold">steamixgame@yandex.com</span> adresine
                    <span className="text-white font-medium"> "7 günlük VIP test yayını istiyorum"</span> konulu
                    bir mail ile gönderin. Giriş bilgileriniz en kısa sürede teslim edilecektir.</>
                ) : (
                  <>Aşağıdaki butona basınca mail uygulamanız açılır. Konu otomatik yazılı gelir — mailde{' '}
                    <span className="text-white font-medium">hangi cihazda</span> deneyeceğinizi yazıp göndermeniz
                    yeterli. Ücretsizdir, giriş bilgileriniz en kısa sürede teslim edilecektir.</>
                )}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {seciliTest.id === '7gun' && (
                <a href="https://shopier.com/50780303" target="_blank" rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-700 text-white font-semibold text-sm text-center hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] transition-all flex items-center justify-center gap-2">
                  <ShoppingCart className="w-4 h-4" />250 TL — Ödemeye Git
                </a>
              )}
              <a href={`mailto:steamixgame@yandex.com?subject=${encodeURIComponent(seciliTest.konu)}&body=${encodeURIComponent(seciliTest.govde)}`}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#0099ff] to-blue-600 text-white font-semibold text-sm text-center hover:shadow-[0_0_25px_rgba(0,153,255,0.5)] transition-all flex items-center justify-center gap-2">
                <Mail className="w-4 h-4" />{seciliTest.id === '7gun' ? 'Mail ile Bilgi İste' : seciliTest.buton}
              </a>
              <button onClick={() => setSeciliTest(null)}
                className="w-full py-3 rounded-xl bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition-all">
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
