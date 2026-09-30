import { useNavigate, useLocation } from 'react-router-dom'
import { useLang } from '@/lib/language'
import { useAuth } from '@/hooks/use-auth'
import { Home, Tv, Film, Clapperboard, Settings, LogOut, Globe, ChevronDown, Heart, Gamepad2 } from 'lucide-react'
import { useState } from 'react'
import RendirBadge from '@/sections/RendirBadge'

const allTabs = [
  { key: 'home', icon: Home, labelKey: 'nav.home' },
  { key: 'live', icon: Tv, labelKey: 'nav.live' },
  { key: 'movies', icon: Film, labelKey: 'nav.movies' },
  { key: 'series', icon: Clapperboard, labelKey: 'nav.series' },
  { key: 'favorites', icon: Heart, labelKey: 'Favoriler' },
  { key: 'games', icon: Gamepad2, labelKey: 'Oyunlar' },
]

interface NavbarProps {
  categoryName?: string
}

export default function Navbar({ categoryName }: NavbarProps) {
  const { t, lang, setLang, langNames, languages } = useLang()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [langOpen, setLangOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const params = new URLSearchParams(location.search)
  const activeTab = params.get('tab') || 'home'
  const liveDisabled = user?.["canlı tv"] === '0' || user?.["canlı tv"] === 'false' || user?.["canlı tv"] === 'kapalı'
  const tabs = allTabs.filter(t => t.key !== 'live' || !liveDisabled)

  const handleTab = (key: string) => {
    if (key === 'home') navigate('/dashboard')
    else navigate(`/dashboard?tab=${key}`)
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/95 via-black/70 to-transparent backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <div className="flex items-center gap-2 md:gap-6">
            <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 shrink-0">
              <img src="/images/steamix-logo.jpg" alt="" className="w-8 h-8 md:w-10 md:h-10 rounded-lg" />
              <span className="text-lg md:text-xl font-bold text-white tracking-wider" style={{ fontFamily: 'Orbitron, sans-serif' }}>Steamix <span className="text-[#0099ff]">TV</span></span>
              <RendirBadge />
            </button>
            <div className="hidden md:flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {tabs.map(tab => {
                const isActive = activeTab === tab.key
                const showCat = isActive && categoryName && (tab.key === 'movies' || tab.key === 'series')
                return (
                <button key={tab.key} onClick={() => handleTab(tab.key)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all group ${
                    isActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}>
                  <tab.icon className="w-4 h-4" />
                  <span className="flex flex-col items-start leading-tight">
                    <span>{t(tab.labelKey)}</span>
                    {showCat && <span className="text-[9px] text-[#0099ff] font-normal opacity-80 group-hover:opacity-100">{categoryName}</span>}
                  </span>
                </button>
              )})}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setLangOpen(!langOpen)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all">
                <Globe className="w-4 h-4" /><span className="hidden sm:inline">{langNames[lang]}</span><ChevronDown className={`w-3 h-3 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
              </button>
              {langOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setLangOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-xl bg-gray-900 border border-white/10 shadow-2xl overflow-hidden">
                    {languages.map((l: string) => (
                      <button key={l} onClick={() => { setLang(l); setLangOpen(false) }}
                        className={`w-full px-4 py-2.5 text-sm text-left transition-colors ${lang === l ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>{langNames[l]}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="relative">
              <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-[#0099ff]/10 hover:shadow-[0_0_15px_rgba(0,153,255,0.3)] transition-all duration-300 group">
                <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-700 ring-0 group-hover:ring-2 group-hover:ring-[#0099ff]/50 transition-all duration-300">
                  {user?.avatar && user.avatar >= 1 && user.avatar <= 5 ? (
                    <img src={`/images/avatar${user.avatar}.jpg`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#0099ff] to-purple-500 flex items-center justify-center text-xs font-bold text-white">
                      {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                </div>
                <ChevronDown className={`w-3 h-3 hidden sm:block transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl bg-gray-900 border border-white/10 shadow-2xl overflow-hidden">
                    <button onClick={() => { navigate('/profile'); setProfileOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                      <Settings className="w-4 h-4" />{t('nav.profile')}
                    </button>
                    <button onClick={() => { logout(); navigate('/login'); setProfileOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors">
                      <LogOut className="w-4 h-4" />{t('nav.logout')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Mobile bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 flex border-t border-white/10 bg-black/95 backdrop-blur-lg z-50">
        {tabs.map(tab => {
          const isActive = activeTab === tab.key
          const showCat = isActive && categoryName && (tab.key === 'movies' || tab.key === 'series')
          return (
          <button key={tab.key} onClick={() => handleTab(tab.key)}
            className={`flex-1 flex flex-col items-center gap-0 py-1.5 text-[10px] font-medium transition-colors ${isActive ? 'text-[#0099ff]' : 'text-gray-500'}`}>
            <tab.icon className="w-5 h-5" />
            <span className="leading-tight">{t(tab.labelKey)}</span>
            {showCat && <span className="text-[7px] text-[#0099ff]/70 leading-tight truncate max-w-full px-1">{categoryName}</span>}
          </button>
        )})}
        <button onClick={() => navigate('/profile')} className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors text-gray-500`}>
          <Settings className="w-5 h-5" />{t('nav.profile')}
        </button>
      </div>
    </nav>
  )
}
