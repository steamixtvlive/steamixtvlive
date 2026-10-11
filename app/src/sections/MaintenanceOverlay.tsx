export default function MaintenanceOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-[#05070f]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;800;900&family=Inter:wght@400;500;600&display=swap');
        @keyframes yildiz { 0%,100% { opacity: 0.35 } 50% { opacity: 1 } }
        @keyframes yorunge { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }
        @keyframes nabiz { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }
        @keyframes yukBar { 0% { transform: translateX(-110%) } 100% { transform: translateX(220%) } }
        @keyframes suruklen { 0% { transform: translateY(0) } 100% { transform: translateY(-50%) } }
      `}</style>

      {/* yıldız tarlası */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'radial-gradient(1.5px 1.5px at 12% 22%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 68% 8%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 84% 34%, #9fd8ff 50%, transparent 51%), radial-gradient(1px 1px at 32% 66%, #fff 50%, transparent 51%), radial-gradient(2px 2px at 52% 48%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 8% 82%, #9fd8ff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 92% 74%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 44% 12%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 76% 58%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 22% 44%, #fff 50%, transparent 51%)',
        backgroundSize: '640px 640px',
        animation: 'yildiz 3.2s ease-in-out infinite',
      }} />
      {/* nebula */}
      <div className="absolute -top-40 -left-40 w-[560px] h-[560px] rounded-full bg-indigo-600/20 blur-[110px]" />
      <div className="absolute -bottom-48 -right-40 w-[620px] h-[620px] rounded-full bg-[#0099ff]/15 blur-[120px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,#05070f_90%)]" />

      {/* içerik */}
      <div className="relative flex-1 flex items-center justify-center px-4 overflow-y-auto">
        <div className="text-center max-w-[560px] py-10">
          {/* yörüngeli logo */}
          <div className="flex justify-center mb-7">
            <div className="relative w-[120px] h-[120px] flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-dashed border-[#0099ff]/40" style={{ animation: 'yorunge 14s linear infinite' }}>
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,1)]" />
              </div>
              <div className="absolute inset-3 rounded-full border border-white/10" />
              <div className="absolute inset-0 rounded-full bg-[#0099ff]/15 blur-2xl" />
              <img src="/images/steamix-logo.jpg" alt="Steamix TV" className="relative w-[72px] h-[72px] rounded-2xl object-cover ring-1 ring-white/20 shadow-[0_0_35px_rgba(0,153,255,0.5)]" />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/15 mb-5">
            <span className="w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]" style={{ animation: 'nabiz 1.6s ease-in-out infinite' }} />
            <span className="text-[11px] font-semibold tracking-[0.22em] text-gray-300 uppercase">Planlı Bakım</span>
          </div>

          <h1 className="text-[36px] md:text-[54px] font-black leading-none tracking-tight mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            <span className="bg-gradient-to-r from-[#0099ff] via-cyan-200 to-purple-400 bg-clip-text text-transparent">TEKNİK</span>
            <span className="text-white"> BAKIM</span>
          </h1>

          <p className="text-[13px] md:text-sm text-gray-400 leading-relaxed mb-7" style={{ fontFamily: 'Inter, sans-serif' }}>
            Sistemlerimizde iyileştirme çalışması yapılıyor. Çalışma tamamlandığında bu ekrandan duyuracağız.
          </p>

          {/* cam çipler */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mb-8">
            {['Sunucular', 'Veritabanı', 'Ağ Altyapısı'].map(c => (
              <span key={c} className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/[0.05] border border-white/10 backdrop-blur-md text-xs text-gray-200">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.9)]" style={{ animation: 'nabiz 1.8s ease-in-out infinite' }} />{c}
              </span>
            ))}
          </div>

          {/* yükleniyor */}
          <div className="w-full max-w-[400px] mx-auto">
            <div className="relative h-[10px] rounded-full bg-white/[0.06] border border-white/10 overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]">
              <div className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-gradient-to-r from-indigo-500 via-[#0099ff] to-cyan-300 shadow-[0_0_16px_rgba(0,153,255,0.9)]" style={{ animation: 'yukBar 2.4s ease-in-out infinite' }} />
              <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
            </div>
            <p className="mt-2.5 text-[10px] font-semibold tracking-[0.28em] text-gray-500 uppercase">Çalışma sürüyor</p>
          </div>
        </div>
      </div>

      {/* alt bar */}
      <div className="relative shrink-0 border-t border-white/10 bg-black/60 px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-1">
        <span className="text-[11px] text-gray-500 tracking-widest uppercase">Steamix Live IPTV</span>
        <span className="text-[11px] text-gray-600">© 2027 Steamix Live IPTV — Tüm hakları saklıdır.</span>
      </div>
    </div>
  )
}
