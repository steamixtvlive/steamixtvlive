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
  const [resumeSeconds] = useState(() => {
    try {
      const list = JSON.parse(localStorage.getItem('notflix_continue') || '[]') as Array<{ id: string; seconds?: number }>
      return list.find((entry) => entry.id === `${type}:${id}`)?.seconds || 0
    } catch { return 0 }
  })
  useEffect(() => {
    let active = true
    void membershipFromSession().then((member) => { if (active && !member?.hasSubscription) setWatchWarning(true) }).catch(() => { if (active) setWatchWarning(true) })
    return () => { active = false }
  }, [])
  const routeState = location.state as { item?: { stream?: string; name?: string; poster?: string }; episode?: { stream?: string; title?: string; still?: string; subtitles?: VodSubtitle[] } } | null

  useEffect(() => {
    if (watchWarning) return
    if (!payload || currentSeconds < 10) return
    const record = { id: `${type}:${id}`, type: type === 'series' ? 'series' : 'movie', title: payload.title, poster: payload.poster, progress: progressPercent, seconds: currentSeconds, href: location.pathname }
    try {
      const existing = JSON.parse(localStorage.getItem('notflix_continue') || '[]') as Array<{ id: string; seconds?: number }>
      localStorage.setItem('notflix_continue', JSON.stringify([record, ...existing.filter((entry) => entry.id !== record.id)].slice(0, 100)))
    } catch { /* playback remains available if storage is disabled */ }
  }, [currentSeconds, id, location.pathname, payload, progressPercent, type])

  useEffect(() => {
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
  }, [id, resumeSeconds, routeState, type, watchWarning])

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
      {error ? <div className="nf-vod-watch__message" role="alert"><AlertTriangle size={24} /><p>{error}</p><button type="button" onClick={() => navigate(-1)}>Geri dön</button></div> : !payload ? <div className="nf-vod-watch__message"><Loader2 className="nf-spin" size={25} /> Yayın hazırlanıyor…</div> : <VideoPlayer src={payload.stream} poster={payload.poster} title={payload.title} subtitles={payload.subtitles} onEnded={() => navigate(-1)} onProgress={(current, duration) => { setCurrentSeconds(current); if (duration > 0) setProgressPercent(Math.round((current / duration) * 100)) }} />}
      {watchWarning && <div className="nf-vod-episode-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setWatchWarning(false) }}><section className="nf-delete-modal" role="dialog" aria-modal="true"><h2>Abonelik gerekli</h2><p>İçerikleri izleyebilmek için lütfen geçerli bir abonelik paketi satın alınız.</p><button type="button" onClick={() => setWatchWarning(false)}>Kapat</button></section></div>}
    </main>
  )
}
