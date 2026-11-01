import { useEffect, useRef, useState } from 'react'
import type { GeilFeatures, GeilSubtitle } from './types'
import type { MouseEvent, TouchEvent as ReactTouchEvent } from 'react'
import Hls from 'hls.js'
import { Captions, List, Layers, Check } from 'lucide-react'
import type { PlayerState, GeilItem, PlayerSource } from './types'
import { XIcon, ChevronLeft, ChevronRight, VolumeIcon, MuteIcon, FullscreenIcon, ExitFullscreenIcon, PipIcon, PlayIcon, HeartIcon, SearchIcon, ArrowLeftIcon } from './icons'
import { channelColor, channelQuality, channelStation, currentEpg, formatClock, initialOf, normalizeLiveChannels, remainingLabel } from './api'
import { saveContinueWatching } from './storage'
import { subtitleLanguageCode, subtitleLanguageLabel } from './subtitle-language'
import { activateFocused, focusFirst, moveFocus, readTvMode, stepSelect } from './tv'
import { useLang } from '@/lib/language'
import ShortcutsHelp from './ShortcutsHelp'

// Keep the live-panel improvements compatible with the pre-Video.js player.

interface Props {
  state: PlayerState
  onClose: () => void
  onPrev?: (() => void) | null
  onNext?: (() => void) | null
  channels?: GeilItem[]
  onChannelSelect?: ((channel: GeilItem, visible?: GeilItem[]) => void) | null
  onSourceSelect?: ((source: PlayerSource) => void) | null
  /** Reports a stream that refuses to play so the parent can move on to the next server. */
  onStreamFailure?: (() => void) | null
}

const RATES = [0.5, 1, 1.25, 1.5, 2]

/** Subtitles come either from the resolved playback or from the item's video list. */
function collectSubtitles(state: PlayerState, videos: GeilItem['videos']): GeilSubtitle[] {
  if (state.subtitles?.length) return state.subtitles
  return (videos || [])
    .filter((entry) => {
      const url = String(entry.url || '')
      const name = String(entry.name || '')
      if (/youtube|youtu\.be/i.test(url) || /fragman|trailer/i.test(name)) return false
      return /\.(srt|vtt)(\?|$)/i.test(url) || /subtitle|caption|altyaz/i.test(`${name} ${url}`)
    })
    .map((entry) => ({
      url: entry.url,
      name: entry.name,
      language: entry.languages?.[0],
      format: entry.url.split('?')[0].split('.').pop(),
    }))
}

// Media URLs arrive already wrapped in the signed /api/geil/stream proxy, so the
// playlist extension has to be read out of the token payload, not the URL suffix.
function isHlsSource(url: string): boolean {
  const raw = (url || '').split('#')[0]
  if (/\.m3u8?([/?]|$)/i.test(raw)) return true
  try {
    const token = new URL(raw, window.location.origin).searchParams.get('t')
    const payload = token ? token.split('.')[0] : ''
    if (!payload) return false
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return /\.m3u8?([/?]|$)/i.test(String(decoded && decoded.u || ''))
  } catch {
    return false
  }
}

function matchesPanelSearch(channel: GeilItem, needle: string): boolean {
  const query = needle.trim().toLocaleLowerCase('tr')
  if (!query) return true
  const name = channel.name.toLocaleLowerCase('tr')
  return name.includes(query) || channelStation(channel.name).toLocaleLowerCase('tr').includes(query)
}

