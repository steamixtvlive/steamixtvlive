import { useState } from 'react'
import type { GeilItem } from './types'
import { imageUrl, posterUrl, ratingOf, yearOf } from './api'
import { itemHref } from './router'
import { StarIcon } from './icons'

export function PosterCard({
  item,
  addonId = 'tmdb',
  index = 0,
  progress = 0,
  numbered = 0,
  caption,
}: {
  item: GeilItem
  addonId?: string
  index?: number
  progress?: number
  numbered?: number
  caption?: string
}) {
  const [loaded, setLoaded] = useState(false)
  const poster = posterUrl(item, 'medium')
  const rating = ratingOf(item)
  const year = yearOf(item)
  const href = itemHref(addonId, item.type, item.id)

  return (
    <a
      className="card card-portrait card-enter"
      href={href}
      style={{ animationDelay: `${Math.min(index, 12) * 28}ms` }}
      aria-label={item.name}
    >
      <div className="card-img">
        {poster ? (
          <img
            src={poster}
            alt=""
            loading="eager"
            className={loaded ? 'loaded' : ''}
            onLoad={() => setLoaded(true)}
          />
        ) : null}
        {!poster || !loaded ? <div className="ph">{(item.name || '?')[0]}</div> : null}
        <div className="card-overlay">
          <div className="card-overlay-top">
            {numbered > 0 ? <span className="card-number">{numbered}</span> : null}
          </div>
          <div className="card-overlay-bottom">
            <div className="card-title">{caption || item.name}</div>
            <div className="card-meta">
              {rating ? <span className="card-rating"><StarIcon size={11} /> {rating}</span> : null}
              {year ? <span>{year}</span> : null}
            </div>
          </div>
        </div>
        {rating ? <span className="card-badge"><StarIcon size={11} /> {rating}</span> : null}
        {progress > 0 ? (
          <span className="card-progress" aria-hidden="true"><span style={{ width: `${Math.round(progress * 100)}%` }} /></span>
        ) : null}
      </div>
    </a>
  )
}

export function LandscapeCard({
  item,
  addonId = 'tmdb',
  index = 0,
  progress = 0,
}: {
  item: GeilItem
  addonId?: string
  index?: number
  progress?: number
}) {
  const [loaded, setLoaded] = useState(false)
  const backdrop = imageUrl(item.images?.backdrops?.[0] || item.images?.poster, 'medium')
  const href = itemHref(addonId, item.type, item.id)
  return (
    <a className="card card-landscape card-enter" href={href} style={{ animationDelay: `${Math.min(index, 12) * 28}ms` }} aria-label={item.name}>
      <div className="card-img">
        {backdrop ? <img src={backdrop} alt="" loading="lazy" className={loaded ? 'loaded' : ''} onLoad={() => setLoaded(true)} /> : null}
        {!backdrop || !loaded ? <div className="ph">{(item.name || '?')[0]}</div> : null}
        <div className="card-overlay">
          <div className="card-overlay-top" />
          <div className="card-overlay-bottom">
            <div className="card-title">{item.name}</div>
            <div className="card-meta">{yearOf(item)}{ratingOf(item) ? ` · ★ ${ratingOf(item)}` : ''}</div>
          </div>
        </div>
        {progress > 0 ? <span className="card-progress"><span style={{ width: `${Math.round(progress * 100)}%` }} /></span> : null}
      </div>
    </a>
  )
}

export function SkeletonCard({ index = 0, shape = 'portrait' }: { index?: number; shape?: string }) {
  return (
    <div className={`card card-${shape} card-skeleton`} aria-hidden="true">
      <div className="card-img">
        <div className="ph" style={{ animationDelay: `${index * 80}ms` }} />
      </div>
    </div>
  )
}

export function SectionRow({
  sectionRef,
  title,
  items,
  loading = false,
  skeletons = 6,
  addonId = 'tmdb',
  numbered = false,
  progressOf,
  captionOf,
  seeAllHref,
}: {
  sectionRef?: (element: HTMLElement | null) => void
  title: string
  items: GeilItem[]
  loading?: boolean
  skeletons?: number
  addonId?: string
  numbered?: boolean
  progressOf?: (item: GeilItem) => number
  captionOf?: (item: GeilItem) => string | undefined
  seeAllHref?: string
}) {
  return (
    <section ref={sectionRef} className="section reveal is-in">
      <div className="section-head">
        <h2 className="section-title section-title-static">
          <span className="section-title-text">{title}</span>
        </h2>
        {seeAllHref ? (
          <a className="section-see-all" href={seeAllHref} aria-label="Tümünü gör" style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={22} height={22}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>
        ) : null}
      </div>
      <div className="row-wrap row-can-scroll row-at-start">
        <div className="row" data-zone="h" data-scroll="x">
          {items.map((item, index) => (
            <PosterCard
              key={`${item.id}-${index}`}
              item={item}
              addonId={addonId}
              index={index}
              numbered={numbered ? index + 1 : 0}
              progress={progressOf ? progressOf(item) : 0}
              caption={captionOf ? captionOf(item) : undefined}
            />
          ))}
          {loading
            ? Array.from({ length: skeletons }).map((_, index) => <SkeletonCard key={`skeleton-${index}`} index={index} />)
            : null}
        </div>
      </div>
    </section>
  )
}

export function CardGrid({
  items,
  addonId = 'tmdb',
  loading = false,
  skeletonCount = 12,
  progressOf,
}: {
  items: GeilItem[]
  addonId?: string
  loading?: boolean
  skeletonCount?: number
  progressOf?: (item: GeilItem) => number
}) {
  return (
    <div className="grid portrait" data-zone="grid" aria-busy={loading ? 'true' : undefined}>
      {items.map((item, index) => (
        <PosterCard
          key={`${item.id}-${index}`}
          item={item}
          addonId={addonId}
          index={index}
          progress={progressOf ? progressOf(item) : 0}
        />
      ))}
      {loading ? Array.from({ length: skeletonCount }).map((_, index) => <SkeletonCard key={`grid-skeleton-${index}`} index={index} />) : null}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  action?: React.ReactNode
}) {
  return (
    <div className="empty-lib">
      <div className="empty-card">
        <div className="empty-card-icon">{icon}</div>
        <h3 className="empty-card-title">{title}</h3>
        <p className="empty-card-desc">{desc}</p>
        {action ? <div className="empty-card-actions" data-zone="h">{action}</div> : null}
      </div>
    </div>
  )
}
