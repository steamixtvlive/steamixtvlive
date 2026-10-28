import { useEffect, useRef, useState, useCallback } from 'react'
import Hls from 'hls.js'
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward, Wrench, Download } from 'lucide-react'
import MediabunnyPlayer from './MediabunnyPlayer'
import { STEAMIX_TV_APK_URL } from '@/lib/constants'


interface VideoPlayerProps {
  src: string
  poster?: string
  title?: string
  onEnded?: () => void
  fallbackSrcs?: string[]
  onToggleFullscreen?: () => void
  onRefreshUrl?: () => string | undefined
}

const IS_MOBILE = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
const PROXY_PREFIXES = ['/dyn/', '/p2095/', '/p8080/']

const isDirectFileUrl = (url: string) => {
  if (!url) return false
  if (!IS_MOBILE && PROXY_PREFIXES.some(p => url.startsWith(p))) return false
  const ext = url.split('?')[0].toLowerCase()
  return ext.endsWith('.mkv')
}

export default function VideoPlayer({ src, poster, title, onEnded, fallbackSrcs, onToggleFullscreen, onRefreshUrl }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [buffered, setBuffered] = useState(0)
  const [loadError, setLoadError] = useState('')
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const urlIndexRef = useRef(0)
  const allUrlsRef = useRef<string[]>([])
  const watchdogRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const lastProgressRef = useRef(0)
  const retryCountRef = useRef(0)
  const [loading, setLoading] = useState(false)
  const [useMediabunny, setUseMediabunny] = useState<boolean | null>(null)

  // Detect if Mediabunny should be used for this source
  useEffect(() => {
    const isProxy = (u: string) => PROXY_PREFIXES.some(p => u.startsWith(p))
    const isMkv = src.endsWith('.mkv')
    const isProxyUrl = isProxy(src)
    const canMkv = isMkv
    if (canMkv && !isProxyUrl && !IS_MOBILE) {
      setUseMediabunny(true)
    } else {
      setUseMediabunny(false)
    }
  }, [src, fallbackSrcs])

  // Build full URL list
  useEffect(() => {
    const urls = [src, ...(fallbackSrcs || [])]
    const filtered = urls.filter(Boolean)
    allUrlsRef.current = filtered
    urlIndexRef.current = 0
    setLoadError('')
  }, [src, fallbackSrcs])

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const startHideTimer = useCallback(() => {
    clearTimeout(hideTimer.current)
    setShowControls(true)
    hideTimer.current = setTimeout(() => { setShowControls(false) }, 4000)
  }, [])

  const tryPlay = useCallback(async (video: HTMLVideoElement) => {
    try {
      await video.play()
      setPlaying(true)
    } catch {
      // Autoplay blocked — show overlay instead of auto-muting
      setPlaying(false)
    }
  }, [])

  const cleanup = useCallback(() => {
    clearInterval(watchdogRef.current)
    clearTimeout(hideTimer.current)
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    const v = videoRef.current
    if (v) {
      v.pause()
      v.removeAttribute('src')
      v.load()
      v.onerror = null
    }
  }, [])

  // Watchdog: every 2s check if video made progress, if stuck try next URL
  const startWatchdog = useCallback((video: HTMLVideoElement) => {
    clearInterval(watchdogRef.current)
    lastProgressRef.current = video.currentTime || 0
    let stuckCount = 0
    const urlIdx = urlIndexRef.current
    const total = allUrlsRef.current.length
    const currentSrc = allUrlsRef.current[urlIdx] || ''
    const maxStuck = currentSrc.endsWith('.mkv') ? 30 : 20
    watchdogRef.current = setInterval(() => {
      if (!video || video.seeking) return
      if (video.readyState >= 2 && video.currentTime > lastProgressRef.current) {
        lastProgressRef.current = video.currentTime
        stuckCount = 0
        return
      }
      stuckCount++
      if (stuckCount >= maxStuck) {
                clearInterval(watchdogRef.current)
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
        if (videoRef.current) videoRef.current.onerror = null
        video.src = ''
        video.load()
        urlIndexRef.current++
        if (urlIndexRef.current < allUrlsRef.current.length) {
          tryUrl(video)
        } else {
          urlIndexRef.current = 0
          setTimeout(() => {
            if (videoRef.current) {
              setLoadError('')
              tryUrl(videoRef.current)
            }
          }, 8000)
          setLoadError('Yeniden bağlanıyor...')
        }
      }
    }, 1800)
  }, [])

  // Try playing a URL from the list
  const tryUrl = useCallback((video: HTMLVideoElement) => {
    const idx = urlIndexRef.current
    const urls = allUrlsRef.current
    if (idx >= urls.length) { setLoadError('Bu kanal bakımdadır'); setLoading(false); return }
    const currentSrc = urls[idx]
    retryCountRef.current = 0
    setLoading(true)

    const ctrl = new AbortController()
    fetch(currentSrc, { signal: ctrl.signal }).then(r => {
      const ct = r.headers.get('content-type') || ''
      ctrl.abort()
    }).catch(() => {})

    // Destroy previous HLS and reset video element fully
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    video.pause()
    video.removeAttribute('src')
    video.load()
    video.muted = false
    setMuted(false)

    const srcNoQuery = currentSrc.split('?')[0]
    const isHls = srcNoQuery.endsWith('.m3u8')
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    if (isHls && Hls.isSupported() && !isSafari) {
      const isVirtualHls = currentSrc.startsWith('/v/')
      const hls = new Hls({
        enableWorker: false, lowLatencyMode: isVirtualHls, debug: false,
        fragLoadingTimeOut: isVirtualHls ? 0 : 15000,
        fragLoadingMaxRetry: 5,
        fragLoadingRetryDelay: 1000,
        manifestLoadingTimeOut: 15000,
        manifestLoadingMaxRetry: 5,
        manifestLoadingRetryDelay: 2000,
        fetchSetup: (context, init) => {
          let url = context.url
          // Proxy Akamai URLs through our server for CORS
          if (url.includes('akamaized.net')) {
            try {
              const u = new URL(url)
              const base = u.protocol + '//' + u.hostname + ':' + (u.port || (u.protocol === 'https:' ? 443 : 80))
              const b64 = btoa(base).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
              url = '/p/' + b64 + u.pathname + (u.search || '')

            } catch (e) {}
          }
          return new Request(url, {
            ...init,
            credentials: 'include',
            referrerPolicy: 'unsafe-url',
            referrer: currentSrc,
          })
        }
      })
      hlsRef.current = hls
      hls.loadSource(currentSrc)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false)
        tryPlay(video)
        startWatchdog(video)
      })
      hls.on(Hls.Events.LEVEL_LOADED, (_e, data) => {
      })
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_e, data) => {
        const tracks: any[] = data.audioTracks || []
        if (tracks.length > 0) {
          const track = tracks[0]
          hls.audioTrack = track.id
        }
      })
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.swapAudioCodec()
          hls.recoverMediaError()
          return
        }
        retryCountRef.current++
        if (retryCountRef.current <= 3 && onRefreshUrl) {
          const freshUrl = onRefreshUrl()
          if (freshUrl && freshUrl !== currentSrc) {
            clearInterval(watchdogRef.current)
            hls.destroy(); hlsRef.current = null
            allUrlsRef.current = [freshUrl, ...allUrlsRef.current.slice(1)]
            urlIndexRef.current = 0
            setTimeout(() => tryUrl(video), 1500)
            return
          }
        }
        clearInterval(watchdogRef.current)
        hls.destroy(); hlsRef.current = null
        urlIndexRef.current++
        tryUrl(video)
      })
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = currentSrc
      const onReady = () => { video.removeEventListener('canplay', onReady); setLoading(false); tryPlay(video); startWatchdog(video) }
      video.addEventListener('canplay', onReady)
      video.addEventListener('error', () => setLoading(false), { once: true })
      startWatchdog(video)
    } else {
      video.src = currentSrc
      video.onerror = () => {
        clearInterval(watchdogRef.current); setLoading(false)
        urlIndexRef.current++
        tryUrl(video)
      }
      video.muted = false; setMuted(false)
      const onReady = () => { video.removeEventListener('canplay', onReady); setLoading(false); tryPlay(video); startWatchdog(video) }
      video.addEventListener('canplay', onReady)
      startWatchdog(video)
    }
  }, [startWatchdog])

  // Initialize on src change
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    urlIndexRef.current = 0
    setLoadError('')
    setPlaying(false)
    setLoading(true)
    tryUrl(video)

    return () => { cleanup() }
  }, [src, fallbackSrcs, tryUrl, cleanup])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) { tryPlay(video) } else { video.pause(); setPlaying(false) }
    startHideTimer()
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
  }

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    videoRef.current!.volume = v
    setVolume(v); setMuted(v === 0)
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = progressRef.current!.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    videoRef.current!.currentTime = pct * duration
  }

  const toggleFullscreen = async () => {
    if (onToggleFullscreen) { onToggleFullscreen(); return }
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen()
      } catch {
        try { await document.documentElement.requestFullscreen() } catch {}
      }
      setFullscreen(true)
      if (IS_MOBILE) {
        try { (screen as any).orientation?.lock?.('landscape')?.catch(() => {}) } catch {}
      }
    } else {
      await document.exitFullscreen()
      setFullscreen(false)
      if (IS_MOBILE) {
        try { (screen as any).orientation?.unlock?.() } catch {}
      }
    }
  }

  const skip = (sec: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime += sec
    lastProgressRef.current = video.currentTime
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTime = () => { setCurrentTime(video.currentTime) }
    const onDur = () => setDuration(video.duration || 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onProg = () => { if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1)) }
    const onEnd = () => onEnded?.()
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('loadedmetadata', onDur)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('progress', onProg)
    video.addEventListener('ended', onEnd)
    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('loadedmetadata', onDur)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('progress', onProg)
      video.removeEventListener('ended', onEnd)
    }
  }, [onEnded, startHideTimer])

  useEffect(() => {
    const onFs = () => {
      setFullscreen(!!document.fullscreenElement)
      startHideTimer()
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [startHideTimer])



  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0

  const isProxyUrl = (u: string) => PROXY_PREFIXES.some(p => u.startsWith(p))
  const canUseMediabunny = useMediabunny === true && src && (!isProxyUrl(src) || IS_MOBILE) && (!(fallbackSrcs?.some(isProxyUrl)) || IS_MOBILE)

  if (canUseMediabunny) {
    return (
      <MediabunnyPlayer
        key={src}
        src={src}
        poster={poster}
        title={title}
        onEnded={onEnded}
        onToggleFullscreen={onToggleFullscreen}
      />
    )
  }

  return (
    <div ref={containerRef} className="relative bg-black group cursor-pointer" onClick={togglePlay} onMouseMove={startHideTimer} onTouchStart={startHideTimer}>
      <video ref={videoRef} className={`w-full ${fullscreen ? 'h-screen w-screen object-cover md:object-contain' : 'aspect-video object-contain'}`} poster={poster} playsInline />

      {title && <div className="absolute top-4 left-4 text-white text-sm font-medium drop-shadow-lg bg-black/40 px-3 py-1.5 rounded-lg">{title}</div>}
      {loadError && (
        <div className={`absolute inset-0 flex items-center justify-center z-10 ${loadError.includes('bağlanıyor') ? '' : 'bg-black/70'}`}>
          {loadError.includes('bağlanıyor') ? (
            <div className="text-center max-w-xs">
              <p className="text-sm text-[#0099ff]">{loadError}</p>
            </div>
          ) : (
            <div className="text-center max-w-xs px-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#0099ff]/10 flex items-center justify-center">
                <Wrench className="w-8 h-8 text-[#0099ff]" />
              </div>
              <p className="text-base font-semibold text-white mb-1.5">{loadError}</p>
              <p className="text-sm text-gray-400 mb-2">Bir süre sonra düzelecektir.<br/>Kesintisiz izleme deneyimi için lütfen <span className="text-[#0099ff] font-medium">profil bölümündeki uygulamayı</span> indirin.</p>
              <p className="text-xs text-gray-500 mb-5">Uygulamada tüm kanallar sorunsuz çalışmaktadır.</p>
              <div className="flex flex-col gap-2">
                <a href={STEAMIX_TV_APK_URL}
                  target="_blank" rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0099ff] to-blue-600 text-white text-sm font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" />Uygulamayı İndir
                </a>
                <button onClick={() => { setLoadError(''); urlIndexRef.current = 0; tryUrl(videoRef.current!) }}
                  className="px-5 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors">Tekrar Dene</button>
              </div>
            </div>
          )}
        </div>
      )}
      {loading && !playing && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
            <svg className="animate-spin w-8 h-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        </div>
      )}
      {!loading && !playing && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
            <Play className="w-8 h-8 text-white ml-1" />
          </div>
        </div>
      )}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-16 pb-3 px-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div ref={progressRef} className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group/progress hover:h-2.5 transition-all" onClick={handleSeek}>
          <div className="h-full bg-white/30 rounded-full relative" style={{ width: `${bufferedPct}%` }}>
            <div className="absolute inset-0 bg-[#0099ff] rounded-full" style={{ width: `${bufferedPct > 0 ? (progress / bufferedPct) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-1 sm:gap-3">
            <button onClick={e => { e.stopPropagation(); skip(-10) }} className="p-2 sm:p-0 hover:text-[#0099ff]"><SkipBack className="w-5 h-5 sm:w-5 sm:h-5" /></button>
            <button onClick={e => { e.stopPropagation(); togglePlay() }} className="p-2 sm:p-0 hover:text-[#0099ff]">{playing ? <Pause className="w-7 h-7 sm:w-6 sm:h-6" /> : <Play className="w-7 h-7 sm:w-6 sm:h-6" />}</button>
            <button onClick={e => { e.stopPropagation(); skip(10) }} className="p-2 sm:p-0 hover:text-[#0099ff]"><SkipForward className="w-5 h-5 sm:w-5 sm:h-5" /></button>
            <div className="flex items-center gap-1 sm:gap-2">
              <button onClick={e => { e.stopPropagation(); toggleMute() }} className="p-2 sm:p-0 hover:text-[#0099ff]">{muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}</button>
              <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={handleVolume} onClick={e => e.stopPropagation()} className="w-16 sm:w-20 accent-[#0099ff]" />
            </div>
            <span className="text-xs text-gray-300 hidden sm:inline">{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <span className="text-[10px] sm:text-xs text-gray-400 sm:hidden">{formatTime(currentTime)} / {formatTime(duration)}</span>
            <button onClick={e => { e.stopPropagation(); toggleFullscreen() }} className="p-2 sm:p-0 hover:text-[#0099ff]">{fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}</button>
          </div>
        </div>
      </div>

    </div>
  )
}
