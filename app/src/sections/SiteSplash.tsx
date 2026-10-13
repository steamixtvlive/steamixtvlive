import { useEffect, useState } from 'react'

const TOZLAR = [
  [10, 75, 5, 0], [18, 62, 4, 0.8], [26, 80, 6, 1.5], [34, 58, 3, 0.4], [42, 78, 5, 2.0],
  [50, 64, 4, 1.0], [58, 82, 6, 2.5], [66, 60, 3, 0.3], [74, 76, 5, 1.3], [82, 66, 4, 2.2],
  [90, 74, 5, 0.7], [6, 45, 4, 1.8], [94, 48, 5, 1.1],
] as const

export default function SiteSplash({ onDone }: { onDone: () => void }) {
  const [dagil, setDagil] = useState(false)
  useEffect(() => {
    const t1 = setTimeout(() => setDagil(true), 4000)
    const t2 = setTimeout(onDone, 5300)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black">
      <style>{`
        @keyframes splashYakin { 0% { transform: scale(0.9) } 100% { transform: scale(1.04) } }
        @keyframes dumanDagil { 0% { opacity: 1; filter: blur(0) } 100% { opacity: 0; filter: blur(24px) } }
        @keyframes harfSplash { 0% { opacity: 0; transform: translateY(40px) scale(1.25); filter: blur(12px) } 100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0) } }
        @keyframes tozYuksel { 0% { transform: translateY(0); opacity: 0 } 25% { opacity: 0.9 } 100% { transform: translateY(-44vh); opacity: 0 } }
      `}</style>

      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <filter id="splashDuman">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.035" numOctaves="2" seed="11" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="0">
            <animate attributeName="scale" values="0;100" keyTimes="0;1" dur="1.3s" begin="4s" fill="freeze" />
          </feDisplacementMap>
        </filter>
      </svg>

      <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[720px] h-[420px] rounded-full bg-[#E50914]/15 blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-56 left-1/2 -translate-x-1/2 w-[820px] h-[460px] rounded-full bg-[#B20710]/20 blur-[140px] pointer-events-none" />

      <div className="absolute inset-0 pointer-events-none">
        {TOZLAR.map(([x, y, s, d], i) => (
          <span key={i} className="absolute rounded-full"
            style={{
              left: `${x}%`, top: `${y}%`, width: s, height: s,
              background: i % 3 === 0 ? '#fff' : '#E50914',
              filter: 'blur(1px)',
              boxShadow: i % 3 === 0 ? 'none' : '0 0 10px rgba(229,9,20,0.9)',
              animation: `tozYuksel ${5 + (i % 3)}s linear ${d}s infinite`,
            }} />
        ))}
      </div>

      <div className="relative text-center px-4"
        style={dagil
          ? { animation: 'dumanDagil 1.3s ease-in both', filter: 'url(#splashDuman)' }
          : { animation: 'splashYakin 4s ease-out both' }}>
        <img src="/images/rendir-media.jpg" alt="Rendir Media"
          className="w-[220px] md:w-[300px] mx-auto object-contain mb-7"
          style={{ filter: 'drop-shadow(0 0 45px rgba(229,9,20,0.45))' }} />
        <h1 className="font-black tracking-[0.28em] text-white text-[26px] md:text-[44px] pl-[0.28em]" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          {'RENDIR MEDIA'.split('').map((h, i) => (
            <span key={i} className="inline-block"
              style={{ animation: 'harfSplash 1s ease-out both', animationDelay: `${0.5 + i * 0.14}s` }}>
              {h === ' ' ? '\u00A0' : h}
            </span>
          ))}
        </h1>
      </div>
    </div>
  )
}
