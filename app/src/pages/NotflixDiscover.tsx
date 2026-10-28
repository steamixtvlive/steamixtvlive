import { useEffect, useState } from 'react'
import { Compass, Loader2 } from 'lucide-react'
import { PAGE_TITLES } from '@/lib/navigation'
import { loadVavooCatalog, type VavooChannel } from '@/lib/vavoo'
import NotflixPlayer from '@/sections/NotflixPlayer'

export default function NotflixDiscover() {
  const [channels, setChannels] = useState<VavooChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    loadVavooCatalog(controller.signal)
      .then((catalog) => setChannels(catalog.channels))
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setError(loadError instanceof Error ? loadError.message : 'Kanal listesi yüklenemedi')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [])

  if (loading) {
    return (
      <section className="nf-template">
        <header className="nf-template__head">
          <span className="nf-kicker">KEŞFET ŞABLONU</span>
          <h1>{PAGE_TITLES.discover}</h1>
          <p>Canlı kanallar yükleniyor...</p>
        </header>
        <div className="nf-template__canvas">
          <span className="nf-template__watermark">N</span>
          <div className="nf-template__placeholder">
            <span className="nf-template__icon">
              <Compass size={22} strokeWidth={1.7} />
            </span>
            <strong>Canlı TV hazırlanıyor</strong>
            <p>Kanal listesi yükleniyor.</p>
          </div>
          <span className="nf-template__corner">
            <i />
            NOTFLİX · 2027
          </span>
        </div>
      </section>
    )
  }

  return (
    <section className="nf-discover">
      <header className="nf-discover__header">
        <div className="nf-discover__title-group">
          <h1>{PAGE_TITLES.discover}</h1>
          <p className="nf-discover__subtitle">Vavoo canlı televizyon kanalları</p>
        </div>
      </header>
      {error ? (
        <div className="nf-discover__empty">
          <p role="alert">Kanal listesi yüklenemedi: {error}</p>
        </div>
      ) : <NotflixPlayer channels={channels} />}
    </section>
  )
}
