import { useEffect, useMemo, useRef, useState } from 'react'
import type { GeilItem } from './types'
import { fetchLiveCatalog, channelColor, channelQuality, initialOf, currentEpg, remainingLabel, formatClock } from './api'
import { HeartIcon } from './icons'

const FAV_KEY = 'notflix_geil_live_favorites'

function readFavs(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')) } catch { return new Set() }
}
function writeFavs(set: Set<string>) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...set])) } catch {}
}

export default function ChannelsView({ onPlay }: { onPlay: (channel: GeilItem) => void }) {
  const [channels, setChannels] = useState<GeilItem[]>([])
  const [features, setFeatures] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nextCursor, setNextCursor] = useState<string | number | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('trending')
  const [group, setGroup] = useState('')
  const [tab, setTab] = useState<'favorites' | 'live'>('live')
  const [favIds, setFavIds] = useState<Set<string>>(() => readFavs())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const update = () => setFavIds(readFavs())
    window.addEventListener('notflix-geil-live-favorites', update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener('notflix-geil-live-favorites', update)
      window.removeEventListener('storage', update)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await fetchLiveCatalog(
          { search: search.trim().length >= 2 ? search.trim() : '', sort, filter: { group }, limit: 300 },
          controller.signal,
        )
        if (controller.signal.aborted) return
        setChannels(data.items)
        setFeatures(data.features)
        setNextCursor(data.nextCursor ?? null)
        if (!selectedId && data.items[0]) setSelectedId(data.items[0].id)
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Kanallar yüklenemedi')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 280)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [search, sort, group])

  const filtered = useMemo(() => {
    let list = channels
    if (tab === 'favorites') list = list.filter((channel) => favIds.has(channel.id))
    if (search.trim().length > 0 && search.trim().length < 2) {
      const needle = search.trim().toLowerCase()
      list = list.filter((channel) => channel.name.toLowerCase().includes(needle))
    }
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    return list
  }, [channels, tab, favIds, search, sort])

  const selected = filtered.find((channel) => channel.id === selectedId) || filtered[0] || channels[0] || null

  useEffect(() => {
    if (selected && selectedId !== selected.id) setSelectedId(selected.id)
  }, [selected?.id])

  function toggleFav(id: string) {
    const next = new Set(favIds)
    if (next.has(id)) { next.delete(id) } else { next.add(id) }
    setFavIds(next)
    writeFavs(next)
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await fetchLiveCatalog({ cursor: nextCursor, search: search.trim().length >= 2 ? search.trim() : '', sort, filter: { group }, limit: 300 })
      setChannels((current) => [...current, ...data.items])
      setNextCursor(data.nextCursor ?? null)
    } catch {
      // Keep the current list; the user can retry.
    } finally {
      setLoadingMore(false)
    }
  }

  const groups = features?.filter?.find((feature: any) => feature.id === 'group')?.values || []

  useEffect(() => {
    const sentinel = listRef.current
    if (!sentinel || !nextCursor) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore()
    }, { rootMargin: '240px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [nextCursor, loadingMore])

  return (
    <div className="catalog-view channels-view">
      {selected ? (
        <section className="live-stage" style={{ '--stage-tint': channelColor(selected.name) } as React.CSSProperties}>
          <div className="live-stage-bg" aria-hidden="true">
            <div style={{ width: '100%', height: '100%', background: channelColor(selected.name), opacity: 0.35 }} />
          </div>
          <div className="live-stage-body">
            <div className="live-stage-logo" style={{ background: channelColor(selected.name) }}>
              {initialOf(selected.name)}
            </div>
            <div className="live-stage-text">
              <h2 className="live-stage-name">{selected.name.replace(/\s*\(\d+\)\s*$/, '')}</h2>
              <div className="live-stage-head">
                {channelQuality(selected.name) ? <span className="ch-chip">{channelQuality(selected.name)}</span> : null}
                <span className="ch-chip ch-chip-flag">{selected.tags?.[0] || 'Live'}</span>
                {(selected.tags || []).slice(0, 2).map((tag) => (
                  <span className="ch-chip ch-chip-tag" key={tag}>{tag}</span>
                ))}
              </div>
            </div>
            <div className="live-stage-preview" aria-label="Önizleme" role="button" onClick={() => onPlay(selected)}>
              <div className="live-stage-mount" />
              <div className="live-stage-preview-ph" />
              <span className="live-stage-preview-badge">CANLI</span>
            </div>
          </div>
        </section>
      ) : null}

      <div className="feature-bar controls-flow">
        <div className="controls ch-controls" data-zone="grid">
          <div className="ep-pills channel-favorite-tabs">
          <button className={`ep-pill ${tab === 'favorites' ? 'active' : ''}`} onClick={() => setTab(tab === 'favorites' ? 'live' : 'favorites')}>
            <HeartIcon size={14} /> Favoriler {favIds.size > 0 ? <span className="ep-pill-count">{favIds.size}</span> : null}
          </button>
          </div>
          <div className="search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="glass-input"
              placeholder="Kanallarda ara..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select className="sort-select" aria-label="Sıralama" value={sort} onChange={(event) => setSort(event.target.value)}>
            {(features?.sort || [{ id: 'trending', name: 'Popüler' }, { id: 'name', name: 'A-Z' }]).map((option: any) => (
              <option key={option.id} value={option.id}>{option.name === 'Trending' || option.name === 'Popular' ? 'Popüler' : option.name}</option>
            ))}
          </select>
          <select className="sort-select" value={group} onChange={(event) => setGroup(event.target.value)}>
            <option value="">Tüm ülkeler</option>
            {groups.map((option: any) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="channels-list">
        {loading ? (
          <div className="ch-list">
            {Array.from({ length: 9 }).map((_, index) => (
              <div className="ch-item" key={`skeleton-${index}`} style={{ position: 'relative', height: 64 }}>
                <div className="ch-row">
                  <span className="ch-num">{index + 1}</span>
                  <span className="ch-logo ch-logo-ph" style={{ background: channelColor(String(index)) }}>•</span>
                  <div className="ch-main">
                    <div className="ch-head"><span className="ch-name">Yükleniyor...</span></div>
                    <div className="ch-epg-block"><div className="ch-epg ch-epg-none">Yayın akışı bilgisi yok</div></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="empty"><h3>Kanallar yüklenemedi</h3><p>{error}</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty"><h3>Sonuç bulunamadı</h3><p>Farklı bir arama veya filtre deneyin.</p></div>
        ) : (
          <>
            <div className="ch-list">
              {filtered.map((channel, index) => {
                const epg = currentEpg(channel)
                const isFav = favIds.has(channel.id)
                return (
                  <div className="ch-item" key={channel.id} style={{ position: 'relative', height: 64 }}>
                    <div
                      className="ch-row"
                      tabIndex={0}
                      role="button"
                      aria-label={channel.name}
                      onClick={() => { setSelectedId(channel.id); onPlay(channel) }}
                    >
                      <span className="ch-num">{index + 1}</span>
                      <span className="ch-logo ch-logo-ph" style={{ background: channelColor(channel.name) }}>
                        {initialOf(channel.name)}
                      </span>
                      <div className="ch-main">
                        <div className="ch-head">
                          <span className="ch-name">{channel.name}</span>
                        </div>
                        <div className="ch-epg-block">
                          {epg.entry ? (
                            <div className="ch-epg">
                              <span className="ch-epg-time">{formatClock(epg.entry.start)} – {formatClock(epg.entry.end)}</span>
                              <span className="ch-epg-title">{epg.entry.title}</span>
                              <span className="ch-epg-left">{remainingLabel(epg.entry.end)}</span>
                            </div>
                          ) : (
                            <div className="ch-epg ch-epg-none">Yayın akışı bilgisi yok</div>
                          )}
                          {epg.entry ? <div className="ch-epg-track"><div className="ch-epg-fill" style={{ width: `${epg.progress}%` }} /></div> : null}
                        </div>
                      </div>
                      <button
                        className={`ch-fav ${isFav ? 'on' : ''}`}
                        aria-label="Favori"
                        aria-pressed={isFav}
                        onClick={(event) => { event.stopPropagation(); toggleFav(channel.id) }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            {nextCursor ? (
              <div ref={listRef} style={{ height: 1, width: '100%' }} />
            ) : null}
            {loadingMore ? <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--t3)' }}>Yükleniyor...</div> : null}
          </>
        )}
      </div>
    </div>
  )
}
