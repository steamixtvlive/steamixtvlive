import { useEffect, useState } from 'react'
import type { GeilItem } from './types'
import { fetchM3uGroups, fetchM3uItems } from './api'
import { SectionRow } from './Cards'
import { useHashRoute, itemHref } from './router'

interface SectionData {
  title: string
  group: string
  type: string | undefined
  items: GeilItem[]
  seeAll: string
}

const HOME_SECTIONS = [
  { title: 'Yeni Çıkan Filmler', group: 'TR | YENI EKLENEN FILMLER', type: 'video' },
  { title: 'Yeni Çıkan Diziler', group: 'TR | PAZARTESI DIZILERI', type: 'series' },
  { title: 'TR Netflix', group: 'TR | NETFLIX' },
  { title: 'TR Netflix Yabancı', group: 'DE | NETFLIX' },
  { title: 'Disney+', group: 'TR | DISNEY+' },
  { title: 'Amazon Prime', group: 'TR | AMAZON PRIME' },
  { title: 'Sinema', group: 'TR | SINEMA' },
  { title: '4K', group: 'TR | UHD' },
  { title: 'Güncel Diziler', group: 'TR | YERLI DIZILER', type: 'series' },
]

export default function HomeView() {
  const route = useHashRoute()
  const [sections, setSections] = useState<SectionData[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [heroIndex, setHeroIndex] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    Promise.all(
      HOME_SECTIONS.map(async (section) => {
        try {
          const data = await fetchM3uItems({ group: section.group, type: section.type, limit: 18 }, controller.signal)
          if (controller.signal.aborted || !data.items.length) return null
          const params = new URLSearchParams({ group: section.group })
          if (section.type) params.set('type', section.type)
          return {
            title: section.title,
            group: section.group,
            type: section.type,
            items: data.items,
            seeAll: `#/catalog/m3u/${encodeURIComponent(section.group)}${section.type ? `?type=${section.type}` : ''}`,
          }
        } catch {
          return null
        }
      }),
    )
      .then((results) => {
        if (controller.signal.aborted) return
        setSections(results.filter((section): section is SectionData => section !== null));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const heroSection = sections[activeTab] || sections[0]
  const heroItems = (heroSection?.items || []).slice(0, 6)
  const activeHero = heroItems[heroIndex % Math.max(1, heroItems.length)] || heroItems[0]

  useEffect(() => {
    if (heroItems.length <= 1) return
    const timer = window.setInterval(() => setHeroIndex((value) => (value + 1) % heroItems.length), 8000)
    return () => window.clearInterval(timer)
  }, [heroItems.length])

  return (
    <div className="home-view">
      <div className="stage" aria-hidden="true" />
      <section className="hero">
        <div className="hero-bg fade-in">
          {activeHero?.images?.poster ? <img src={activeHero.images.poster} alt="" className="loaded" /> : null}
        </div>
        <div className="hero-topfade" aria-hidden="true" />
        <div className="hero-tabs" data-zone="h" data-scroll="x">
          {sections.map((section, index) => (
            <button
              key={section.title}
              className={`hero-tab ${index === activeTab ? 'active' : ''}`}
              onClick={() => { setActiveTab(index); setHeroIndex(0) }}
            >
              {section.title}
            </button>
          ))}
        </div>
        <div className="hero-body">
          <div className="hero-content fade-in">
            <div className="hero-fold">
              <div className="hero-text">
                <div className="hero-head">
                  <h1 className="hero-title">{activeHero?.name || ''}</h1>
                  <div className="hero-meta">{activeHero?.genres?.join(' · ')}</div>
                </div>
                <div className="hero-badges">
                  {(activeHero?.genres || []).slice(0, 3).map((genre) => (
                    <span className="badge badge-fact" key={genre}>{genre}</span>
                  ))}
                </div>
              </div>
              <div className="hero-actions" data-zone="h">
                {activeHero ? (
                  <a className="btn-hero-primary" href={itemHref('m3u', activeHero.type, activeHero.id)}>
                    Detaylar <span aria-hidden="true">›</span>
                  </a>
                ) : null}
                {heroItems.length > 1 ? (
                  <div className="hero-dots">
                    {heroItems.map((_, index) => (
                      <button
                        key={index}
                        className={`hero-dot ${index === heroIndex % heroItems.length ? 'active' : ''}`}
                        aria-label={`Slayt ${index + 1}`}
                        onClick={() => setHeroIndex(index)}
                      >
                        {index === heroIndex % heroItems.length ? <span className="hero-dot-fill" style={{ animationDuration: '8000ms' }} /> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        {heroItems.length > 1 ? (
          <div className="hero-strip">
            <span className="hero-strip-label" aria-hidden="true">Sıradaki</span>
            {heroItems.map((item, index) => (
              <span
                key={item.id}
                className={`hero-thumb ${index === heroIndex % heroItems.length ? 'active' : ''}`}
                role="button"
                aria-label={item.name}
                aria-current={index === heroIndex % heroItems.length ? 'true' : undefined}
                onClick={() => setHeroIndex(index)}
              >
                <img src={item.images?.poster || ''} alt="" className="loaded" />
                {index === heroIndex % heroItems.length ? <span className="hero-thumb-fill" style={{ animationDuration: '8000ms' }} /> : null}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {loading
        ? Array.from({ length: 4 }).map((_, index) => (
            <section className="section reveal" key={`skeleton-${index}`}>
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
        : sections.map((section) => (
            <SectionRow
              key={section.title}
              title={section.title}
              items={section.items}
              loading={false}
              skeletons={0}
              addonId="m3u"
              seeAllHref={section.seeAll}
            />
          ))}
    </div>
  )
}
