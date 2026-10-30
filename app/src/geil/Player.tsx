import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import type { PlayerState } from './types'
import { XIcon, ChevronLeft, ChevronRight, VolumeIcon, MuteIcon, FullscreenIcon, ExitFullscreenIcon, PipIcon, PlayIcon } from './icons'

interface Props {
  state: PlayerState
  onClose: () => void
  onPrev?: (() => void) | null
  onNext?: (() => void) | null
}

export default function Player({ state, onClose, onPrev, onNext }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showControls, setShowControls] = useState(true)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const hideTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!state.open) return
    document.documentElement.classList.add('player-open', 'player-osd')
    return () => {
      document.documentElement.classList.remove('player-open', 'player-osd')
    }
  }, [state.open])

  useEffect(() => {
    if (!state.open) return
    const video = videoRef.current
    if (!video) return
    setLoading(true)
    setError('')
    setCurrentTime(0)
    setDuration(0)
    setBuffered(0)

    let hls: Hls | null = null
    const source = state.streamUrl

    const onPlaying = () => { setLoading(false); setPlaying(true) }
    const onPause = () => setPlaying(false)
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime || 0)
      if (video.buffered.length) {
        setBuffered((video.buffered.end(video.buffered.length - 1) / Math.max(1, video.duration || 1)) * 100)
      }
    }
    const onDurationChange = () => setDuration(video.duration || 0)
    const onError = () => setError('Akış oynatılamadı')

    video.addEventListener('playing', onPlaying)
    video.addEventListener('pause', onPause)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('durationchange', onDurationChange)
    video.addEventListener('error', onError)

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: state.isLive })
      hls.loadSource(source)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false)
        void video.play().catch(() => {})
      })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) setError('Akış oynatılamadı')
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = source
      video.addEventListener('loadedmetadata', () => {
        setLoading(false)
        void video.play().catch(() => {})
      }, { once: true })
    } else {
      setError('Tarayıcı HLS oynatmayı desteklemiyor')
    }

    return () => {
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('durationchange', onDurationChange)
      video.removeEventListener('error', onError)
      if (hls) hls.destroy()
      try { video.pause() } catch {}
      video.removeAttribute('src')
      video.load()
    }
  }, [state.open, state.streamUrl, state.isLive])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = volume
    video.muted = muted
  }, [volume, muted])

  useEffect(() => {
    if (!showControls) return
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setShowControls(false), 3200)
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
    }
  }, [showControls])

  if (!state.open) return null

  async function toggleFullscreen() {
    const container = containerRef.current
    if (!container) return
    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch {
      // Fullscreen may be blocked by the browser.
    }
  }

  async function togglePip() {
    const video = videoRef.current
    if (!video || !('requestPictureInPicture' in video)) return
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else await video.requestPictureInPicture()
    } catch {
      // PiP may be unavailable.
    }
  }

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play().catch(() => {})
    else video.pause()
  }

  function seek(event: any) {
    const video = videoRef.current
    if (!video || !duration) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    video.currentTime = ratio * duration
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const formatTime = (value: number) => {
    if (!Number.isFinite(value)) return '0:00'
    const minutes = Math.floor(value / 60)
    const seconds = Math.floor(value % 60)
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
  }

  return (
    <div className="player-root" ref={containerRef} onMouseMove={() => setShowControls(true)}>
      <div className="player-pager">
        <div className="player-video-wrap">
          <video ref={videoRef} className="player-video" playsInline onClick={togglePlay} />
        </div>
        <div className="player-click-area" onClick={() => setShowControls((value) => !value)} />
        {loading ? (
          <div className="player-loading">
            <div className="player-pulse" />
          </div>
        ) : null}
        {error ? (
          <div className="player-loading">
            <p style={{ color: '#fff', padding: 24, textAlign: 'center' }}>{error}</p>
          </div>
        ) : null}
      </div>

      {state.isLive ? (
        <div className={`player-controls show player-live ${showControls ? '' : 'player-controls-hidden'}`}>
          <div className="player-bottom player-iptv">
            <div className="iptv-bar-wrap">
              <div className="iptv-bar" data-zone="h">
                <div className="iptv-bar-main">
                  <span className="iptv-bar-logo ch-logo-ph">{state.title ? state.title[0] : '•'}</span>
                  <div className="iptv-bar-text">
                    <div className="iptv-bar-head">
                      <span className="ch-chip ch-chip-num">CANLI</span>
                    </div>
                    <div className="iptv-bar-name">{state.title}</div>
                  </div>
                </div>
                <div className="iptv-bar-controls">
                  <div className="player-vol-wrap">
                    <button className="player-ctrl-btn" aria-label="Ses" onClick={() => setMuted((value) => !value)}>
                      {muted || volume === 0 ? <MuteIcon size={20} /> : <VolumeIcon size={20} />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={muted ? 0 : volume}
                      onChange={(event) => {
                        const next = Number(event.target.value)
                        setVolume(next)
                        if (next > 0) setMuted(false)
                      }}
                    />
                  </div>
                  {onPrev ? (
                    <button className="player-ctrl-btn" aria-label="Önceki" onClick={onPrev}>
                      <ChevronLeft size={20} />
                    </button>
                  ) : null}
                  {onNext ? (
                    <button className="player-ctrl-btn" aria-label="Sonraki" onClick={onNext}>
                      <ChevronRight size={20} />
                    </button>
                  ) : null}
                  <button className="player-ctrl-btn" aria-label="PiP" onClick={togglePip}>
                    <PipIcon size={20} />
                  </button>
                  <button className="player-ctrl-btn" aria-label="Tam ekran" onClick={toggleFullscreen}>
                    {isFullscreen ? <ExitFullscreenIcon size={20} /> : <FullscreenIcon size={20} />}
                  </button>
                  <button className="player-ctrl-btn" aria-label="Kapat" onClick={onClose}>
                    <XIcon size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`player-controls show ${showControls ? '' : 'player-controls-hidden'}`}>
          <div className="player-top">
            <button className="player-ctrl-btn" aria-label="Kapat" onClick={onClose}>
              <XIcon size={20} />
            </button>
            <div className="player-title">{state.title}</div>
          </div>
          <div className="player-bottom">
            <div className="player-seek" onClick={seek}>
              <div className="player-seek-buf" style={{ width: `${buffered}%` }} />
              <div className="player-seek-fill" style={{ width: `${progress}%` }}>
                <div className="player-seek-handle" />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="player-ctrl-btn" aria-label="Oynat/Duraklat" onClick={togglePlay}>
                  {playing ? '❚❚' : <PlayIcon size={20} />}
                </button>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, color: '#fff' }}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="player-vol-wrap">
                  <button className="player-ctrl-btn" aria-label="Ses" onClick={() => setMuted((value) => !value)}>
                    {muted || volume === 0 ? <MuteIcon size={20} /> : <VolumeIcon size={20} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={muted ? 0 : volume}
                    onChange={(event) => {
                      const next = Number(event.target.value)
                      setVolume(next)
                      if (next > 0) setMuted(false)
                    }}
                  />
                </div>
                <button className="player-ctrl-btn" aria-label="PiP" onClick={togglePip}>
                  <PipIcon size={20} />
                </button>
                <button className="player-ctrl-btn" aria-label="Tam ekran" onClick={toggleFullscreen}>
                  {isFullscreen ? <ExitFullscreenIcon size={20} /> : <FullscreenIcon size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