export default function Player({ state, onClose, onPrev, onNext, channels = [], onChannelSelect, onSourceSelect, onStreamFailure }: Props) {
  const { t, lang } = useLang()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
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
  const [subtitleMenuOpen, setSubtitleMenuOpen] = useState(false)
  const [rate, setRate] = useState(1)
  const [panelOpen, setPanelOpen] = useState(false)
  const [sourceChooserOpen, setSourceChooserOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [osd, setOsd] = useState<string | null>(null)
  const [zap, setZap] = useState<{ name: string; color: string } | null>(null)
  const [panelSearch, setPanelSearch] = useState('')
  // The panel defaults to the same order the channels page shows, so zapping never reorders the
  // list the viewer is already looking at.
  const [panelSort, setPanelSort] = useState('')
  // Zapping opens the panel on the viewer's own country, the same default the channels page uses,
  // so the remote never walks a global list that starts with foreign stations.
  const [panelGroup, setPanelGroup] = useState('Turkey')
  const [panelFeatures, setPanelFeatures] = useState<GeilFeatures | null>(null)
  const [panelLoading, setPanelLoading] = useState(false)
  const [panelChannels, setPanelChannels] = useState<GeilItem[]>(channels)
  const [catalogChannels, setCatalogChannels] = useState<GeilItem[]>(channels)
  const swipeRef = useRef<{ x: number; y: number } | null>(null)
  const swipeHandledRef = useRef(false)
  const [favIds, setFavIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('notflix_geil_live_favorites') || '[]')) } catch { return new Set() }
  })
  const hideTimer = useRef<number | null>(null)
  const osdTimer = useRef<number | null>(null)
  const saveTimer = useRef<number>(0)
  const startApplied = useRef(0)
  const failureReported = useRef('')
  const userInteracted = useRef(false)
  const actionsRef = useRef<(event: KeyboardEvent | { key: string; remote?: boolean }) => void>(() => {})
  const playerStateRef = useRef(state)
  playerStateRef.current = state
  const subtitles = collectSubtitles(state, state.item?.videos)
  const subtitlesRef = useRef<GeilSubtitle[]>(subtitles)
  subtitlesRef.current = subtitles

  useEffect(() => {
    if (!state.open || !state.isLive) return
    if (panelOpen) {
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      hideTimer.current = null
      return
    }
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      const active = document.activeElement
      if (active && containerRef.current?.contains(active) && active !== containerRef.current && active.tagName !== 'VIDEO') return
      setShowControls(false)
    }, 2000)
    return () => { if (hideTimer.current) window.clearTimeout(hideTimer.current) }
  }, [panelOpen, state.isLive, state.open, state.streamUrl])

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
        params.set('limit', '300')
        const response = await fetch(`/api/geil/live/catalog?${params}`, { signal: controller.signal })
        const data = await response.json() as { ok?: boolean; items?: GeilItem[]; features?: GeilFeatures }
        if (!response.ok || data?.ok === false) throw new Error('Kanallar yüklenemedi')
        if (controller.signal.aborted) return
        setPanelFeatures(data.features || {})
        // The catalogue decides which country groups exist, so an unsupported default falls back to all.
        const groupOptions = (data.features?.filter || []).find((feature) => feature.id === 'group')?.values || []
        if (panelGroup !== '__favorites__' && groupOptions.length && !groupOptions.some((option) => option.id === panelGroup)) setPanelGroup('')
        // Use the full server-side result when available; fall back to the supplied
        // channel set if the catalog request fails or returns no items.
        if (Array.isArray(data.items)) {
          const countryItems = panelGroup && panelGroup !== '__favorites__'
            ? data.items.filter((channel) => (channel.tags || []).some((tag) => tag.toLowerCase() === panelGroup.toLowerCase()))
            : data.items
          setCatalogChannels(normalizeLiveChannels(countryItems, panelSort))
        }
      } catch {
        // Keep the current list available if the optional refresh fails.
      } finally {
        if (!controller.signal.aborted) setPanelLoading(false)
      }
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [panelOpen, state.isLive, panelSearch, panelSort, panelGroup, favIds])

  useEffect(() => {
    const all = [...channels, ...catalogChannels]
    const merged = normalizeLiveChannels(all, panelSort)
    // A favourite was stored against one quality variant, so a station matches when any of its
    // variants is on the list.
    const variantsOf = new Map<string, string[]>()
    for (const channel of all) {
      const key = channelStation(channel.name).toLocaleLowerCase('tr')
      const ids = variantsOf.get(key) || []
      ids.push(channel.id)
      variantsOf.set(key, ids)
    }
    const isFavourite = (channel: GeilItem) => favIds.has(channel.id)
      || (variantsOf.get(channelStation(channel.name).toLocaleLowerCase('tr')) || []).some((id) => favIds.has(id))
    setPanelChannels(panelGroup === '__favorites__' ? merged.filter(isFavourite) : panelGroup ? (catalogChannels.length ? catalogChannels : merged.filter((channel) => (channel.tags || []).some((tag) => tag.toLowerCase() === panelGroup.toLowerCase()))) : merged)
  }, [channels, catalogChannels, panelGroup, panelSort, favIds])

  useEffect(() => {
    if (!state.open) return
    document.documentElement.classList.add('player-open', 'player-osd')
    // Take the focus for the player itself: a TV remote has no cursor, and without this its first
    // arrow press would walk the catalogue page behind the picture.
    containerRef.current?.focus({ preventScroll: true })
    return () => {
      document.documentElement.classList.remove('player-open', 'player-osd')
    }
  }, [state.open])

  useEffect(() => {
    if (!sourceChooserOpen) return
    const timer = window.setTimeout(() => focusFirst({ root: document.querySelector<HTMLElement>('.source-panel .source-panel-list') }), 80)
    return () => window.clearTimeout(timer)
  }, [sourceChooserOpen])

  function togglePanelFavorite(id: string) {
    const next = new Set(favIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setFavIds(next)
    try { localStorage.setItem('notflix_geil_live_favorites', JSON.stringify([...next])) } catch { /* storage may be unavailable */ }
    window.dispatchEvent(new CustomEvent('notflix-geil-live-favorites'))
  }

  useEffect(() => {
    if (!zap) return
    if (state.pending || !state.streamUrl) return
    const timer = window.setTimeout(() => setZap(null), 1800)
    return () => window.clearTimeout(timer)
  }, [zap, state.pending, state.streamUrl])

  // A video that will not open is a source problem, not something to shout about over the
  // picture: the spinner stays up and the parent moves to the next server.
  function reportStreamFailure(url: string) {
    if (failureReported.current === url) return
    failureReported.current = url
    setLoading(true)
    setError('')
    onStreamFailure?.()
  }

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
    startApplied.current = 0

    const source = state.streamUrl
    // The stream is still being resolved; keep the spinner instead of the media error.
    if (!source) return

    const onPlaying = () => { setLoading(false); setPlaying(true) }
    const onPause = () => { setPlaying(false); saveProgress() }
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime || 0)
      if (video.buffered.length) {
        setBuffered((video.buffered.end(video.buffered.length - 1) / Math.max(1, video.duration || 1)) * 100)
      }
      const now = Date.now()
      if (now - saveTimer.current > 5000) {
        saveTimer.current = now
        saveProgress()
      }
    }
    const onDurationChange = () => setDuration(video.duration || 0)
    const onLoadedMetadata = () => {
      if (state.isLive) return
      const startAt = Number(state.startAt || 0)
      if (startAt > 5 && startApplied.current === 0) {
        startApplied.current = startAt
        const target = Math.min(startAt, Math.max(6, (video.duration || startAt + 10) - 8))
        try { video.currentTime = target } catch { /* seeking may fail before metadata */ }
      }
    }
    const onError = () => {
      if (state.isLive) { setError('Akış oynatılamadı'); return }
      reportStreamFailure(source)
    }
    const onStalled = () => {
      if (!video.paused && video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) setLoading(true)
    }
    const onCanPlay = () => { setLoading(false); setError('') }
    const onEnded = () => {
      setPlaying(false)
      saveProgress(true)
    }

    video.addEventListener('playing', onPlaying)
    video.addEventListener('pause', onPause)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('durationchange', onDurationChange)
    video.addEventListener('loadedmetadata', onLoadedMetadata)
    video.addEventListener('error', onError)
    video.addEventListener('stalled', onStalled)
    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('ended', onEnded)

    const trackLabels = subtitles.map((subtitle, index) => subtitleLanguageLabel(
      [subtitle.language, subtitle.name],
      lang,
      `${t('player.subtitleGeneric')} ${index + 1}`,
    ))
    video.querySelectorAll('track[data-vod-subtitle]').forEach((track) => track.remove())
    subtitles.forEach((subtitle, index) => {
      const track = document.createElement('track')
      track.kind = 'subtitles'
      track.label = trackLabels[index]
      const language = (subtitle.language || 'und').toLowerCase()
      track.srclang = language === 'und' ? 'und' : language.split(/[-_]/)[0].slice(0, 2)
      track.src = subtitle.url
      track.setAttribute('data-vod-subtitle', 'true')
      video.appendChild(track)
    })
    if (!state.isLive && subtitles.length) {
      const turkish = subtitles.findIndex((subtitle) => subtitleLanguageCode(subtitle.language, subtitle.name) === 'tr')
      if (turkish >= 0) setSubtitleIndex(turkish)
    }

    let hls: Hls | null = null
    hlsRef.current = null
    const usesHls = isHlsSource(source)
    if (usesHls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: state.isLive,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: state.isLive ? 1 : 0,
        manifestLoadingRetryDelay: 500,
        levelLoadingMaxRetry: 2,
        fragLoadingMaxRetry: 3,
      })
      hlsRef.current = hls
      hls.loadSource(source)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!state.isLive) video.playbackRate = rate
        void video.play().catch(() => {})
      })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return
        if (state.isLive) { setError('Akış oynatılamadı'); return }
        reportStreamFailure(source)
      })
    } else if (usesHls && !video.canPlayType('application/vnd.apple.mpegurl')) {
      setError('Tarayıcı HLS oynatmayı desteklemiyor')
    } else {
      video.src = source
      if (!state.isLive) video.playbackRate = rate
      if (usesHls) {
        const playWhenReady = () => { void video.play().catch(() => {}) }
        video.addEventListener('loadedmetadata', playWhenReady, { once: true })
      }
      video.play().catch(() => {})
    }

    return () => {
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('durationchange', onDurationChange)
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
      video.removeEventListener('error', onError)
      video.removeEventListener('stalled', onStalled)
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('ended', onEnded)
      saveProgress()
      if (hls) hls.destroy()
      hlsRef.current = null
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!state.isLive) video.playbackRate = rate
  }, [volume, muted, rate, state.isLive])

  function flashOsd(text: string) {
    setOsd(text)
    if (osdTimer.current) window.clearTimeout(osdTimer.current)
    osdTimer.current = window.setTimeout(() => setOsd(null), 1600)
  }

  function saveProgress(force = false) {
    const video = videoRef.current
    const current = playerStateRef.current
    const meta = current.watchMeta
    if (!video || !meta || current.isLive) return
    const total = video.duration || 0
    if (!Number.isFinite(total) || total <= 0) return
    const position = force ? total : video.currentTime
    saveContinueWatching({
      key: meta.key,
      id: meta.id,
      type: meta.type,
      name: meta.name,
      poster: meta.poster,
      addonId: meta.addonId,
      season: meta.season,
      episode: meta.episode,
      episodeName: meta.episodeName,
      position,
      duration: total,
      progress: total > 0 ? position / total : 0,
      item: meta.item,
      episodeItem: meta.episodeItem || null,
    })
  }

  function revealControls() {
    if (panelOpen && state.isLive) return
    userInteracted.current = true
    setShowControls(true)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      // A D-pad holds a control by focusing it. Hiding the bar under the viewer's focus would
      // make the remote look dead, so the timeout waits for the focus to leave instead.
      const active = document.activeElement
      if (active && containerRef.current?.contains(active) && active !== containerRef.current && active.tagName !== 'VIDEO') return
      setShowControls(false)
    }, 2000)
  }

  function openChannelPanel() {
    userInteracted.current = true
    setPanelOpen(true)
    setShowControls(false)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    // The panel is the surface now, so the D-pad lands on its first row instead of staying on the
    // bar that just closed or on the panel's own close button.
    window.setTimeout(() => focusFirst({ root: document.querySelector<HTMLElement>('.ch-panel .ch-list') }), 80)
  }

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play().catch(() => {})
    else video.pause()
    revealControls()
  }

  function seekBy(seconds: number) {
    const video = videoRef.current
    if (!video || state.isLive || !Number.isFinite(video.duration)) return
    video.currentTime = Math.min(Math.max(0, video.currentTime + seconds), Math.max(0, video.duration - 0.5))
    flashOsd(`${seconds > 0 ? '+' : ''}${seconds} sn`)
    revealControls()
  }

  function jumpToPercent(percent: number) {
    const video = videoRef.current
    if (!video || state.isLive || !Number.isFinite(video.duration)) return
    video.currentTime = video.duration * percent
    flashOsd(`%${Math.round(percent * 100)}`)
    revealControls()
  }

  function changeVolume(delta: number) {
    const next = Math.min(1, Math.max(0, Math.round((volume + delta) * 100) / 100))
    setVolume(next)
    setMuted(next === 0)
    flashOsd(`${Math.round(next * 100)}%`)
    revealControls()
  }

  function toggleMute() {
    setMuted((value) => !value)
    flashOsd(muted ? t('player.unmute') : t('player.mute'))
    revealControls()
  }

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

  useEffect(() => {
    const update = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])

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

  function subtitleLabel(subtitle: GeilSubtitle | undefined, index: number): string {
    if (!subtitle) return t('player.subtitles')
    return subtitleLanguageLabel([subtitle.language, subtitle.name], lang, `${t('player.subtitleGeneric')} ${index + 1}`)
  }

  function cycleSubtitle() {
    const list = subtitlesRef.current || []
    if (!list.length) { flashOsd(t('player.subtitlesNone')); return }
    const next = subtitleIndex >= list.length - 1 ? -1 : subtitleIndex + 1
    setSubtitleIndex(next)
    flashOsd(next < 0 ? t('common.off') : subtitleLabel(list[next], next))
  }

  function cycleRate() {
    const index = RATES.indexOf(rate)
    const next = RATES[(index + 1) % RATES.length]
    setRate(next)
    flashOsd(`${t('player.speed')}: ${next}×`)
  }

  function cycleQuality() {
    const hls = hlsRef.current
    if (hls && hls.levels.length > 1) {
      const next = (hls.currentLevel + 2) % (hls.levels.length + 1) - 1
      hls.currentLevel = next
      flashOsd(`${t('shortcuts.quality')}: ${next < 0 ? 'Auto' : `${hls.levels[next].height}p`}`)
      return
    }
    flashOsd(t('player.qualityUnavailable'))
  }

  function zapChannel(direction: -1 | 1) {
    if (!state.isLive) return
    // Zap through exactly the list the channel panel is showing, so a country selection
    // and its sort order carry over to the arrow keys instead of jumping back to all.
    const visiblePanel = panelChannels.filter((channel) => matchesPanelSearch(channel, panelSearch))
    const list = visiblePanel.length ? visiblePanel : (state.channels?.length ? state.channels : channels)
    if (!list.length || !onChannelSelect) return
    const index = list.findIndex((entry) => entry.id === state.item?.id)
    const nextChannel = list[(index + direction + list.length) % list.length]
    if (!nextChannel) return
    const station = channelStation(nextChannel.name)
    setZap({ name: station, color: channelColor(station) })
    onChannelSelect(nextChannel, visiblePanel.length ? visiblePanel : undefined)
    revealControls()
  }

  function beginSwipe(event: ReactTouchEvent<HTMLDivElement>) {
    const touch = event.touches[0]
    swipeHandledRef.current = false
    swipeRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null
  }

  function endSwipe(event: ReactTouchEvent<HTMLDivElement>) {
    const start = swipeRef.current
    swipeRef.current = null
    if (!start || !state.isLive || !onChannelSelect) return
    const touch = event.changedTouches[0]
    if (!touch) return
    const dy = touch.clientY - start.y
    const dx = touch.clientX - start.x
    // Only a deliberately vertical drag zaps; horizontal ones stay the browser's.
    if (Math.abs(dy) < 60 || Math.abs(dy) < Math.abs(dx)) return
    swipeHandledRef.current = true
    zapChannel(dy < 0 ? 1 : -1)
  }

  function copyLink() {
    const url = window.location.href
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(url).catch(() => {})
    }
    flashOsd(t('player.linkCopied'))
  }

  function ejectToEpisodes() {
    const meta = state.watchMeta
    if (!meta) { flashOsd(t('shortcuts.episodes')); return }
    window.dispatchEvent(new CustomEvent('notflix-open-episodes', { detail: { item: meta.item } }))
  }

  actionsRef.current = (event) => {
    if (!state.open) return
    const key = event.key
    const target = (event as KeyboardEvent).target as HTMLElement | null
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      // A TV remote has no typing to protect, so its arrows and OK leave the search box and the
      // dropdowns to walk the panel instead of editing it.
      if (key === 'Escape' || target.tagName !== 'INPUT') return
    }
    const handled = () => { if ('preventDefault' in event) { event.preventDefault(); event.stopPropagation() } }
    // A WebView's Back is often only ever a key code, so the exit ladder answers it too.
    if (key === 'Escape' || key === 'GoBack' || (event as KeyboardEvent).keyCode === 10009) {
      handled()
      if (showHelp) { setShowHelp(false); return }
      if (subtitleMenuOpen) { setSubtitleMenuOpen(false); return }
      if (sourceChooserOpen) { setSourceChooserOpen(false); return }
      if (panelOpen) { setPanelOpen(false); revealControls(); return }
      onClose()
      return
    }
    if (showHelp) return
    // On a TV the D-pad is the pointer everywhere else in the app, so the player honours the same
    // contract: arrows walk the controls, OK activates. Transport keeps its letters, the AIR
    // remote's dedicated buttons and, for live, the channel row keys (166/165 → chup/chdown).
    const dpadArrows = readTvMode() && (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight')
    if (dpadArrows) {
      handled()
      const direction = key === 'ArrowUp' ? 'up' : key === 'ArrowDown' ? 'down' : key === 'ArrowLeft' ? 'left' : 'right'
      if ((direction === 'left' || direction === 'right') && stepSelect(direction)) return
      if (panelOpen || sourceChooserOpen || subtitleMenuOpen || showControls) { moveFocus(direction); return }
      revealControls()
      if (target !== videoRef.current && document.activeElement !== videoRef.current) moveFocus(direction)
      return
    }
    if (key === 'Enter' || key === 'NumpadEnter') {
      const active = document.activeElement
      const bare = !active || active === document.body || active === containerRef.current || active === videoRef.current
      handled()
      if (bare) togglePlay()
      else if (!activateFocused()) togglePlay()
      return
    }
    if (key === ' ' || key === 'k' || key === 'K' || key === 'MediaPlayPause') {
      handled(); togglePlay(); return
    }
    if (key === 'j' || key === 'J') { handled(); seekBy(-10); return }
    if (key === 'l' || key === 'L') { handled(); if (state.isLive) { panelOpen ? setPanelOpen(false) : openChannelPanel() } else seekBy(10); return }
    if (key === 'ArrowLeft') { handled(); seekBy(-10); return }
    if (key === 'ArrowRight') { handled(); seekBy(10); return }
    if (key === 'ArrowUp') { handled(); if (state.isLive) zapChannel(1); else changeVolume(0.1); return }
    if (key === 'ArrowDown') { handled(); if (state.isLive) zapChannel(-1); else changeVolume(-0.1); return }
    if (key === 'm' || key === 'M') { handled(); toggleMute(); return }
    if (key === 'f' || key === 'F') { handled(); void toggleFullscreen(); return }
    if (key === 'p' || key === 'P') { handled(); void togglePip(); return }
    if (key === 'c' || key === 'C') { handled(); cycleSubtitle(); return }
    if (key === 's' || key === 'S') { handled(); if (!state.isLive && (state.sources?.length || 0) > 0) setSourceChooserOpen((value) => !value); return }
    if (key === 'r' || key === 'R') { handled(); cycleRate(); return }
    if (key === 'q' || key === 'Q') { handled(); cycleQuality(); return }
    if (key === 'a' || key === 'A') { handled(); flashOsd(t('shortcuts.audio')); return }
    if (key === 'e' || key === 'E') { handled(); ejectToEpisodes(); return }
    if (key === 'i' || key === 'I') { handled(); copyLink(); return }
    if (key === 't' || key === 'T') {
      handled()
      window.open(`${window.location.origin}${window.location.pathname}`, '_blank', 'noopener')
      flashOsd(t('shortcuts.secondScreen'))
      return
    }
    if (key === 'x' || key === 'X') { handled(); flashOsd(t('player.chatUnavailable')); return }
    if (key === '?' || key === 'h' || key === 'H') { handled(); setShowHelp(true); return }
    if (/^[0-9]$/.test(key)) { handled(); jumpToPercent(Number(key) / 10); return }
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => actionsRef.current(event)
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      const command = (event as CustomEvent<{ command?: string }>).detail?.command
      if (!state.open || !command) return
      // The D-pad is the pointer, not the transport: it walks the controls the way it walks the
      // catalogue, so subtitles, source picker and exit are reachable from the phone. Seeking has
      // its own keys for the same reason a real remote has its own transport row.
      if (command === 'up' || command === 'down' || command === 'left' || command === 'right') {
        revealControls()
        moveFocus(command)
        return
      }
      if (command === 'ok') { if (!activateFocused()) togglePlay(); return }
      if (command === 'home') { onClose(); return }
      if (command === 'back') {
        // Claim the key so the Android shell does not also step out of the page behind the player.
        event.preventDefault()
        if (sourceChooserOpen) setSourceChooserOpen(false)
        else if (subtitleMenuOpen) setSubtitleMenuOpen(false)
        else if (panelOpen) { setPanelOpen(false); revealControls() }
        else onClose()
        return
      }
      if (command === 'playpause') { togglePlay(); return }
      if (command === 'mute') { toggleMute(); return }
      if (command === 'volup') { changeVolume(0.1); return }
      if (command === 'voldown') { changeVolume(-0.1); return }
      if (command === 'chup') { zapChannel(1); return }
      if (command === 'chdown') { zapChannel(-1); return }
      if (command === 'subtitle') { revealControls(); cycleSubtitle(); return }
      if (command === 'source') {
        revealControls()
        if (state.isLive && onChannelSelect) openChannelPanel()
        else if (!state.isLive && (state.sources?.length || 0) > 0) setSourceChooserOpen(true)
        return
      }
      if (command === 'rewind' && !state.isLive) { revealControls(); seekBy(-10); return }
      if (command === 'forward' && !state.isLive) { revealControls(); seekBy(10); return }
    }
    window.addEventListener('notflix-remote', handler)
    return () => window.removeEventListener('notflix-remote', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open, state.isLive, panelOpen, sourceChooserOpen, subtitleMenuOpen, volume, muted, rate, subtitleIndex])

  if (!state.open) return null

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
    const total = Math.floor(value)
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = total % 60
    return hours > 0
      ? `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
      : `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
  }
  const playbackError = state.playbackError || error
  const playerSources = state.sources || []
  const activeSourceIndex = state.sourceIndex ?? -1

  function pickSource(source: PlayerSource) {
    setSourceChooserOpen(false)
    setShowControls(true)
    onSourceSelect?.(source)
  }

  return (
    <div className={`player-root player-renderer-legacy ${isFullscreen ? 'player-renderer-legacy-fullscreen' : ''}`} ref={containerRef} onMouseMove={revealControls} onTouchStart={revealControls} tabIndex={-1} data-focus-scope>
      <div className="player-pager">
        <div className="player-video-wrap">
          <video ref={videoRef} className="player-video" playsInline onClick={togglePlay} />
        </div>
        <div
          className="player-click-area"
          onTouchStart={beginSwipe}
          onTouchEnd={endSwipe}
          onClick={() => {
            if (swipeHandledRef.current) { swipeHandledRef.current = false; return }
            userInteracted.current = true
            setShowControls((value) => !value)
          }}
        />
        {loading && !playbackError ? (
          <div className="player-loading">
            <div className="player-pulse" />
          </div>
        ) : null}
        {playbackError && state.isLive ? (
          <div className="player-error player-error-offline">
            <p>{t('channels.offline')}</p>
          </div>
        ) : playbackError ? (
          <div className="player-error player-error-danger">
            <p>{playbackError}</p>
            <div className="player-error-actions">
              {playerSources.length ? (
                <button type="button" className="player-error-action" onClick={() => setSourceChooserOpen(true)}>
                  <Layers size={18} /> {t('sources.change')}
                </button>
              ) : null}
              <button type="button" className="player-error-action" onClick={onClose}>
                <ArrowLeftIcon size={18} /> {t('player.exit')}
              </button>
            </div>
          </div>
        ) : null}

        {state.isLive && zap ? (
          <div className="live-zap-overlay" aria-live="polite">
            <div className="live-zap-logo" style={{ background: zap.color }}>{initialOf(zap.name)}</div>
            <div className="live-zap-text">
              <div className="live-zap-name">{zap.name}</div>
              <div className="live-zap-status">{state.pending || !state.streamUrl ? t('common.loading') : t('channels.live')}</div>
            </div>
          </div>
        ) : null}

        {osd ? (
          <div className="geil-osd" aria-live="polite">
            <VolumeIcon size={18} /> <span>{osd}</span>
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
                      <span className="ch-chip ch-chip-num">{t('channels.live')}</span>
                    </div>
                    <div className="iptv-bar-name">{state.title}</div>
                  </div>
                </div>
                <div className="iptv-bar-controls">
                  {onChannelSelect ? (
                    <>
                      <button className="player-ctrl-btn" aria-label={t('player.channelDown')} onClick={() => zapChannel(-1)}>
                        <ChevronLeft size={20} />
                      </button>
                      <button className="player-ctrl-btn" aria-label={t('player.channelUp')} onClick={() => zapChannel(1)}>
                        <ChevronRight size={20} />
                      </button>
                    </>
                  ) : null}
                  <div className="player-vol-wrap">
                    <button className="player-ctrl-btn" aria-label={t('player.volume')} onClick={toggleMute}>
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
                  {onChannelSelect ? (
                  <button className={`player-ctrl-btn ${panelOpen ? 'active' : ''}`} aria-label={panelOpen ? 'Kanal listesini kapat' : 'Kanal listesini aç'} aria-pressed={panelOpen} onClick={() => panelOpen ? (setPanelOpen(false), revealControls()) : openChannelPanel()}>
                      <List size={20} />
                  </button>
                  ) : null}
                  <button className="player-ctrl-btn" aria-label="PiP" onClick={togglePip}>
                    <PipIcon size={20} />
                  </button>
                  <button className="player-ctrl-btn" aria-label={t('player.fullscreen')} onClick={toggleFullscreen}>
                    {isFullscreen ? <ExitFullscreenIcon size={20} /> : <FullscreenIcon size={20} />}
                  </button>
                  <button className="player-ctrl-btn" aria-label={t('common.close')} onClick={onClose}><XIcon size={20} /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`player-controls show ${showControls && !panelOpen ? '' : 'player-controls-hidden'}`}>
          <div className="player-top">
            <button className="player-exit-btn" onClick={() => { saveProgress(); onClose() }}>
              <ArrowLeftIcon size={18} /> <span>{t('player.exit')}</span>
            </button>
            <div className="player-title">{state.title}</div>
            <button className="player-help-btn" onClick={() => setShowHelp(true)} aria-label={t('player.help')}>?</button>
          </div>
          <div className="player-bottom">
            <div className="player-seek" onClick={seek}>
              <div className="player-seek-buf" style={{ width: `${buffered}%` }} />
              <div className="player-seek-fill" style={{ width: `${progress}%` }}>
                <div className="player-seek-handle" />
              </div>
            </div>
            <div className="player-vod-controls">
              <div className="player-vod-left">
                <button className="player-ctrl-btn" aria-label={t('player.play')} onClick={togglePlay}>
                  {playing ? '❚❚' : <PlayIcon size={20} />}
                </button>
                <button className="player-skip-btn" aria-label="10 sn geri" onClick={() => seekBy(-10)}>−10</button>
                <button className="player-skip-btn" aria-label="10 sn ileri" onClick={() => seekBy(10)}>+10</button>
                <span className="player-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
              </div>
              <div className="player-vod-right">
                <button className="player-rate-btn" onClick={cycleRate} aria-label={t('player.speed')}>{rate}×</button>
                <div className="player-vol-wrap">
                  <button className="player-ctrl-btn" aria-label={t('player.mute')} onClick={toggleMute}>
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
                <div className="player-sub-wrap">
                  <button
                    className={`player-ctrl-btn ${subtitleMenuOpen || subtitleIndex >= 0 ? 'active' : ''}`}
                    aria-label={t('player.subtitles')}
                    aria-pressed={subtitleMenuOpen}
                    onClick={() => { userInteracted.current = true; setSubtitleMenuOpen((value) => !value) }}
                  >
                    <Captions size={20} />
                  </button>
                  {subtitleMenuOpen ? (
                    <div className="subtitle-menu" role="dialog" aria-label={t('player.subtitles')} data-focus-scope onClick={(event) => event.stopPropagation()}>
                      <div className="subtitle-menu-head">{t('player.subtitles')}</div>
                      <div className="subtitle-switch" role="radiogroup" aria-label={t('player.subtitles')}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={subtitleIndex < 0}
                          className={`subtitle-switch-btn ${subtitleIndex < 0 ? 'is-active' : ''}`}
                          onClick={() => setSubtitleIndex(-1)}
                        >
                          {t('common.off')}
                        </button>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={subtitleIndex >= 0}
                          disabled={!subtitles.length}
                          className={`subtitle-switch-btn ${subtitleIndex >= 0 ? 'is-active' : ''}`}
                          onClick={() => {
                            const turkish = subtitles.findIndex((subtitle) => subtitleLanguageCode(subtitle.language, subtitle.name) === 'tr')
                            setSubtitleIndex(turkish >= 0 ? turkish : 0)
                          }}
                        >
                          {t('common.on')}
                        </button>
                      </div>
                      {subtitles.length === 0 ? (
                        <div className="subtitle-empty">{t('player.subtitlesNone')}</div>
                      ) : subtitleIndex >= 0 ? (
                        <div className="subtitle-list">
                          {subtitles.map((subtitle, index) => (
                            <button
                              key={`${subtitle.url}-${index}`}
                              type="button"
                              className={`subtitle-row ${index === subtitleIndex ? 'is-active' : ''}`}
                              onClick={() => setSubtitleIndex(index)}
                            >
                              <span className="subtitle-row-name">{subtitleLabel(subtitle, index)}</span>
                              {index === subtitleIndex ? <Check size={16} aria-hidden="true" /> : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {!state.isLive && playerSources.length > 0 ? (
                  <button
                    className={`player-ctrl-btn ${sourceChooserOpen ? 'active' : ''}`}
                    aria-label={t('player.sources')}
                    aria-pressed={sourceChooserOpen}
                    onClick={() => { userInteracted.current = true; setSourceChooserOpen((value) => !value) }}
                  >
                    <Layers size={20} />
                    <span className="player-ctrl-label">{playerSources[activeSourceIndex]?.name || t('player.sources')}</span>
                  </button>
                ) : null}
                <button className="player-ctrl-btn" aria-label="PiP" onClick={togglePip}>
                  <PipIcon size={20} />
                </button>
                <button className="player-ctrl-btn" aria-label={t('player.fullscreen')} onClick={toggleFullscreen}>
                  {isFullscreen ? <ExitFullscreenIcon size={20} /> : <FullscreenIcon size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!state.isLive && sourceChooserOpen ? (
        <div className="ch-overlay source-overlay" role="dialog" aria-modal="true" aria-label={t('sources.title')} onClick={(event) => { if (event.target === event.currentTarget) setSourceChooserOpen(false) }}>
          <div className="ch-panel source-panel" data-focus-scope>
            <div className="ch-panel-head">
              <h3>{t('sources.title')}</h3>
              <div className="ch-panel-head-actions">
                <button className="modal-close" aria-label={t('common.close')} onClick={() => setSourceChooserOpen(false)}>×</button>
              </div>
            </div>
            <div className="ch-list source-panel-list">
              {playerSources.map((source, index) => (
                <button
                  key={`${source.url}-${index}`}
                  type="button"
                  className={`source-row ${index === activeSourceIndex ? 'is-active' : ''}`}
                  onClick={() => pickSource(source)}
                >
                  <span className="source-row-icon">{(source.name || '?').slice(0, 2).toUpperCase()}</span>
                  <span className="source-row-text">
                    <span className="source-row-name">{source.name}</span>
                    <span className="source-row-meta">{source.quality || `${t('sources.server')} ${index + 1}`}</span>
                  </span>
                  {index === activeSourceIndex ? <span className="source-row-badge">{t('sources.playing')}</span> : <PlayIcon size={18} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {state.isLive ? (
        <div
          className={`${panelOpen || !showControls ? 'player-live-brand-hidden' : ''} player-live-brand`}
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
            opacity: showControls && !panelOpen ? 1 : 0,
            transition: 'opacity 0.3s ease',
            pointerEvents: 'none',
          }}
        >
          NOTFLİX
        </div>
      ) : null}

      {state.isLive ? (
        <button type="button" className={`player-center-toggle ${showControls ? 'is-visible' : ''}`} onClick={(event) => { event.stopPropagation(); togglePlay(); revealControls() }} aria-label={playing ? t('player.pause') : t('player.play')}>
          {playing ? '❚❚' : <PlayIcon size={28} />}
        </button>
      ) : null}

      {state.isLive && panelOpen && onChannelSelect ? (
        <div className="ch-overlay" role="dialog" aria-modal="true" aria-label={t('channels.title')} onClick={(event) => { if (event.target === event.currentTarget) { setPanelOpen(false); revealControls() } }}>
          <div className="ch-panel" data-focus-scope>
            <div className="ch-panel-head" data-zone="h">
              <h3>{t('channels.title')}</h3>
              <div className="ch-panel-head-actions">
                <button className="modal-close" aria-label={t('common.close')} onClick={() => { setPanelOpen(false); revealControls() }}>×</button>
              </div>
            </div>
            <div className="ch-now" role="button" tabIndex={-1}>
              <span className="ch-now-logo ch-logo-ph" style={{ background: channelColor(state.title) }}>
                {initialOf(state.title)}
              </span>
              <div className="ch-now-text">
                <div className="ch-now-label">{t('channels.live')}</div>
                <div className="ch-now-name">{state.title}</div>
                {(() => {
                  const epg = currentEpg(state.item)
                  return epg.entry ? (
                    <div className="ch-epg">
                      <span className="ch-epg-time">{formatClock(epg.entry.start)} – {formatClock(epg.entry.end)}</span>
                      <span className="ch-epg-title">{epg.entry.title}</span>
                      <span className="ch-epg-left">{remainingLabel(epg.entry.end)}</span>
                    </div>
                  ) : <div className="ch-epg ch-epg-none">{t('channels.noEpg')}</div>
                })()}
              </div>
            </div>
            <div className="search-wrap" style={{ margin: '10px 12px' }}>
              <SearchIcon size={20} />
              <input className="glass-input" placeholder={t('channels.search')} value={panelSearch} onChange={(event) => setPanelSearch(event.target.value)} />
            </div>
            <div className="ch-controls" style={{ display: 'flex', gap: 8, padding: '0 12px 10px', flexShrink: 0 }}>
              <select className="sort-select" aria-label={t('channels.sortPopular')} value={panelSort} onChange={(event) => setPanelSort(event.target.value)}>
                <option value="">{t('channels.sortOriginal')}</option>
                {(panelFeatures?.sort || [{ id: 'trending', name: t('channels.sortPopular') }, { id: 'name', name: 'A-Z' }]).map((option) => (
                  <option key={option.id} value={option.id}>{option.name === 'Trending' || option.name === 'Popular' ? t('channels.sortPopular') : option.name}</option>
                ))}
              </select>
              <select className="sort-select" aria-label={t('channels.allCountries')} value={panelGroup} onChange={(event) => setPanelGroup(event.target.value)}>
                <option value="">{t('channels.allCountries')}</option>
                {(panelFeatures?.filter?.find((feature) => feature.id === 'group')?.values || []).map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
              <button className={`ep-pill panel-favorites-filter ${panelGroup === '__favorites__' ? 'active' : ''}`} aria-pressed={panelGroup === '__favorites__'} onClick={() => setPanelGroup((value) => value === '__favorites__' ? '' : '__favorites__')}>
                {t('channels.favorites')} {favIds.size > 0 ? <span className="ep-pill-count">{favIds.size}</span> : null}
              </button>
            </div>
            <div className="ch-list" style={{ maxHeight: 'none', minHeight: 0, overflowY: 'auto', flex: 1 }} aria-busy={panelLoading}>
              {panelChannels
                .filter((channel) => matchesPanelSearch(channel, panelSearch))
                .map((channel, index) => (
                  <div className="ch-item" key={channel.id} style={{ position: 'relative', height: 64 }}>
                    <div className="ch-row" tabIndex={0} role="button" aria-label={channelStation(channel.name)} style={{ height: '100%' }} onClick={() => { onChannelSelect(channel, panelChannels); setPanelOpen(false); containerRef.current?.focus({ preventScroll: true }) }}>
                      <span className="ch-num">{index + 1}</span>
                      <span className="ch-logo ch-logo-ph" style={{ background: channelColor(channelStation(channel.name)) }}>{initialOf(channelStation(channel.name))}</span>
                      <div className="ch-main">
                        <div className="ch-head">
                          <span className="ch-name">{channelStation(channel.name)}</span>
                          {channelQuality(channel.name) ? <span className="ch-chip">{channelQuality(channel.name)}</span> : null}
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
                            ) : <div className="ch-epg ch-epg-none">{t('channels.noEpg')}</div>
                          })()}
                        </div>
                      </div>
                      <button className={`ch-fav ${favIds.has(channel.id) ? 'on' : ''}`} aria-label={t('item.favorite')} aria-pressed={favIds.has(channel.id)} onClick={(event) => { event.stopPropagation(); togglePanelFavorite(channel.id) }}>
                        <HeartIcon size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              {!panelLoading && panelChannels.filter((channel) => matchesPanelSearch(channel, panelSearch)).length === 0 ? (
                <div className="empty"><h3>{t('channels.noResults')}</h3><p>{t('channels.noResultsDesc')}</p></div>
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

      {showHelp ? <ShortcutsHelp onClose={() => setShowHelp(false)} /> : null}
    </div>
  )
}
