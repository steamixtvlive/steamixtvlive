import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, Loader2, Radio, RotateCcw, Server, Wifi } from 'lucide-react'
import NotflixLogo from '@/sections/NotflixLogo'
import NotflixFooter from '@/sections/NotflixFooter'
import { loadVavooCatalog, loadVavooStatus, type VavooCatalog } from '@/lib/vavoo'

const MIN_LOADING_MS = 2900

interface NotflixLoadingProps {
  onReady: (catalog: VavooCatalog) => void
  onCancel: () => void
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

export default function NotflixLoading({ onReady, onCancel }: NotflixLoadingProps) {
  const [progress, setProgress] = useState(3)
  const [target, setTarget] = useState(9)
  const [step, setStep] = useState('İçerikler yükleniyor...')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [rawCount, setRawCount] = useState(0)
  const [channelCount, setChannelCount] = useState(0)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    startedAt.current = Date.now()

    setProgress(3)
    setTarget(9)
    setStep('VOD arşivi ve canlı TV hazırlanıyor...')
    setError('')
    setRawCount(0)
    setChannelCount(0)

    const ticker = window.setInterval(() => {
      setProgress((current) => {
        const ceiling = Math.max(3, target)
        if (current >= ceiling) return current
        return Math.min(ceiling, current + Math.max(0.32, (ceiling - current) * 0.075))
      })
    }, 110)

    const poller = window.setInterval(async () => {
      try {
        const status = await loadVavooStatus(controller.signal)
        if (cancelled) return
        if (typeof status.raw === 'number' && status.raw > 0) setRawCount(status.raw)
        if (typeof status.total === 'number' && status.total > 0) setChannelCount(status.total)
          if (status.active) {
            setTarget((current) => Math.max(current, Math.min(94, Math.max(9, status.percent))))
            if (status.message) setStep(status.message.replace(/Vavoo|MediaHubMX/gi, 'Canlı yayın'))
        }
      } catch {
        // Status is a best-effort enhancement; the main request is the source of truth.
      }
    }, 320)

    async function load() {
      try {
        const catalog = await loadVavooCatalog(controller.signal)
        if (cancelled) return

        const elapsed = Date.now() - startedAt.current
        if (elapsed < MIN_LOADING_MS) await delay(MIN_LOADING_MS - elapsed)
        if (cancelled) return

        setRawCount(catalog.rawTotal)
        setChannelCount(catalog.total)
          setStep('Posterler, VOD arşivi ve oynatıcı hazırlanıyor...')
        setTarget(100)
        setProgress(100)

        await delay(950)
        if (cancelled) return
        onReady(catalog)
      } catch (loadError) {
        if (cancelled || controller.signal.aborted) return
        setError(loadError instanceof Error ? loadError.message : 'İçerikler yüklenemedi')
        setStep('Bağlantı kurulamadı')
        setTarget(0)
      }
    }

    void load()

    return () => {
      cancelled = true
      controller.abort()
      window.clearInterval(ticker)
      window.clearInterval(poller)
    }
  }, [attempt, onReady])

  const rounded = Math.min(100, Math.round(progress))

  if (error) {
    return (
      <div className="nf-loading">
        <div className="nf-loading__grain" aria-hidden="true" />
        <main className="nf-loading__error-card">
          <span className="nf-loading__error-icon">
            <AlertTriangle size={26} />
          </span>
          <p className="nf-kicker">BAĞLANTI HATASI</p>
          <h1>İçerikler yüklenemedi</h1>
          <p className="nf-loading__error-text">{error}</p>
          <p className="nf-loading__error-hint">
            Canlı yayın kataloğuna erişilemiyor olabilir. Bağlantınızı kontrol edip yeniden deneyin.
          </p>
          <div className="nf-loading__error-actions">
            <button type="button" className="nf-btn nf-btn--primary" onClick={() => setAttempt((value) => value + 1)}>
              <RotateCcw size={17} />
              Yeniden Dene
            </button>
            <button type="button" className="nf-btn nf-btn--ghost" onClick={onCancel}>
              <ArrowLeft size={17} />
              Kod Ekranına Dön
            </button>
          </div>
        </main>
        <NotflixFooter />
      </div>
    )
  }

  return (
    <div className="nf-loading">
      <div className="nf-loading__glow" aria-hidden="true" />
      <div className="nf-loading__grain" aria-hidden="true" />

      <main className="nf-loading__content">
        <div className="nf-loading__logo">
          <NotflixLogo />
        </div>

        <div className="nf-loading__orb" aria-hidden="true">
          <span className="nf-loading__orb-ring" />
          <span className="nf-loading__orb-ring nf-loading__orb-ring--inner" />
          <span className="nf-loading__orb-core">
            <Loader2 className="nf-spin" size={25} />
          </span>
        </div>

        <p className="nf-kicker">
          <Radio size={13} />
          MEDIA HUB · CANLI YAYIN
        </p>

        <h1 className="nf-loading__title">İçerikler yükleniyor, lütfen bekleyiniz...</h1>
      <p className="nf-loading__step">{step}</p>

        <div className="nf-loading__meter" aria-hidden="true">
          <span className="nf-loading__meter-fill" style={{ width: `${rounded}%` }} />
        </div>

        <div className="nf-loading__numbers">
          <span className="nf-loading__percent">
            %{rounded}
            <span className="nf-loading__dots">
              <i />
              <i />
              <i />
            </span>
          </span>
          <span className="nf-loading__counts">
            {rawCount > 0 ? `${rawCount.toLocaleString('tr-TR')} kaynak taranıyor` : 'Katalog taranıyor'}
            {channelCount > 0 ? ` · ${channelCount.toLocaleString('tr-TR')} kanal` : ''}
          </span>
        </div>

        <div className="nf-loading__chips">
          <span>
            <Server size={13} /> Canlı TV
          </span>
          <span>
            <Wifi size={13} /> HLS Proxy
          </span>
          <span>
            <Radio size={13} /> Kanallar
          </span>
        </div>
      </main>

      <NotflixFooter />
    </div>
  )
}
