import { useEffect, useRef, useState } from 'react'
import type { GeilFeatures } from './types'
import type { MouseEvent } from 'react'
import Hls from 'hls.js'
import { Captions, List } from 'lucide-react'
import type { PlayerState, GeilItem } from './types'
import { XIcon, ChevronLeft, ChevronRight, VolumeIcon, MuteIcon, FullscreenIcon, ExitFullscreenIcon, PipIcon, PlayIcon, HeartIcon, SearchIcon } from './icons'
import { channelColor, currentEpg, formatClock, initialOf, remainingLabel } from './api'

// Keep the live-panel improvements compatible with the pre-Video.js player.

interface Props {
  state: PlayerState
  onClose: () => void
  onPrev?: (() => void) | null
  onNext?: (() => void) | null
  channels?: GeilItem[]
  onChannelSelect?: ((channel: GeilItem) => void) | null
}

export default function Player({ state, onClose, onPrev, onNext, channels = [], onChannelSelect }: Props) {
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
  const [subtitleIndex, setSubtitleIndex] = useState(-1)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelSearch, setPanelSearch] = useState('')
  const [panelSort, setPanelSort] = useState('trending')
  const [panelGroup, setPanelGroup] = useState('')
  const [panelFeatures, setPanelFeatures] = useState<GeilFeatures | null>(null)
  const [panelLoading, setPanelLoading] = useState(false)
  const [panelChannels, setPanelChannels] = useState<GeilItem[]>(channels)
  const [catalogChannels, setCatalogChannels] = useState<GeilItem[]>(channels)
  const [favIds, setFavIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('notflix_geil_live_favorites') || '[]')) } catch { return new Set() }
  })
  const hideTimer = useRef<number | null>(null)
  const userInteracted = useRef(false)
  const currentVideos = useRef(state.item?.videos)
  currentVideos.current = state.item?.videos

  useEffect(() => {
    if (!state.isLive) return
    if (panelOpen) {
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      hideTimer.current = null
      return
    }
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setShowControls(false), 2500)
    return () => { if (hideTimer.current) window.clearTimeout(hideTimer.current) }
  }, [panelOpen, state.isLive])

  useEffect(() => {
    if (!panelOpen || !state.isLive) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      if (!userInteracted.current) { setPanelLoading(false); return }
      setPanelLoading(true)
      try {
        const params = new URLSearchParams()
        if (panelSearch.trim().length >= 2) params.set('search', panelSearch.trim())
        if (panelSort) params.set('sort', panelSort)
        if (panelGroup && panelGroup !== '__favorites__') params.set('group', panelGroup)
        if (panelGroup === '__favorites__' && panelSearch.trim().length < 2) {
          params.set('sort', 'trending')
        }
        params.set('limit', '300')
        const response = await fetch(`/api/geil/live/catalog?${params}`, { signal: controller.signal })
        const data = await response.json() as { ok?: boolean; items?: GeilItem[]; features?: GeilFeatures }
        if (!response.ok || data?.ok === false) throw new Error('Kanallar yüklenemedi')
        if (controller.signal.aborted) return
        setPanelFeatures(data.features || {})
        // Use the full server-side result when available; fall back to the supplied
        // channel set if the catalog request fails or returns no items.
        if (Array.isArray(data.items)) setCatalogChannels(data.items)
      } catch {
        // Keep the current list available if the optional refresh fails.
      } finally {
        if (!controller.signal.aborted) setPanelLoading(false)
      }
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [panelOpen, state.isLive, panelSearch, panelSort, panelGroup, favIds])

  useEffect(() => {
    const merged = [...channels, ...catalogChannels].filter((channel, index, all) => all.findIndex((entry) => entry.id === channel.id) === index)
    setPanelChannels(panelGroup === '__favorites__' ? merged.filter((channel) => favIds.has(channel.id)) : channels.length ? channels : catalogChannels)
  }, [channels, catalogChannels, panelGroup, favIds])

  function togglePanelFavorite(id: string) {
    const next = new Set(favIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setFavIds(next)
    try { localStorage.setItem('notflix_geil_live_favorites', JSON.stringify([...next])) } catch { /* storage may be unavailable */ }
    window.dispatchEvent(new CustomEvent('notflix-geil-live-favorites'))
  }

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
    setSubtitleIndex(-1)

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
    const onError = () => {
      const mediaError = video.error
      if (mediaError) setError(`Akış oynatılamadı (${mediaError.code})`)
      else setError('Akış oynatılamadı')
    }
    const onStalled = () => {
      if (!video.paused && video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) setLoading(true)
    }
    const onCanPlay = () => { setLoading(false); setError('') }

    video.addEventListener('playing', onPlaying)
    video.addEventListener('pause', onPause)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('durationchange', onDurationChange)
    video.addEventListener('error', onError)
    video.addEventListener('stalled', onStalled)
    video.addEventListener('canplay', onCanPlay)

    const subtitles = state.subtitles?.length ? state.subtitles : currentVideos.current
      ?.filter((entry) => /subtitle|caption|altyaz/i.test(`${entry.name || ''} ${entry.url}`))
      .map((entry) => ({ url: entry.url, name: entry.name, language: entry.languages?.[0], format: entry.url.split('?')[0].split('.').pop() })) || []
    video.querySelectorAll('track[data-vod-subtitle]').forEach((track) => track.remove())
    subtitles.forEach((subtitle, index) => {
      const track = document.createElement('track')
      track.kind = 'subtitles'
      track.label = subtitle.name || subtitle.language || `Altyazı ${index + 1}`
      const language = (subtitle.language || 'und').toLowerCase()
      track.srclang = language === 'und' ? 'und' : language.split(/[-_]/)[0].slice(0, 2)
      track.src = subtitle.url
      track.setAttribute('data-vod-subtitle', 'true')
      video.appendChild(track)
    })

    let hls: Hls | null = null
    if (state.isLive && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: true })
      hls.loadSource(source)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => { void video.play().catch(() => {}) })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) setError('Akış oynatılamadı')
      })
    } else if (state.isLive && !video.canPlayType('application/vnd.apple.mpegurl')) {
      setError('Tarayıcı HLS oynatmayı desteklemiyor')
    } else if (state.isLive) {
      video.src = source
      video.load()
      const playWhenReady = () => { void video.play().catch(() => {}) }
      video.addEventListener('loadedmetadata', playWhenReady, { once: true })
    } else {
      video.src = source
      video.play().catch(() => {})
    }

    return () => {
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('durationchange', onDurationChange)
      video.removeEventListener('error', onError)
      video.removeEventListener('stalled', onStalled)
      video.removeEventListener('canplay', onCanPlay)
      if (hls) hls.destroy()
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [state.open, state.streamUrl, state.isLive, state.subtitles])

  useEffect(() => {
    const video = videoRef.current
    if (!video || state.isLive) return
    Array.from(video.textTracks).forEach((track, index) => {
      track.mode = index === subtitleIndex ? 'showing' : 'disabled'
    })
  }, [subtitleIndex, state.subtitles, state.isLive, state.streamUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = volume
    video.muted = muted
  }, [volume, muted])

  function revealControls() {
    if (panelOpen && state.isLive) return
    userInteracted.current = true
    setShowControls(true)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setShowControls(false), 2500)
  }

  function openChannelPanel() {
    userInteracted.current = true
    setPanelOpen(true)
    setShowControls(false)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
  }

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

  function seek(event: MouseEvent<HTMLDivElement>) {
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
    <div className={`player-root player-renderer-legacy ${isFullscreen ? 'player-renderer-legacy-fullscreen' : ''}`} ref={containerRef} onMouseMove={revealControls} onTouchStart={revealControls}>
      <div className="player-pager">
        <div className="player-video-wrap">
          <video ref={videoRef} className="player-video" playsInline onClick={togglePlay} />
        </div>
        <div className="player-click-area" onClick={() => { userInteracted.current = true; setShowControls((value) => !value) }} />
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
        <div className={`player-controls show player-live ${showControls && !panelOpen ? '' : 'player-controls-hidden'}`}>
          <div className={`player-bottom player-iptv ${showControls && !panelOpen ? '' : 'player-controls-hidden'}`}>
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
                  <button className={`player-ctrl-btn ${panelOpen ? 'active' : ''}`} aria-label={panelOpen ? 'Kanal listesini kapat' : 'Kanal listesini aç'} aria-pressed={panelOpen} onClick={() => panelOpen ? (setPanelOpen(false), revealControls()) : openChannelPanel()}>
                      <List size={20} />
                  </button>
                  ) : null}
                  <button className="player-ctrl-btn" aria-label="PiP" onClick={togglePip}>
                    <PipIcon size={20} />
                  </button>
                  <button className="player-ctrl-btn" aria-label="Tam ekran" onClick={toggleFullscreen}>
                    {isFullscreen ? <ExitFullscreenIcon size={20} /> : <FullscreenIcon size={20} />}
                  </button>
                  <button className="player-ctrl-btn" aria-label="Kapat" onClick={onClose}><XIcon size={20} /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`player-controls show ${showControls && !panelOpen ? '' : 'player-controls-hidden'}`}>
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
                {!state.isLive && (state.subtitles?.length || 0) > 0 ? (
                  <label className="player-subtitle-select" onClick={(event) => event.stopPropagation()}>
                    <Captions size={19} aria-hidden="true" />
                    <select aria-label="Altyazı seç" value={subtitleIndex} onChange={(event) => setSubtitleIndex(Number(event.target.value))}>
                      <option value={-1}>Altyazı kapalı</option>
                      {state.subtitles?.map((subtitle, index) => (
                        <option key={`${subtitle.url}-${index}`} value={index}>{subtitle.name || subtitle.language || `Altyazı ${index + 1}`}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
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
          className={panelOpen ? 'player-live-brand-hidden' : ''}
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
        <div className="ch-overlay" role="dialog" aria-modal="true" aria-label="Kanallar" onClick={(event) => { if (event.target === event.currentTarget) { setPanelOpen(false); revealControls() } }}>
          <div className="ch-panel">
            <div className="ch-panel-head" data-zone="h">
              <h3>Kanallar</h3>
              <div className="ch-panel-head-actions">
                <button className="modal-close" aria-label="Kanal listesini kapat" onClick={() => { setPanelOpen(false); revealControls() }}>×</button>
              </div>
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
            <div className="search-wrap" style={{ margin: '10px 12px' }}>
              <SearchIcon size={20} />
              <input className="glass-input" placeholder="Kanallarda ara..." value={panelSearch} onChange={(event) => setPanelSearch(event.target.value)} />
            </div>
            <div className="ch-controls" style={{ display: 'flex', gap: 8, padding: '0 12px 10px', flexShrink: 0 }}>
              <select className="sort-select" aria-label="Sıralama" value={panelSort} onChange={(event) => setPanelSort(event.target.value)}>
                {(panelFeatures?.sort || [{ id: 'trending', name: 'Trending' }, { id: 'name', name: 'A-Z' }]).map((option) => (
                  <option key={option.id} value={option.id}>{option.name === 'Trending' ? 'Trending' : option.name}</option>
                ))}
              </select>
              <select className="sort-select" aria-label="Ülke" value={panelGroup} onChange={(event) => setPanelGroup(event.target.value)}>
                <option value="">Country: tümü</option>
                {(panelFeatures?.filter?.find((feature) => feature.id === 'group')?.values || []).map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
              <button className={`ep-pill panel-favorites-filter ${panelGroup === '__favorites__' ? 'active' : ''}`} aria-pressed={panelGroup === '__favorites__'} onClick={() => setPanelGroup((value) => value === '__favorites__' ? '' : '__favorites__')}>
                Favoriler {favIds.size > 0 ? <span className="ep-pill-count">{favIds.size}</span> : null}
              </button>
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
                      <button className={`ch-fav ${favIds.has(channel.id) ? 'on' : ''}`} aria-label="Favori" aria-pressed={favIds.has(channel.id)} onClick={(event) => { event.stopPropagation(); togglePanelFavorite(channel.id) }}>
                        <HeartIcon size={20} />
                      </button>
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
      {state.isLive && onChannelSelect && showControls && !panelOpen ? (
        <button
          className={`player-panel-toggle ${panelOpen ? 'is-open' : ''}`}
          type="button"
          aria-label={panelOpen ? 'Kanal listesini kapat' : 'Kanal listesini aç'}
          aria-pressed={panelOpen}
          onClick={() => panelOpen ? (setPanelOpen(false), revealControls()) : openChannelPanel()}
        >
          <List size={21} />
        </button>
      ) : null}
    </div>
  )
}
