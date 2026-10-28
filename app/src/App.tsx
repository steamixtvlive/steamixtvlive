import { useCallback, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import NotflixSplash from '@/sections/NotflixSplash'
import NotflixLogin from '@/pages/NotflixLogin'
import NotflixLoading from '@/pages/NotflixLoading'
import NotflixShell from '@/sections/NotflixShell'
import type { VavooCatalog } from '@/lib/vavoo'
import { getChannelById, getChannelsByCategory, type RotationChannel } from '@/lib/rotation'
import VideoPlayer from '@/sections/VideoPlayer'
import VavooPlayer from '@/sections/NotflixPlayer'

type Stage = 'splash' | 'login' | 'loading' | 'app'

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

function AppRoutes() {
  const [stage, setStage] = useState<Stage>('splash')
  const [catalog, setCatalog] = useState<VavooCatalog | null>(null)
  const location = useLocation()
  const isRotationRoute = location.pathname.startsWith('/watch/rotation/')
  const isVavooRoute = location.pathname.startsWith('/watch/vavoo/')

  const handleReady = useCallback((nextCatalog: VavooCatalog) => {
    setCatalog(nextCatalog)
    setStage('app')
  }, [])

  return (
    <>
      {isRotationRoute || isVavooRoute ? (
        <Routes>
          <Route path="/watch/rotation/:id/:slug" element={<M3UChannelWatch />} />
          {catalog && <Route path="/watch/vavoo/:id" element={<VavooChannelWatch channels={catalog.channels} />} />}
          <Route path="*" element={<NotflixSplash onDone={() => setStage('login')} />} />
        </Routes>
      ) : stage === 'splash' ? <NotflixSplash onDone={() => setStage('login')} /> : null}

      {!isRotationRoute && !isVavooRoute && stage === 'login' && (
        <div className="notflix-app-enter">
          <NotflixLogin onActivated={() => setStage('loading')} />
        </div>
      )}

      {!isRotationRoute && !isVavooRoute && stage === 'loading' && (
        <NotflixLoading onReady={handleReady} onCancel={() => setStage('login')} />
      )}

      {!isRotationRoute && !isVavooRoute && stage === 'app' && (
        <div className="notflix-app-enter nf-shell-enter">
          <Routes>
            <Route path="/watch/rotation/:id/:slug" element={<M3UChannelWatch />} />
            <Route path="*" element={catalog ? <NotflixShell catalog={catalog} /> : <NotflixSplash onDone={() => setStage('login')} />} />
          </Routes>
        </div>
      )}
    </>
  )
}

function M3UChannelWatch() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = location.state as { returnTo?: string } | null
  const returnTo = routeState?.returnTo || '/'
  const channel = getChannelById(id)
  const [playback, setPlayback] = useState({ id, urlIndex: 0, key: 0, error: '' })
  const playbackState = playback.id === id ? playback : { id, urlIndex: 0, key: playback.key + 1, error: '' }

  const playChannel = (nextChannel: RotationChannel) => {
    navigate(`/watch/rotation/${encodeURIComponent(nextChannel.id)}/${encodeURIComponent(nextChannel.name.toLowerCase().replace(/\s+/g, '-'))}`, {
      replace: true,
      state: location.state,
    })
  }

  if (!channel || channel.urls.length === 0) {
    return (
      <main className="nf-m3u-watch-error">
        <h1>Yayın bulunamadı</h1>
        <p>Bu kanal M3U listesinde yok veya yayın adresi tanımlanmamış.</p>
        <button type="button" onClick={() => navigate(-1)}>Keşfet’e dön</button>
      </main>
    )
  }

  const currentUrl = channel.urls[playbackState.urlIndex]
  const goBack = () => {
    navigate(returnTo)
  }

  return (
    <main className="nf-m3u-watch">
      <header className="nf-m3u-watch__bar">
        <button type="button" onClick={goBack}>← Keşfet’e dön</button>
        <strong>{channel.name}</strong>
        <span>{channel.groupTitle}</span>
      </header>
      <div className="nf-m3u-watch__video">
        {playbackState.error ? (
          <div className="nf-m3u-watch__error" role="alert">
            <p>{playbackState.error}</p>
            {playbackState.urlIndex + 1 < channel.urls.length ? (
              <button type="button" onClick={() => setPlayback((state) => ({ ...state, urlIndex: state.urlIndex + 1, error: '', key: state.key + 1 }))}>Yedek yayını dene</button>
            ) : <button type="button" onClick={goBack}>Kanallara dön</button>}
          </div>
        ) : currentUrl ? (
          <VideoPlayer
            key={`${channel.id}:${playbackState.urlIndex}:${playbackState.key}`}
            src={currentUrl}
            title={channel.name}
            fallbackSrcs={channel.urls.slice(playbackState.urlIndex + 1)}
            onEnded={goBack}
            onLoadError={(message) => setPlayback((state) => ({ ...state, error: message }))}
          />
        ) : <div className="nf-m3u-watch__error" role="status">Yedek yayın bulunamadı.</div>}
      </div>
      <nav className="nf-m3u-watch__controls" aria-label="M3U kanal geçişi">
        <button type="button" disabled={!getSiblingChannel(channel, -1)} onClick={() => {
          const previous = getSiblingChannel(channel, -1)
          if (previous) playChannel(previous)
        }}>← Önceki</button>
        <span>{channel.name} · {channel.groupTitle}</span>
        <button type="button" disabled={!getSiblingChannel(channel, 1)} onClick={() => {
          const next = getSiblingChannel(channel, 1)
          if (next) playChannel(next)
        }}>Sonraki →</button>
      </nav>
    </main>
  )
}

function getSiblingChannel(channel: RotationChannel, direction: -1 | 1): RotationChannel | undefined {
  const current = getChannelsByCategory(channel.groupTitle)
  const index = current.findIndex((candidate) => candidate.id === channel.id)
  return index >= 0 ? current[index + direction] : undefined
}

function VavooChannelWatch({ channels }: { channels: VavooCatalog['channels'] }) {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const channel = channels.find((item) => item.id === id)
  if (!channel) {
    return (
      <main className="nf-m3u-watch-error">
        <h1>Vavoo kanalı bulunamadı</h1>
        <button type="button" onClick={() => navigate('/')}>Geri dön</button>
      </main>
    )
  }

  return (
    <main className="nf-m3u-watch">
      <header className="nf-m3u-watch__bar">
        <button type="button" onClick={() => navigate('/')}>← Geri dön</button>
        <strong>{channel.name}</strong>
        <span>Vavoo · Canlı TV</span>
      </header>
      <div className="nf-m3u-watch__video">
        <VavooPlayer
          channels={channels}
          initialId={channel.id}
          onSelectChannel={(nextChannel) => navigate(`/watch/vavoo/${encodeURIComponent(nextChannel.id)}`, { replace: true })}
        />
      </div>
    </main>
  )
}
