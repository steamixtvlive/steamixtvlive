import { useEffect, useState } from 'react'
import type { GeilItem } from './types'
import { fetchTmdbCatalog } from './api'
import { SectionRow, SkeletonCard } from './Cards'
import { useHashRoute, itemHref } from './router'

const HERO_TABS = [
  { key: 'series-trending', title: 'Trend Olan Diziler', type: 'series' as const, sort: 'trendingDay' },
  { key: 'series-popular', title: 'Popüler Diziler', type: 'series' as const, sort: 'popularity' },
  { key: 'movie-trending', title: 'Trend Olan Filmler', type: 'video' as const, sort: 'trendingDay' },
  { key: 'movie-popular', title: 'Popüler Filmler', type: 'video' as const, sort: 'popularity' },
]

export default function HomeView() {
  const route = useHashRoute()
  const [data, setData] = useState<Record<string, GeilItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [heroIndex, setHeroIndex] = useState(0)
  const [heroDetail, setHeroDetail] = useState<GeilItem | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    Promise.all(
      HERO_TABS.map(async (tab) => {
        const response = await fetchTmdbCatalog(tab.type, tab.type === 'series' ? 'series' : 'movie', { sort: tab.sort, limit: 18 }, controller.signal)
        return [tab.key, response.items] as const
      }),
    )
      .then((entries) => {
        if (controller.signal.aborted) return
        setData(Object.fromEntries(entries))
      })
      .catch(() => {
        if (controller.signal.aborted) return
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const heroItems = HERO_TABS.map((tab) => (data[tab.key] || []).slice(0, 6)).flat().slice(0, 6)
  const selectedHeroItems = (data[HERO_TABS[activeTab].key] || []).slice(0, 6)
  const activeHero = selectedHeroItems[heroIndex % Math.max(1, selectedHeroItems.length)] || selectedHeroItems[0]

  useEffect(() => {
    if (selectedHeroItems.length <= 1) return
    const timer = window.setInterval(() => setHeroIndex((value) => (value + 1) % selectedHeroItems.length), 8000)
    return () => window.clearInterval(timer)
  }, [selectedHeroItems.length])

  useEffect(() => {
    if (!activeHero) return
    let cancelled = false
    import('./api').then(({ fetchTmdbItem }) => {
      fetchTmdbItem(activeHero.type, activeHero.id)
        .then((item) => { if (!cancelled) setHeroDetail(item) })
        .catch(() => { if (!cancelled) setHeroDetail(activeHero) })
    })
    return () => { cancelled = true }
  }, [activeHero?.id])

  const hero = heroDetail || activeHero

  return (
    <div className="home-view">
      <div className="stage" aria-hidden="true" />
      <section
        className="hero"
        onTouchStart={(event) => {
          const touch = event.touches[0]
          ;(event.currentTarget as HTMLElement).dataset.touchX = String(touch.clientX)
        }}
        onTouchEnd={(event) => {
          const startX = Number((event.currentTarget as HTMLElement).dataset.touchX || 0)
          const endX = event.changedTouches[0]?.clientX || 0
          if (Math.abs(endX - startX) > 50 && selectedHeroItems.length > 1) {
            setHeroIndex((value) => (endX < startX ? (value + 1) % selectedHeroItems.length : (value - 1 + selectedHeroItems.length) % selectedHeroItems.length))
          }
        }}
      >
        <div className="hero-bg fade-in">
          {hero?.images?.backdrops?.[0] || hero?.images?.poster ? (
            <img src={hero.images?.backdrops?.[0] || hero.images?.poster} alt="" className="loaded" />
          ) : null}
        </div>
        <div className="hero-topfade" aria-hidden="true" />
        <div className="hero-tabs" data-zone="h" data-scroll="x">
          {HERO_TABS.map((tab, index) => (
            <button
              key={tab.key}
              className={`hero-tab ${index === activeTab ? 'active' : ''}`}
              onClick={() => { setActiveTab(index); setHeroIndex(0) }}
            >
              {tab.title}
            </button>
          ))}
        </div>
        <div className="hero-body">
          <div className="hero-content fade-in">
            <div className="hero-fold">
              <div className="hero-text">
                <div className="hero-head">
                  {hero?.images?.logo ? (
                    <h1 className="hero-title hero-title-logo">
                      <img src={hero.images.logo} alt={hero.name} />
                    </h1>
                  ) : (
                    <h1 className="hero-title">{hero?.name || ''}</h1>
                  )}
                  <div className="hero-meta">
                    {[hero ? new Date(hero.releaseDate || '').getFullYear() || '' : '', (hero?.genres || []).slice(0, 3).join(' · ')].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="hero-badges">
                  {hero?.ratings?.tmdb ? (
                    <span className="rating">
                      <span>★ {Number(hero.ratings.tmdb).toFixed(1)}</span>
                      <span className="rating-src">TMDB</span>
                    </span>
                  ) : null}
                  {(hero?.genres || []).slice(0, 2).map((genre) => (
                    <span className="badge badge-fact" key={genre}>{genre}</span>
                  ))}
                </div>
                {hero?.description ? <p className="hero-desc">{hero.description}</p> : null}
              </div>
              <div className="hero-actions" data-zone="h">
                {hero ? (
                  <a className="btn-hero-primary" href={itemHref('tmdb', hero.type, hero.id)}>
                    Detaylar <span aria-hidden="true">›</span>
                  </a>
                ) : null}
                {hero ? (
                  <button
                    className="btn-hero-fav"
                    aria-label="Favori"
                    onClick={() => {
                      import('./storage').then(({ toggleFavorite }) => toggleFavorite(hero, 'tmdb'))
                    }}
                  >
                    ♡
                  </button>
                ) : null}
                {selectedHeroItems.length > 1 ? (
                  <div className="hero-dots">
                    {selectedHeroItems.map((_, index) => (
                      <button
                        key={index}
                        className={`hero-dot ${index === heroIndex % selectedHeroItems.length ? 'active' : ''}`}
                        aria-label={`Slayt ${index + 1}`}
                        onClick={() => setHeroIndex(index)}
                      >
                        {index === heroIndex % selectedHeroItems.length ? <span className="hero-dot-fill" style={{ animationDuration: '8000ms' }} /> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        {selectedHeroItems.length > 1 ? (
          <div className="hero-strip">
            <span className="hero-strip-label" aria-hidden="true">Sıradaki</span>
            {selectedHeroItems.map((item, index) => (
              <span
                key={item.id}
                className={`hero-thumb ${index === heroIndex % selectedHeroItems.length ? 'active' : ''}`}
                role="button"
                aria-label={item.name}
                aria-current={index === heroIndex % selectedHeroItems.length ? 'true' : undefined}
                onClick={() => setHeroIndex(index)}
              >
                <img src={item.images?.poster || ''} alt="" className="loaded" />
                {index === heroIndex % selectedHeroItems.length ? <span className="hero-thumb-fill" style={{ animationDuration: '8000ms' }} /> : null}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {HERO_TABS.map((tab) => (
        <SectionRow
          key={tab.key}
          title={tab.title}
          items={data[tab.key] || []}
          loading={loading && !(data[tab.key]?.length)}
          skeletons={6}
          addonId="tmdb"
        />
      ))}
    </div>
  )
}
