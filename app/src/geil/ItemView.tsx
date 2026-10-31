import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { GeilItem } from './types'
import { fetchM3uItem, fetchM3uSeriesEpisodes, fetchTmdbCatalog, fetchTmdbItem, posterUrl, backdropUrl, runtimeLabel, ratingOf, yearOf } from './api'
import { useHashRoute } from './router'
import { PosterCard } from './Cards'
import { StarIcon } from './icons'
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
  const [m3uSeasons, setM3uSeasons] = useState<number[]>([])
  const [episodeLoading, setEpisodeLoading] = useState(false)
  const [selectedEpisode, setSelectedEpisode] = useState<GeilItem | null>(null)
  const [related, setRelated] = useState<GeilItem[]>([])
  const [trailerUrl, setTrailerUrl] = useState('')
  const [fav, setFav] = useState(false)
  const episodeRowRef = useRef<HTMLDivElement | null>(null)
  const castRowRef = useRef<HTMLDivElement | null>(null)
  const [episodeScroll, setEpisodeScroll] = useState({ left: false, right: false })
  const [castScroll, setCastScroll] = useState({ left: false, right: false })

  function updateHorizontalScroll(ref: RefObject<HTMLDivElement | null>, setter: (value: { left: boolean; right: boolean }) => void) {
    const element = ref.current
    if (!element) return
    setter({ left: element.scrollLeft > 4, right: element.scrollLeft + element.clientWidth < element.scrollWidth - 4 })
  }

  function moveHorizontal(ref: RefObject<HTMLDivElement | null>, direction: -1 | 1, setter: (value: { left: boolean; right: boolean }) => void) {
    const element = ref.current
    if (!element) return
    element.scrollBy({ left: direction * Math.max(300, element.clientWidth * 0.8), behavior: 'smooth' })
    window.setTimeout(() => updateHorizontalScroll(ref, setter), 250)
  }

  useEffect(() => {
    const rows = [episodeRowRef.current, castRowRef.current].filter((row): row is HTMLDivElement => Boolean(row))
    if (!rows.length) return
    const update = () => {
      updateHorizontalScroll(episodeRowRef, setEpisodeScroll)
      updateHorizontalScroll(castRowRef, setCastScroll)
    }
    update()
    const observer = new ResizeObserver(update)
    rows.forEach((row) => observer.observe(row))
    return () => observer.disconnect()
  }, [episodes.length, item?.cast?.length])

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    const itemPromise = addonId === 'm3u' ? fetchM3uItem(id, controller.signal) : fetchTmdbItem(type, id, controller.signal)
    itemPromise
      .then((data) => {
        if (controller.signal.aborted) return
        setItem(data)
        setM3uSeasons([])
        setFav(isFavorite(data.id))
        pushHistory(data, addonId)
      const seasons = (data.catalogs || [])
          .filter((catalog) => /^season_/.test(catalog.id))
          .map((catalog) => {
            const match = catalog.id.match(/season_(?:\d+)_(\d+)/)
            return match ? Number(match[1]) : null
          })
        .filter((value): value is number => Number.isFinite(value))
        .sort((a, b) => a - b)
        const availableSeasons = addonId === 'm3u' ? [1] : seasons
        const firstSeason = availableSeasons.includes(1) ? 1 : availableSeasons[0] ?? 1
        setSelectedSeason(firstSeason)
        setEpisodes([])
        setSelectedEpisode(null)
        if (addonId === 'm3u' && data.type === 'series') {
          fetchM3uSeriesEpisodes(data.id, firstSeason, controller.signal).then((result) => {
            if (!controller.signal.aborted) setM3uSeasons(result.seasons)
          }).catch(() => {})
        }
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
    if (addonId === 'm3u') return []
    return (item?.catalogs || []).filter((catalog) => /^season_/.test(catalog.id))
  }, [addonId, item])

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
    if (!item || (type !== 'series' && item.type !== 'series') || selectedSeason === null) return
    if (addonId === 'm3u') {
      const controller = new AbortController()
      setEpisodeLoading(true)
      fetchM3uSeriesEpisodes(item.id, selectedSeason, controller.signal)
        .then((data) => { if (!controller.signal.aborted) { setEpisodes(data.episodes); setM3uSeasons(data.seasons); setSelectedEpisode(data.episodes[0] || null) } })
        .catch(() => { if (!controller.signal.aborted) setEpisodes([]) })
        .finally(() => { if (!controller.signal.aborted) setEpisodeLoading(false) })
      return () => controller.abort()
    }
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
  }, [addonId, item, type, selectedSeason, seasonCatalogs])

  useEffect(() => {
    if (!item) return
    const controller = new AbortController()
    void fetch(`/api/trailer?name=${encodeURIComponent(item.name)}&year=${encodeURIComponent(yearOf(item))}&type=${item.type === 'series' ? 'series' : 'movie'}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ youtube_id?: string }> : null)
      .then((data) => { if (!controller.signal.aborted && data?.youtube_id) setTrailerUrl(`https://www.youtube.com/watch?v=${data.youtube_id}`) })
      .catch(() => {})
    return () => controller.abort()
  }, [item?.id])

  useEffect(() => {
    if (!item) return
    if (addonId === 'm3u') return
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
  }, [addonId, item, type])

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

  const itemIsSeries = item.type === 'series' || type === 'series'
  const playable = itemIsSeries ? selectedEpisode : item
  const itemPoster = posterUrl(item, 'large')
  const trailer = item.videos?.find((video) => /youtube/i.test(video.url)) || item.videos?.[0]
  const trailerHref = trailer?.url || trailerUrl
  const trailerHrefNormalized = trailerHref && !/^https?:\/\//i.test(trailerHref) ? `https://${trailerHref.replace(/^\/+/, '')}` : trailerHref

  function handlePlay() {
    if (!playable) return
    onPlay((addonId === 'm3u' ? (itemIsSeries ? selectedEpisode : item) : item) as GeilItem, itemIsSeries && addonId !== 'm3u' ? (selectedEpisode || undefined) : undefined)
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
          {backdropUrl(item, 'large') || itemPoster ? <img src={backdropUrl(item, 'large') || itemPoster} alt="" className="loaded" /> : null}
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
                {itemIsSeries && selectedEpisode ? (
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
                {trailerHrefNormalized ? (
                  <a className="btn-hero-glass" href={trailerHrefNormalized} target="_blank" rel="noreferrer">
                    Fragman
                  </a>
                ) : null}
                <button className={`btn-hero-fav ${fav ? 'on' : ''}`} onClick={handleFavorite} aria-label="Favori">
                  {fav ? '♥' : '♡'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="item-body">
        {itemIsSeries ? (
          <section className="item-section">
            <div className="item-section-head">
              <h2 className="item-section-title">Bölümler</h2>
              {(addonId === 'm3u' ? m3uSeasons.length > 1 : seasonNumbers.length > 1) ? (
                <div className="ep-pills">
                  {(addonId === 'm3u' ? m3uSeasons : seasonNumbers).map((season) => (
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
              <div className="ep-strip-wrap geil-horizontal-wrap">
                <button className="geil-carousel-arrow geil-carousel-arrow-left" type="button" aria-label="Önceki bölümler" disabled={!episodeScroll.left} onClick={() => moveHorizontal(episodeRowRef, -1, setEpisodeScroll)}><span aria-hidden="true">‹</span></button>
                <div className="ep-strip" ref={episodeRowRef} onScroll={() => updateHorizontalScroll(episodeRowRef, setEpisodeScroll)}>
                {Array.from({ length: 6 }).map((_, index) => <div className="ep-tile" key={index}><div className="ep-tile-img"><div className="ph" /></div></div>)}
                </div>
                <button className="geil-carousel-arrow geil-carousel-arrow-right" type="button" aria-label="Sonraki bölümler" disabled={!episodeScroll.right} onClick={() => moveHorizontal(episodeRowRef, 1, setEpisodeScroll)}><span aria-hidden="true">›</span></button>
              </div>
            ) : (
              <div className="ep-strip-wrap geil-horizontal-wrap">
                <button className="geil-carousel-arrow geil-carousel-arrow-left" type="button" aria-label="Önceki bölümler" disabled={!episodeScroll.left} onClick={() => moveHorizontal(episodeRowRef, -1, setEpisodeScroll)}><span aria-hidden="true">‹</span></button>
                <div className="ep-strip" ref={episodeRowRef} onScroll={() => updateHorizontalScroll(episodeRowRef, setEpisodeScroll)}>
                {episodes.map((episode) => (
                  <button
                    key={episode.id}
                    className={`ep-tile ${selectedEpisode?.id === episode.id ? 'ep-tile-active' : ''}`}
                    onClick={() => { setSelectedEpisode(episode); onPlay(addonId === 'm3u' ? episode : item, addonId === 'm3u' ? undefined : episode) }}
                  >
                    <div className="ep-tile-img">
                      {episode.images?.thumbnail || episode.images?.poster ? (
                        <img src={episode.images?.thumbnail || episode.images?.poster} alt="" className="loaded" />
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
                <button className="geil-carousel-arrow geil-carousel-arrow-right" type="button" aria-label="Sonraki bölümler" disabled={!episodeScroll.right} onClick={() => moveHorizontal(episodeRowRef, 1, setEpisodeScroll)}><span aria-hidden="true">›</span></button>
              </div>
            )}
          </section>
        ) : null}

        {item.cast?.length ? (
          <section className="item-section">
            <h2 className="item-section-title">Oyuncular</h2>
            <div className="geil-horizontal-wrap cast-row-wrap">
              <button className="geil-carousel-arrow geil-carousel-arrow-left" type="button" aria-label="Önceki oyuncular" disabled={!castScroll.left} onClick={() => moveHorizontal(castRowRef, -1, setCastScroll)}><span aria-hidden="true">‹</span></button>
              <div className="cast-row" ref={castRowRef} onScroll={() => updateHorizontalScroll(castRowRef, setCastScroll)}>
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
              <button className="geil-carousel-arrow geil-carousel-arrow-right" type="button" aria-label="Sonraki oyuncular" disabled={!castScroll.right} onClick={() => moveHorizontal(castRowRef, 1, setCastScroll)}><span aria-hidden="true">›</span></button>
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
