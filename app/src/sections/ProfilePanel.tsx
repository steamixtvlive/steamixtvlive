import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { parseSureDuration } from '@/lib/supabase'
import { STEAMIX_TV_APK_URL } from '@/lib/constants'
import { ArrowLeft, Check, Loader2, ShoppingCart, LogOut, Edit3, User, Clock, Calendar, ChevronDown, Download } from 'lucide-react'

const avatars = [1, 2, 3, 4, 5]

function calcRemaining(startMs: number | null | undefined, sure: string, now: number) {
  if (!sure || sure === '0' || !startMs) return { remaining: -1, total: -1, endDate: null }
  const start = typeof startMs === 'string' ? parseInt(startMs) : startMs
  const totalMs = parseSureDuration(sure)
  if (totalMs <= 0) return { remaining: -1, total: -1, endDate: null }
  const elapsed = now - start
  const remaining = Math.max(0, totalMs - elapsed)
  const endDate = new Date(start + totalMs)
  return { remaining, total: totalMs, endDate }
}

function formatDurationFull(ms: number): string {
  if (ms <= 0) return 'Süre doldu'
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}g`)
  if (hours > 0) parts.push(`${hours}s`)
  if (minutes > 0) parts.push(`${minutes}d`)
  parts.push(`${seconds}sn`)
  return parts.join(' ')
}

export default function ProfilePanel() {
  const { user, saveAvatar, logout } = useAuth()
  const navigate = useNavigate()
  const [showAvatars, setShowAvatars] = useState(false)
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [renewOpen, setRenewOpen] = useState(false)
  const [logouting, setLogouting] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!logouting) return
    const id = setTimeout(() => { logout(); navigate('/login') }, 4000)
    return () => clearTimeout(id)
  }, [logouting, logout, navigate])

  const sureStr = user?.SÜRE || (user as any)?.süre || '0'
  const sub = calcRemaining(user?.sure_start_ms, sureStr, now)
  const isUnlimited = !sureStr || sureStr === '0'
  const isExpired = sub.remaining === 0
  const progress = sub.total > 0 ? ((sub.total - sub.remaining) / sub.total) * 100 : 0
  const elapsed = sub.total > 0 ? sub.total - sub.remaining : 0

  const handleAvatarSave = async (num: number) => {
    if (!user) return
    setSaving(true)
    await saveAvatar(num)
    setSaving(false)
    setShowAvatars(false)
  }

  return (
    <div className="min-h-screen bg-[#0f172a]/60 pt-20 md:pt-24 pb-24">
      <div className="max-w-3xl mx-auto px-4">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />Geri
        </button>

        {/* Kullanıcı Kartı */}
        <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-2xl p-6 md:p-8 border border-white/10 mb-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <button onClick={() => setShowAvatars(true)} className="relative group shrink-0">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-700 shadow-lg shadow-[#0099ff]/20 ring-2 ring-white/10 group-hover:ring-[#0099ff]/50 transition-all duration-300">
                {user?.avatar && user.avatar >= 1 && user.avatar <= 5 ? (
                  <img src={`/images/avatar${user.avatar}.jpg`} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#0099ff] to-purple-500 flex items-center justify-center text-3xl font-bold text-white">
                    {user?.username?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Edit3 className="w-6 h-6 text-white" />
                </div>
              </div>
            </button>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl font-bold text-white">{user?.username}</h1>
              <p className="text-sm text-gray-500 mt-1">Hesabın aktif ve kullanıma hazır</p>
              <div className="flex items-center justify-center md:justify-start gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <div className={`w-2 h-2 rounded-full ${isExpired ? 'bg-red-400' : 'bg-green-400'}`} />
                  <span className={isExpired ? 'text-red-400' : 'text-green-400'}>{isExpired ? 'Süresi Doldu' : 'Aktif'}</span>
                </div>
                {!isUnlimited && sub.remaining > 0 && (
                  <span className="text-xs text-gray-500">{formatDurationFull(sub.remaining)} kaldı</span>
                )}
                {isUnlimited && <span className="text-xs text-[#0099ff]">Sınırsız</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { if (logouting) return; setLogouting(true) }}
                disabled={logouting}
                className="px-4 py-2 rounded-xl bg-white/10 text-gray-400 text-xs font-semibold hover:text-white hover:bg-white/20 transition-all flex items-center gap-1.5 disabled:opacity-50">
                {logouting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Çıkış yapılıyor...</> : <><LogOut className="w-3.5 h-3.5" />Çıkış</>}
              </button>
            </div>
          </div>
        </div>

        {/* ABONELİK DURUMU */}
        {!isUnlimited && sub.endDate && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-[#0099ff] rounded-full" />
              <h2 className="text-sm font-bold text-white tracking-widest" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                ABONELİK <span className="text-[#0099ff]">DURUMU</span>
              </h2>
            </div>
            <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-2xl p-6 border border-white/10">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="flex items-center gap-3 bg-white/[0.02] rounded-xl p-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Geçen Süre</p>
                    <p className="text-sm font-bold text-white font-mono">{formatDurationFull(elapsed)}</p>
                    <p className="text-[10px] text-gray-600">{sub.endDate ? new Date(user?.sure_start_ms || Date.now()).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/[0.02] rounded-xl p-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0099ff]/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-[#0099ff]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Kalan Süre</p>
                    <p className="text-sm font-bold text-white font-mono">{formatDurationFull(sub.remaining)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/[0.02] rounded-xl p-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Bitiş Tarihi</p>
                    <p className="text-sm font-bold text-white">{sub.endDate ? sub.endDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</p>
                  </div>
                </div>
              </div>
              <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#0099ff] to-blue-500 transition-all duration-1000" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-gray-600">Başlangıç</span>
                <span className="text-[10px] text-gray-600">{Math.round(Math.min(100, Math.max(0, progress)))}%</span>
                <span className="text-[10px] text-gray-600">Bitiş</span>
              </div>
            </div>
          </div>
        )}

        {/* ABONELİK YENİLE - Akordiyon */}
        <div className="mb-8">
          <button onClick={() => setRenewOpen(!renewOpen)} className="w-full flex items-center gap-2 mb-4 cursor-pointer group">
            <div className="w-1 h-5 bg-[#0099ff] rounded-full" />
            <h2 className="text-sm font-bold text-white tracking-widest flex-1 text-left" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              ABONELİK <span className="text-[#0099ff]">YENİLE</span>
            </h2>
            <ChevronDown className={`w-4 h-4 text-gray-500 group-hover:text-white transition-all duration-300 ${renewOpen ? 'rotate-180' : ''}`} />
          </button>
          <div className={`transition-all duration-500 ${renewOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
              {[
                { name: '1 AYLIK', price: '300 TL', link: 'https://www.shopier.com/platool/49623989', features: ['4K Ultra HD', 'Sınırsız İzleme', 'Tüm Kategoriler', 'VOD + Arşiv', '7/24 Destek'] },
                { name: '3 AYLIK', price: '600 TL', link: 'https://www.shopier.com/platool/49624003', popular: true, features: ['4K Ultra HD', 'Sınırsız İzleme', 'Tüm Kategoriler', 'VOD + Arşiv', '7/24 Destek', 'En Popüler Seçim'] },
                { name: '12 AYLIK', price: '1.200 TL', link: 'https://www.shopier.com/platool/49624023', features: ['4K Ultra HD', 'Sınırsız İzleme', 'Tüm Kategoriler', 'VOD + Arşiv', '7/24 Destek'] },
              ].map(p => (
                <div key={p.name} className={`relative rounded-3xl p-6 border transition-all duration-300 hover:-translate-y-1.5 ${p.popular ? 'border-[#0099ff]/60 bg-gradient-to-b from-[#0099ff]/[0.14] to-[#0099ff]/[0.02] shadow-[0_0_45px_rgba(0,153,255,0.18)]' : 'border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] hover:border-white/25 hover:shadow-[0_0_30px_rgba(0,153,255,0.1)]'}`}>
                  <div className={`absolute top-0 inset-x-0 h-1 rounded-t-3xl ${p.popular ? 'bg-gradient-to-r from-[#0099ff] via-blue-400 to-purple-500' : 'bg-gradient-to-r from-white/15 to-white/5'}`} />
                  {p.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#0099ff] to-purple-500 text-white text-[11px] font-bold tracking-wide whitespace-nowrap shadow-lg shadow-[#0099ff]/40 ring-2 ring-[#0099ff]/20">
                      En Popüler
                    </div>
                  )}
                  <div className="text-center mb-5 mt-3">
                    <p className="text-[11px] font-semibold text-gray-400 tracking-[0.25em] uppercase mb-3">{p.name}</p>
                    <div className="text-4xl font-extrabold bg-gradient-to-r from-[#0099ff] to-purple-400 bg-clip-text text-transparent mb-1 drop-shadow-[0_0_15px_rgba(0,153,255,0.35)]">{p.price}</div>
                  </div>
                  <ul className="space-y-2.5 mb-6">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-xs text-gray-300">
                        <span className="w-4 h-4 rounded-full bg-[#0099ff]/15 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-[#0099ff]" />
                        </span>{f}
                      </li>
                    ))}
                  </ul>
                  <a href={p.link} target="_blank" rel="noopener noreferrer"
                    className="block w-full py-3 rounded-xl bg-gradient-to-r from-[#0099ff] via-blue-500 to-purple-600 text-white font-bold text-xs tracking-wide text-center hover:shadow-[0_0_25px_rgba(0,153,255,0.5)] hover:scale-[1.02] active:scale-[0.97] transition-all flex items-center justify-center gap-2">
                    <ShoppingCart className="w-4 h-4" />Satın Al
                  </a>
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-3">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-yellow-500/[0.07] to-transparent border border-yellow-500/15 border-l-4 border-l-yellow-500/50">
                <p className="text-xs text-gray-400 leading-relaxed">
                  <span className="text-yellow-400 font-bold">📌 Önemli:</span> Satın aldıktan sonra{' '}
                  <a href="https://t.me/streamsupport00" target="_blank" rel="noopener noreferrer" className="text-[#0099ff] font-semibold hover:underline">Telegram 7/24 destek</a> hattına
                  satın aldığınıza dair ekran görüntüsü atın. Yönetici tarafından onaylanıp en kısa sürede
                  abonelik giriş bilgileriniz size teslim edilecektir.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500/[0.08] to-transparent border border-orange-500/15 border-l-4 border-l-orange-500/50">
                <p className="text-xs text-orange-300 leading-relaxed">
                  ⚠️ Shopier resmi kuralları gereği abonelikler sınırlıdır; satın aldığınız abonelik tamamlandıktan
                  sonra ek olarak yalnızca bir defaya mahsus tekrar alınabilir.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Hesap Bilgileri */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 tracking-widest">HESAP BİLGİLERİ</h3>
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <p className="text-xs text-gray-500 mb-1">Kullanıcı Adı</p>
            <p className="text-sm text-white font-medium">{user?.username}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <p className="text-xs text-gray-500 mb-1">Abonelik Türü</p>
            <p className="text-sm text-white font-medium">
              {isUnlimited ? 'Sınırsız' : isExpired ? 'Süre doldu' : formatDurationFull(sub.remaining)}
            </p>
          </div>
          {user?.sure_start_ms && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <p className="text-xs text-gray-500 mb-1">Başlangıç Tarihi</p>
              <p className="text-sm text-white font-medium">{new Date(typeof user.sure_start_ms === 'string' ? parseInt(user.sure_start_ms) : user.sure_start_ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          )}
          {sub.endDate && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <p className="text-xs text-gray-500 mb-1">Bitiş Tarihi</p>
              <p className="text-sm text-white font-medium">{sub.endDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          )}
        </div>
      </div>

        {/* UYGULAMAYI İNDİR */}
        <div className="mt-6 mb-8">
          <div className="bg-gradient-to-br from-[#0099ff]/10 to-purple-500/10 rounded-2xl p-6 border border-[#0099ff]/20">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0099ff] to-purple-500 flex items-center justify-center shrink-0 shadow-lg shadow-[#0099ff]/30">
                <Download className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-white font-bold text-base">Mobil Uygulamayı İndir</h3>
                <p className="text-sm text-gray-400 mt-1">Steamix TV uygulamasını şimdi TV box'unuzda ve mobil cihazlarınızda deneyin</p>
              </div>
              <a href={STEAMIX_TV_APK_URL}
                target="_blank" rel="noopener noreferrer"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-[#0099ff] to-blue-600 text-white text-sm font-semibold hover:shadow-[0_0_30px_rgba(0,153,255,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap">
                <Download className="w-4 h-4" />İndir
              </a>
            </div>
          </div>
        </div>

      {/* Avatar Seç - Modern Modal */}
      {showAvatars && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAvatars(false)} />
          <div className="relative z-10 bg-gradient-to-b from-gray-900 to-gray-950 rounded-3xl p-8 max-w-sm w-full mx-4 border border-white/10 shadow-2xl shadow-[#0099ff]/5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-[#0099ff]" /> Avatar Seç
              </h3>
              <button onClick={() => setShowAvatars(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-4 mb-4">
              {avatars.map(id => (
                <button key={id} onClick={() => handleAvatarSave(id)} disabled={saving}
                  className={`relative w-full aspect-square rounded-2xl overflow-hidden ring-2 transition-all duration-300 hover:scale-110 ${
                    user?.avatar === id ? 'ring-[#0099ff] ring-offset-4 ring-offset-gray-900 shadow-lg shadow-[#0099ff]/30' : 'ring-white/10 hover:ring-white/30'
                  }`}>
                  <img src={`/images/avatar${id}.jpg`} alt="" className="w-full h-full object-cover" />
                  {user?.avatar === id && (
                    <div className="absolute inset-0 bg-[#0099ff]/20 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-[#0099ff] flex items-center justify-center shadow-lg">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
            {saving && (
              <div className="flex items-center justify-center gap-2 text-xs text-[#0099ff]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Kaydediliyor...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


