import { useEffect, useRef, useState } from 'react'
import type { GeilItem } from './types'
import { fetchTmdbCatalog } from './api'
import { SectionRow } from './Cards'
import { itemHref } from './router'
import { toggleFavorite, isFavorite } from './storage'
import { HeartIcon } from './icons'

const HERO_TABS = [
  { key: 'series-trending', title: 'Trend Olan Diziler', type: 'series' as const, sort: 'trendingDay' },
  { key: 'series-popular', title: 'Popüler Diziler', type: 'series' as const, sort: 'popularity' },
  { key: 'movie-trending', title: 'Trend Olan Filmler', type: 'video' as const, sort: 'trendingDay' },
  { key: 'movie-popular', title: 'Popüler Filmler', type: 'video' as const, sort: 'popularity' },
]

export default function HomeView() {
  const [data, setData] = useState<Record<string, GeilItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [heroIndex, setHeroIndex] = useState(0)
  const [heroDetail, setHeroDetail] = useState<GeilItem | null>(null)
  const [heroIsFavorite, setHeroIsFavorite] = useState(false)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const previousTab = useRef(activeTab)

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
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const selectedHeroItems = (data[HERO_TABS[activeTab].key] || []).slice(0, 6)
  const activeHero = selectedHeroItems[heroIndex % Math.max(1, selectedHeroItems.length)] || selectedHeroItems[0]

  useEffect(() => {
    if (previousTab.current !== activeTab) {
      previousTab.current = activeTab
      return
    }
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

  function jumpToSection(key: string) {
    window.setTimeout(() => {
      const section = sectionRefs.current[key]
      if (!section) return
      const mainScroller = document.querySelector<HTMLElement>('.main-inner')
      const rect = section.getBoundingClientRect()
      if (mainScroller) {
        const parent = mainScroller.getBoundingClientRect()
        mainScroller.scrollTo({ top: mainScroller.scrollTop + rect.top - parent.top - 18, behavior: 'smooth' })
      } else section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  const hero = heroDetail || activeHero

  useEffect(() => {
    const update = () => setHeroIsFavorite(hero ? isFavorite(hero.id) : false)
    update()
    window.addEventListener('notflix-geil-storage', update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener('notflix-geil-storage', update)
      window.removeEventListener('storage', update)
    }
  }, [hero?.id])

  return (
    <div className="home-view">
      <div className="stage" aria-hidden="true" />
      <section className="hero">
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
              onClick={() => { setActiveTab(index); setHeroIndex(0); jumpToSection(tab.key) }}
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
                    className={`btn-hero-fav ${heroIsFavorite ? 'on' : ''}`}
                    aria-label={heroIsFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                    aria-pressed={heroIsFavorite}
                    onClick={() => setHeroIsFavorite(toggleFavorite(hero, 'tmdb'))}
                  >
                    <HeartIcon size={19} />
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

      {loading
        ? Array.from({ length: 4 }).map((_, index) => (
            <section className="section reveal is-in" key={`skeleton-${index}`}>
              <div className="section-head"><h2 className="section-title section-title-static"><span className="section-title-text">Yükleniyor...</span></h2></div>
              <div className="row-wrap row-can-scroll">
                <div className="row" data-zone="h">
                  {Array.from({ length: 6 }).map((__, i) => (
                    <div className="card card-portrait card-skeleton" key={i}><div className="card-img"><div className="ph" /></div></div>
                  ))}
                </div>
              </div>
            </section>
          ))
        : HERO_TABS.map((tab) => (
            <SectionRow
              key={tab.key}
              sectionRef={(element) => { sectionRefs.current[tab.key] = element }}
              title={tab.title}
              items={data[tab.key] || []}
              loading={false}
              skeletons={0}
              addonId="tmdb"
              seeAllHref={`#/catalog/tmdb/${tab.type}/${tab.type === 'series' ? 'series' : 'movie'}?sort=${tab.sort}`}
            />
          ))}
    </div>
  )
}
