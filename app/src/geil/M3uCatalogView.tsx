import { useEffect, useRef, useState } from 'react'
import type { GeilItem } from './types'
import { fetchM3uItems } from './api'
import { useHashRoute } from './router'
import { CardGrid } from './Cards'

export default function M3uCatalogView() {
  const route = useHashRoute()
  const group = decodeURIComponent(route.parts[2] || '')
  const type = route.query.get('type') || (group === 'series' || group === 'video' ? group : '')
  const [items, setItems] = useState<GeilItem[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState(route.query.get('q') || '')
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setSearch(route.query.get('q') || '')
  }, [route.hash])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setItems([])
    setOffset(0)
    setHasMore(true)
    fetchM3uItems({ group, type: type || undefined, search: search.trim() || undefined, offset: 0, limit: 30 }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setItems(data.items)
        setHasMore(data.hasMore)
        setOffset(data.items.length)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [group, type, search])

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const data = await fetchM3uItems({ group, type: type || undefined, search: search.trim() || undefined, offset, limit: 30 })
      setItems((current) => [...current, ...data.items])
      setHasMore(data.hasMore)
      setOffset((current) => current + data.items.length)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore()
    }, { rootMargin: '300px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, offset])

  return (
    <div className="catalog-view">
      <div className="catalog-head">
        <h1>{group === 'series' ? 'Diziler' : group === 'video' ? 'Filmler' : group}</h1>
      </div>
      <div className="feature-bar controls-flow">
        <div className="controls">
          <div className="search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input className="glass-input" placeholder="Ara..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>
      </div>
      {loading ? (
        <div className="grid portrait" data-zone="grid">
          {Array.from({ length: 12 }).map((_, index) => (
            <div className="card card-portrait card-skeleton" key={index}><div className="card-img"><div className="ph" /></div></div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="empty"><h3>Sonuç bulunamadı</h3></div>
      ) : (
        <>
          <CardGrid items={items} addonId="m3u" loading={loadingMore} skeletonCount={6} />
          <div ref={sentinelRef} style={{ height: 1 }} />
        </>
      )}
    </div>
  )
}
