import { useEffect, useState } from 'react'

const MAINTENANCE_END = new Date('2027-01-10T00:00:00+03:00').getTime()

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
      <div className="absolute -bottom-32 -right-28 w-[520px] h-[520px] rounded-full bg-purple-500/14 blur-[100px]" style={{ animation: 'floatB 11s ease-in-out infinite' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[760px] h-[760px] rounded-full bg-[#0099ff]/[0.06] blur-[80px] pointer-events-none" />

      {/* ince üst çizgi */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-white/5 overflow-hidden">
        <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#0099ff] to-purple-500 shadow-[0_0_18px_rgba(0,153,255,0.9)]" style={{ animation: 'shimmer 2.2s linear infinite' }} />
      </div>

      {/* kart */}
      <div className="relative w-full max-w-[640px]">
        {/* dış glow */}
        <div className="absolute -inset-[1px] rounded-[28px] bg-gradient-to-br from-[#0099ff]/35 via-white/10 to-purple-500/30 blur-[1px]" />
        <div className="relative rounded-[28px] overflow-hidden bg-gradient-to-b from-white/[0.09] to-white/[0.02] backdrop-blur-2xl border border-white/10 shadow-[0_20px_80px_rgba(0,0,0,0.7),0_0_60px_rgba(0,153,255,0.18)]">

          {/* üst ince gradient çizgi */}
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#0099ff]/60 to-transparent" />

          <div className="px-7 md:px-10 pt-9 pb-8 text-center">
            {/* logo */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl bg-[#0099ff]/25 blur-[18px]" style={{ animation: 'glowPulse 2.8s ease-in-out infinite' }} />
                <img src="/images/steamix-logo.jpg" alt="Steamix TV" className="relative w-[76px] h-[76px] rounded-2xl object-cover shadow-[0_0_30px_rgba(0,153,255,0.45)] ring-1 ring-white/15" />
                <span className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-400 border-2 border-[#0a0f1e] flex items-center justify-center text-[10px]">⚙️</span>
              </div>
            </div>

            {/* badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 mb-5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
              <span className="text-[11px] font-semibold tracking-[0.18em] text-amber-300 uppercase">Sistem Güncellemesi</span>
            </div>

            <h1 className="text-[28px] md:text-[34px] font-extrabold leading-tight tracking-tight text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Kısa Bir <span className="bg-gradient-to-r from-[#0099ff] to-purple-400 bg-clip-text text-transparent">Ara</span> Veriyoruz
            </h1>

            <p className="text-[13px] md:text-[14.5px] leading-relaxed text-gray-300/90 max-w-[520px] mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
              Sizlere <span className="text-white font-semibold">daha iyi hizmet verebilmek için</span> bakıma girdik.<br className="hidden md:block" />
              Bakım çalışmaları <span className="text-[#7dd3ff] font-semibold">10 Ocak 2027</span> tarihine kadar devam edecek.
            </p>

            {/* geri sayım */}
            <div className="mt-6 flex justify-center gap-2.5 md:gap-3">
              {units.map(u => (
                <div key={u.label} className="w-[68px] md:w-[76px] rounded-2xl bg-white/[0.04] border border-white/10 py-3 backdrop-blur-xl">
                  <div className="text-[22px] md:text-[26px] font-extrabold text-white tabular-nums" style={{ fontFamily: 'Orbitron, sans-serif' }}>{u.v}</div>
                  <div className="text-[10px] tracking-[0.2em] text-gray-500 uppercase mt-1">{u.label}</div>
                </div>
              ))}
            </div>

            {/* animasyonlu bar + dişli */}
            <div className="mt-7 flex flex-col items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="text-[14px]" style={{ display: 'inline-block', animation: 'spinSlow 2.2s linear infinite' }}>⚙️</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-[#0099ff]/10 border border-[#0099ff]/20 flex items-center justify-center">
                  <span className="text-[14px]" style={{ display: 'inline-block', animation: 'spinSlow 2.8s linear infinite reverse' }}>⚙️</span>
                </div>
                <span className="text-xs tracking-widest text-gray-500 uppercase ml-1">Güncelleniyor</span>
              </div>

              <div className="w-full max-w-[360px] h-[6px] rounded-full bg-white/5 border border-white/10 overflow-hidden p-[2px]">
                <div className="h-full rounded-full bg-gradient-to-r from-[#0099ff] via-blue-400 to-purple-500 shadow-[0_0_12px_rgba(0,153,255,0.7)]" style={{ animation: 'barLoad 1.8s ease-in-out infinite' }} />
              </div>
              <p className="text-[11px] tracking-[0.18em] text-gray-500 uppercase">10 Ocak 2027 • Tekrar görüşmek üzere</p>
            </div>

            {/* alt bilgi */}
            <div className="mt-7 pt-5 border-t border-white/5 flex flex-col items-center gap-2">
              <span className="text-[11px] tracking-[0.22em] text-gray-500 uppercase">Steamix TV Company</span>
              <span className="text-[11px] text-gray-600">steamixgame@yandex.com</span>
            </div>
          </div>

          {/* alt glow */}
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
        </div>

        {/* dış alt gölge */}
        <div className="mx-auto mt-4 h-[18px] w-[70%] rounded-full bg-black/40 blur-[16px]" />
      </div>
    </div>
  )
}
