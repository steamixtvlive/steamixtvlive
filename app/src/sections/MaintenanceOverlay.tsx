import { useEffect, useRef, useState } from 'react'

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
  const [sabit, setSabit] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSabit(true), 8000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-black">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;800;900&family=Inter:wght@400;500;600&display=swap');
        @keyframes tozKaybol { 0% { opacity: 1; filter: blur(0); transform: scale(1) } 100% { opacity: 0; filter: blur(18px); transform: scale(1.12) } }
        @keyframes logoYakin { 0% { transform: scale(0.92) } 100% { transform: scale(1) } }
      `}</style>

      {!sabit ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <img src="/images/netflax-logo.jpg" alt="Netflax"
            className="w-full max-w-[680px] object-contain"
            style={{ animation: 'logoYakin 6.8s ease-out both, tozKaybol 1.4s ease-in 6.6s both' }} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <img src="/images/netflax-logo.jpg" alt="Netflax" className="w-[240px] md:w-[300px] mx-auto object-contain mb-6" />
            <p className="text-[13px] md:text-sm font-semibold tracking-[0.3em] text-gray-300 uppercase mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>
              İlk Yerli Projemiz
            </p>
            <h1 className="text-[30px] md:text-[46px] font-black tracking-tight text-[#E50914]" style={{ fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 30px rgba(229,9,20,0.5)' }}>
              NETFLAX ÇOK YAKINDA
            </h1>
          </div>
        </div>
      )}

      <div className="relative shrink-0 border-t border-[#E50914]/20 bg-black px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-1">
        <span className="text-[11px] text-gray-500 tracking-widest uppercase">Steamix Live IPTV</span>
        <span className="text-[11px] text-gray-600">© 2027 Steamix Live IPTV — Tüm hakları saklıdır.</span>
      </div>
    </div>
  )
}
