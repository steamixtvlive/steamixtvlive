import './geil.css'
import './overrides.css'
import './extras.css'
import { useEffect, useRef, useState } from 'react'
import type { GeilItem, GeilSource, PlayerSource, PlayerState, WatchMeta } from './types'
import { resolveLiveChannel, fetchLiveCatalog, resolveVodSource, posterUrl, pollRemoteCommands, fetchVodSources } from './api'
import { useHashRoute, parseHash, replaceRoute, navigate, itemHref } from './router'
import { getContinueEntry, getDeadSourceUrls, getSavedSourceUrl, markDeadSource, clearDeadSource, saveSavedSourceUrl, type ContinueEntry } from './storage'
import { activateFocused, androidKeyCommand, applyTvMode, focusFirst, isShellApp, moveFocus, readTvMode, setTvMode, stepSelect } from './tv'
import type { FocusDirection } from './tv'
import Sidebar from './Sidebar'
import SiteFullscreenButton from './SiteFullscreenButton'
import HomeView from './HomeView'
import ChannelsView from './ChannelsView'
import CatalogView from './CatalogView'
import M3uCatalogView from './M3uCatalogView'
import ItemView from './ItemView'
import SearchView from './SearchView'
import LibraryView from './LibraryView'
import SettingsView from './SettingsView'
import Player from './Player'
import RemoteView from './RemoteView'
import ShortcutsHelp from './ShortcutsHelp'
import SourceModal, { vodContextOf } from './SourceModal'
import type { SourceSelection } from './SourceModal'

const INITIAL_PLAYER: PlayerState = {
  open: false,
  title: '',
  isLive: false,
  streamUrl: '',
}

interface PlaybackContext {
  item: GeilItem
  episode: GeilItem | null
  vodType: string
  vodId: string
  isM3u: boolean
  title: string
}

interface VodQueue {
  context: PlaybackContext
  sources: GeilSource[]
  order: number[]
  pos: number
  seq: number
}

interface RemoteSessionState {
  code: string
  token: string
}

const REMOTE_CURSOR_KEY = 'notflix_remote_cursor'

// A poll cursor that survives remounts, so an old pairing never replays its queued commands.
function readRemoteCursor(code: string): number {
  try {
    const raw = localStorage.getItem(REMOTE_CURSOR_KEY)
    if (!raw) return 0
    const parsed = JSON.parse(raw) as { code?: string; cursor?: number }
    return parsed.code === code ? Number(parsed.cursor) || 0 : 0
  } catch { return 0 }
}

function writeRemoteCursor(code: string, cursor: number) {
  try { localStorage.setItem(REMOTE_CURSOR_KEY, JSON.stringify({ code, cursor })) } catch { /* storage may be blocked */ }
}

function readStoredRemoteSession(): RemoteSessionState | null {
  try {
    const raw = localStorage.getItem('notflix_remote_session')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { code?: string; token?: string; at?: number }
    if (!parsed.code || !parsed.token) return null
    // The server keeps a pairing alive for as long as this page polls it, so a reload of the TV
    // keeps the same code instead of asking somebody to type six digits across the room.
    if (Date.now() - Number(parsed.at || 0) > 12 * 60 * 60 * 1000) return null
    return { code: parsed.code, token: parsed.token }
  } catch { return null }
}

function forgetStoredRemoteSession(code: string) {
  try {
    const raw = localStorage.getItem('notflix_remote_session')
    if (raw && (JSON.parse(raw) as { code?: string }).code === code) localStorage.removeItem('notflix_remote_session')
  } catch { /* storage may be blocked */ }
}

