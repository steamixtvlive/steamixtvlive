import { Tv } from 'lucide-react'

export default function RendirBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full bg-gradient-to-r from-[#0099ff]/15 to-purple-500/15 border border-[#0099ff]/30 shadow-[0_0_15px_rgba(0,153,255,0.25)]">
      <style>{`
        @keyframes rendirTvGlow { 0%,100% { opacity:1; filter:drop-shadow(0 0 3px rgba(0,153,255,0.9)) } 50% { opacity:0.65; filter:drop-shadow(0 0 8px rgba(168,85,247,0.9)) } }
        @keyframes rendirTvFloat { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-1.5px) } }
      `}</style>
      <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#0099ff] to-purple-500 flex items-center justify-center ring-1 ring-white/25">
        <Tv className="w-3.5 h-3.5 text-white" style={{ animation: 'rendirTvGlow 2s ease-in-out infinite, rendirTvFloat 2s ease-in-out infinite' }} />
      </span>
      <span className="text-[11px] md:text-xs font-bold tracking-[0.2em] uppercase bg-gradient-to-r from-[#7dd3ff] to-purple-300 bg-clip-text text-transparent" style={{ fontFamily: 'Orbitron, sans-serif' }}>rendır</span>
    </span>
  )
}
