import { useEffect, useMemo, useState } from 'react'
import type { GeilItem } from './types'
import { fetchTmdbCatalog, fetchTmdbItem, posterUrl, backdropUrl, runtimeLabel, ratingOf, yearOf } from './api'
import { useHashRoute } from './router'
import { PosterCard } from './Cards'
import { PlayIcon, PlusIcon, BookmarkIcon, ChevronLeft, ChevronRight, StarIcon, InfoIcon } from './icons'
import { pushHistory, toggleFavorite, isFavorite } from './storage'

export default function ItemView({ onPlay }: { onPlay: (item: GeilItem, episode?: GeilItem) => void }) {
  const route = useHashRoute()
  const addonId = route.parts[1] || 'tmdb'
  const type = route.parts[2] === 'series' ? 'series' : 'video'
  const id = decodeURIComponent(route.parts[3] || '')
  const [item, setItem] = useState<GeilItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null)
  const [episodes, setEpisodes] = useState<GeilItem[]>([])
  const [episodeLoading, setEpisodeLoading] = useState(false)
  const [selectedEpisode, setSelectedEpisode] = useState<GeilItem | null>(null)
  const [related, setRelated] = useState<GeilItem[]>([])
  const [fav, setFav] = useState(false)

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetchTmdbItem(type, id, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setItem(data)
        setFav(isFavorite(data.id))
        pushHistory(data, addonId)
        const seasons = (data.catalogs || [])
          .filter((catalog) => /^season_/.test(catalog.id))
          .map((catalog) => {
            const match = catalog.id.match(/season_(?:\d+)_(\d+)/)
            return match ? Number(match[1]) : null
          })
          .filter((value): value is number => Number.isFinite(value))
        const firstSeason = seasons.includes(1) ? 1 : seasons[0] ?? 1
        setSelectedSeason(firstSeason)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'İçerik yüklenemedi')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [addonId, type, id])

  const seasonCatalogs = useMemo(() => {
    return (item?.catalogs || []).filter((catalog) => /^season_/.test(catalog.id))
  }, [item])

  const seasonNumbers = useMemo(() => {
    return seasonCatalogs
      .map((catalog) => {
        const match = catalog.id.match(/season_[^_]+_(\d+)/)
        return match ? Number(match[1]) : null
      })
      .filter((value): value is number => Number.isFinite(value))
      .sort((a, b) => a - b)
  }, [seasonCatalogs])

  useEffect(() => {
    if (!item || type !== 'series' || selectedSeason === null) return
    const catalog = seasonCatalogs.find((entry) => entry.id.endsWith(`_${selectedSeason}`))
    if (!catalog) return
    const controller = new AbortController()
    setEpisodeLoading(true)
    fetchTmdbCatalog('video', catalog.id, { limit: 60 }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setEpisodes(data.items)
        if (data.items[0]) setSelectedEpisode(data.items[0])
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setEpisodes([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setEpisodeLoading(false)
      })
    return () => controller.abort()
  }, [item, type, selectedSeason, seasonCatalogs])

  useEffect(() => {
    if (!item) return
    const relatedCatalog = (item.catalogs || []).find((catalog) =>
      /similar|recommendation/i.test(catalog.id),
    )
    if (!relatedCatalog) return
    const controller = new AbortController()
    fetchTmdbCatalog(type, relatedCatalog.id, { limit: 12 }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setRelated(data.items)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [item, type])

  if (loading) {
    return (
      <div className="item-view">
        <section className="hero hero-subject hero-placeholder">
          <div className="hero-body">
            <div className="hero-content">
              <div className="skeleton skel-line skel-title" />
              <div className="skeleton skel-line skel-meta" />
              <div className="skeleton skel-line skel-desc" />
              <div className="skeleton skel-line skel-desc skel-desc-short" />
            </div>
          </div>
        </section>
      </div>
    )
  }

  if (error || !item) {
    return <div className="empty"><h3>İçerik yüklenemedi</h3><p>{error || 'İçerik bulunamadı'}</p></div>
  }

  const playable = type === 'video' ? item : selectedEpisode
  const trailer = null

  function handlePlay() {
    if (!playable) return
    onPlay(item as GeilItem, type === 'series' ? (selectedEpisode || undefined) : undefined)
  }

  function handleFavorite() {
    if (!item) return
    const next = toggleFavorite(item, addonId)
    setFav(next)
  }

  return (
    <div className="item-view">
      <section className="hero hero-subject">
        <div className="hero-bg fade-in">
          {backdropUrl(item, 'large') ? <img src={backdropUrl(item, 'large')} alt="" className="loaded" /> : null}
        </div>
        <div className="hero-topfade" aria-hidden="true" />
        <div className="hero-body">
          <div className="hero-content fade-in">
            <div className="hero-fold">
              <div className="hero-text">
                <div className="hero-head">
                  {item.images?.logo ? (
                    <h1 className="hero-title hero-title-logo">
                      <img src={item.images.logo} alt={item.name} />
                    </h1>
                  ) : (
                    <h1 className="hero-title">{item.name}</h1>
                  )}
                  <div className="hero-meta">
                    {[yearOf(item), (item.genres || []).slice(0, 3).join(' · '), item.originalName && item.originalName !== item.name ? item.originalName : ''].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="hero-badges">
                  {ratingOf(item) ? (
                    <span className="rating">
                      <StarIcon size={12} /> <span>{ratingOf(item)}</span> <span className="rating-src">TMDB</span>
                    </span>
                  ) : null}
                  {(item.genres || []).slice(0, 3).map((genre) => (
                    <span className="badge badge-fact" key={genre}>{genre}</span>
                  ))}
                  {item.runtime ? <span className="badge badge-fact">{runtimeLabel(item.runtime)}</span> : null}
                  {item.status ? <span className="badge badge-status">{item.status}</span> : null}
                </div>
                {type === 'series' && selectedEpisode ? (
                  <div className="hero-episode">
                    <div className="hero-episode-head">
                      <span className="hero-episode-num">S{selectedEpisode.season} · B{selectedEpisode.episode}</span>
                      <span className="hero-episode-name">{selectedEpisode.name}</span>
                    </div>
                    <div className="hero-episode-meta">
                      {[selectedEpisode.releaseDate?.slice(0, 10), runtimeLabel(selectedEpisode.runtime)].filter(Boolean).join(' · ')}
                    </div>
                    {selectedEpisode.description ? <p className="hero-episode-desc">{selectedEpisode.description}</p> : null}
                  </div>
                ) : item.description ? (
                  <p className="hero-desc">{item.description}</p>
                ) : null}
              </div>
              <div className="hero-actions" data-zone="h">
                <button className="btn-hero-play" onClick={handlePlay} disabled={!playable}>
                  <span>▶</span> İzle
                </button>
                {null}
                <button className={`btn-hero-fav ${fav ? 'on' : ''}`} onClick={handleFavorite} aria-label="Favori">
                  {fav ? '♥' : '♡'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="item-body">
        {type === 'series' ? (
          <section className="item-section">
            <div className="item-section-head">
              <h2 className="item-section-title">Bölümler</h2>
              {seasonNumbers.length > 1 ? (
                <div className="ep-pills">
                  {seasonNumbers.map((season) => (
                    <button
                      key={season}
                      className={`ep-pill ${selectedSeason === season ? 'active' : ''}`}
                      onClick={() => setSelectedSeason(season)}
                    >
                      {season}. Sezon
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {episodeLoading ? (
              <div className="ep-strip">
                {Array.from({ length: 6 }).map((_, index) => <div className="ep-tile" key={index}><div className="ep-tile-img"><div className="ph" /></div></div>)}
              </div>
            ) : (
              <div className="ep-strip">
                {episodes.map((episode) => (
                  <button
                    key={episode.id}
                    className={`ep-tile ${selectedEpisode?.id === episode.id ? 'ep-tile-active' : ''}`}
                    onClick={() => { setSelectedEpisode(episode); onPlay(item, episode) }}
                  >
                    <div className="ep-tile-img">
                      {episode.images?.thumbnail || episode.images?.poster ? (
                        <img src={episode.images?.thumbnail || episode.images?.poster} alt="" />
                      ) : (
                        <div className="ep-tile-fallback">{episode.episode}</div>
                      )}
                      <span className="ep-tile-badge">B{episode.episode}</span>
                    </div>
                    <div className="ep-tile-name">{episode.name}</div>
                    <div className="ep-date">{episode.releaseDate?.slice(0, 10)}</div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {item.cast?.length ? (
          <section className="item-section">
            <h2 className="item-section-title">OYUNCULAR</h2>
            <div className="cast-row">
              {item.cast.slice(0, 18).map((member) => (
                <a
                  key={member.name}
                  className="cast-card"
                  href={member.directory ? `#/catalog/tmdb/video/${member.directory.catalogId}` : `#/search?q=${encodeURIComponent(member.name)}`}
                >
                  <div className="cast-avatar">
                    {member.image ? <img src={member.image} alt={member.name} /> : <span>{member.name[0]}</span>}
                  </div>
                  <div className="cast-name">{member.name}</div>
                  <div className="cast-role">{member.role}</div>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        {related.length ? (
          <section className="item-section">
            <h2 className="item-section-title">Benzer İçerikler</h2>
            <div className="row-wrap">
              <div className="row" data-zone="h" data-scroll="x">
                {related.map((relatedItem, index) => (
                  <PosterCard key={relatedItem.id} item={relatedItem} addonId={addonId} index={index} />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="item-section item-facts">
          <h2 className="item-section-title">Detaylar</h2>
          <div className="item-facts-grid">
            {yearOf(item) ? <div><span>Yıl</span><strong>{yearOf(item)}</strong></div> : null}
            {item.runtime ? <div><span>Süre</span><strong>{runtimeLabel(item.runtime)}</strong></div> : null}
            {item.countries?.length ? <div><span>Ülke</span><strong>{item.countries.join(', ')}</strong></div> : null}
            {item.genres?.length ? <div><span>Tür</span><strong>{item.genres.join(', ')}</strong></div> : null}
            {ratingOf(item) ? <div><span>Puan</span><strong>{ratingOf(item)} / 10</strong></div> : null}
          </div>
        </section>
      </div>
    </div>
  )
}
