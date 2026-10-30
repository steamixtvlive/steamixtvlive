import { useEffect, useMemo, useState } from 'react'
import type { GeilItem } from './types'
import { fetchTmdbCatalog, fetchLiveCatalog, fetchM3uItems, posterUrl } from './api'
import { useHashRoute, navigate, searchHref } from './router'
import { PosterCard, CardGrid } from './Cards'
import { SearchIcon, XIcon, StarIcon } from './icons'

const RECENT_KEY = 'notflix_geil_recent_searches'

function readRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}
function writeRecent(list: string[]) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8))) } catch {}
}

export default function SearchView() {
  const route = useHashRoute()
  const initial = route.query.get('q') || ''
  const [query, setQuery] = useState(initial)
  const [submitted, setSubmitted] = useState(initial)
  const [movies, setMovies] = useState<GeilItem[]>([])
  const [series, setSeries] = useState<GeilItem[]>([])
  const [vod, setVod] = useState<GeilItem[]>([])
  const [channels, setChannels] = useState<GeilItem[]>([])
  const [loading, setLoading] = useState(false)
  const [recent, setRecent] = useState<string[]>(() => readRecent())

  useEffect(() => {
    setQuery(initial)
    setSubmitted(initial)
  }, [initial])

  useEffect(() => {
    const q = submitted.trim()
    if (q.length < 2) {
      setMovies([])
      setSeries([])
      setChannels([])
      return
    }
    const controller = new AbortController()
    setLoading(true)
    Promise.all([
      fetchTmdbCatalog('video', 'movie', { search: q, limit: 24 }, controller.signal).catch(() => ({ items: [] })),
      fetchTmdbCatalog('series', 'series', { search: q, limit: 24 }, controller.signal).catch(() => ({ items: [] })),
      fetchLiveCatalog({ search: q, limit: 24 }, controller.signal).catch(() => ({ items: [] })),
      fetchM3uItems({ search: q, limit: 24 }, controller.signal).catch(() => ({ items: [] })),
    ]).then(([movieData, seriesData, liveData, vodData]) => {
      if (controller.signal.aborted) return
      setMovies(movieData.items || [])
      setSeries(seriesData.items || [])
      setChannels(liveData.items || [])
      setVod(vodData.items || [])
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [submitted])

  const topResult = useMemo(() => {
    const candidates = [...vod, ...series, ...movies]
    return candidates.find((item) => item.name.toLowerCase().includes(submitted.toLowerCase())) || candidates[0] || null
  }, [vod, series, movies, submitted])

  function submit(value: string) {
    const trimmed = value.trim()
    setSubmitted(trimmed)
    if (trimmed.length >= 2) {
      const next = [trimmed, ...recent.filter((entry) => entry !== trimmed)].slice(0, 8)
      setRecent(next)
      writeRecent(next)
      navigate(searchHref(trimmed))
    }
  }

  return (
    <div className="search-view">
      <div className="search-hero">
        <div className="search-big" data-zone="h">
          <SearchIcon size={20} />
          <input
            className="glass-input"
            placeholder="Film, dizi veya kanal ara..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit(query)
            }}
          />
          <div className="search-tools">
            {query ? (
              <button className="search-clear" aria-label="Temizle" onClick={() => { setQuery(''); setSubmitted('') }}>
                <XIcon size={16} />
              </button>
            ) : null}
          </div>
        </div>
        {!submitted && recent.length ? (
          <div className="search-recent" data-zone="h">
            {recent.map((entry) => (
              <button key={entry} className="tag" onClick={() => { setQuery(entry); submit(entry) }}>
                {entry}
              </button>
            ))}
            <button className="tag tag-clear" onClick={() => { setRecent([]); writeRecent([]) }}>
              Temizle
            </button>
          </div>
        ) : null}
      </div>

      {submitted.trim().length >= 2 && topResult ? (
        <section className="top-result">
          <div className="top-result-bg" aria-hidden="true">
            {posterUrl(topResult, 'large') ? <img src={posterUrl(topResult, 'large')} alt="" /> : null}
          </div>
          <div className="top-result-body" data-zone="h">
            <div className="top-result-poster">
              {posterUrl(topResult, 'medium') ? <img src={posterUrl(topResult, 'medium')} alt={topResult.name} /> : <span>{topResult.name[0]}</span>}
            </div>
            <div className="top-result-text">
              <div className="top-result-label">
                <span className="badge">En iyi sonuç</span>
                <span className="ch-chip">{topResult.type === 'series' ? 'Dizi' : topResult.type === 'live' ? 'Canlı' : 'Film'}</span>
              </div>
              <h2 className="top-result-name">{topResult.name}</h2>
              <div className="top-result-meta">
                {[topResult.releaseDate?.slice(0, 4), (topResult.genres || []).slice(0, 3).join(' · ')].filter(Boolean).join(' · ')}
              </div>
              {topResult.description ? <p className="top-result-desc">{topResult.description}</p> : null}
              <div className="top-result-actions">
                <a className="btn-hero-primary" href={`#/item/tmdb/${topResult.type}/${topResult.id}`}>
                  Detaylar ›
                </a>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="empty"><p>Aranıyor...</p></div>
      ) : submitted.trim().length >= 2 ? (
        <>
          {channels.length ? (
            <section className="section">
              <div className="section-head"><h2 className="section-title section-title-static"><span className="section-title-text">Kanallar</span></h2></div>
              <CardGrid items={channels} addonId="live" loading={false} skeletonCount={0} />
            </section>
          ) : null}
          {vod.length ? (
            <section className="section">
              <div className="section-head"><h2 className="section-title section-title-static"><span className="section-title-text">VOD</span></h2></div>
              <CardGrid items={vod} addonId="m3u" loading={false} skeletonCount={0} />
            </section>
          ) : null}
          {series.length ? (
            <section className="section">
              <div className="section-head"><h2 className="section-title section-title-static"><span className="section-title-text">Diziler</span></h2></div>
              <CardGrid items={series} addonId="tmdb" loading={false} skeletonCount={0} />
            </section>
          ) : null}
          {movies.length ? (
            <section className="section">
              <div className="section-head"><h2 className="section-title section-title-static"><span className="section-title-text">Filmler</span></h2></div>
              <CardGrid items={movies} addonId="tmdb" loading={false} skeletonCount={0} />
            </section>
          ) : null}
          {!movies.length && !series.length && !channels.length ? (
            <div className="empty"><h3>Sonuç bulunamadı</h3><p>Farklı bir arama deneyin.</p></div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
