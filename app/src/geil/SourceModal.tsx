import { useEffect, useRef, useState } from 'react'
import type { GeilItem, GeilSource } from './types'
import { fetchVodSourcesForTypes, resolveVodSource } from './api'
import { XIcon, PlayIcon, LoaderIcon } from './icons'
import type { GeilPlayback } from './types'

interface Props {
  item: GeilItem
  episode?: GeilItem | null
  onClose: () => void
  onPlay: (url: string, title: string, headers?: Record<string, string>, subtitles?: GeilPlayback['subtitles']) => void
}

export default function SourceModal({ item, episode, onClose, onPlay }: Props) {
  const target = episode || item
  const vodType = episode ? 'series' : item.type === 'series' ? 'series' : 'video'
  const vodId = episode ? episode.id : item.id
  const [sources, setSources] = useState<GeilSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resolvingUrl, setResolvingUrl] = useState<string | null>(null)
  const [resolvingAll, setResolvingAll] = useState(false)
  const resolveAbort = useRef<AbortController | null>(null)
  const [playbackReady, setPlaybackReady] = useState<{ source: GeilSource; playback: GeilPlayback } | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    const controller = new AbortController()
    const requestedTypes = episode ? ['series'] : item.type === 'series' ? ['series', 'video'] : ['video', 'series']
    setLoading(true)
    setSources([])
    setPlaybackReady(null)
    setError('')
    fetchVodSourcesForTypes(requestedTypes, vodId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        if (!controller.signal.aborted) setSources(data)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Kaynaklar yüklenemedi')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { mountedRef.current = false; controller.abort() }
  }, [vodType, vodId, episode?.id, item.type])

  async function resolve(source: GeilSource, signal?: AbortSignal): Promise<GeilPlayback> {
    setResolvingUrl(source.url)
    try { return await resolveVodSource(vodType, vodId, source.url, signal) }
    finally {
      if (!signal?.aborted && mountedRef.current) setResolvingUrl(null)
    }
  }

  async function trySource(source: GeilSource, signal?: AbortSignal) {
    const resolved = await resolve(source, signal)
    if (!signal?.aborted && mountedRef.current) setPlaybackReady({ source, playback: resolved })
    return resolved
  }

  async function playResolved() {
    if (!playbackReady) return
    onPlay(playbackReady.playback.url, target.name, playbackReady.playback.headers || undefined, playbackReady.playback.subtitles || [])
    onClose()
  }

  async function resolveAll() {
    if (resolvingAll || !sources.length) return
    const controller = new AbortController()
    resolveAbort.current?.abort()
    resolveAbort.current = controller
    setResolvingAll(true)
    setError('')
    setPlaybackReady(null)
    const ordered = [...sources].sort((a, b) => {
      const score = (source: GeilSource) => (source.subtitles?.length ? 10 : 0) + (source.quality ? 1 : 0)
      return score(b) - score(a)
    })
    for (const source of ordered) {
      if (controller.signal.aborted) break
      try {
        await trySource(source, controller.signal)
        if (mountedRef.current) setResolvingAll(false)
        return
      } catch (err) {
        if (controller.signal.aborted) return
        setError(`${source.name}: ${err instanceof Error ? err.message : 'Kaynak çözümlenemedi'}`)
      }
    }
    if (!controller.signal.aborted && mountedRef.current) setError('Denenecek kaynaklar çözümlenemedi. Sağlayıcı kaynak uç noktası şu anda yanıt vermiyor olabilir.')
    if (mountedRef.current) setResolvingAll(false)
  }

  async function resolveOne(source: GeilSource) {
    const controller = new AbortController()
    resolveAbort.current?.abort()
    resolveAbort.current = controller
    setResolvingAll(true)
    setError('')
    setPlaybackReady(null)
    try {
      await trySource(source, controller.signal)
    } catch (err) {
      if (!controller.signal.aborted) setError(`${source.name}: ${err instanceof Error ? err.message : 'Kaynak çözümlenemedi'}`)
    } finally {
      if (!controller.signal.aborted) setResolvingAll(false)
    }
  }

  useEffect(() => () => { mountedRef.current = false; resolveAbort.current?.abort() }, [])

  return (
    <div className="modal-bg" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="modal modal-sources" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2 className="modal-title">Kaynaklar</h2>
          <button className="modal-close" aria-label="Kapat" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="source-ep-desc">
            {target.name}
            {episode ? ` · S${episode.season} B${episode.episode}` : ''}
          </div>
          {loading ? (
            <div className="empty"><p>Kaynaklar yükleniyor...</p></div>
          ) : playbackReady ? (
            <div className="empty source-preview">
              <h3>Kaynak hazır: {playbackReady.source.name}</h3>
              <p>{playbackReady.playback.quality || playbackReady.source.quality || 'Oynatılabilir akış çözümlendi'}</p>
              <button className="btn" onClick={() => void playResolved()}><PlayIcon size={16} /> İzle</button>
              {playbackReady.playback.subtitles?.length ? <p>{playbackReady.playback.subtitles.length} altyazı bulundu</p> : null}
            </div>
          ) : error && sources.length === 0 ? (
            <div className="empty"><h3>Kaynaklar yüklenemedi</h3><p>{error}</p></div>
          ) : sources.length === 0 ? (
            <div className="empty"><h3>Kaynak bulunamadı</h3><p>Bu içerik için şu an kaynak yok.</p></div>
          ) : (
            <div className="source-list">
              {sources.map((source, index) => (
                <button
                  key={`${source.url}-${index}`}
                  className="source-item"
                  onClick={() => { setError(''); void resolveOne(source) }}
                  disabled={resolvingUrl !== null || resolvingAll}
                >
                  <span className="source-icon">{source.name.slice(0, 2).toUpperCase()}</span>
                  <span className="source-info">
                    <span className="source-name">{source.name}</span>
                    <span className="source-detail">
                      {[source.quality, source.size ? `${Math.round(source.size / 1048576)} MB` : ''].filter(Boolean).join(' · ')}
                    </span>
                    {(source.languages?.length || source.subtitles?.length) ? (
                      <span className="source-langs">{[...(source.languages || []), ...(source.subtitles || []).map((subtitle) => subtitle.name || subtitle.language || '').filter(Boolean)].filter((language, index, all) => all.indexOf(language) === index).join(', ')}</span>
                    ) : null}
                  </span>
                  <span className="source-play">
                    {resolvingUrl === source.url ? <LoaderIcon size={18} /> : <PlayIcon size={18} />}
                  </span>
                </button>
              ))}
            </div>
          )}
          {error && sources.length > 0 && !playbackReady ? <p className="source-error" role="alert">{error}</p> : null}
          {!loading && sources.length > 0 && !playbackReady && !resolvingAll ? (
            <button className="btn source-auto-resolve" onClick={() => void resolveAll()} disabled={resolvingAll || resolvingUrl !== null}>
              Kaynakları sırayla dene
            </button>
          ) : null}
          {!loading && resolvingAll && !playbackReady ? <div className="empty source-resolving"><LoaderIcon size={18} /> Kaynaklar sırayla deneniyor…</div> : null}
        </div>
      </div>
    </div>
  )
}
