import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react'
import VideoPlayer from '@/sections/VideoPlayer'
import { fetchVodEpisodeStream, fetchVodStream, type VodSubtitle } from '@/lib/vod'
import { membershipFromSession } from '@/lib/membership'

interface PlaybackPayload {
  stream: string
  title: string
  poster: string
  subtitles: VodSubtitle[]
}

export default function NotflixVodWatch() {
  const { type, id = '' } = useParams<{ type: string; id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [payload, setPayload] = useState<PlaybackPayload | null>(null)
  const [error, setError] = useState('')
  const [progressPercent, setProgressPercent] = useState(0)
  const [currentSeconds, setCurrentSeconds] = useState(0)
  const [watchWarning, setWatchWarning] = useState(false)
  const [membershipChecked, setMembershipChecked] = useState(false)
  const [resumeSeconds, setResumeSeconds] = useState(() => {
    try {
      const list = JSON.parse(localStorage.getItem('notflix_continue') || '[]') as Array<{ id: string; seconds?: number }>
      return list.find((entry) => entry.id === `${type}:${id}`)?.seconds || 0
    } catch { return 0 }
  })
  useEffect(() => {
    let active = true
    void membershipFromSession().then((member) => { if (active && !member?.hasSubscription) setWatchWarning(true) }).catch(() => { if (active) setWatchWarning(true) }).finally(() => { if (active) setMembershipChecked(true) })
    return () => { active = false }
  }, [])
  const routeState = location.state as { item?: { stream?: string; name?: string; poster?: string }; episode?: { stream?: string; title?: string; still?: string; subtitles?: VodSubtitle[]; seriesId?: string; seriesTitle?: string; seriesPoster?: string; nextEpisodeId?: string } } | null

  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem('notflix_continue') || '[]') as Array<{ id: string; seconds?: number }>
      setResumeSeconds(list.find((entry) => entry.id === `${type}:${id}`)?.seconds || 0)
    } catch { setResumeSeconds(0) }
  }, [id, type])

  const continueSeries = () => {
    const seriesId = routeState?.episode?.seriesId
    if (type === 'episode' && seriesId) {
      const nextEpisodeId = routeState?.episode?.nextEpisodeId
      if (nextEpisodeId) navigate(`/notflix/watch/episode/${nextEpisodeId}`, { replace: true, state: { episode: { ...routeState?.episode, stream: '' } } })
      else navigate(`/notflix/watch/series/${seriesId}`, { replace: true, state: { episode: routeState?.episode } })
    }
    else navigate(-1)
  }

  useEffect(() => {
    if (watchWarning || !membershipChecked) return
    if (!payload || currentSeconds < 2) return
    const isEpisode = type === 'episode'
    const seriesId = routeState?.episode?.seriesId
    const record = { id: isEpisode && seriesId ? `series:${seriesId}` : `${type}:${id}`, type: isEpisode || type === 'series' ? 'series' : 'movie', title: isEpisode ? routeState?.episode?.seriesTitle || payload.title : payload.title, poster: isEpisode ? routeState?.episode?.seriesPoster || payload.poster : payload.poster, progress: progressPercent, seconds: currentSeconds, href: isEpisode && seriesId ? `/notflix/watch/series/${seriesId}` : location.pathname }
    try {
      const existing = JSON.parse(localStorage.getItem('notflix_continue') || '[]') as Array<{ id: string; type?: string }>
      const mediaOnly = existing.filter((entry) => entry.type === 'movie' || entry.type === 'series')
      localStorage.setItem('notflix_continue', JSON.stringify([record, ...mediaOnly.filter((entry) => entry.id !== record.id)].slice(0, 100)))
    } catch { /* playback remains available if storage is disabled */ }
  }, [currentSeconds, id, location.pathname, membershipChecked, payload, progressPercent, routeState, type, watchWarning])

  useEffect(() => {
    if (!membershipChecked || watchWarning) return
    const controller = new AbortController()
    const embeddedEpisode = routeState?.episode
    const embeddedItem = routeState?.item

    const load = embeddedEpisode
      ? Promise.resolve({ stream: embeddedEpisode.stream || '', title: embeddedEpisode.title || 'Bölüm', poster: embeddedEpisode.still || '', subtitles: embeddedEpisode.subtitles || [] })
      : embeddedItem?.stream
        ? Promise.resolve({ stream: embeddedItem.stream, title: embeddedItem.name || 'İçerik', poster: embeddedItem.poster || '', subtitles: (embeddedItem as { subtitles?: VodSubtitle[] }).subtitles || [] })
      : type === 'episode'
        ? fetchVodEpisodeStream(id, controller.signal)
        : fetchVodStream(type === 'series' ? 'series' : 'movie', id, controller.signal)

    load.then((result) => {
      if (controller.signal.aborted) return
      if (!result.stream) throw new Error('Bu içerik için izlenebilir yayın adresi bulunamadı')
      setPayload(result)
      const video = document.querySelector<HTMLVideoElement>('.nf-vod-watch video')
      if (video && resumeSeconds > 0) video.addEventListener('loadedmetadata', () => { video.currentTime = Math.min(resumeSeconds, Math.max(0, video.duration - 1)) }, { once: true })
    }).catch((loadError: unknown) => {
      if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Yayın hazırlanamadı')
    })
    return () => controller.abort()
  }, [id, membershipChecked, resumeSeconds, routeState, type, watchWarning])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') navigate(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  return (
    <main className="nf-vod-watch">
      <header className="nf-vod-watch__header">
        <button type="button" onClick={() => navigate(-1)}><ArrowLeft size={17} /> Geri dön</button>
        <strong>{payload?.title || 'İçerik oynatılıyor'}</strong>
        <span>{payload?.subtitles.length ? `${payload.subtitles.length} altyazı` : 'Altyazı yok'}{progressPercent > 0 && ` · %${progressPercent}`}</span>
      </header>
      {error ? <div className="nf-vod-watch__message" role="alert"><AlertTriangle size={24} /><p>{error}</p><button type="button" onClick={() => navigate(-1)}>Geri dön</button></div> : !payload ? <div className="nf-vod-watch__message"><Loader2 className="nf-spin" size={25} /> Yayın hazırlanıyor…</div> : <VideoPlayer src={payload.stream} poster={payload.poster} title={payload.title} subtitles={payload.subtitles} onEnded={continueSeries} onProgress={(current, duration) => { setCurrentSeconds(current); if (duration > 0) setProgressPercent(Math.round((current / duration) * 100)) }} />}
      {type === 'episode' && payload && progressPercent >= 98 && <button type="button" className="nf-vod-next-episode" onClick={continueSeries}>Sonraki bölüm <ArrowLeft size={16}/></button>}
      {watchWarning && <div className="nf-vod-episode-overlay" role="presentation"><section className="nf-delete-modal" role="dialog" aria-modal="true"><h2>İçeriği açmak için giriş yapın</h2><p>İzlemek için hediye kodunuzla giriş yapmanız gerekir.</p><button type="button" onClick={() => { setWatchWarning(false); navigate('/', { replace: true }) }}>Giriş ekranına dön</button></section></div>}
    </main>
  )
}
