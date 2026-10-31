import { useEffect, useState } from 'react'
import type { GeilItem, GeilSource } from './types'
import { fetchVodSources } from './api'
import { getDeadSourceUrls } from './storage'
import { subtitleLanguageLabel } from './subtitle-language'
import { XIcon, PlayIcon } from './icons'
import { useLang } from '@/lib/language'

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

export interface VodContext {
  vodType: string
  vodId: string
  isM3u: boolean
  title: string
}

// geil.to v2 resolves movies and individual episodes through the same "video"
// source endpoint; episodes carry ids like "289517:1:1".
export function vodContextOf(item: GeilItem, episode?: GeilItem | null): VodContext {
  const target = episode || item
  return {
    vodType: 'video',
    vodId: episode ? (episode.ids?.tmdb || episode.id) : (item.ids?.tmdb || item.id),
    isM3u: target.id.startsWith('m3u-'),
    title: target.name,
  }
}

interface Props {
  item: GeilItem
  episode?: GeilItem | null
  /** Set by the player once every candidate refused to open, so the reason stays here. */
  notice?: 'unavailable'
  onClose: () => void
  onSelect: (selection: SourceSelection) => void
}

export default function SourceModal({ item, episode, notice, onClose, onSelect }: Props) {
  const { t, lang } = useLang()
  const target = episode || item
  const { vodType, vodId, isM3u, title } = vodContextOf(item, episode)
  const isSeries = item.type === 'series' || Boolean(episode)
  const [sources, setSources] = useState<GeilSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [dead, setDead] = useState<string[]>(() => getDeadSourceUrls())

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
        if (!controller.signal.aborted) {
          setDead(getDeadSourceUrls())
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [vodId, vodType, target.url, isM3u, reloadToken])

  function select(source: GeilSource) {
    onSelect({ item, episode: episode || null, vodType, vodId, isM3u, title, source, sources })
  }

  function selectBest() {
    const reliableHost = (url: string) => /dood\.yt|voe\.sx|vidsonic|supervideo/i.test(url) ? 4 : /dood/i.test(url) ? 2 : 0
    const deadSet = new Set(dead)
    const best = [...sources].sort((a, b) => {
      const score = (source: GeilSource) => reliableHost(source.url) + (source.quality ? 2 : 0) + (source.subtitles?.length ? 1 : 0) - (deadSet.has(source.url) ? 12 : 0)
      return score(b) - score(a)
    })[0]
    if (best) select(best)
  }

  // Upstream leaves the audio language as a bare code; the row only needs that country tag.
  function countryTags(source: GeilSource): string[] {
    return [...new Set((source.languages || []).map((code) => subtitleLanguageLabel([code], lang, String(code).toUpperCase())))]
  }

  // Upstream reports "kaynak bulunamadı" for titles nobody has uploaded yet; that
  // reads like a bug, so it is phrased as a plain "no source for this title" notice.
  const missingSource = /bulunamad|not\s?found|no\s?source|yok|empty/i.test(error)

  return (
    <div className="modal-bg" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="modal modal-sources" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2 className="modal-title">{t('sources.title')}</h2>
          <button className="modal-close" aria-label={t('common.close')} onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="source-ep-desc">
            {target.name}
            {episode ? ` · S${episode.season} B${episode.episode}` : ''}
          </div>
          {loading ? (
            <div className="empty"><p>{t('common.loading')}</p></div>
          ) : sources.length === 0 && (!error || missingSource) ? (
            <div className="empty">
              <h3>{isSeries ? t('sources.noneSeries') : t('sources.noneMovie')}</h3>
              <button className="btn source-auto-resolve" onClick={() => setReloadToken((value) => value + 1)}>{t('common.retry')}</button>
            </div>
          ) : error && sources.length === 0 ? (
            <div className="empty">
              <h3>{t('common.error')}</h3>
              <p>{error}</p>
              <button className="btn source-auto-resolve" onClick={() => setReloadToken((value) => value + 1)}>{t('common.retry')}</button>
            </div>
          ) : (
            <div className="source-list">
              {notice === 'unavailable' ? <p className="source-error" role="alert">{t('sources.allFailed')}</p> : null}
              {sources.map((source, index) => {
                const isDead = dead.includes(source.url)
                const countries = countryTags(source)
                return (
                  <button
                    key={`${source.url}-${index}`}
                    className={`source-item ${isDead ? 'source-item-error' : ''}`}
                    onClick={() => select(source)}
                  >
                    <span className="source-icon">{source.name.slice(0, 2).toUpperCase()}</span>
                    <span className="source-info">
                      <span className="source-name">
                        {source.name}
                        {isDead ? <span className="source-dead">{t('sources.dead')}</span> : null}
                      </span>
                      {countries.length ? <span className="source-detail">{countries.join(' · ')}</span> : null}
                    </span>
                    <span className="source-play"><PlayIcon size={18} /></span>
                  </button>
                )
              })}
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
