import { useEffect, useState } from 'react'
import type { GeilItem } from './types'
import { getFavorites, getHistory, clearHistory, getContinueWatching, removeContinueWatching, type ContinueEntry } from './storage'
import { posterUrl } from './api'
import { PosterCard } from './Cards'
import { HeartIcon, HistoryIcon, TrashIcon } from './icons'
import { useLang } from '@/lib/language'

type LibraryTab = 'favorites' | 'history' | 'continue'

export default function LibraryView({ onResume }: { onResume?: (entry: ContinueEntry) => void }) {
  const { t } = useLang()
  const [tab, setTab] = useState<LibraryTab>('favorites')
  const [favorites, setFavorites] = useState(getFavorites())
  const [history, setHistory] = useState(getHistory())
  const [continueItems, setContinueItems] = useState(getContinueWatching())
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    const update = () => {
      setFavorites(getFavorites())
      setHistory(getHistory())
      setContinueItems(getContinueWatching())
    }
    window.addEventListener('notflix-geil-storage', update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener('notflix-geil-storage', update)
      window.removeEventListener('storage', update)
    }
  }, [])

  function removeEntry(key: string) {
    removeContinueWatching(key)
    setContinueItems(getContinueWatching())
  }

  const items = tab === 'favorites' ? favorites : tab === 'history' ? history : []
  const emptyTitle = tab === 'favorites' ? t('library.emptyFav') : tab === 'history' ? t('library.emptyHistory') : t('library.emptyContinue')
  const emptyDesc = tab === 'favorites' ? t('library.emptyFavDesc') : tab === 'history' ? t('library.emptyHistoryDesc') : t('library.emptyContinueDesc')
  const emptyIcon = tab === 'favorites' ? <HeartIcon size={28} /> : <HistoryIcon size={28} />

  return (
    <div className="catalog-view">
      <div className="catalog-head">
        <h1>{t('library.title')}</h1>
      </div>
      <div className="tab-bar" data-zone="h">
        <div className="ep-pills">
          <button className={`ep-pill ${tab === 'favorites' ? 'active' : ''}`} onClick={() => { setConfirmClear(false); setTab('favorites') }}>
            {t('library.favorites')} {favorites.length ? <span className="ep-pill-count">{favorites.length}</span> : null}
          </button>
          <button className={`ep-pill ${tab === 'continue' ? 'active' : ''}`} onClick={() => { setConfirmClear(false); setTab('continue') }}>
            {t('library.continue')} {continueItems.length ? <span className="ep-pill-count">{continueItems.length}</span> : null}
          </button>
          <button className={`ep-pill ${tab === 'history' ? 'active' : ''}`} onClick={() => { setConfirmClear(false); setTab('history') }}>
            {t('library.history')} {history.length ? <span className="ep-pill-count">{history.length}</span> : null}
          </button>
        </div>
      </div>

      {tab === 'continue' ? (
        continueItems.length === 0 ? (
          <div className="empty-lib">
            <div className="empty-card">
              <div className="empty-card-icon"><HistoryIcon size={28} /></div>
              <h3 className="empty-card-title">{emptyTitle}</h3>
              <p className="empty-card-desc">{emptyDesc}</p>
            </div>
          </div>
        ) : (
          <div className="grid portrait lib-grid" data-zone="grid">
            {continueItems.map((entry) => {
              const poster = entry.poster || posterUrl(entry.item, 'medium') || posterUrl(entry.episodeItem, 'medium')
              return (
                <div className="lib-tile" key={entry.key}>
                  <button
                    type="button"
                    className="lib-tile-btn"
                    onClick={() => onResume?.(entry)}
                    aria-label={`${t('misc.continueWatching')}: ${entry.name}`}
                  >
                    <div className="card-img">
                      {poster ? <img src={poster} alt="" loading="lazy" /> : <div className="ph">{(entry.name || '?')[0]}</div>}
                      <div className="card-overlay">
                        <div className="card-overlay-top" />
                        <div className="card-overlay-bottom">
                          <div className="card-title">{entry.name}</div>
                          <div className="card-meta">
                            {entry.type === 'series' && entry.season
                              ? `${t('item.season')} ${entry.season} · ${t('item.episode')} ${entry.episode}`
                              : `${Math.round(entry.progress * 100)}%`}
                          </div>
                        </div>
                      </div>
                      <span className="card-progress" aria-hidden="true"><span style={{ width: `${Math.round(entry.progress * 100)}%` }} /></span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="lib-tile-remove"
                    aria-label={`${t('common.delete')} ${entry.name}`}
                    onClick={() => removeEntry(entry.key)}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )
      ) : items.length === 0 ? (
        <div className="empty-lib">
          <div className="empty-card">
            <div className="empty-card-icon">{emptyIcon}</div>
            <h3 className="empty-card-title">{emptyTitle}</h3>
            <p className="empty-card-desc">{emptyDesc}</p>
          </div>
        </div>
      ) : (
        <div className="grid portrait" data-zone="grid">
          {items.map((entry, index) => {
            const item: GeilItem = {
              id: entry.id,
              type: entry.type as GeilItem['type'],
              name: entry.name,
              images: { poster: entry.poster },
            }
            return <PosterCard key={`${entry.id}-${index}`} item={item} addonId={entry.addonId} index={index} />
          })}
        </div>
      )}

      {tab === 'history' && history.length ? (
        <div style={{ padding: '20px 0' }}>
          {!confirmClear ? (
            <button className="btn btn-primary" onClick={() => setConfirmClear(true)}><TrashIcon size={16} /> {t('library.clearHistory')}</button>
          ) : (
            <div className="history-clear-confirm" role="alertdialog" aria-label={t('library.clearHistory')}>
              <span>{t('library.clearHistory')}?</span>
              <button className="btn btn-primary" onClick={() => { clearHistory(); setHistory([]); setConfirmClear(false) }}>{t('common.yes')}</button>
              <button className="btn" onClick={() => setConfirmClear(false)}>{t('common.cancel')}</button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
