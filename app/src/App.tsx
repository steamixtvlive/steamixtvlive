import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import NotflixSplash from '@/sections/NotflixSplash'
import NotflixLogin from '@/pages/NotflixLogin'
import NotflixLoading from '@/pages/NotflixLoading'
import NotflixShell from '@/sections/NotflixShell'
import type { VavooCatalog } from '@/lib/vavoo'
import { preloadVodHome } from '@/lib/vod'
import NotflixVodWatch from '@/pages/NotflixVodWatch'
import VavooPlayerRoute from '@/sections/NotflixPlayer'
import { resolveVavooChannel, resolveVavooVariant } from '@/lib/vavoo'

type Stage = 'splash' | 'login' | 'loading' | 'app'

export default function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>
}

function AppContent() {
  const [stage, setStage] = useState<Stage>('splash')
  const [catalog, setCatalog] = useState<VavooCatalog | null>(null)
  const [activationProfile, setActivationProfile] = useState<{ fullName: string; username: string; expiresAt: number } | null>(null)
  const location = useLocation()
  const isVavooWatch = location.pathname.startsWith('/notflix/vavoo/')
  const isVodWatch = location.pathname.startsWith('/notflix/watch/')

  const handleReady = useCallback((nextCatalog: VavooCatalog) => {
    setCatalog(nextCatalog)
    setStage('app')
  }, [])

  useEffect(() => {
    void preloadVodHome().catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ fullName: string; username: string; expiresAt: number }>
      setActivationProfile(custom.detail)
    }
    window.addEventListener('notflix-developer-activated', handler)
    return () => window.removeEventListener('notflix-developer-activated', handler)
  }, [])

  return (
    <>
      {isVavooWatch ? (
        <Routes><Route path="/notflix/vavoo/:id" element={catalog ? <VavooWatch channels={catalog.channels} /> : <NotflixSplash onDone={() => setStage('login')} />} /></Routes>
      ) : isVodWatch ? (
        <Routes><Route path="/notflix/watch/:type/:id" element={<NotflixVodWatch />} /><Route path="*" element={<NotflixVodWatch />} /></Routes>
      ) : stage === 'splash' && <NotflixSplash onDone={() => setStage('login')} />}

      {!isVavooWatch && !isVodWatch && stage === 'login' && (
        <div className="notflix-app-enter">
          <NotflixLogin onActivated={() => setStage('loading')} />
        </div>
      )}

      {!isVavooWatch && !isVodWatch && stage === 'loading' && (
        <NotflixLoading onReady={handleReady} onCancel={() => setStage('login')} />
      )}

      {!isVavooWatch && !isVodWatch && stage === 'app' && catalog && (
        <div className="notflix-app-enter nf-shell-enter">
          <NotflixShell catalog={catalog} activationProfile={activationProfile} />
        </div>
      )}
    </>
  )
}

function VavooWatch({ channels }: { channels: VavooCatalog['channels'] }) {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const baseChannel = channels.find((entry) => entry.id === id || entry.qualityVariants?.some((variant) => variant.id === id))
  const variant = baseChannel?.qualityVariants?.find((entry) => entry.id === id)
  const channel = baseChannel && variant ? { ...baseChannel, ...variant } : baseChannel
  if (!channel) return <main className="nf-vod-watch"><button onClick={() => navigate('/')} type="button">Geri dön</button><p>Vavoo kanalı bulunamadı</p></main>
  return <main className="nf-vod-watch nf-vod-watch--live"><header className="nf-vod-watch__header"><button type="button" onClick={() => navigate('/')}>← Keşfet</button><strong>{channel.name}</strong><span>Canlı TV</span></header><NotflixLiveChannel channels={channels} channelId={channel.id} sourceId={baseChannel?.id || channel.id} quality={variant?.quality} /></main>
}

function NotflixLiveChannel({ channels, channelId, sourceId, quality }: { channels: VavooCatalog['channels']; channelId: string; sourceId: string; quality?: string }) {
  const [stream, setStream] = useState('')
  const channel = channels.find((entry) => entry.id === sourceId)
  useEffect(() => {
    if (!channel) return
    const controller = new AbortController()
    const streamRequest = quality ? resolveVavooVariant(sourceId, quality, controller.signal) : resolveVavooChannel(sourceId, false, controller.signal)
    void streamRequest.then((result) => setStream(result.stream)).catch(() => {})
    return () => controller.abort()
  }, [channel, quality, sourceId])
  return <VavooPlayerRoute channels={channels} initialId={channelId} initialStream={stream} />
}
