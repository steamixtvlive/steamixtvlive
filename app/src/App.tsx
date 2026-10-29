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
import { checkMembership, type MembershipSummary } from '@/lib/membership'

type Stage = 'splash' | 'login' | 'loading' | 'app'

export default function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>
}

function AppContent() {
  const navigate = useNavigate()
  const [stage, setStage] = useState<Stage>('splash')
  const [catalog, setCatalog] = useState<VavooCatalog | null>(null)
  const [member, setMember] = useState<MembershipSummary | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const location = useLocation()
  const currentPath = location.pathname
  const isVavooWatch = location.pathname.startsWith('/notflix/vavoo/')
  const isVodWatch = location.pathname.startsWith('/notflix/watch/')
  const watchAllowed = Boolean(member?.hasSubscription && !member.banned && (member.subscriptionExpiresAt === null || new Date(member.subscriptionExpiresAt).getTime() > Date.now()))

  useEffect(() => {
    const handle = window.setInterval(() => {
      if (member && member.subscriptionExpiresAt && Date.parse(member.subscriptionExpiresAt) <= Date.now()) {
        setMember({ ...member, hasSubscription: false })
      }
    }, 1000)
    return () => window.clearInterval(handle)
  }, [member])

  const handleReady = useCallback((nextCatalog: VavooCatalog) => {
    setCatalog(nextCatalog)
    setStage('app')
  }, [])

  const enterApp = useCallback(() => {
    const local = (() => { try { return JSON.parse(localStorage.getItem('notflix_local_user_v1') || 'null') as { username?: string; expiresAt?: number | null } | null } catch { return null } })()
    const username = local?.username || 'Notflix Kullanıcısı'
    setMember({ username, hasSubscription: Boolean(local?.expiresAt && local.expiresAt > Date.now()), subscriptionExpiresAt: local?.expiresAt ? new Date(local.expiresAt).toISOString() : null, banned: false })
    setStage(catalog ? 'app' : 'loading')
  }, [catalog])

  const finishSplash = useCallback(() => {
    try { sessionStorage.setItem('notflix_splash_seen', '1') } catch { /* session still continues */ }
    setStage(authChecked ? (member ? (catalog ? 'app' : 'loading') : 'login') : 'splash')
  }, [authChecked, catalog, member])

  const onRegisteredMember = useCallback((username: string) => {
    const local = (() => { try { return JSON.parse(localStorage.getItem('notflix_local_user_v1') || 'null') as { expiresAt?: number | null; tier?: string } | null } catch { return null } })()
    setMember({ username, hasSubscription: Boolean(local && (local.tier === 'premium' || (local.expiresAt && local.expiresAt > Date.now()))), subscriptionExpiresAt: local?.expiresAt ? new Date(local.expiresAt).toISOString() : null, banned: false })
    setStage('loading')
  }, [])

  const cancelCatalogLoad = useCallback(() => {
    setCatalog({ ok: false, source: 'unavailable', group: 'all', total: 0, rawTotal: 0, generatedAt: Date.now(), countries: [], channels: [] })
    if (member) setStage('app')
    else setStage('login')
  }, [member])

  const finishCatalogFallback = useCallback(() => {
    setCatalog({ ok: false, source: 'unavailable', group: 'all', total: 0, rawTotal: 0, generatedAt: Date.now(), countries: [], channels: [] })
    setStage('app')
  }, [])

  useEffect(() => {
    void preloadVodHome().catch(() => {})
  }, [])

  useEffect(() => {
    let active = true
    const isWatchRoute = currentPath.startsWith('/notflix/watch/') || currentPath.startsWith('/notflix/vavoo/')
    if (isWatchRoute) return () => { active = false }
    void checkMembership().then((result) => {
      if (!active) return
      setMember(result)
      if (result) setStage('loading')
      else setStage('login')
    }).catch(() => { if (active) { setMember(null); setStage('login') } }).finally(() => { if (active) setAuthChecked(true) })
    return () => { active = false }
  }, [currentPath])

  useEffect(() => {
    if (isVodWatch || isVavooWatch) return
    if (member) setStage(catalog ? 'app' : 'loading')
    else if (authChecked) setStage(catalog ? 'app' : 'loading')
  }, [authChecked, catalog, currentPath, isVavooWatch, isVodWatch, member])

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ username: string }>
      void checkMembership().then((result) => {
        if (result && result.username === custom.detail.username) setMember(result)
        else setMember({ username: custom.detail.username, hasSubscription: false, subscriptionExpiresAt: null, banned: false })
        setStage('app')
        if (!catalog) setStage('loading')
      }).catch(() => { setMember({ username: custom.detail.username, hasSubscription: false, subscriptionExpiresAt: null, banned: false }); if (catalog) setStage('app'); else setStage('loading') })
    }
    window.addEventListener('notflix-developer-activated', handler)
    return () => { window.removeEventListener('notflix-developer-activated', handler) }
  }, [catalog])

  return (
    <>
      {isVavooWatch ? (
        <Routes><Route path="/notflix/vavoo/:id" element={watchAllowed ? catalog ? <VavooWatch channels={catalog.channels} /> : <NotflixSplash onDone={finishSplash} /> : <main className="nf-vod-watch__message">İçerikleri izleyebilmek için lütfen geçerli bir abonelik paketi satın alınız.<button type="button" onClick={() => navigate('/')}>Keşfet’e dön</button></main>} /></Routes>
      ) : isVodWatch ? (watchAllowed ? (
        <Routes><Route path="/notflix/watch/:type/:id" element={<NotflixVodWatch />} /><Route path="*" element={<NotflixVodWatch />} /></Routes>
      ) : <main className="nf-vod-watch__message">İçerikleri izleyebilmek için lütfen geçerli bir abonelik paketi satın alınız.<button type="button" onClick={() => navigate('/')}>Keşfet’e dön</button></main>)
      : stage === 'splash' && <NotflixSplash onDone={finishSplash} />}

      {!isVavooWatch && !isVodWatch && stage === 'splash' && <div className="nf-app-wait" role="status">NOTFLİX hazırlanıyor…</div>}
      {!isVavooWatch && !isVodWatch && stage === 'login' && !authChecked && <div className="nf-app-wait" role="status">Notflix hazırlanıyor…</div>}
      {!isVavooWatch && !isVodWatch && stage === 'login' && authChecked && (
        <div className="notflix-app-enter">
          <NotflixLogin onActivated={enterApp} onLoggedIn={onRegisteredMember} />
        </div>
      )}

      {!isVavooWatch && !isVodWatch && stage === 'loading' && (
        <NotflixLoading onReady={handleReady} onCancel={cancelCatalogLoad} />
      )}

      {!isVavooWatch && !isVodWatch && stage === 'app' && member && catalog && (
        <div className="notflix-app-enter nf-shell-enter">
              <NotflixShell catalog={catalog} activationProfile={member ? { fullName: '', username: member.username, expiresAt: member.subscriptionExpiresAt ? new Date(member.subscriptionExpiresAt).getTime() : 0 } : null} />
        </div>
      )}
      {!isVavooWatch && !isVodWatch && stage === 'app' && member && !catalog && <NotflixLoading onReady={handleReady} onCancel={finishCatalogFallback} />}
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
