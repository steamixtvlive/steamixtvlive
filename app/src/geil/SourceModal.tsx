import { useEffect, useState } from 'react'
import type { GeilItem, GeilSource } from './types'
import { fetchVodSources, resolveVodSource, imageUrl } from './api'
import { XIcon, PlayIcon, LoaderIcon } from './icons'

interface Props {
  item: GeilItem
  episode?: GeilItem | null
  onClose: () => void
  onPlay: (url: string, title: string, headers?: Record<string, string>) => void
}

export default function SourceModal({ item, episode, onClose, onPlay }: Props) {
  const target = episode || item
  const [sources, setSources] = useState<GeilSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resolvingUrl, setResolvingUrl] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetchVodSources(target.type === 'series' ? 'series' : 'video', target.id, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setSources(data)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Kaynaklar yüklenemedi')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [target.id, target.type])

  async function resolve(source: GeilSource) {
    setResolvingUrl(source.url)
    try {
      const resolved = await resolveVodSource(
        target.type === 'series' ? 'series' : 'video',
        target.id,
        source.url,
      )
      onPlay(resolved.url, target.name, resolved.headers || undefined)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaynak çözümlenemedi')
    } finally {
      setResolvingUrl(null)
    }
  }

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
          ) : error ? (
            <div className="empty"><h3>Kaynaklar yüklenemedi</h3><p>{error}</p></div>
          ) : sources.length === 0 ? (
            <div className="empty"><h3>Kaynak bulunamadı</h3><p>Bu içerik için şu an kaynak yok.</p></div>
          ) : (
            <div className="source-list">
              {sources.map((source, index) => (
                <button
                  key={`${source.url}-${index}`}
                  className="source-item"
                  onClick={() => resolve(source)}
                  disabled={resolvingUrl !== null}
                >
                  <span className="source-icon">{source.name.slice(0, 2).toUpperCase()}</span>
                  <span className="source-info">
                    <span className="source-name">{source.name}</span>
                    <span className="source-detail">
                      {[source.quality, source.size ? `${Math.round(source.size / 1048576)} MB` : ''].filter(Boolean).join(' · ')}
                    </span>
                    {source.languages?.length ? (
                      <span className="source-langs">{source.languages.join(', ')}</span>
                    ) : null}
                  </span>
                  <span className="source-play">
                    {resolvingUrl === source.url ? <LoaderIcon size={18} /> : <PlayIcon size={18} />}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
