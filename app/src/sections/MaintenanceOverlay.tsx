const BARLAR = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0']

export default function MaintenanceOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-black">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;800;900&family=Inter:wght@400;500;600&display=swap');
        @keyframes parazit { 0% { background-position: 0 0 } 20% { background-position: -60px 30px } 40% { background-position: 40px -50px } 60% { background-position: -30px -70px } 80% { background-position: 70px 60px } 100% { background-position: 0 0 } }
        @keyframes yayinNokta { 0%,100% { opacity: 1 } 50% { opacity: 0.25 } }
        @keyframes altaKay { 0% { transform: translateY(-100%) } 100% { transform: translateY(100%) } }
        @keyframes yukBar { 0% { transform: translateX(-110%) } 100% { transform: translateX(220%) } }
      `}</style>

      {/* renk barları */}
      <div className="flex h-[16vh] min-h-[90px] shrink-0">
        {BARLAR.map(b => (
          <div key={b} className="flex-1" style={{ background: b }} />
        ))}
      </div>

      {/* orta alan */}
      <div className="relative flex-1 flex items-center justify-center px-4 overflow-hidden" style={{ background: '#0a0a0a' }}>
        {/* parazit */}
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)'/%3E%3C/svg%3E")`,
            animation: 'parazit 0.45s steps(2) infinite',
          }} />
        {/* tarama çizgisi */}
        <div className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-white/[0.05] to-transparent pointer-events-none" style={{ animation: 'altaKay 5s linear infinite' }} />

        <div className="relative text-center max-w-[560px]">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-red-500/50 bg-red-500/10 mb-6">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)]" style={{ animation: 'yayinNokta 1.2s ease-in-out infinite' }} />
            <span className="text-[11px] font-bold tracking-[0.25em] text-red-400 uppercase">Planlı Bakım</span>
          </div>

          <h1 className="text-[34px] md:text-[52px] font-black leading-none tracking-tight text-white mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            TEKNİK<br />BAKIM
          </h1>

          <p className="text-[13px] md:text-sm text-gray-400 leading-relaxed mb-7" style={{ fontFamily: 'Inter, sans-serif' }}>
            Sistemlerimizde iyileştirme çalışması yapılıyor. Çalışma tamamlandığında bu ekrandan duyuracağız.<br />
            Sorularınız için destek hattımız açık.
          </p>

          <div className="w-full max-w-[420px] mx-auto">
            <div className="flex items-center justify-between mb-2 px-0.5">
              <span className="text-[10px] font-semibold tracking-[0.25em] text-gray-500 uppercase">Çalışma durumu</span>
              <span className="text-[10px] font-semibold tracking-[0.25em] text-[#7dd3ff] uppercase" style={{ animation: 'yayinNokta 1.6s ease-in-out infinite' }}>Sürüyor</span>
            </div>
            <div className="relative h-[10px] rounded-full bg-white/[0.06] border border-white/10 overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]">
              <div className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-gradient-to-r from-[#0099ff] via-cyan-300 to-[#0099ff] shadow-[0_0_16px_rgba(0,153,255,0.9)]" style={{ animation: 'yukBar 2.4s ease-in-out infinite' }} />
              <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* alt bar */}
      <div className="shrink-0 border-t border-white/10 bg-black/80 px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-1 max-w-none">
        <span className="text-[11px] text-gray-500 tracking-widest uppercase">Steamix Live IPTV</span>
        <span className="text-[11px] text-gray-600">© 2027 Steamix Live IPTV — Tüm hakları saklıdır.</span>
      </div>
    </div>
  )
}
