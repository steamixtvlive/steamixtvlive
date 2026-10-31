import './geil.css'
import './overrides.css'
import { useEffect, useRef, useState } from 'react'
import type { GeilItem, PlayerSource, PlayerState } from './types'
import { resolveLiveChannel, fetchLiveCatalog, resolveVodSource } from './api'
import { useHashRoute, parseHash, replaceRoute } from './router'
import Sidebar from './Sidebar'
import HomeView from './HomeView'
import ChannelsView from './ChannelsView'
import CatalogView from './CatalogView'
import M3uCatalogView from './M3uCatalogView'
import ItemView from './ItemView'
import SearchView from './SearchView'
import LibraryView from './LibraryView'
import SettingsView from './SettingsView'
import SocialView from './SocialView'
import Player from './Player'
import SourceModal from './SourceModal'
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

export default function GeilApp() {
  const route = useHashRoute()
  const [player, setPlayer] = useState<PlayerState>(INITIAL_PLAYER)
  const [sourceModal, setSourceModal] = useState<{ item: GeilItem; episode?: GeilItem | null } | null>(null)
  const [liveChannels, setLiveChannels] = useState<GeilItem[]>([])

  const playerRef = useRef(player)
  const modalRef = useRef(sourceModal)
  playerRef.current = player
  modalRef.current = sourceModal

  const overlayKey = player.open ? 'player' : sourceModal ? 'sources' : ''
  const lastOverlay = useRef('')
  const skipPop = useRef(0)
  const resolveSeq = useRef(0)
  const playbackContext = useRef<PlaybackContext | null>(null)

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

  async function playLive(channel: GeilItem) {
    const seq = ++resolveSeq.current
    setPlayer({
      open: true,
      title: channel.name,
      subtitle: channel.tags?.join(' · '),
      isLive: true,
      streamUrl: '',
      pending: true,
      item: channel,
      channels: liveChannels,
      channelIndex: liveChannels.findIndex((entry) => entry.id === channel.id),
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
    }))
    const sourceIndex = Math.max(0, selection.sources.findIndex((source) => source.url === selection.source.url))

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
          item: context.episode || context.item,
        })

    try {
      const playback = context.isM3u
        ? { url: selection.source.url, subtitles: [] as NonNullable<PlayerState['subtitles']> }
        : await resolveVodSource(context.vodType, context.vodId, selection.source.url)
      if (resolveSeq.current !== seq) return
      setPlayer((current) => current.open
        ? {
            ...current,
            streamUrl: playback.url,
            sourceUrl: playback.url,
            streamHeaders: playback.headers,
            subtitles: playback.subtitles || [],
            pending: false,
            playbackError: undefined,
          }
        : current)
    } catch (error) {
      if (resolveSeq.current !== seq) return
      setPlayer((current) => current.open
        ? {
            ...current,
            pending: false,
            playbackError: error instanceof Error ? error.message : 'Kaynak açılamadı',
          }
        : current)
    }
  }

  function switchSource(source: PlayerSource) {
    const context = playbackContext.current
    if (!context) return
    const sources = (playerRef.current.sources || []).map((entry) => ({
      name: entry.name,
      url: entry.url,
      quality: entry.quality ?? undefined,
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

  async function selectLiveChannel(channel: GeilItem) {
    try {
      const resolved = await resolveLiveChannel(channel.id)
      setPlayer((current) => ({
        ...current,
        open: true,
        title: channel.name,
        subtitle: channel.tags?.join(' · '),
        isLive: true,
        streamUrl: resolved.url,
        streamHeaders: resolved.headers,
        item: channel,
        channelIndex: current.channels?.findIndex((entry) => entry.id === channel.id) ?? current.channelIndex,
      }))
    } catch {
      // Keep current stream if resolve fails.
    }
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
    if (route.view === 'library') return <LibraryView />
    if (route.view === 'settings') return <SettingsView />
    if (route.view === 'social') return <SocialView />
    return <HomeView />
  }

  return (
    <div className="app-root">
      <Sidebar route={route} />
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
        />
      ) : null}

      {sourceModal ? (
        <SourceModal
          item={sourceModal.item}
          episode={sourceModal.episode}
          onClose={closeSourceModal}
          onSelect={(selection) => { void openSource(selection) }}
        />
      ) : null}
    </div>
  )
}