export default function GeilApp() {
  const route = useHashRoute()
  const [player, setPlayer] = useState<PlayerState>(INITIAL_PLAYER)
  const [sourceModal, setSourceModal] = useState<{ item: GeilItem; episode?: GeilItem | null; notice?: 'unavailable' } | null>(null)
  const [liveChannels, setLiveChannels] = useState<GeilItem[]>([])
  const [showHelp, setShowHelp] = useState(false)
  const [tvMode, setTvModeState] = useState(readTvMode)
  const [remoteSession, setRemoteSession] = useState<RemoteSessionState | null>(readStoredRemoteSession)

  const playerRef = useRef(player)
  const modalRef = useRef(sourceModal)
  const helpRef = useRef(showHelp)
  const routeRef = useRef(route)
  playerRef.current = player
  modalRef.current = sourceModal
  helpRef.current = showHelp
  routeRef.current = route

  const overlayKey = player.open ? 'player' : sourceModal ? 'sources' : ''
  const lastOverlay = useRef('')
  const skipPop = useRef(0)
  const resolveSeq = useRef(0)
  const playbackContext = useRef<PlaybackContext | null>(null)
  const vodQueue = useRef<VodQueue | null>(null)

  // A refreshed deep link has no in-app history entry; keep one so back never leaves the site.
  useEffect(() => {
    const initial = parseHash()
    if (initial.view === 'home') return
    if (window.history.state?.notflixRoute) return
    const here = window.location.href
    window.history.replaceState({ notflixRoute: '#/' }, '', '#/')
    window.history.pushState({ notflixRoute: here.slice(here.indexOf('#')) }, '', here)
  }, [])

  // Overlays get their own history entry so the browser back button closes them first.
  useEffect(() => {
    if (overlayKey === lastOverlay.current) return
    const previous = lastOverlay.current
    lastOverlay.current = overlayKey
    if (!overlayKey) return
    const currentState = window.history.state || {}
    if (previous && currentState.geilOverlay) {
      window.history.replaceState({ ...currentState, geilOverlay: overlayKey }, '', window.location.href)
    } else {
      window.history.pushState({ ...currentState, geilOverlay: overlayKey }, '', window.location.href)
    }
  }, [overlayKey])

  useEffect(() => {
    const handlePopState = () => {
      if (skipPop.current > 0) {
        skipPop.current -= 1
        return
      }
      if (playerRef.current.open) {
        const wasLive = playerRef.current.isLive
        lastOverlay.current = ''
        playerRef.current = INITIAL_PLAYER
        setPlayer(INITIAL_PLAYER)
        if (wasLive) replaceRoute('#/channels')
        return
      }
      if (modalRef.current) {
        lastOverlay.current = ''
        modalRef.current = null
        setSourceModal(null)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    const handleBackShortcut = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (playerRef.current.open) {
        event.preventDefault()
        closePlayer()
      } else if (modalRef.current) {
        event.preventDefault()
        closeSourceModal()
      }
    }
    window.addEventListener('keydown', handleBackShortcut)
    return () => window.removeEventListener('keydown', handleBackShortcut)
  }, [])

  useEffect(() => {
    applyTvMode(tvMode)
    const handler = (event: Event) => {
      const enabled = Boolean((event as CustomEvent<{ enabled?: boolean }>).detail?.enabled)
      setTvModeState(enabled)
    }
    window.addEventListener('notflix-tv-mode', handler)
    return () => window.removeEventListener('notflix-tv-mode', handler)
  }, [tvMode])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = Boolean(target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable))
      if ((event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === 'K')) {
        event.preventDefault()
        navigate('/search')
        return
      }
      if (event.key === 'Escape' && showHelp) {
        event.preventDefault()
        setShowHelp(false)
        return
      }
      if (typing) return
      // The channel row of an Android TV remote arrives as a bare key code, so it joins the same
      // command bus the D-pad uses: the player zaps, everywhere else the viewer lands on channels.
      const channelCommand = androidKeyCommand(event.keyCode)
      if (channelCommand) {
        event.preventDefault()
        window.dispatchEvent(new CustomEvent('notflix-remote', { detail: { command: channelCommand } }))
        return
      }
      if (playerRef.current.open || modalRef.current) return
      if (event.shiftKey && !event.ctrlKey && !event.metaKey && (event.key === 'T' || event.key === 't')) {
        event.preventDefault()
        setTvMode(!readTvMode())
        return
      }
      if (event.key === '?' || event.key === 'h' || event.key === 'H') {
        event.preventDefault()
        setShowHelp((value) => !value)
        return
      }
      if (event.key === 'Backspace' && !showHelp) {
        if (route.view !== 'home' && !window.history.state?.geilOverlay) {
          event.preventDefault()
          window.history.back()
        }
        return
      }
      if (!readTvMode()) return
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        moveFocus(event.key === 'ArrowUp' ? 'up' : event.key === 'ArrowDown' ? 'down' : event.key === 'ArrowLeft' ? 'left' : 'right')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showHelp, route.view])

  useEffect(() => {
    const handler = (event: Event) => {
      const command = (event as CustomEvent<{ command?: string }>).detail?.command
      if (!command) return
      // The player owns its own surface while it is on screen — but a source picker opened on top
      // of it owns it back, otherwise the D-pad would steer the picture behind the dialog.
      if (playerRef.current.open && !modalRef.current) return
      if (command === 'up' || command === 'down' || command === 'left' || command === 'right') {
        const direction = command as FocusDirection
        // A focused dropdown owns left/right: the D-pad picks its value instead of leaving the row.
        if ((direction === 'left' || direction === 'right') && stepSelect(direction)) return
        moveFocus(direction)
        return
      }
      if (command === 'ok' || command === 'playpause') { if (!activateFocused()) focusFirst(); return }
      if (command === 'back') {
        if (modalRef.current) { closeSourceModal(); event.preventDefault(); return }
        if (helpRef.current) { setShowHelp(false); event.preventDefault(); return }
        // Telling the shell whether the page consumed the key is what keeps Android's Back from
        // stepping out of the app while a screen is still there to go back to.
        if (routeRef.current.view !== 'home') { window.history.back(); event.preventDefault(); return }
        // In a browser the remote's Back is the browser's Back. In the shell the answer above has
        // already told Android what to do, so stepping history here would move twice.
        if (!isShellApp()) window.history.back()
        return
      }
      if (command === 'home') { navigate('/'); return }
      if (command === 'chup' || command === 'chdown') { navigate('/channels'); window.setTimeout(focusFirst, 150); return }
    }
    window.addEventListener('notflix-remote', handler)
    return () => window.removeEventListener('notflix-remote', handler)
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      const session = (event as CustomEvent<{ session?: RemoteSessionState | null }>).detail?.session
      setRemoteSession(session || null)
    }
    window.addEventListener('notflix-remote-session', handler)
    return () => window.removeEventListener('notflix-remote-session', handler)
  }, [])

  useEffect(() => {
    if (!remoteSession) return
    // A phone-driven D-pad moves focus without any keyboard activity, and browsers suppress the
    // focus ring in exactly that case — so while a remote is attached the ring is forced back on.
    document.documentElement.classList.add('remote-live')
    let cursor = readRemoteCursor(remoteSession.code)
    let stopped = false
    let controller: AbortController | null = null
    let wake: (() => void) | null = null
    let waitTimer = 0

    const pause = (ms: number) => new Promise<void>((resolve) => {
      wake = resolve
      waitTimer = window.setTimeout(() => { wake = null; resolve() }, ms)
    })

    const loop = async () => {
      while (!stopped) {
        const startedAt = Date.now()
        controller = new AbortController()
        const giveUp = window.setTimeout(() => controller?.abort(), 30000)
        try {
          const data = await pollRemoteCommands(remoteSession.code, remoteSession.token, cursor, controller.signal)
          if (stopped) break
          const next = Number(data.cursor) || cursor
          if (next !== cursor) { cursor = next; writeRemoteCursor(remoteSession.code, cursor) }
          for (const entry of data.commands || []) {
            window.dispatchEvent(new CustomEvent('notflix-remote', { detail: { command: entry.command } }))
          }
          // An endpoint that answers immediately with nothing means this build of the API has no
          // long-poll, so back off instead of spinning. A held poll never reaches this branch.
          if (!(data.commands || []).length && Date.now() - startedAt < 500) await pause(400)
        } catch (error) {
          if (stopped) break
          // A 404 is the server saying this pairing is gone (it restarted or the code aged out).
          // Keep retrying would only spam it, so forget the session and let the viewer re-pair.
          if ((error as { status?: number }).status === 404) {
            stopped = true
            forgetStoredRemoteSession(remoteSession.code)
            break
          }
          // An abort is our own restart (a stuck request or the tab coming back), so retry at once;
          // only a real network failure deserves a breath before the next attempt.
          if (!controller.signal.aborted) await pause(1200)
        } finally {
          window.clearTimeout(giveUp)
          controller = null
        }
      }
    }
    void loop()

    // A tab that was kept in the background can miss a held response, so the first poll after it is
    // shown again goes out straight away rather than after the current request settles.
    const onVisible = () => { if (document.visibilityState === 'visible') { wake?.(); controller?.abort() } }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      document.documentElement.classList.remove('remote-live')
      document.removeEventListener('visibilitychange', onVisible)
      window.clearTimeout(waitTimer)
      wake?.()
      controller?.abort()
    }
  }, [remoteSession])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ item?: GeilItem | null }>).detail
      const meta = playerRef.current.watchMeta
      const target = detail?.item || meta?.item
      if (!target) return
      lastOverlay.current = ''
      playerRef.current = INITIAL_PLAYER
      setPlayer(INITIAL_PLAYER)
      replaceRoute(itemHref(meta?.addonId === 'm3u' ? 'm3u' : 'tmdb', target.type, target.id))
    }
    window.addEventListener('notflix-open-episodes', handler)
    return () => window.removeEventListener('notflix-open-episodes', handler)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchLiveCatalog({ limit: 300 }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setLiveChannels(data.items)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  useEffect(() => {
    document.title = 'NOTFLİX'
  }, [])

  function popOverlayEntry() {
    if (window.history.state?.geilOverlay) {
      skipPop.current += 1
      window.history.back()
    }
  }

  function closePlayer() {
    if (!playerRef.current.open) return
    playerRef.current = INITIAL_PLAYER
    setPlayer(INITIAL_PLAYER)
    popOverlayEntry()
  }

  function closeSourceModal() {
    if (!modalRef.current) return
    modalRef.current = null
    setSourceModal(null)
    popOverlayEntry()
  }

  async function playLive(channel: GeilItem, visible?: GeilItem[]) {
    const seq = ++resolveSeq.current
    // Zapping must stay inside the list the viewer is looking at (country filter,
    // favourites, search), not the whole catalogue.
    const list = visible?.length ? visible : liveChannels
    setPlayer({
      open: true,
      title: channel.name,
      subtitle: channel.tags?.join(' · '),
      isLive: true,
      streamUrl: '',
      pending: true,
      item: channel,
      channels: list,
      channelIndex: list.findIndex((entry) => entry.id === channel.id),
    })
    try {
      const resolved = await resolveLiveChannel(channel.id)
      if (resolveSeq.current !== seq) return
      setPlayer((current) => current.open && current.item?.id === channel.id
        ? { ...current, streamUrl: resolved.url, streamHeaders: resolved.headers, pending: false, playbackError: undefined }
        : current)
    } catch {
      if (resolveSeq.current !== seq) return
      setPlayer((current) => current.open && current.item?.id === channel.id
        ? { ...current, pending: false, playbackError: 'Kanal açılamadı' }
        : current)
    }
  }

  function playVod(item: GeilItem, episode?: GeilItem) {
    setSourceModal({ item, episode: episode || null })
  }

  // A dead server is never announced over a playing picture: the queue walks on to the
  // next candidate and the picker is the one that reports what could not be opened.
  function candidateOrder(sources: GeilSource[], preferred: number): number[] {
    const dead = new Set(getDeadSourceUrls())
    const rest = sources.map((_, index) => index).filter((index) => index !== preferred)
    rest.sort((a, b) => Number(dead.has(sources[a].url)) - Number(dead.has(sources[b].url)))
    return [preferred, ...rest].slice(0, 6)
  }

  function failOverAllSources() {
    const queue = vodQueue.current
    vodQueue.current = null
    if (!queue) return
    resolveSeq.current += 1
    playerRef.current = INITIAL_PLAYER
    setPlayer(INITIAL_PLAYER)
    setSourceModal({ item: queue.context.item, episode: queue.context.episode, notice: 'unavailable' })
  }

  async function playQueueEntry(pos: number) {
    const queue = vodQueue.current
    if (!queue) return
    const index = queue.order[pos]
    const source = index === undefined ? undefined : queue.sources[index]
    if (index === undefined || !source) {
      failOverAllSources()
      return
    }
    queue.pos = pos
    setPlayer((current) => current.open
      ? {
          ...current,
          streamUrl: '',
          sourceUrl: '',
          streamHeaders: undefined,
          subtitles: [],
          pending: true,
          playbackError: undefined,
          sourceIndex: index,
        }
      : current)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), pos === 0 ? 30000 : 15000)
    try {
      const playback = queue.context.isM3u
        ? { url: source.url, subtitles: [] as NonNullable<PlayerState['subtitles']> }
        : await resolveVodSource(queue.context.vodType, queue.context.vodId, source.url, controller.signal)
      window.clearTimeout(timeout)
      if (resolveSeq.current !== queue.seq) return
      clearDeadSource(source.url)
      const subtitles = playback.subtitles?.length ? playback.subtitles : source.subtitles || []
      setPlayer((current) => current.open
        ? {
            ...current,
            streamUrl: playback.url,
            sourceUrl: playback.url,
            streamHeaders: playback.headers,
            subtitles,
            pending: false,
            playbackError: undefined,
          }
        : current)
    } catch {
      window.clearTimeout(timeout)
      if (resolveSeq.current !== queue.seq) return
      markDeadSource(source.url)
      if (pos + 1 < queue.order.length) {
        void playQueueEntry(pos + 1)
        return
      }
      failOverAllSources()
    }
  }

  function handleStreamFailure() {
    const queue = vodQueue.current
    if (!queue) return
    const source = queue.sources[queue.order[queue.pos]]
    if (source) markDeadSource(source.url)
    if (queue.pos + 1 < queue.order.length) {
      void playQueueEntry(queue.pos + 1)
      return
    }
    failOverAllSources()
  }

  async function openSource(selection: SourceSelection, switching = false) {
    const seq = ++resolveSeq.current
    const context: PlaybackContext = {
      item: selection.item,
      episode: selection.episode || null,
      vodType: selection.vodType,
      vodId: selection.vodId,
      isM3u: selection.isM3u,
      title: selection.title,
    }
    playbackContext.current = context
    const sources: PlayerSource[] = selection.sources.map((source) => ({
      name: source.name,
      url: source.url,
      quality: source.quality ?? null,
      subtitles: source.subtitles,
    }))
    const sourceIndex = Math.max(0, selection.sources.findIndex((source) => source.url === selection.source.url))
    const playable = context.episode || context.item
    const watchKey = `vod:${context.vodId}`
    const watchMeta: WatchMeta = {
      key: watchKey,
      id: playable.id,
      type: context.episode ? 'series' : (context.item.type || 'video'),
      name: context.title,
      // Episodes inherit the show poster; upstream leaves their own art empty.
      poster: posterUrl(context.item, 'medium') || posterUrl(playable, 'medium'),
      addonId: context.isM3u ? 'm3u' : 'tmdb',
      season: context.episode?.season,
      episode: context.episode?.episode,
      episodeName: context.episode?.name,
      item: context.item,
      episodeItem: context.episode,
    }
    const resume = getContinueEntry(watchKey)
    saveSavedSourceUrl(watchKey, selection.source.url)

    modalRef.current = null
    setSourceModal(null)
    setPlayer((current) => switching && current.open
      ? { ...current, streamUrl: '', pending: true, playbackError: undefined, sourceIndex }
      : {
          open: true,
          title: context.title,
          isLive: false,
          streamUrl: '',
          pending: true,
          playbackError: undefined,
          sources,
          sourceIndex,
          item: playable,
          watchMeta,
          startAt: resume?.position || 0,
        })

    vodQueue.current = {
      context,
      sources: selection.sources,
      order: candidateOrder(selection.sources, sourceIndex),
      pos: 0,
      seq,
    }
    await playQueueEntry(0)
  }

  function switchSource(source: PlayerSource) {
    const context = playbackContext.current
    if (!context) return
    const sources = (playerRef.current.sources || []).map((entry) => ({
      name: entry.name,
      url: entry.url,
      quality: entry.quality ?? undefined,
      subtitles: entry.subtitles,
    }))
    void openSource({
      item: context.item,
      episode: context.episode,
      vodType: context.vodType,
      vodId: context.vodId,
      isM3u: context.isM3u,
      title: context.title,
      source: { name: source.name, url: source.url, quality: source.quality ?? undefined },
      sources,
    }, true)
  }

  async function selectLiveChannel(channel: GeilItem, visible?: GeilItem[]) {
    const seq = ++resolveSeq.current
    setPlayer((current) => {
      const list = visible?.length ? visible : current.channels
      return {
        ...current,
        open: true,
        title: channel.name,
        subtitle: channel.tags?.join(' · '),
        isLive: true,
        streamUrl: '',
        pending: true,
        playbackError: undefined,
        item: channel,
        channels: list,
        channelIndex: list?.findIndex((entry) => entry.id === channel.id) ?? current.channelIndex,
      }
    })
    try {
      const resolved = await resolveLiveChannel(channel.id)
      if (resolveSeq.current !== seq) return
      setPlayer((current) => current.item?.id === channel.id
        ? { ...current, streamUrl: resolved.url, streamHeaders: resolved.headers, pending: false, playbackError: undefined }
        : current)
    } catch {
      if (resolveSeq.current !== seq) return
      setPlayer((current) => current.item?.id === channel.id
        ? { ...current, pending: false, playbackError: 'Kanal şu an yanıt vermiyor' }
        : current)
    }
  }

  async function resumeContinue(entry: ContinueEntry) {
    const episode = entry.episodeItem || null
    const target = episode || entry.item
    const context = vodContextOf(entry.item, episode)
    const savedUrl = getSavedSourceUrl(entry.key)
    if (!savedUrl) {
      setSourceModal({ item: entry.item, episode })
      return
    }
    // Resuming means the server is already known: replay it and skip the picker.
    const sources = context.isM3u
      ? (target.url ? [{ url: target.url, name: 'MCLanX M3U', quality: '', languages: [], subtitles: [] }] : [])
      : await fetchVodSources(context.vodType, context.vodId).catch(() => [])
    const source = sources.find((candidate) => candidate.url === savedUrl)
    if (source) {
      void openSource({ item: entry.item, episode, ...context, source, sources })
      return
    }
    setSourceModal({ item: entry.item, episode })
  }

  function renderView() {
    if (route.view === 'channels') return <ChannelsView onPlay={playLive} />
    if (route.view === 'catalog') {
      const addonId = route.parts[1] || 'tmdb'
      if (addonId === 'm3u') return <M3uCatalogView />
      return <CatalogView />
    }
    if (route.view === 'item') return <ItemView key={route.hash} onPlay={playVod} />
    if (route.view === 'search') return <SearchView />
    if (route.view === 'library') return <LibraryView onResume={resumeContinue} />
    if (route.view === 'settings') return <SettingsView />
    if (route.view === 'remote') return <RemoteView />
    return <HomeView />
  }

  return (
    <div className="app-root">
      <Sidebar route={route} />
      {player.open || route.view === 'remote' ? null : <SiteFullscreenButton />}
      <main className="main" role="main">
        <div className="main-inner">
          <div className="cached-view view-active view-enter">{renderView()}</div>
        </div>
      </main>

      {player.open ? (
        <Player
          state={player}
          onClose={closePlayer}
          channels={player.channels}
          onChannelSelect={player.isLive ? selectLiveChannel : null}
          onSourceSelect={player.isLive ? null : switchSource}
          onStreamFailure={player.isLive ? undefined : handleStreamFailure}
        />
      ) : null}

      {sourceModal ? (
        <SourceModal
          item={sourceModal.item}
          episode={sourceModal.episode}
          notice={sourceModal.notice}
          onClose={closeSourceModal}
          onSelect={(selection) => { void openSource(selection) }}
        />
      ) : null}

      {showHelp && !player.open ? <ShortcutsHelp onClose={() => setShowHelp(false)} /> : null}
    </div>
  )
}
