import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react'
import VideoPlayer from '@/sections/VideoPlayer'
import { fetchVodEpisodeStream, fetchVodStream, type VodSubtitle } from '@/lib/vod'

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
  const routeState = location.state as { item?: { stream?: string; name?: string; poster?: string }; episode?: { stream?: string; title?: string; still?: string; subtitles?: VodSubtitle[] } } | null

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
    }).catch((loadError: unknown) => {
      if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Yayın hazırlanamadı')
    })
    return () => controller.abort()
  }, [id, routeState, type])

  return (
    <main className="nf-vod-watch">
      <header className="nf-vod-watch__header">
        <button type="button" onClick={() => navigate(-1)}><ArrowLeft size={17} /> Geri dön</button>
        <strong>{payload?.title || 'İçerik oynatılıyor'}</strong>
        <span>{payload?.subtitles.length ? `${payload.subtitles.length} altyazı` : 'Altyazı yok'}</span>
      </header>
      {error ? <div className="nf-vod-watch__message" role="alert"><AlertTriangle size={24} /><p>{error}</p><button type="button" onClick={() => navigate(-1)}>Geri dön</button></div> : !payload ? <div className="nf-vod-watch__message"><Loader2 className="nf-spin" size={25} /> Yayın hazırlanıyor…</div> : <VideoPlayer src={payload.stream} poster={payload.poster} title={payload.title} subtitles={payload.subtitles} onEnded={() => navigate(-1)} />}
    </main>
  )
}
