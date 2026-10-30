import { useEffect, useMemo, useState } from 'react'
import type { GeilItem } from './types'
import { fetchTmdbCatalog, mergeFeatures } from './api'
import { useHashRoute } from './router'
import { CardGrid, SkeletonCard } from './Cards'

export default function CatalogView() {
  const route = useHashRoute()
  const addonId = route.parts[1] || 'tmdb'
  const type = (route.parts[2] === 'series' ? 'series' : 'video') as 'video' | 'series'
  const catalog = route.parts[3] || (type === 'series' ? 'series' : 'movie')
  const title = route.query.get('title') || catalog.replace(/_/g, ' ')
  const [items, setItems] = useState<GeilItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [features, setFeatures] = useState<any>(null)
  const [search, setSearch] = useState(route.query.get('q') || '')
  const [sort, setSort] = useState(route.query.get('sort') || '')
  const [genre, setGenre] = useState(route.query.get('genre') || '')
  const [year, setYear] = useState(route.query.get('year') || '')

  useEffect(() => {
    setSearch(route.query.get('q') || '')
    setSort(route.query.get('sort') || '')
    setGenre(route.query.get('genre') || '')
    setYear(route.query.get('year') || '')
  }, [route.hash])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setItems([])
    setNextCursor(null)
    const timer = window.setTimeout(async () => {
      try {
        const data = await fetchTmdbCatalog(
          type,
          catalog,
          {
            search: search.trim() || undefined,
            sort: sort || undefined,
            filter: {
              genre: genre || undefined,
              year: year || undefined,
            },
            limit: 30,
          },
          controller.signal,
        )
        if (controller.signal.aborted) return
        setItems(data.items)
        setNextCursor(data.nextCursor ?? null)
        setFeatures(data.features)
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Katalog yüklenemedi')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 260)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [addonId, type, catalog, search, sort, genre, year])

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await fetchTmdbCatalog(type, catalog, {
        cursor: nextCursor,
        search: search.trim() || undefined,
        sort: sort || undefined,
        filter: { genre: genre || undefined, year: year || undefined },
        limit: 30,
      })
      setItems((current) => [...current, ...data.items])
      setNextCursor(data.nextCursor ?? null)
    } catch {
      // Keep current items.
    } finally {
      setLoadingMore(false)
    }
  }

  const merged = mergeFeatures(features)
  const sortOptions = merged.sort?.length ? merged.sort : [{ id: 'popularity', name: 'Popularity' }, { id: 'trendingDay', name: 'Trending today' }]
  const genreOptions = merged.filter?.find((feature: any) => feature.id === 'genre')?.values || []
  const yearOptions = merged.filter?.find((feature: any) => feature.id === 'year')?.values || []

  return (
    <div className="catalog-view">
      <div className="catalog-head">
        <h1>{title}</h1>
      </div>

      <div className="feature-bar controls-flow">
        <div className="controls">
          <div className="search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="glass-input"
              placeholder="Ara..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select className="sort-select" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="">Sıralama</option>
            {sortOptions.map((option: any) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
          {genreOptions.length ? (
            <select className="sort-select" value={genre} onChange={(event) => setGenre(event.target.value)}>
              <option value="">Tür: tümü</option>
              {genreOptions.map((option: any) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          ) : null}
          {yearOptions.length ? (
            <select className="sort-select" value={year} onChange={(event) => setYear(event.target.value)}>
              <option value="">Yıl: tümü</option>
              {yearOptions.map((option: any) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="grid portrait" data-zone="grid">
          {Array.from({ length: 12 }).map((_, index) => <SkeletonCard key={index} index={index} />)}
        </div>
      ) : error ? (
        <div className="empty"><h3>Katalog yüklenemedi</h3><p>{error}</p></div>
      ) : items.length === 0 ? (
        <div className="empty"><h3>Sonuç bulunamadı</h3><p>Farklı filtreler deneyin.</p></div>
      ) : (
        <>
          <CardGrid items={items} addonId={addonId} loading={loadingMore} skeletonCount={6} />
          {nextCursor ? (
            <div style={{ padding: '16px 0', textAlign: 'center' }}>
              <button className="btn btn-primary" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Yükleniyor...' : 'Daha fazla yükle'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
