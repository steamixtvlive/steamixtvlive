import './geil.css'
import './overrides.css'
import { useEffect, useState } from 'react'
import type { GeilItem, PlayerState } from './types'
import { resolveLiveChannel, fetchLiveCatalog, signStreamUrl } from './api'
import { useHashRoute } from './router'
import Sidebar from './Sidebar'
import HomeView from './HomeView'
import ChannelsView from './ChannelsView'
import CatalogView from './CatalogView'
import ItemView from './ItemView'
import SearchView from './SearchView'
import LibraryView from './LibraryView'
import SettingsView from './SettingsView'
import SocialView from './SocialView'
import Player from './Player'
import SourceModal from './SourceModal'

const INITIAL_PLAYER: PlayerState = {
  open: false,
  title: '',
  isLive: false,
  streamUrl: '',
}

export default function GeilApp() {
  const route = useHashRoute()
  const [player, setPlayer] = useState<PlayerState>(INITIAL_PLAYER)
  const [sourceModal, setSourceModal] = useState<{ item: GeilItem; episode?: GeilItem | null } | null>(null)
  const [liveChannels, setLiveChannels] = useState<GeilItem[]>([])

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

  async function playLive(channel: GeilItem) {
    try {
      const resolved = await resolveLiveChannel(channel.id)
      setPlayer({
        open: true,
        title: channel.name,
        subtitle: channel.tags?.join(' · '),
        isLive: true,
        streamUrl: resolved.url,
        poster: undefined,
        item: channel,
        channels: liveChannels,
        channelIndex: liveChannels.findIndex((entry) => entry.id === channel.id),
      })
    } catch (error) {
      console.error(error)
    }
  }

  function playVod(item: GeilItem, episode?: GeilItem) {
    setSourceModal({ item, episode: episode || null })
  }

  async function playDirect(item: GeilItem, episode?: GeilItem) {
    const target = episode || item
    if (!target.url) return
    let streamUrl = target.url
    if (/^http:\/\//i.test(target.url)) {
      try {
        streamUrl = await signStreamUrl(target.url)
      } catch {
        streamUrl = target.url
      }
    }
    setPlayer({
      open: true,
      title: target.name,
      isLive: false,
      streamUrl,
      item: target,
    })
  }

  function closePlayer() {
    setPlayer(INITIAL_PLAYER)
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
        item: channel,
        channelIndex: current.channels?.findIndex((entry) => entry.id === channel.id) ?? current.channelIndex,
      }))
    } catch {
      // Keep current stream if resolve fails.
    }
  }

  function renderView() {
    if (route.view === 'channels') return <ChannelsView onPlay={playLive} />
    if (route.view === 'catalog') return <CatalogView />
    if (route.view === 'item') return <ItemView onPlay={playVod} onPlayDirect={playDirect} />
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
          channelIndex={player.channelIndex}
          onChannelSelect={player.isLive ? selectLiveChannel : null}
        />
      ) : null}

      {sourceModal ? (
        <SourceModal
          item={sourceModal.item}
          episode={sourceModal.episode}
          onClose={() => setSourceModal(null)}
          onPlay={(url, title) => {
            setPlayer({
              open: true,
              title,
              isLive: false,
              streamUrl: url,
              item: sourceModal.episode || sourceModal.item,
            })
            setSourceModal(null)
          }}
        />
      ) : null}
    </div>
  )
}
