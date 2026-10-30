import { BrowserRouter, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import NotflixSplash from '@/sections/NotflixSplash'
import GeilApp from '@/geil/GeilApp'
import type { VavooCatalog } from '@/lib/vavoo'
import NotflixVodWatch from '@/pages/NotflixVodWatch'
import VavooPlayerRoute from '@/sections/NotflixPlayer'
import { resolveVavooChannel, resolveVavooVariant } from '@/lib/vavoo'
import { useEffect, useState } from 'react'
type Stage = 'splash' | 'app'

export default function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>
}

function AppContent() {
  const navigate = useNavigate()
  const [stage, setStage] = useState<Stage>('splash')
  const [catalog, setCatalog] = useState<VavooCatalog | null>(() => ({ ok: true, source: 'embedded', group: 'all', total: 0, rawTotal: 0, generatedAt: Date.now(), countries: [], channels: [] }))
  const member = { username: 'Notflix Kullanıcısı', hasSubscription: false, subscriptionExpiresAt: null, banned: false }
  const location = useLocation()
  const isVavooWatch = location.pathname.startsWith('/notflix/vavoo/')
  const isVodWatch = location.pathname.startsWith('/notflix/watch/')
  const watchAllowed = true

  const finishSplash = () => {
    setStage('app')
  }

  return (
    <>
      {isVavooWatch ? (
        <Routes><Route path="/notflix/vavoo/:id" element={watchAllowed ? catalog ? <VavooWatch channels={catalog.channels} /> : <NotflixSplash onDone={finishSplash} /> : <main className="nf-vod-watch__message">İçerikleri izleyebilmek için lütfen geçerli bir abonelik paketi satın alınız.<button type="button" onClick={() => navigate('/')}>Keşfet’e dön</button></main>} /></Routes>
      ) : isVodWatch ? (watchAllowed ? (
        <Routes><Route path="/notflix/watch/:type/:id" element={<NotflixVodWatch />} /><Route path="*" element={<NotflixVodWatch />} /></Routes>
      ) : <main className="nf-vod-watch__message">İçerikleri izleyebilmek için lütfen geçerli bir abonelik paketi satın alınız.<button type="button" onClick={() => navigate('/')}>Keşfet’e dön</button></main>)
      : stage === 'splash' ? <NotflixSplash onDone={finishSplash} /> : null}

      {!isVavooWatch && !isVodWatch && stage === 'app' && (
        <div className="notflix-app-enter nf-shell-enter">
          <GeilApp />
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
