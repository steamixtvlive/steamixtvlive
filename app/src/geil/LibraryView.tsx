import { useEffect, useState } from 'react'
import type { GeilItem } from './types'
import { getFavorites, getHistory, clearHistory } from './storage'
import { PosterCard } from './Cards'
import { HeartIcon, HistoryIcon, TrashIcon } from './icons'

export default function LibraryView() {
  const [tab, setTab] = useState<'favorites' | 'history'>('favorites')
  const [favorites, setFavorites] = useState(getFavorites())
  const [history, setHistory] = useState(getHistory())
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    const update = () => {
      setFavorites(getFavorites())
      setHistory(getHistory())
    }
    window.addEventListener('notflix-geil-storage', update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener('notflix-geil-storage', update)
      window.removeEventListener('storage', update)
    }
  }, [])

  const items = tab === 'favorites' ? favorites : history


  return (
    <div className="catalog-view">
      <div className="catalog-head">
        <h1>Kitaplık</h1>
      </div>
      <div className="tab-bar" data-zone="h">
        <div className="ep-pills">
          <button className={`ep-pill ${tab === 'favorites' ? 'active' : ''}`} onClick={() => { setConfirmClear(false); setTab('favorites') }}>
            Favoriler {favorites.length ? <span className="ep-pill-count">{favorites.length}</span> : null}
          </button>
          <button className={`ep-pill ${tab === 'history' ? 'active' : ''}`} onClick={() => { setConfirmClear(false); setTab('history') }}>
            Geçmiş {history.length ? <span className="ep-pill-count">{history.length}</span> : null}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-lib">
          <div className="empty-card">
            <div className="empty-card-icon">{tab === 'favorites' ? <HeartIcon size={28} /> : <HistoryIcon size={28} />}</div>
            <h3 className="empty-card-title">{tab === 'favorites' ? 'Favori içerik yok' : 'Geçmiş boş'}</h3>
            <p className="empty-card-desc">
              {tab === 'favorites'
                ? 'Beğendiğiniz film ve dizileri favorilere ekleyin.'
                : 'İzlediğiniz içerikler burada görünür.'}
            </p>
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
            <button className="btn btn-primary" onClick={() => setConfirmClear(true)}><TrashIcon size={16} /> Geçmişi temizle</button>
          ) : (
            <div className="history-clear-confirm" role="alertdialog" aria-label="Geçmişi temizleme onayı">
              <span>İzleme geçmişinin tamamı silinsin mi?</span>
              <button className="btn btn-primary" onClick={() => { clearHistory(); setHistory([]); setConfirmClear(false) }}>Evet, temizle</button>
              <button className="btn" onClick={() => setConfirmClear(false)}>Vazgeç</button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
