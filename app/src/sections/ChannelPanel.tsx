import { useDeferredValue, useMemo, useState } from 'react'
import { Search, Tv, X } from 'lucide-react'
import {
  CATEGORY_ORDER,
  FEATURED_CATEGORY,
  channelInitial,
  formatEpgTime,
  getNowNext,
  searchKey,
  type VavooChannel,
} from '@/lib/vavoo'

interface ChannelPanelProps {
  channels: VavooChannel[]
  activeId: string
  onSelect: (channel: VavooChannel) => void
  onClose?: () => void
  className?: string
}

export default function ChannelPanel({
  channels,
  activeId,
  onSelect,
  onClose,
  className = '',
}: ChannelPanelProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>(FEATURED_CATEGORY)
  const deferredQuery = useDeferredValue(query)

  const categories = useMemo(() => {
    const available = CATEGORY_ORDER.filter((entry) => channels.some((channel) => channel.category === entry))
    return [FEATURED_CATEGORY, ...available]
  }, [channels])

  const filtered = useMemo(() => {
    const needle = searchKey(deferredQuery.trim())
    const base =
      category === FEATURED_CATEGORY
        ? channels
        : channels.filter((channel) => channel.category === category)

    if (!needle) return base
    return base.filter((channel) => searchKey(channel.name).includes(needle))
  }, [channels, category, deferredQuery])

  function clearSearch() {
    setQuery('')
  }

  return (
    <aside className={`nf-channels ${className}`.trim()} aria-label="Kanal seçimi">
      <div className="nf-channels__head">
        <div>
          <span className="nf-channels__eyebrow">CANLI KANALLAR</span>
          <h2>
            Kanallar
            <span>{channels.length.toLocaleString('tr-TR')}</span>
          </h2>
        </div>
        {onClose && (
          <button type="button" className="nf-channels__close" onClick={onClose} aria-label="Kanal panelini kapat">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="nf-channels__search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Kanal ara..."
          aria-label="Kanal ara"
          spellCheck={false}
        />
        {query && (
          <button type="button" onClick={clearSearch} aria-label="Aramayı temizle">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="nf-channels__chips" role="tablist" aria-label="Kanal kategorileri">
        {categories.map((entry) => (
          <button
            key={entry}
            type="button"
            role="tab"
            aria-selected={category === entry}
            className={`nf-channels__chip ${category === entry ? 'is-active' : ''}`}
            onClick={() => setCategory(entry)}
          >
            {entry}
          </button>
        ))}
      </div>

      <div className="nf-channels__list">
        {filtered.length === 0 ? (
          <div className="nf-channels__empty">
            <span>
              <Tv size={22} />
            </span>
            <strong>Kanal bulunamadı</strong>
            <p>Arama veya kategori filtresini değiştirmeyi deneyin.</p>
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setCategory(FEATURED_CATEGORY)
              }}
            >
              Filtreleri temizle
            </button>
          </div>
        ) : (
          filtered.map((channel) => {
            const active = channel.id === activeId
            const { now } = getNowNext(channel)
            return (
              <button
                key={channel.id}
                type="button"
                className={`nf-channel ${active ? 'is-active' : ''}`}
                onClick={() => onSelect(channel)}
                aria-pressed={active}
                title={channel.name}
              >
                <span className="nf-channel__logo">
                  <span className="nf-channel__initial">{channelInitial(channel.name)}</span>
                  {channel.logo && (
                    <img
                      src={channel.logo}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                </span>

                <span className="nf-channel__body">
                  <span className="nf-channel__name">{channel.name}</span>
                  <span className="nf-channel__meta">
                    {now ? (
                      <>
                        <em>{formatEpgTime(now.start)}</em>
                        {now.title}
                      </>
                    ) : (
                      channel.category
                    )}
                  </span>
                </span>

                <span className="nf-channel__tail">
                  <span className="nf-channel__quality">{channel.quality}</span>
                  {active ? (
                    <span className="nf-eq" aria-label="Şu an oynuyor">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    <span className="nf-channel__play" aria-hidden="true">▶</span>
                  )}
                </span>
              </button>
            )
          })
        )}
      </div>

      <div className="nf-channels__foot">
        <span>{filtered.length.toLocaleString('tr-TR')} kanal gösteriliyor</span>
        <span className="nf-channels__source">
          <i />
          VAVOO
        </span>
      </div>
    </aside>
  )
}
