export default function RendirBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full bg-gradient-to-r from-[#0099ff]/15 to-purple-500/15 border border-[#0099ff]/30 shadow-[0_0_15px_rgba(0,153,255,0.25)]">
      <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center ring-1 ring-white/25 overflow-hidden">
        <img src="/images/render-logo.svg" alt="Render" className="w-4 h-4" />
      </span>
      <span className="text-[11px] md:text-xs font-bold tracking-[0.2em] uppercase bg-gradient-to-r from-[#7dd3ff] to-purple-300 bg-clip-text text-transparent" style={{ fontFamily: 'Orbitron, sans-serif' }}>rendır media</span>
    </span>
  )
}
