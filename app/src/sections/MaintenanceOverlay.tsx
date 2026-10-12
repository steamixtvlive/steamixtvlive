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
        @keyframes logoYakin { 0% { transform: scale(0.92) } 100% { transform: scale(1) } }
        @keyframes dumanDagil { 0% { opacity: 1; filter: blur(0); transform: scale(1) } 100% { opacity: 0; filter: blur(22px); transform: scale(1.1) } }
        @keyframes harfYavas { 0% { opacity: 0; transform: translateY(34px); filter: blur(10px) } 100% { opacity: 1; transform: translateY(0); filter: blur(0) } }
        @keyframes harfSplash { 0% { opacity: 0; transform: translateY(46px) scale(1.3); filter: blur(14px) } 100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0) } }
      `}</style>

      {/* duman filtresi */}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <filter id="dumanDagit">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.035" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="0">
            <animate attributeName="scale" values="0;95" keyTimes="0;1" dur="1.4s" begin="6.6s" fill="freeze" />
          </feDisplacementMap>
        </filter>
      </svg>

      {!sabit ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center"
            style={{
              animation: 'dumanDagil 1.4s ease-in 6.6s both',
              filter: 'url(#dumanDagit)',
            }}>
            <img src="/images/noxflax-logo.jpg" alt="Noxflax"
              className="w-full max-w-[520px] mx-auto object-contain"
              style={{ clipPath: 'inset(0 0 30% 0)', animation: 'logoYakin 6.8s ease-out both' }} />
            <h1 className="font-black tracking-[0.3em] text-[#E50914] text-[40px] md:text-[64px] -mt-6" style={{ fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 34px rgba(229,9,20,0.65)' }}>
              {'NOXFLAX'.split('').map((h, i) => (
                <span key={i} className="inline-block"
                  style={{ animation: 'harfSplash 1.1s ease-out both', animationDelay: `${1.0 + i * 0.35}s` }}>{h}</span>
              ))}
            </h1>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <img src="/images/noxflax-logo.jpg" alt="Noxflax" className="w-[230px] md:w-[290px] mx-auto object-contain mb-7" />
            <p className="text-[12px] md:text-sm font-semibold tracking-[0.35em] text-gray-300 uppercase mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
              İlk Yerli Projemiz
            </p>
            <h1 className="font-black tracking-[0.18em] text-[#E50914] text-[26px] md:text-[42px]" style={{ fontFamily: 'Orbitron, sans-serif', textShadow: '0 0 30px rgba(229,9,20,0.5)' }}>
              NOXFLAX ÇOK YAKINDA
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
