import { useNavigate } from 'react-router-dom'
import { Play, Radio, Tv } from 'lucide-react'
import type { RotationCategory, RotationChannel } from '@/lib/rotation'
import { slugify } from '@/lib/utils'

interface NotflixDiscoverProps {
  categories: RotationCategory[]
}

export default function NotflixDiscover({ categories }: NotflixDiscoverProps) {
  const navigate = useNavigate()
  const playableCategories = categories.filter((category) => category.channels.length > 0)

  function watch(channel: RotationChannel) {
    navigate(`/watch/rotation/${encodeURIComponent(channel.id)}/${slugify(channel.name)}`, {
      state: { returnTo: '/notflix', source: 'mxclanx-m3u' },
    })
  }

  return (
    <section className="nf-discover" aria-label="MXClanX M3U kanal kataloğu">
      <header className="nf-discover__header">
        <div className="nf-discover__title-group">
          <h1>Keşfet</h1>
          <p className="nf-discover__subtitle">MXClanX · Canlı M3U kanalları</p>
        </div>
        <span className="nf-discover__source"><Radio size={14} /> {playableCategories.reduce((sum, category) => sum + category.channels.length, 0)} kanal</span>
      </header>

      {playableCategories.length === 0 ? (
        <div className="nf-discover__empty" role="status">
          <p>M3U kanal listesi boş. Playlist bağlantısını ve M3U verisini kontrol edin.</p>
        </div>
      ) : (
        <div className="nf-discover__categories">
          {playableCategories.map((category) => (
            <section key={category.id} className="nf-discover__category-card">
              <div className="nf-discover__category-header">
                <span className="nf-discover__category-name">{category.name} · {category.channels.length}</span>
                <span className="nf-discover__see-all">CANLI TV</span>
              </div>
              <div className="nf-discover__category-grid">
                {category.channels.map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    className="nf-discover__poster-card"
                    onClick={() => watch(channel)}
                    aria-label={`${channel.name} kanalını izle`}
                  >
                    {channel.tvgLogo ? (
                      <img
                        src={channel.tvgLogo}
                        alt=""
                        className="nf-discover__poster-img"
                        loading="lazy"
                        onError={(event) => { event.currentTarget.style.display = 'none' }}
                      />
                    ) : (
                      <span className="nf-discover__channel-placeholder"><Tv size={28} /></span>
                    )}
                    <span className="nf-discover__poster-info">
                      <span className="nf-discover__poster-title">{channel.name}</span>
                      <span className="nf-discover__poster-year">{channel.groupTitle}</span>
                    </span>
                    <span className="nf-discover__play"><Play size={17} fill="currentColor" /></span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
