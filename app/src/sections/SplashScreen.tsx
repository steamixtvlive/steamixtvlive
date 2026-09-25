import { useEffect, useState } from 'react'

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 4400)
    const t2 = setTimeout(onDone, 5000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  return (
    <div
      onClick={() => onDone()}
      className={`fixed inset-0 z-[10000] flex items-center justify-center overflow-hidden bg-[#04060d] cursor-pointer transition-opacity duration-500 ${leaving ? 'opacity-0' : 'opacity-100'}`}
    >
      <style>{`
        @keyframes splashBar { 0% { width: 4% } 100% { width: 100% } }
        @keyframes splashLogoFloat { 0%,100% { transform: translateY(0) scale(1) } 50% { transform: translateY(-8px) scale(1.03) } }
        @keyframes splashLogoGlow { 0%,100% { box-shadow: 0 0 40px rgba(0,153,255,0.45), 0 0 90px rgba(168,85,247,0.25) } 50% { box-shadow: 0 0 70px rgba(0,153,255,0.7), 0 0 130px rgba(168,85,247,0.45) } }
        @keyframes splashTextIn { 0% { opacity: 0; transform: translateY(12px) } 100% { opacity: 1; transform: translateY(0) } }
        @keyframes splashShimmer { 0% { transform: translateX(-100%) } 100% { transform: translateX(200%) } }
      `}</style>

      {/* arka plan */}
      <div className="absolute inset-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#0099ff]/10 blur-[130px]" />
        <div className="absolute -bottom-40 left-1/4 w-[420px] h-[420px] rounded-full bg-purple-500/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,#04060d_85%)]" />
      </div>
      <div className="absolute top-0 inset-x-0 h-[2px] bg-white/5 overflow-hidden">
        <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#0099ff] to-purple-500" style={{ animation: 'splashShimmer 2s linear infinite' }} />
      </div>

      <div className="relative flex flex-col items-center px-6 text-center">
        {/* logo */}
        <div className="w-24 h-24 md:w-28 md:h-28 rounded-[28px] bg-gradient-to-br from-[#0a2540] to-[#1e1b4b] border border-[#0099ff]/40 flex items-center justify-center mb-7" style={{ animation: 'splashLogoFloat 3s ease-in-out infinite, splashLogoGlow 2.4s ease-in-out infinite' }}>
          <img src="/images/render-logo.svg" alt="rendır media" className="w-14 h-14 md:w-16 md:h-16" />
        </div>

        <div className="text-[11px] tracking-[0.35em] uppercase text-[#7dd3ff]/80 mb-3" style={{ animation: 'splashTextIn 0.7s ease-out both' }}>rendır media</div>
        <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-wide" style={{ fontFamily: 'Orbitron, sans-serif', animation: 'splashTextIn 0.7s ease-out 0.15s both' }}>
          HOŞGELDİNİZ
        </h1>
        <p className="mt-4 text-[13px] md:text-sm text-gray-400 max-w-[420px] leading-relaxed" style={{ animation: 'splashTextIn 0.7s ease-out 0.3s both' }}>
          Sınırsız eğlence, kesintisiz keyif sizi bekliyor.<br />Devam etmek için bekleyin veya dokunun.
        </p>

        {/* ilerleme */}
        <div className="mt-8 w-[220px] md:w-[260px] h-[5px] rounded-full bg-white/5 border border-white/10 overflow-hidden p-[1.5px]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#0099ff] via-blue-400 to-purple-500 shadow-[0_0_12px_rgba(0,153,255,0.7)]" style={{ animation: 'splashBar 4.4s linear forwards' }} />
        </div>
        <div className="mt-5 text-[10px] tracking-[0.25em] uppercase text-gray-600">Steamix TV Company</div>
      </div>

      <div className="absolute bottom-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
    </div>
  )
}
