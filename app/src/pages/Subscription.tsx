import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingCart, Check } from 'lucide-react'

export default function Subscription() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0f172a]/60">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />Geri
        </button>
        <div className="text-center mb-10">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Steamix <span className="text-[#0099ff]">TV</span>
          </h1>
          <p className="text-sm text-gray-500">Size en uygun planı seçin, tüm içeriklere sınırsız erişim</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {[
            { name: '1 AYLIK', price: '300 TL', link: 'https://www.shopier.com/platool/49623989', features: ['4K Ultra HD', 'Sınırsız İzleme', 'Tüm Kategoriler', 'VOD + Arşiv', '7/24 Destek'] },
            { name: '3 AYLIK', price: '600 TL', link: 'https://www.shopier.com/platool/49624003', popular: true, features: ['4K Ultra HD', 'Sınırsız İzleme', 'Tüm Kategoriler', 'VOD + Arşiv', '7/24 Destek', 'En Popüler Seçim'] },
            { name: '12 AYLIK', price: '1.200 TL', link: 'https://www.shopier.com/platool/49624023', features: ['4K Ultra HD', 'Sınırsız İzleme', 'Tüm Kategoriler', 'VOD + Arşiv', '7/24 Destek'] },
          ].map(p => (
            <div key={p.name} className={`relative rounded-2xl p-6 border transition-all duration-300 hover:scale-[1.03] flex flex-col ${p.popular ? 'border-[#0099ff] bg-[#0099ff]/5 shadow-lg shadow-[#0099ff]/10' : 'border-white/10 bg-white/5'}`}>
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#0099ff] to-purple-500 text-white text-xs font-semibold whitespace-nowrap shadow-lg">
                  En Popüler
                </div>
              )}
              <div className="text-center mb-4 mt-2">
                <p className="text-xs text-gray-500 tracking-widest mb-2">{p.name}</p>
                <div className="text-3xl md:text-4xl font-bold text-[#0099ff] mb-1">{p.price}</div>
              </div>
              <div className="flex-1 space-y-2 mb-6">
                {p.features?.map(f => (
                  <div key={f} className="flex items-center gap-2 text-xs text-gray-300">
                    <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <a href={p.link} target="_blank" rel="noopener noreferrer"
                className="block w-full py-3 rounded-xl bg-gradient-to-r from-[#0099ff] to-blue-600 text-white font-semibold text-sm text-center hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#0099ff]/20">
                <ShoppingCart className="w-4 h-4" />Satın Al
              </a>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-3 max-w-xl mx-auto">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-xs text-gray-400 leading-relaxed text-center">
              <span className="text-yellow-400 font-semibold">📌 Önemli:</span> Satın aldıktan sonra{' '}
              <a href="https://t.me/streamsupport00" target="_blank" rel="noopener noreferrer" className="text-[#0099ff] font-medium hover:underline">Telegram 7/24 destek</a> hattına
              satın aldığınıza dair ekran görüntüsü atın. Yönetici tarafından onaylanıp en kısa sürede
              abonelik giriş bilgileriniz size teslim edilecektir.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <p className="text-xs text-yellow-300 leading-relaxed text-center">
              ⚠️ Shopier resmi kuralları gereği abonelikler sınırlıdır; satın aldığınız abonelik tamamlandıktan
              sonra ek olarak yalnızca bir defaya mahsus tekrar alınabilir.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

