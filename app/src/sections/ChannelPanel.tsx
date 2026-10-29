import { useDeferredValue, useMemo, useState } from 'react'
import { Search, Tv, X } from 'lucide-react'
import {
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
  country?: string
  countries?: string[]
  onCountryChange?: (country: string) => void
}

export default function ChannelPanel({
  channels,
  activeId,
  onSelect,
  onClose,
  className = '',
  country,
  countries = [],
  onCountryChange,
}: ChannelPanelProps) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const filtered = useMemo(() => {
    const needle = searchKey(deferredQuery.trim())
    const unique = new Map<string, VavooChannel>()
    for (const channel of channels) {
      const key = `${channel.id}:${channel.name}`
      if (!unique.has(key) && (!needle || searchKey(channel.name).includes(needle))) unique.set(key, channel)
    }
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'tr', { sensitivity: 'base', numeric: true }))
  }, [channels, deferredQuery])

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

      {country && countries.length > 0 && onCountryChange && <label className="nf-channels__country">Ülke<select value={country} onChange={(event) => onCountryChange(event.target.value)}>{countries.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>}

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

      <div className="nf-channels__list">
        {filtered.length === 0 ? (
          <div className="nf-channels__empty">
            <span>
              <Tv size={22} />
            </span>
            <strong>Kanal bulunamadı</strong>
            <p>Başka bir kanal adı aramayı deneyin.</p>
            <button
              type="button"
              onClick={() => {
                setQuery('')
              }}
            >
              Filtreleri temizle
            </button>
          </div>
        ) : (
          filtered.map((channel) => {
            const active = channel.id === activeId
            const { now } = getNowNext(channel)
            const variants = (channel.qualityVariants || []).filter((variant) => variant.id !== channel.id)
            return (
              <div key={channel.id} className={`nf-channel-group ${active ? 'is-active' : ''}`}>
              <button
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
                  {now && <span className="nf-channel__meta"><em>{formatEpgTime(now.start)}</em>{now.title}</span>}
                </span>

                <span className="nf-channel__tail">
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
              {variants.length > 0 && <div className="nf-channel-variants" aria-label={`${channel.name} çözünürlükleri`}>{variants.map((variant) => <button key={variant.id} type="button" className="nf-channel-variant" onClick={() => onSelect({ ...channel, id: variant.id, name: variant.name, quality: variant.quality })}>{variant.quality}</button>)}</div>}
              </div>
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
