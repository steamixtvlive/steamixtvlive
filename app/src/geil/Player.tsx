import { useEffect, useRef, useState } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import type { PlayerState, GeilItem } from './types'
import { XIcon, ChevronLeft, ChevronRight, VolumeIcon, MuteIcon, FullscreenIcon, ExitFullscreenIcon, PipIcon, PlayIcon, TvIcon } from './icons'
import { channelColor, currentEpg, formatClock, initialOf, remainingLabel } from './api'

interface Props {
  state: PlayerState
  onClose: () => void
  onPrev?: (() => void) | null
  onNext?: (() => void) | null
  channels?: GeilItem[]
  channelIndex?: number
  onChannelSelect?: ((channel: GeilItem) => void) | null
}

export default function Player({ state, onClose, onPrev, onNext, channels = [], channelIndex = -1, onChannelSelect }: Props) {
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
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelSearch, setPanelSearch] = useState('')
  const [panelSort, setPanelSort] = useState('trending')
  const [panelGroup, setPanelGroup] = useState('')
  const [panelFeatures, setPanelFeatures] = useState<any>(null)
  const [panelLoading, setPanelLoading] = useState(false)
  const [panelChannels, setPanelChannels] = useState<GeilItem[]>(channels)
  const hideTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!panelOpen || !state.isLive) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setPanelLoading(true)
      try {
        const params = new URLSearchParams()
        if (panelSearch.trim().length >= 2) params.set('search', panelSearch.trim())
        if (panelSort) params.set('sort', panelSort)
        if (panelGroup) params.set('group', panelGroup)
        params.set('limit', '300')
        const response = await fetch(`/api/geil/live/catalog?${params}`, { signal: controller.signal })
        const data = await response.json()
        if (!response.ok || data?.ok === false) throw new Error('Kanallar yüklenemedi')
        if (controller.signal.aborted) return
        setPanelFeatures(data.features || {})
        // Use the full server-side result when available; fall back to the supplied
        // channel set if the catalog request fails or returns no items.
        if (Array.isArray(data.items) && data.items.length > 0) setPanelChannels(data.items)
      } catch {
        // Keep the current list available if the optional refresh fails.
      } finally {
        if (!controller.signal.aborted) setPanelLoading(false)
      }
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [panelOpen, state.isLive, panelSearch, panelSort, panelGroup])

  useEffect(() => {
    setPanelChannels(channels)
  }, [channels])

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

    const vjsPlayer: any = videojs(video, {
      controls: false,
      autoplay: true,
      preload: 'auto',
      fluid: false,
      liveui: state.isLive,
    }, () => {
      vjsPlayer.src({ src: source, type: 'application/x-mpegURL' })
    })
    vjsPlayer.on('loadedmetadata', () => {
      setLoading(false)
      void vjsPlayer.play().catch(() => {})
    })
    vjsPlayer.on('error', () => {
      setError('Akış oynatılamadı')
    })
    ;(video as any)._vjsPlayer = vjsPlayer

    return () => {
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('durationchange', onDurationChange)
      video.removeEventListener('error', onError)
      const vjsPlayer = (video as any)._vjsPlayer
      if (vjsPlayer) {
        try { vjsPlayer.dispose() } catch {}
      }
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
    hideTimer.current = window.setTimeout(() => setShowControls(false), 2500)
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
                  {onChannelSelect ? (
                    <button className="player-ctrl-btn" aria-label="Kanallar" onClick={() => setPanelOpen((value) => !value)}>
                      <TvIcon size={20} />
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

      {state.isLive ? (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 12,
            padding: '6px 12px',
            borderRadius: 999,
            background: 'rgba(217, 0, 7, 0.88)',
            color: '#fff',
            fontWeight: 800,
            fontSize: 12,
            letterSpacing: '0.08em',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            opacity: showControls ? 1 : 0.35,
            transition: 'opacity 0.3s ease',
            pointerEvents: 'none',
          }}
        >
          NOTFLİX
        </div>
      ) : null}

      {state.isLive && panelOpen && onChannelSelect ? (
        <div className="ch-overlay" role="dialog" aria-modal="true" aria-label="Kanallar" onClick={(event) => { if (event.target === event.currentTarget) setPanelOpen(false) }}>
          <div className="ch-panel">
            <div className="ch-panel-head" data-zone="h">
              <h3>Kanallar</h3>
              <button className="modal-close" onClick={() => setPanelOpen(false)}>×</button>
            </div>
            <div className="ch-now" role="button" tabIndex={-1}>
              <span className="ch-now-logo ch-logo-ph" style={{ background: channelColor(state.title) }}>
                {initialOf(state.title)}
              </span>
              <div className="ch-now-text">
                <div className="ch-now-label">Şu an oynatılıyor</div>
                <div className="ch-now-name">{state.title}</div>
                {(() => {
                  const epg = currentEpg(state.item)
                  return epg.entry ? (
                    <div className="ch-epg">
                      <span className="ch-epg-time">{formatClock(epg.entry.start)} – {formatClock(epg.entry.end)}</span>
                      <span className="ch-epg-title">{epg.entry.title}</span>
                      <span className="ch-epg-left">{remainingLabel(epg.entry.end)}</span>
                    </div>
                  ) : <div className="ch-epg ch-epg-none">Yayın akışı bilgisi yok</div>
                })()}
              </div>
            </div>
            <div className="search-wrap" style={{ margin: '10px 0' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input className="glass-input" placeholder="Kanallarda ara..." value={panelSearch} onChange={(event) => setPanelSearch(event.target.value)} />
            </div>
            <div className="ch-controls" style={{ display: 'flex', gap: 8, padding: '0 12px 10px', flexShrink: 0 }}>
              <select className="sort-select" aria-label="Sıralama" value={panelSort} onChange={(event) => setPanelSort(event.target.value)}>
                {(panelFeatures?.sort || [{ id: 'trending', name: 'Trending' }, { id: 'name', name: 'A-Z' }]).map((option: any) => (
                  <option key={option.id} value={option.id}>{option.name === 'Trending' ? 'Trending' : option.name}</option>
                ))}
              </select>
              <select className="sort-select" aria-label="Ülke" value={panelGroup} onChange={(event) => setPanelGroup(event.target.value)}>
                <option value="">Country: tümü</option>
                {(panelFeatures?.filter?.find((feature: any) => feature.id === 'group')?.values || []).map((option: any) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </div>
            <div className="ch-list" style={{ maxHeight: 'none', minHeight: 0, overflowY: 'auto', flex: 1 }} aria-busy={panelLoading}>
              {panelChannels
                .filter((channel) => channel.name.toLowerCase().includes(panelSearch.toLowerCase()))
                .map((channel, index) => (
                  <div className="ch-item" key={channel.id} style={{ position: 'relative', height: 64 }}>
                    <div className="ch-row" style={{ height: '100%' }} onClick={() => onChannelSelect(channel)}>
                      <span className="ch-num">{index + 1}</span>
                      <span className="ch-logo ch-logo-ph" style={{ background: channelColor(channel.name) }}>{initialOf(channel.name)}</span>
                      <div className="ch-main">
                        <div className="ch-head">
                          <span className="ch-name">{channel.name}</span>
                          {channel.id === state.item?.id ? <span className="ch-now-label">ŞU AN</span> : null}
                        </div>
                        <div className="ch-epg-block">
                          {(() => {
                            const epg = currentEpg(channel)
                            return epg.entry ? (
                              <>
                                <div className="ch-epg">
                                  <span className="ch-epg-time">{formatClock(epg.entry.start)} – {formatClock(epg.entry.end)}</span>
                                  <span className="ch-epg-title">{epg.entry.title}</span>
                                  <span className="ch-epg-left">{remainingLabel(epg.entry.end)}</span>
                                </div>
                                <div className="ch-epg-track"><div className="ch-epg-fill" style={{ width: `${epg.progress}%` }} /></div>
                              </>
                            ) : <div className="ch-epg ch-epg-none">Yayın akışı bilgisi yok</div>
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              {!panelLoading && panelChannels.filter((channel) => channel.name.toLowerCase().includes(panelSearch.toLowerCase())).length === 0 ? (
                <div className="empty"><h3>Sonuç bulunamadı</h3><p>Farklı bir arama veya filtre deneyin.</p></div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
