import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Hls from 'hls.js'
import {
  AlertTriangle,
  ListVideo,
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
import ChannelPanel from '@/sections/ChannelPanel'
import {
  channelInitial,
  formatEpgTime,
  getNowNext,
  pickDefaultChannel,
  resolveVavooChannel,
  type VavooChannel,
} from '@/lib/vavoo'

interface NotflixPlayerProps {
  channels: VavooChannel[]
}

const HLS_CONFIG = {
  enableWorker: true,
  lowLatencyMode: false,
  backBufferLength: 30,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  liveSyncDurationCount: 3,
  manifestLoadingTimeOut: 22000,
  manifestLoadingMaxRetry: 3,
  levelLoadingTimeOut: 18000,
  levelLoadingMaxRetry: 3,
  fragLoadingTimeOut: 26000,
  fragLoadingMaxRetry: 5,
}

function isSmallScreen() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
}

export default function NotflixPlayer({ channels }: NotflixPlayerProps) {
  const defaultChannel = useMemo(() => pickDefaultChannel(channels), [channels])
  const [activeId, setActiveId] = useState(() => defaultChannel?.id || '')
  const active = useMemo(
    () => channels.find((channel) => channel.id === activeId) || defaultChannel || null,
    [channels, activeId, defaultChannel],
  )

  const [attempt, setAttempt] = useState(0)
  const [stream, setStream] = useState('')
  const [resolving, setResolving] = useState(true)
  const [buffering, setBuffering] = useState(true)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(82)
  const [drawerOpen, setDrawerOpen] = useState(() => !isSmallScreen())
  const [fullscreen, setFullscreen] = useState(false)
  const [pipSupported, setPipSupported] = useState(false)
  const [pipActive, setPipActive] = useState(false)
  const [uiVisible, setUiVisible] = useState(true)
  const [nowTick, setNowTick] = useState(() => Date.now())

  const wrapperRef = useRef<HTMLElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const hideTimer = useRef<number | null>(null)
  const retryTimer = useRef<number | null>(null)
  const autoRetryRef = useRef(0)
  const forceRefreshRef = useRef(false)

  const epg = useMemo(() => {
    if (!active) return { now: null, next: null }
    return getNowNext(active, nowTick / 1000)
  }, [active, nowTick])

  const epgProgress = useMemo(() => {
    if (!epg.now) return 0
    const span = epg.now.stop - epg.now.start
    if (span <= 0) return 0
    return Math.min(100, Math.max(0, ((nowTick / 1000 - epg.now.start) / span) * 100))
  }, [epg.now, nowTick])

  const clock = useMemo(
    () =>
      new Intl.DateTimeFormat('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/Istanbul',
      }).format(new Date(nowTick)),
    [nowTick],
  )

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      void video.play().catch(() => setError('Yayın oynatılamadı. Yeniden deneyin.'))
    } else {
      video.pause()
    }
  }, [])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const nextMuted = !video.muted
    video.muted = nextMuted
    setMuted(nextMuted)
  }, [])

  const handleVolume = useCallback((value: number) => {
    const video = videoRef.current
    setVolume(value)
    setMuted(value === 0)
    if (video) {
      video.volume = value / 100
      video.muted = value === 0
    }
  }, [])

  const selectChannel = useCallback((channel: VavooChannel) => {
    setActiveId(channel.id)
    if (isSmallScreen()) setDrawerOpen(false)
  }, [])

  const stepChannel = useCallback((direction: -1 | 1) => {
    if (channels.length === 0) return
    const currentIndex = channels.findIndex((channel) => channel.id === active?.id)
    const safeIndex = currentIndex < 0 ? 0 : currentIndex
    const nextIndex = (safeIndex + direction + channels.length) % channels.length
    setActiveId(channels[nextIndex].id)
  }, [active?.id, channels])

  const retry = useCallback(() => {
    forceRefreshRef.current = true
    setError('')
    setResolving(true)
    setBuffering(true)
    setAttempt((value) => value + 1)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const node = wrapperRef.current
    if (!node) return
    try {
      if (document.fullscreenElement === node) await document.exitFullscreen()
      else await node.requestFullscreen()
    } catch {
      setError('Tam ekran modu kullanılamıyor.')
    }
  }, [])

  const togglePip = useCallback(async () => {
    const video = videoRef.current as (HTMLVideoElement & {
      requestPictureInPicture?: () => Promise<PictureInPictureWindow>
    }) | null
    if (!video) return
    try {
      if (document.pictureInPictureElement === video) await document.exitPictureInPicture()
      else if (video.requestPictureInPicture) await video.requestPictureInPicture()
    } catch {
      setError('Mini oynatıcı açılamadı.')
    }
  }, [])

  const wakeUi = useCallback(() => {
    setUiVisible(true)
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      const video = videoRef.current
      if (video && !video.paused) setUiVisible(false)
    }, 3800)
  }, [])

  useEffect(() => {
    wakeUi()
    return () => {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current)
    }
  }, [wakeUi])

  useEffect(() => {
    if (!playing) {
      setUiVisible(true)
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current)
    } else {
      wakeUi()
    }
  }, [playing, wakeUi])

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const supported =
      typeof document !== 'undefined' &&
      'pictureInPictureEnabled' in document &&
      Boolean((document as Document & { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled) &&
      typeof HTMLVideoElement !== 'undefined' &&
      'requestPictureInPicture' in HTMLVideoElement.prototype

    setPipSupported(supported)

    const video = videoRef.current
    if (!video) return

    const onEnter = () => setPipActive(true)
    const onLeave = () => setPipActive(false)
    video.addEventListener('enterpictureinpicture', onEnter)
    video.addEventListener('leavepictureinpicture', onLeave)
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter)
      video.removeEventListener('leavepictureinpicture', onLeave)
    }
  }, [])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === wrapperRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = volume / 100
    video.muted = muted
  }, [volume, muted])

  useEffect(() => {
    if (!active) return

    let cancelled = false
    let timedOut = false
    const controller = new AbortController()
    const refresh = forceRefreshRef.current
    forceRefreshRef.current = false
    autoRetryRef.current = 0

    setResolving(true)
    setBuffering(true)
    setError('')
    setStream('')
    setPlaying(false)

    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 25000)

    resolveVavooChannel(active.id, refresh, controller.signal)
      .then((resolved) => {
        if (cancelled) return
        setStream(resolved.stream)
      })
      .catch((resolveError) => {
        if (cancelled) return
        setResolving(false)
        setBuffering(false)
        setError(
          timedOut
            ? 'Kanal yayını zaman aşımına uğradı. Lütfen yeniden deneyin.'
            : resolveError instanceof Error
              ? resolveError.message
              : 'Kanal yayınına bağlanılamadı',
        )
      })
      .finally(() => {
        window.clearTimeout(timeout)
      })

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [active, attempt])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target?.closest(
          'input, textarea, select, button, a, [contenteditable="true"], [role="textbox"]',
        )
      ) {
        return
      }

      if (event.code === 'Space') {
        event.preventDefault()
        togglePlay()
        wakeUi()
        return
      }

      const key = event.key.toLowerCase()

      if (key === 'm') {
        toggleMute()
        wakeUi()
      } else if (key === 'f') {
        void toggleFullscreen()
      } else if (key === 'c' || key === 'l') {
        setDrawerOpen((value) => !value)
        wakeUi()
      } else if (key === 'arrowright') {
        event.preventDefault()
        stepChannel(1)
        wakeUi()
      } else if (key === 'arrowleft') {
        event.preventDefault()
        stepChannel(-1)
        wakeUi()
      } else if (key === 'escape') {
        if (drawerOpen && isSmallScreen()) {
          setDrawerOpen(false)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen, stepChannel, toggleFullscreen, toggleMute, togglePlay, wakeUi])

  if (!active) {
    return (
      <section className="nf-player nf-player--empty">
        <div className="nf-player__empty-state">
          <Radio size={28} />
          <h2>Kanal bulunamadı</h2>
          <p>Canlı kanal listesi yüklenemedi.</p>
        </div>
      </section>
    )
  }

  return (
    <div className="nf-live-stage">
      <section
        ref={wrapperRef}
        className={`nf-player ${uiVisible ? 'is-ui-visible' : 'is-idle'} ${drawerOpen ? 'has-drawer' : ''}`}
        aria-label={`Canlı TV oynatıcısı: ${active.name}`}
        onPointerMove={wakeUi}
        onPointerDown={wakeUi}
        tabIndex={-1}
      >
        <video
          ref={videoRef}
          className="nf-player__video"
          playsInline
          muted={muted}
          onClick={togglePlay}
          onPlaying={() => {
            setPlaying(true)
            setBuffering(false)
            setResolving(false)
            wakeUi()
          }}
          onPause={() => {
            setPlaying(false)
            setUiVisible(true)
          }}
          onWaiting={() => setBuffering(true)}
          onStalled={() => setBuffering(true)}
          onCanPlay={() => {
            setBuffering(false)
            setResolving(false)
          }}
          onLoadedMetadata={() => setResolving(false)}
          onVolumeChange={() => {
            const video = videoRef.current
            if (!video) return
            setMuted(video.muted)
            setVolume(Math.round(video.volume * 100))
          }}
        />

        <div className="nf-player__shade" aria-hidden="true" />
        <div className="nf-player__grain" aria-hidden="true" />

        <header className="nf-player__top">
          <div className="nf-player__brand-group">
            <span className="nf-player__brand">NOTFLİX</span>
            <span className="nf-player__brand-rule" aria-hidden="true" />
            <span className="nf-player__top-caption">CANLI TV</span>
          </div>

          <div className="nf-player__top-actions">
            <span className="nf-player__live-tag">
              <i />
              CANLI
            </span>
            <button
              type="button"
              className={`nf-player__pill ${drawerOpen ? 'is-active' : ''}`}
              onClick={() => setDrawerOpen((value) => !value)}
              aria-pressed={drawerOpen}
              aria-label={drawerOpen ? 'Kanal panelini kapat' : 'Kanal panelini aç'}
            >
              <ListVideo size={16} />
              <span>Kanallar</span>
            </button>
          </div>
        </header>

        {(resolving || buffering) && (
          <div className="nf-player__status" role="status">
            <span className="nf-player__spinner">
              <Loader2 className="nf-spin" size={25} />
            </span>
            <span>
              <strong>
                {error ||
                  (resolving ? 'Kanal bağlantısı kuruluyor' : 'Yayın tamponlanıyor')}
              </strong>
              <small>{active.name} · Vavoo canlı yayın</small>
            </span>
          </div>
        )}

        {error && !resolving && !buffering && (
          <div className="nf-player__error" role="alert">
            <span className="nf-player__error-icon">
              <AlertTriangle size={25} />
            </span>
            <h2>Yayın açılamadı</h2>
            <p>{error}</p>
            <div className="nf-player__error-actions">
              <button type="button" onClick={retry} className="nf-btn nf-btn--primary">
                <RotateCcw size={16} />
                Yeniden Dene
              </button>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="nf-btn nf-btn--ghost"
              >
                <ListVideo size={16} />
                Kanal Seç
              </button>
            </div>
          </div>
        )}

        {!error && playing && muted && (
          <button type="button" className="nf-player__unmute" onClick={toggleMute}>
            <Volume2 size={16} />
            Sesi aç
          </button>
        )}

        <div className="nf-player__bottom">
          <div className="nf-player__meta">
            <span className="nf-player__channel-logo">
              <span>{channelInitial(active.name)}</span>
              {active.logo && (
                <img
                  src={active.logo}
                  alt=""
                  draggable={false}
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                />
              )}
            </span>

            <div className="nf-player__channel-copy">
              <div className="nf-player__channel-title">
                <h2>{active.name}</h2>
                <span className="nf-player__category">{active.category}</span>
              </div>

              {epg.now ? (
                <p className="nf-player__program">
                  <em>{formatEpgTime(epg.now.start)}</em>
                  {epg.now.title}
                </p>
              ) : (
                <p className="nf-player__program">
                  <em>CANLI</em>
                  Kesintisiz canlı yayın
                </p>
              )}

              {epg.next && (
                <p className="nf-player__next">
                  <span>Sırada</span>
                  <em>{formatEpgTime(epg.next.start)}</em>
                  {epg.next.title}
                </p>
              )}
            </div>
          </div>

          <div className="nf-player__timeline" aria-hidden="true">
            <span className="nf-player__timeline-label">
              <i />
              CANLI
            </span>
            <span className="nf-player__timeline-track">
              <span style={{ width: `${epgProgress}%` }} />
            </span>
            <span className="nf-player__timeline-clock">{clock}</span>
          </div>

          <div className="nf-player__controls">
            <div className="nf-player__controls-left">
              <button
                type="button"
                className="nf-player__control nf-player__control--play"
                onClick={togglePlay}
                aria-label={playing ? 'Duraklat' : 'Oynat'}
              >
                {playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
              </button>

              <div className="nf-player__volume">
                <button
                  type="button"
                  className="nf-player__control"
                  onClick={toggleMute}
                  aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}
                >
                  {muted || volume === 0 ? <VolumeX size={19} /> : <Volume2 size={19} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={muted ? 0 : volume}
                  onChange={(event) => handleVolume(Number(event.target.value))}
                  aria-label="Ses seviyesi"
                  className="nf-player__volume-slider"
                />
              </div>

              <span className="nf-player__state">
                <i className={playing ? 'is-live' : ''} />
                {resolving ? 'Bağlanıyor' : playing ? 'Canlı yayın' : 'Duraklatıldı'}
              </span>
            </div>

            <div className="nf-player__controls-right">
              <button
                type="button"
                className={`nf-player__control ${drawerOpen ? 'is-active' : ''}`}
                onClick={() => setDrawerOpen((value) => !value)}
                aria-label={drawerOpen ? 'Kanal panelini kapat' : 'Kanal panelini aç'}
                aria-pressed={drawerOpen}
              >
                <ListVideo size={17} />
              </button>

              {pipSupported && (
                <button
                  type="button"
                  className={`nf-player__control ${pipActive ? 'is-active' : ''}`}
                  onClick={() => void togglePip()}
                  aria-label={pipActive ? 'Mini oynatıcıyı kapat' : 'Mini oynatıcı'}
                >
                  <PictureInPicture2 size={18} />
                </button>
              )}

              <button
                type="button"
                className={`nf-player__control ${fullscreen ? 'is-active' : ''}`}
                onClick={() => void toggleFullscreen()}
                aria-label={fullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
              >
                {fullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
              </button>
            </div>
          </div>
        </div>

        {drawerOpen && (
          <button
            type="button"
            className="nf-player__drawer-scrim"
            onClick={() => setDrawerOpen(false)}
            aria-label="Kanal panelini kapat"
            tabIndex={-1}
          />
        )}

        <div
          className={`nf-player__drawer ${drawerOpen ? 'is-open' : ''}`}
          aria-hidden={!drawerOpen}
          inert={!drawerOpen}
        >
          <ChannelPanel
            channels={channels}
            activeId={active.id}
            onSelect={selectChannel}
            onClose={() => setDrawerOpen(false)}
          />
        </div>
      </section>
    </div>
  )
}
