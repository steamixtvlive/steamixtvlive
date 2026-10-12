import { useEffect, useRef } from 'react'

const HARFLER = 'NETFLAX'.split('')

const TOZLAR = [
  [8, 72, 5, 0], [14, 60, 4, 0.7], [21, 78, 6, 1.3], [27, 55, 3, 0.4], [33, 82, 5, 1.9],
  [39, 64, 4, 0.9], [45, 75, 6, 2.4], [52, 58, 3, 0.2], [58, 80, 5, 1.1], [64, 66, 4, 2.0],
  [70, 74, 6, 0.6], [76, 62, 3, 1.6], [82, 79, 5, 2.7], [88, 68, 4, 0.3], [93, 76, 5, 1.4],
  [5, 40, 4, 2.2], [18, 35, 5, 1.0], [36, 30, 3, 2.9], [55, 38, 6, 0.8], [73, 32, 4, 2.5],
  [90, 42, 5, 1.7], [48, 88, 4, 0.5], [66, 90, 3, 2.1], [25, 88, 5, 1.2],
] as const

function useTudum() {
  const caldi = useRef(false)
  useEffect(() => {
    const cal = () => {
      if (caldi.current) return
      try {
        const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
        const AC = W.AudioContext || W.webkitAudioContext
        if (!AC) return
        const ctx = new AC()
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => undefined)
        }
        const t0 = ctx.currentTime + 0.05
        const vur = ctx.createOscillator()
        const vg = ctx.createGain()
        vur.type = 'sine'
        vur.frequency.value = 55
        vg.gain.setValueAtTime(0.5, t0)
        vg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7)
        vur.connect(vg)
        vg.connect(ctx.destination)
        vur.start(t0)
        vur.stop(t0 + 0.75)
        ;[146.83, 185, 220].forEach(f => {
          const o = ctx.createOscillator()
          const g = ctx.createGain()
          o.type = 'sine'
          o.frequency.value = f
          g.gain.setValueAtTime(0.0001, t0 + 0.3)
          g.gain.exponentialRampToValueAtTime(0.16, t0 + 1.1)
          g.gain.exponentialRampToValueAtTime(0.001, t0 + 2.8)
          o.connect(g)
          g.connect(ctx.destination)
          o.start(t0 + 0.3)
          o.stop(t0 + 2.9)
        })
        caldi.current = true
      } catch { /* sessiz kal */ }
    }
    cal()
    window.addEventListener('pointerdown', cal)
    window.addEventListener('keydown', cal)
    return () => {
      window.removeEventListener('pointerdown', cal)
      window.removeEventListener('keydown', cal)
    }
  }, [])
}

export default function MaintenanceOverlay() {
  useTudum()
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-black">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;800;900&family=Inter:wght@400;500;600&display=swap');
        @keyframes damga { 0% { transform: scale(2.4); opacity: 0 } 55% { transform: scale(0.94); opacity: 1 } 75% { transform: scale(1.04); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
        @keyframes flas { 0% { opacity: 0.55 } 100% { opacity: 0 } }
        @keyframes harfGir { 0% { transform: translateY(70px) scale(1.5); opacity: 0; filter: blur(16px) } 60% { opacity: 1; filter: blur(2px) } 100% { transform: translateY(0) scale(1); opacity: 1; filter: blur(0) } }
        @keyframes tozYuksel { 0% { transform: translateY(0) scale(1); opacity: 0 } 25% { opacity: 0.9 } 100% { transform: translateY(-46vh) scale(0.4); opacity: 0 } }
        @keyframes yaziGir { 0% { transform: translateY(26px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
        @keyframes nabiz { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }
        @keyframes yukBar { 0% { transform: translateX(-110%) } 100% { transform: translateX(220%) } }
      `}</style>

      {/* kırmızı flaş */}
      <div className="absolute inset-0 bg-[#E50914] pointer-events-none" style={{ animation: 'flas 0.7s ease-out 0.55s both' }} />

      {/* toz parçacıkları */}
      <div className="absolute inset-0 pointer-events-none">
        {TOZLAR.map(([x, y, s, d], i) => (
          <span key={i} className="absolute rounded-full"
            style={{
              left: `${x}%`, top: `${y}%`, width: s, height: s,
              background: i % 3 === 0 ? '#fff' : '#E50914',
              filter: 'blur(1px)',
              boxShadow: i % 3 === 0 ? 'none' : '0 0 10px rgba(229,9,20,0.9)',
              animation: `tozYuksel ${5 + (i % 4)}s linear ${d}s infinite`,
            }} />
        ))}
      </div>

      {/* derin kırmızı ışıklar */}
      <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[720px] h-[420px] rounded-full bg-[#E50914]/15 blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-56 left-1/2 -translate-x-1/2 w-[820px] h-[460px] rounded-full bg-[#B20710]/20 blur-[140px] pointer-events-none" />

      {/* içerik */}
      <div className="relative flex-1 flex items-center justify-center px-4 overflow-y-auto">
        <div className="text-center max-w-[720px] py-10">
          {/* damga logo */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-[#E50914]/40 blur-[30px]" />
              <img src="/images/netflax-logo.jpg" alt="Netflax" className="relative w-[120px] h-[120px] rounded-3xl object-cover ring-2 ring-[#E50914]/60" style={{ animation: 'damga 1.4s cubic-bezier(0.2,0.9,0.3,1.2) both' }} />
            </div>
          </div>

          {/* dev harfler — toz gibi akar */}
          <h1 className="font-black leading-none tracking-tight mb-5 text-[52px] md:text-[92px]" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            {HARFLER.map((h, i) => (
              <span key={i} className="inline-block text-[#E50914]"
                style={{
                  animation: 'harfGir 0.9s ease-out both',
                  animationDelay: `${1.2 + i * 0.13}s`,
                  textShadow: '0 0 34px rgba(229,9,20,0.65)',
                }}>{h}</span>
            ))}
          </h1>

          <div style={{ animation: 'yaziGir 1s ease-out 2.9s both' }}>
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#E50914]/10 border border-[#E50914]/40 mb-5">
              <span className="w-2 h-2 rounded-full bg-[#E50914] shadow-[0_0_10px_rgba(229,9,20,1)]" style={{ animation: 'nabiz 1.4s ease-in-out infinite' }} />
              <span className="text-[12px] font-bold tracking-[0.3em] text-white uppercase">Çok Yakında</span>
            </div>
            <p className="text-[14px] md:text-base text-gray-300 leading-relaxed mb-8" style={{ fontFamily: 'Inter, sans-serif' }}>
              Yüzlerce film dizi çok yakında.
            </p>
            <div className="w-full max-w-[420px] mx-auto">
              <div className="relative h-[10px] rounded-full bg-white/[0.07] border border-white/10 overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-gradient-to-r from-[#B20710] via-[#E50914] to-[#ff4d57] shadow-[0_0_18px_rgba(229,9,20,1)]" style={{ animation: 'yukBar 2.2s ease-in-out infinite' }} />
              </div>
              <p className="mt-3 text-[10px] font-semibold tracking-[0.3em] text-gray-500 uppercase">Çalışma sürüyor</p>
            </div>
          </div>
        </div>
      </div>

      {/* alt bar */}
      <div className="relative shrink-0 border-t border-[#E50914]/20 bg-black px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-1">
        <span className="text-[11px] text-gray-500 tracking-widest uppercase">Steamix Live IPTV</span>
        <span className="text-[11px] text-gray-600">© 2027 Steamix Live IPTV — Tüm hakları saklıdır.</span>
      </div>
    </div>
  )
}
