import { useEffect, useState } from 'react'
import type { GeilItem, GeilSource } from './types'
import { fetchVodSources } from './api'
import { XIcon, PlayIcon } from './icons'

export interface SourceSelection {
  item: GeilItem
  episode?: GeilItem | null
  vodType: string
  vodId: string
  isM3u: boolean
  title: string
  source: GeilSource
  sources: GeilSource[]
}

interface Props {
  item: GeilItem
  episode?: GeilItem | null
  onClose: () => void
  onSelect: (selection: SourceSelection) => void
}

export default function SourceModal({ item, episode, onClose, onSelect }: Props) {
  const target = episode || item
  const isM3u = target.id.startsWith('m3u-')
  // geil.to v2 resolves movies and individual episodes through the same
  // "video" source endpoint; episodes carry ids like "289517:1:1".
  const vodType = 'video'
  const vodId = episode
    ? (episode.ids?.tmdb || episode.id)
    : (item.ids?.tmdb || item.id)
  const [sources, setSources] = useState<GeilSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    if (target.url && isM3u) {
      setSources([{ url: target.url, name: 'MCLanX M3U', quality: '', languages: [], subtitles: [] }])
      setLoading(false)
      return () => controller.abort()
    }
    setLoading(true)
    setSources([])
    setError('')
    fetchVodSources(vodType, vodId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setSources(data)
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Kaynaklar yüklenemedi')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [vodId, vodType, target.url, isM3u, reloadToken])

  function select(source: GeilSource) {
    onSelect({ item, episode: episode || null, vodType, vodId, isM3u, title: target.name, source, sources })
  }

  function selectBest() {
    const reliableHost = (url: string) => /dood\.yt|voe\.sx|vidsonic|supervideo/i.test(url) ? 4 : /dood/i.test(url) ? 2 : 0
    const best = [...sources].sort((a, b) => {
      const score = (source: GeilSource) => reliableHost(source.url) + (source.quality ? 2 : 0) + (source.subtitles?.length ? 1 : 0)
      return score(b) - score(a)
    })[0]
    if (best) select(best)
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
          ) : error && sources.length === 0 ? (
            <div className="empty">
              <h3>Kaynaklar yüklenemedi</h3>
              <p>{error}</p>
              <button className="btn source-auto-resolve" onClick={() => setReloadToken((value) => value + 1)}>Yeniden dene</button>
            </div>
          ) : sources.length === 0 ? (
            <div className="empty">
              <h3>Kaynak bulunamadı</h3>
              <p>Bu içerik için şu an kaynak yok.</p>
              <button className="btn source-auto-resolve" onClick={() => setReloadToken((value) => value + 1)}>Yeniden dene</button>
            </div>
          ) : (
            <div className="source-list">
              {sources.map((source, index) => (
                <button
                  key={`${source.url}-${index}`}
                  className="source-item"
                  onClick={() => select(source)}
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
                  <span className="source-play"><PlayIcon size={18} /></span>
                </button>
              ))}
            </div>
          )}
          {error && sources.length > 0 ? <p className="source-error" role="alert">{error}</p> : null}
          {!loading && sources.length > 0 ? (
            <button className="btn source-auto-resolve" onClick={selectBest}>
              Otomatik kaynak seç
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
