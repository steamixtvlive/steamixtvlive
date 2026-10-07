export default function RendirBadge() {
  return (
    <span className="inline-flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full bg-gradient-to-r from-[#0099ff]/15 to-purple-500/15 border border-[#0099ff]/30 shadow-[0_0_15px_rgba(0,153,255,0.25)]">
      <span className="w-8 h-8 rounded-full flex items-center justify-center ring-1 ring-[#0099ff]/40 overflow-hidden">
        <img src="/images/rendir-media.jpg" alt="Rendir Media" className="w-8 h-8 object-cover" />
      </span>
      <span className="text-xs md:text-sm font-bold tracking-[0.2em] uppercase bg-gradient-to-r from-[#7dd3ff] to-purple-300 bg-clip-text text-transparent" style={{ fontFamily: 'Orbitron, sans-serif' }}>rendır media</span>
    </span>
  )
}
