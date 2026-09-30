import { useEffect, useState } from 'react'

const MAINTENANCE_END = Date.now() + 4 * 3600 * 1000

function useCountdown() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const diff = Math.max(0, MAINTENANCE_END - now)
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor(diff / 3600000) % 24,
    minutes: Math.floor(diff / 60000) % 60,
    seconds: Math.floor(diff / 1000) % 60,
  }
}

export default function MaintenanceOverlay() {
  const { days, hours, minutes, seconds } = useCountdown()
  const pad = (n: number) => String(n).padStart(2, '0')
  const units = [
    { v: String(days), label: 'Gün' },
    { v: pad(hours), label: 'Saat' },
    { v: pad(minutes), label: 'Dakika' },
    { v: pad(seconds), label: 'Saniye' },
  ]
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden bg-[#04060d]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;800&family=Inter:wght@300;400;500;600&display=swap');
        @keyframes slowZoom { 0% { transform: scale(1) } 50% { transform: scale(1.06) } 100% { transform: scale(1) } }
        @keyframes floatA { 0%,100% { transform: translate(0,0) } 50% { transform: translate(18px,-14px) } }
        @keyframes floatB { 0%,100% { transform: translate(0,0) } 50% { transform: translate(-16px,12px) } }
        @keyframes shimmer { 0% { transform: translateX(-100%) } 100% { transform: translateX(200%) } }
        @keyframes glowPulse { 0%,100% { opacity:0.7; transform:scale(1) } 50% { opacity:1; transform:scale(1.04) } }
        @keyframes spinSlow { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }
        @keyframes barLoad { 0% { width: 12% } 50% { width: 88% } 100% { width: 12% } }
      `}</style>

      {/* arka plan foto */}
      <div className="absolute inset-0">
        <div
          className="absolute -inset-[80px]"
          style={{
            backgroundImage: 'url(/images/login.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.28) blur(2px) saturate(1.15)',
            animation: 'slowZoom 18s ease-in-out infinite',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#04060d]/30 via-[#04060d]/55 to-[#04060d]/90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#04060d_85%)]" />
      </div>

      {/* glow orblar */}
      <div className="absolute -top-28 -left-28 w-[520px] h-[520px] rounded-full bg-[#0099ff]/18 blur-[90px]" style={{ animation: 'floatA 9s ease-in-out infinite' }} />
      <div className="absolute -bottom-32 -right-28 w-[520px] h-[520px] rounded-full bg-[#0099ff]/10 blur-[100px]" style={{ animation: 'floatB 11s ease-in-out infinite' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[760px] h-[760px] rounded-full bg-[#0099ff]/[0.06] blur-[80px] pointer-events-none" />

      {/* ince üst çizgi */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-white/5 overflow-hidden">
        <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#0099ff] to-cyan-300 shadow-[0_0_18px_rgba(0,153,255,0.9)]" style={{ animation: 'shimmer 2.2s linear infinite' }} />
      </div>

      {/* içerik — açık ekran, kartsız */}
      <div className="relative w-full max-w-[620px] text-center px-6">
        {/* logo */}
        <div className="flex justify-center mb-7">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-[#0099ff]/25 blur-[18px]" style={{ animation: 'glowPulse 2.8s ease-in-out infinite' }} />
            <img src="/images/steamix-logo.png" alt="Steamix TV" className="relative w-[84px] h-[84px] rounded-2xl object-cover shadow-[0_0_30px_rgba(0,153,255,0.45)] ring-1 ring-white/15" />
            <span className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#0099ff] border-2 border-[#0a0f1e] flex items-center justify-center text-[10px]">⚙️</span>
          </div>
        </div>

        {/* badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0099ff]/10 border border-[#0099ff]/25 mb-5">
          <span className="w-2 h-2 rounded-full bg-[#0099ff] animate-pulse shadow-[0_0_8px_rgba(0,153,255,0.8)]" />
          <span className="text-[11px] font-semibold tracking-[0.18em] text-[#7dd3ff] uppercase">Sistem Güncellemesi</span>
        </div>

        <h1 className="text-[30px] md:text-[38px] font-extrabold leading-tight tracking-tight text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          Kısa Bir <span className="bg-gradient-to-r from-[#0099ff] to-cyan-300 bg-clip-text text-transparent">Ara</span> Veriyoruz
        </h1>

        <p className="text-[13px] md:text-[15px] leading-relaxed text-gray-300/90 max-w-[520px] mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
          Sizlere <span className="text-white font-semibold">daha iyi hizmet verebilmek için</span> bakıma girdik.<br />
          <span className="text-[#7dd3ff] font-semibold text-base">En kısa sürede döneceğiz.</span>
        </p>

        {/* durum satırları */}
        <div className="mt-7 mx-auto max-w-[440px] space-y-2.5 text-left">
          {([
            ['Yayın sunucuları güncelleniyor', true],
            ['Kanal listesi ve EPG yenileniyor', true],
            ['Test yayınları kısa süre duraklatıldı', false],
          ] as [string, boolean][]).map(([yazi, aktif]) => (
            <div key={yazi} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10">
              <span className={`w-2 h-2 rounded-full shrink-0 ${aktif ? 'bg-[#0099ff] shadow-[0_0_8px_rgba(0,153,255,0.9)]' : 'bg-gray-500'}`} style={aktif ? { animation: 'glowPulse 1.8s ease-in-out infinite' } : undefined} />
              <span className="text-xs text-gray-200">{yazi}</span>
            </div>
          ))}
        </div>

        {/* ilerleme çizgisi */}
        <div className="mt-7 mx-auto w-full max-w-[440px]">
          <div className="relative h-[8px] rounded-full bg-white/[0.06] border border-white/10 overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-2/3 rounded-full bg-gradient-to-r from-[#0099ff] via-cyan-300 to-[#0099ff]" style={{ animation: 'barKay 2.6s ease-in-out infinite' }} />
          </div>
          <p className="mt-3 text-[11px] tracking-[0.22em] text-gray-500 uppercase">Çalışmalar sürüyor</p>
        </div>

        {/* alt bilgi */}
        <div className="mt-8 flex flex-col items-center gap-1.5">
          <span className="text-[11px] tracking-[0.22em] text-gray-500 uppercase">Steamix TV Company</span>
          <span className="text-[11px] text-gray-500">Destek: <a href="https://t.me/streamsupport00" target="_blank" rel="noopener noreferrer" className="text-[#7dd3ff] hover:underline">Telegram 7/24</a></span>
        </div>
        <style>{`@keyframes barKay { 0% { transform: translateX(-110%) } 100% { transform: translateX(320%) } }`}</style>
      </div>
    </div>
  )
}
