import './geil.css'
import './overrides.css'
import { useEffect, useState } from 'react'
import type { GeilItem, PlayerState } from './types'
import { resolveLiveChannel } from './api'
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

  useEffect(() => {
    document.title = 'NOTFLIX'
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
      })
    } catch (error) {
      console.error(error)
    }
  }

  function playVod(item: GeilItem, episode?: GeilItem) {
    setSourceModal({ item, episode: episode || null })
  }

  function closePlayer() {
    setPlayer(INITIAL_PLAYER)
  }

  function renderView() {
    if (route.view === 'channels') return <ChannelsView onPlay={playLive} />
    if (route.view === 'catalog') return <CatalogView />
    if (route.view === 'item') return <ItemView onPlay={playVod} />
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
        <div className="main-inner">{renderView()}</div>
      </main>

      {player.open ? (
        <Player state={player} onClose={closePlayer} />
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
