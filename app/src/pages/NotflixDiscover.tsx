import { useEffect, useState, useRef, useCallback } from 'react'
import {
  AlertTriangle,
  Check,
  Compass,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  Radio,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useVodApi } from '@/lib/vod'
import NotflixPlayer from '@/sections/NotflixPlayer'
import { PAGE_TITLES, type PageId } from '@/lib/navigation'
import { useInView } from '@/lib/player-intents'

interface PosterCardProps {
  type: 'movie' | 'series'
  id: string
  name: string
  year: number
  poster: string
  category: string
}

interface HeroItem {
  type: 'movie' | 'series'
  id: string
  name: string
  poster: string
  year: number
}

export default function NotflixDiscover() {
  const { state, loadVodApi, home, list, detail, stream, subtitle } = useVodApi()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    loadVodApi()
    setMounted(true)
  }, [loadVodApi])

  if (!mounted || !state.ready) {
    return (
      <section className="nf-template">
        <header className="nf-template__head">
          <span className="nf-kicker">KEŞFET ŞABLONU</span>
          <h1>{PAGE_TITLES.discover}</h1>
          <p>İçerikler yükleniyor...</p>
        </header>
        <div className="nf-template__canvas">
          <span className="nf-template__watermark">N</span>
          <div className="nf-template__placeholder">
            <span className="nf-template__icon">
              <Compass size={22} strokeWidth={1.7} />
            </span>
            <strong>İçerik alanı hazır</strong>
            <p>Film ve dizi kataloğu yükleniyor.</p>
          </div>
          <span className="nf-template__corner">
            <i />
            NOTFLİX · 2027
          </span>
        </div>
      </section>
    )
  }

  // Initialize with home data if available
  const { hero, categories, rows } = state

  // Hero section - featured titles
  const [visibleIndex, setVisibleIndex] = useState(0)
  const heroRef = useRef<HTMLDivElement>(null)

  const handleScroll = useCallback(() => {
    if (!heroRef.current) return
    const maxScroll = heroRef.current.scrollWidth - heroRef.current.clientWidth
    const currentScroll = heroRef.current.scrollLeft
    // Auto-scroll hero every 3 seconds or on interaction
    heroRef.current.scrollLeft = Math.min(currentScroll + 1, maxScroll)
  }, [])

  useEffect(() => {
    const timer = setInterval(handleScroll, 3000)
    return () => clearInterval(timer)
  }, [handleScroll])

  return (
    <section className="nf-discover">
      <header className="nf-discover__header">
        <div className="nf-discover__title-group">
          <h1>{PAGE_TITLES.discover}</h1>
          <p className="nf-discover__subtitle">Film ve dizi keşfi</p>
        </div>
        <div className="nf-discover__actions">
          <button
            type="button"
            className="nf-btn nf-btn--secondary"
            onClick={() => loadVodApi(true)}
          >
            <RotateCcw size={14} />
            Kataloğu Yenile
          </button>
        </div>
      </header>

      {/* Hero / Featured Section */}
      {hero.length > 0 && (
        <div
          className="nf-discover__hero"
          ref={heroRef}
          aria-label="Öne çıkan içerikler"
        >
          <button
            type="button"
            className="nf-discover__hero-prev"
            aria-label="Önceki"
            onClick={() => setVisibleIndex((i) => Math.max(0, i - 1))}
          >
            <Maximize2 size={20} /> {/* Using Maximize as left arrow */}
          </button>
          <button
            type="button"
            className="nf-discover__hero-next"
            aria-label="Sonraki"
            onClick={() => setVisibleIndex((i) => Math.min(hero.length - 1, i + 1))}
          >
            <Minimize2 size={20} /> {/* Using Minimize as right arrow */}
          </button>

          <div className="nf-discover__hero-carousel">
            {hero.map((item, index) => {
              const isVisible = index >= visibleIndex && index < visibleIndex + 3
              if (!isVisible) return null
              return (
                <div
                  key={item.id}
                  className="nf-discover__hero-item"
                  onClick={() => openDetail(item.type, item.id)}
                  role="button"
                  tabIndex={0}
                >
                  <img
                    src={item.poster}
                    alt={item.name}
                    className="nf-discover__hero-poster"
                    loading="lazy"
                  />
                  <div className="nf-discover__hero-info">
                    <h3 className="nf-discover__hero-title">{item.name}</h3>
                    <p className="nf-discover__hero-year">{item.year}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Category Rows */}
      {categories.length > 0 && (
        <div className="nf-discover__categories">
          {categories.map((category) => {
            const row = rows.find((r) => r.key === `category:${category.id}`)
            const items = row ? row.items : []
            const count = row ? row.count : 0

            return (
              <div
                key={category.key}
                className="nf-discover__category-card"
              >
                <div className="nf-discover__category-header">
                  <span className="nf-discover__category-name">
                    {category.name} · {count}
                  </span>
                  <span className="nf-discover__see-all">
                    Tümünü gör
                  </span>
                </div>

                <div className="nf-discover__category-grid">
                  {items.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      className="nf-discover__poster-card"
                      onClick={() => openDetail(item.type, item.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <img
                        src={item.poster}
                        alt={item.name}
                        className="nf-discover__poster-img"
                        loading="lazy"
                      />
                      <div className="nf-discover__poster-info">
                        <h4 className="nf-discover__poster-title">{item.name}</h4>
                        <p className="nf-discover__poster-year">{item.year}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* No content fallback */}
      {state.ready && hero.length === 0 && categories.length === 0 && (
        <div className="nf-discover__empty">
          <Loader2 size={32} className="nf-spin" />
          <p>Kataloğa sahip içerik bulunamadı.</p>
        </div>
      )}
    </section>
  )
}

function openDetail(type: 'movie' | 'series', id: string) {
  // Navigate to detail view - in a full app this would use routing
  // For now, we just show the detail inline or redirect
  window.location.href = `/detail?type=${type}&id=${id}`
}