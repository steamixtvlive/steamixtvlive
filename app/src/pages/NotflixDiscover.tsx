import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ChevronRight, Loader2, Play, Search } from 'lucide-react'
import { fetchVodDetail, fetchVodList, preloadVodHome, type VodCategory, type VodHome, type VodItem } from '@/lib/vod'

const PAGE_SIZE = 48

export default function NotflixDiscover() {
  const navigate = useNavigate()
  const [home, setHome] = useState<VodHome | null>(null)
  const [heroIndex, setHeroIndex] = useState(0)
  const [type, setType] = useState<'all' | 'movie' | 'series'>('all')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<VodCategory | null>(null)
  const [categoryItems, setCategoryItems] = useState<VodItem[]>([])
  const [categoryPage, setCategoryPage] = useState(1)
  const [categoryHasMore, setCategoryHasMore] = useState(true)
  const [categoryLoading, setCategoryLoading] = useState(false)
  const [searchItems, setSearchItems] = useState<VodItem[]>([])
  const [searchPage, setSearchPage] = useState(1)
  const [searchTotal, setSearchTotal] = useState(0)
  const [searchLoading, setSearchLoading] = useState(false)
  const [detail, setDetail] = useState<VodItem | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [listError, setListError] = useState('')
  const [detailError, setDetailError] = useState('')
  const detailCache = useRef(new Map<string, VodItem>())
  const observerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    preloadVodHome().then((data) => { if (!cancelled) setHome(data) }).catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'VOD kataloğu yüklenemedi')
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const now = new Date()
    const day = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`
    let savedDay = ''
    try { savedDay = localStorage.getItem('notflix_hero_day') || '' } catch { /* optional seed */ }
    if (savedDay !== day) { try { localStorage.setItem('notflix_hero_day', day) } catch { /* optional seed */ } }
    const timer = window.setInterval(() => {
      setHeroIndex((index) => {
        const next = index + 1
        try { localStorage.setItem('notflix_hero_index', String(next)) } catch { /* optional */ }
        return next
      })
    }, 3500)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (category || query.trim().length < 2) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearchLoading(true)
      setListError('')
      fetchVodList({ type, category: 'all', query, page: 1, limit: PAGE_SIZE, signal: controller.signal })
        .then((result) => { setSearchItems(result.items); setSearchPage(1); setSearchTotal(result.total) })
        .catch((searchError: unknown) => { if (!controller.signal.aborted) setListError(searchError instanceof Error ? searchError.message : 'Arama başarısız') })
        .finally(() => { if (!controller.signal.aborted) setSearchLoading(false) })
    }, 280)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query, type, category])

  const loadCategory = useCallback(async (target: VodCategory, page: number, append: boolean) => {
    setCategoryLoading(true)
    setListError('')
    try {
      const result = await fetchVodList({ type: target.type, category: target.id, page, limit: PAGE_SIZE })
      setCategoryItems((items) => append ? [...items, ...result.items] : result.items)
      setCategoryPage(result.page)
      setCategoryHasMore(result.hasMore)
    } catch (loadError) {
      setListError(loadError instanceof Error ? loadError.message : 'Kategori yüklenemedi')
    } finally {
      setCategoryLoading(false)
    }
  }, [])

  useEffect(() => {
    const node = observerRef.current
    if (!node || categoryLoading || (category ? !categoryHasMore : query.trim().length < 2 || searchLoading || searchPage * PAGE_SIZE >= searchTotal)) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        if (category) void loadCategory(category, categoryPage + 1, true)
        else if (query.trim().length >= 2 && !searchLoading && searchPage * PAGE_SIZE < searchTotal) {
          void loadSearchPage(query, type, searchPage + 1)
        }
      }
    }, { rootMargin: '500px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [category, categoryHasMore, categoryLoading, categoryPage, loadCategory, query, searchLoading, searchPage, searchTotal, type])

  async function loadSearchPage(search: string, contentType: 'all' | 'movie' | 'series', page: number) {
    setSearchLoading(true)
    setListError('')
    try {
      const result = await fetchVodList({ type: contentType, category: 'all', query: search, page, limit: PAGE_SIZE })
      setSearchItems((items) => page === 1 ? result.items : [...items, ...result.items])
      setSearchPage(result.page)
      setSearchTotal(result.total)
    } catch (loadError) {
      setListError(loadError instanceof Error ? loadError.message : 'Arama devam ettirilemedi')
    } finally {
      setSearchLoading(false)
    }
  }

  async function openDetail(item: VodItem) {
    setDetail(item)
    setDetailError('')
    setDetailLoading(true)
    const key = `${item.type}:${item.id}`
    try {
      const cached = detailCache.current.get(key)
      const loaded = cached || await fetchVodDetail(item.type, item.id)
      detailCache.current.set(key, loaded)
      setDetail(loaded)
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : 'İçerik ayrıntısı yüklenemedi')
    } finally {
      setDetailLoading(false)
    }
  }

  function chooseCategory(next: VodCategory) {
    setCategory(next)
    setCategoryItems([])
    setCategoryPage(0)
    setCategoryHasMore(true)
    setQuery('')
    void loadCategory(next, 1, false)
  }

  function clearCategory() {
    setCategory(null)
    setCategoryItems([])
    setCategoryPage(1)
    setCategoryHasMore(true)
  }

  const hero = home?.hero || []
  const preferredLocalSeries = hero.filter((item) => item.type === 'series' && /uzak şehir|mehmed|fetih|kızılcık|şerbet|trt|show|atv|now/i.test(item.name))
  const heroPool = preferredLocalSeries.length >= 4 ? [...preferredLocalSeries, ...hero.filter((item) => !preferredLocalSeries.includes(item))] : hero
  const currentHero = heroPool.length ? heroPool[heroIndex % heroPool.length] : null
  const isBrowsing = Boolean(category || query.trim().length >= 2)
  const visibleItems = category ? categoryItems : query.trim().length >= 2 ? searchItems : []

  function play(item: VodItem) {
    if (!item.stream) {
      navigate(`/watch/${item.type}/${item.id}/${encodeURIComponent(item.name.toLowerCase().replace(/\s+/g, '-'))}`)
      return
    }
    navigate(`/notflix/watch/${item.type}/${item.id}`, { state: { item } })
  }

  if (detail) {
    return (
      <main className="nf-vod-detail">
        <button className="nf-vod-back" type="button" onClick={() => setDetail(null)}><ArrowLeft size={17} /> Keşfet’e dön</button>
        <section className="nf-vod-detail__hero" style={{ backgroundImage: detail.backdrop ? `linear-gradient(90deg, #08090df2, #08090d55), linear-gradient(0deg, #08090d, transparent), url("${detail.backdrop}")` : undefined }}>
          <div className="nf-vod-detail__poster"><img src={detail.poster} alt={detail.name} /></div>
          <div className="nf-vod-detail__copy">
            <span className="nf-vod-kicker">{detail.type === 'movie' ? 'FİLM' : 'DİZİ'} · {detail.category}</span>
            <h1>{detail.name}</h1>
            <div className="nf-vod-detail__meta">
              {detail.year > 0 && <span>{detail.year}</span>}
              {detail.rating && <span>★ {detail.rating}</span>}
              {detail.country && <span>{detail.country}</span>}
              {detail.duration && <span>{detail.duration}</span>}
            </div>
            {detail.genre && detail.genre.length > 0 && <p className="nf-vod-detail__genres">{detail.genre.join(' · ')}</p>}
            {detail.plot && <p className="nf-vod-detail__plot">{detail.plot}</p>}
            {detail.director && <p className="nf-vod-detail__credits"><b>Yönetmen</b> {detail.director}</p>}
            {detail.cast && <p className="nf-vod-detail__credits"><b>Oyuncular</b> {detail.cast}</p>}
            <button type="button" className="nf-vod-play" onClick={() => play(detail)}><Play size={18} fill="currentColor" /> {detail.type === 'series' ? 'İlk bölümü izle' : 'İzle'}</button>
          </div>
        </section>
        {detailLoading && <div className="nf-vod-inline-status"><Loader2 className="nf-spin" size={18} /> Ayrıntılar ve öneriler alınıyor…</div>}
        {detailError && <p className="nf-vod-error" role="alert">{detailError}</p>}
        {detail.type === 'series' && detail.seasons?.map((season) => (
          <section className="nf-vod-season" key={season.number}>
            <h2>Sezon {season.number}</h2>
            {season.episodes.map((episode) => <button key={episode.id} type="button" onClick={() => play({ ...detail, stream: episode.stream, subtitles: episode.subtitles, name: `${detail.name} · ${episode.title}` })}><Play size={15} /> {episode.number}. {episode.title}</button>)}
          </section>
        ))}
        {(detail as VodItem & { similar?: VodItem[] }).similar?.length ? <VodShelf title="Benzer içerikler" items={(detail as VodItem & { similar?: VodItem[] }).similar || []} onOpen={(item) => void openDetail(item)} /> : null}
      </main>
    )
  }

  return (
    <main className="nf-vod-discover">
      {error ? <div className="nf-vod-error" role="alert"><AlertTriangle size={20} /> {error}<button type="button" onClick={() => { setError(''); void preloadVodHome().then(setHome).catch((e: unknown) => setError(e instanceof Error ? e.message : 'VOD yüklenemedi')) }}>Yeniden dene</button></div> : !home ? <div className="nf-vod-loading"><Loader2 className="nf-spin" size={28} /> VOD kataloğu hazırlanıyor…</div> : <>
        <section className="nf-vod-showcase" aria-label="Öne çıkan film ve diziler">
          {currentHero && <>
            {currentHero.backdrop && <img className="nf-vod-showcase__backdrop" src={currentHero.backdrop} alt="" />}
            <div className="nf-vod-showcase__shade" />
            <div className="nf-vod-showcase__content">
              <span className="nf-vod-kicker">{currentHero.type === 'movie' ? 'ÖNE ÇIKAN FİLM' : 'ÖNE ÇIKAN DİZİ'} · {currentHero.year || 'YENİ'}</span>
              <h1>{currentHero.name}</h1>
              <p>{currentHero.plot || `${currentHero.category} kategorisinden seçilmiş içerik.`}</p>
              <div className="nf-vod-showcase__actions"><button type="button" className="nf-vod-play" onClick={() => void openDetail(currentHero)}><Play size={17} fill="currentColor" /> {currentHero.type === 'series' ? 'Son Bölüm İzle' : 'Ayrıntılar'}</button><button type="button" className="nf-vod-secondary" onClick={() => void openDetail(currentHero)}>Daha fazla bilgi</button></div>
            </div>
            <div className="nf-vod-showcase__poster"><img src={currentHero.poster} alt={currentHero.name} /></div>
            {currentHero.isNew && <span className="nf-vod-showcase__new">YENİ</span>}
          </>}
          {!currentHero && <div className="nf-vod-showcase__fallback"><span className="nf-vod-kicker">NOTFLİX · VOD</span><h1>Filmler ve diziler</h1><p>Kataloğu keşfetmeye başlayın.</p></div>}
        </section>

        <section className="nf-vod-toolbar">
          <div className="nf-vod-tabs" role="tablist" aria-label="İçerik türü">
            {(['all', 'movie', 'series'] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={type === value} className={type === value ? 'is-active' : ''} onClick={() => { setType(value); setCategory(null); setCategoryItems([]); setCategoryHasMore(true); setSearchItems([]); setSearchPage(1); setSearchTotal(0) }}>{value === 'all' ? 'Tümü' : value === 'movie' ? 'Filmler' : 'Diziler'}</button>)}
          </div>
          <label className="nf-vod-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setCategory(null); setCategoryItems([]); setCategoryHasMore(true) }} placeholder="Film veya dizi ara…" aria-label="Film veya dizi ara" /><span>{query.trim().length >= 2 ? `${searchTotal.toLocaleString('tr-TR')} sonuç` : ''}</span></label>
        </section>
        <div className="nf-vod-category-pills" aria-label="VOD kategorileri">{home.categories.slice(0, 36).map((entry) => <button key={`${entry.type}:${entry.id}`} type="button" onClick={() => chooseCategory(entry)}>{entry.label} <span>{entry.count}</span></button>)}</div>

        {isBrowsing ? (
          <section className="nf-vod-browse">
            <div className="nf-vod-section-title"><div><span className="nf-vod-kicker">{category ? category.name : 'ARAMA SONUÇLARI'}</span><h2>{category ? `${category.count.toLocaleString('tr-TR')} içerik` : query}</h2></div><button type="button" onClick={clearCategory}>Tüm kategoriler</button></div>
            {listError && <p className="nf-vod-error" role="alert">{listError}</p>}
            <PosterGrid items={visibleItems} onOpen={(item) => void openDetail(item)} />
            {(categoryLoading || searchLoading) && <div className="nf-vod-inline-status"><Loader2 className="nf-spin" size={18} /> İçerikler yükleniyor…</div>}
            <div ref={observerRef} className="nf-vod-sentinel" aria-hidden="true" />
            {category && categoryHasMore && <button type="button" className="nf-vod-load-more" disabled={categoryLoading} onClick={() => void loadCategory(category, categoryPage + 1, true)}>Tümünü gör · sonraki {PAGE_SIZE}</button>}
            {!category && query.trim().length >= 2 && searchPage * PAGE_SIZE < searchTotal && <button type="button" className="nf-vod-load-more" disabled={searchLoading} onClick={() => void loadSearchPage(query, type, searchPage + 1)}>Sonuçları yükle</button>}
          </section>
        ) : <div className="nf-vod-home-rows">{home.rows.filter((row) => type === 'all' || row.type === type).map((row) => <VodShelf key={row.key} title={row.title} count={row.count} items={row.items} onOpen={(item) => void openDetail(item)} onSeeAll={() => { const target: VodCategory = { id: row.categoryId, name: row.title, type: row.type, count: row.count }; chooseCategory(target) }} />)}</div>}
      </>}
    </main>
  )
}

function PosterGrid({ items, onOpen }: { items: VodItem[]; onOpen: (item: VodItem) => void }) {
  return <div className="nf-vod-grid">{items.map((item) => <PosterCard key={`${item.type}:${item.id}`} item={item} onOpen={onOpen} />)}</div>
}

function PosterCard({ item, onOpen }: { item: VodItem; onOpen: (item: VodItem) => void }) {
  return <button type="button" className="nf-vod-card" onClick={() => onOpen(item)} aria-label={`${item.name}${item.year ? ` (${item.year})` : ''}`}><span className="nf-vod-card__image"><img src={item.poster} alt="" loading="lazy" decoding="async" />{item.isNew && <span className="nf-vod-card__new">YENİ</span>}<span className="nf-vod-card__play"><Play size={18} fill="currentColor" /></span><span className="nf-vod-card__type">{item.type === 'movie' ? 'FİLM' : 'DİZİ'}</span></span><span className="nf-vod-card__name">{item.name}</span><span className="nf-vod-card__year">{item.year || item.category}</span></button>
}

function VodShelf({ title, count, items, onOpen, onSeeAll }: { title: string; count?: number; items: VodItem[]; onOpen: (item: VodItem) => void; onSeeAll?: () => void }) {
  if (!items.length) return null
  return <section className="nf-vod-shelf"><div className="nf-vod-section-title"><div><span className="nf-vod-kicker">{count !== undefined ? `${count.toLocaleString('tr-TR')} İÇERİK` : 'ÖNERİLER'}</span><h2>{title}</h2></div>{onSeeAll && <button type="button" onClick={onSeeAll}>Tümünü gör <ChevronRight size={14} /></button>}</div><div className="nf-vod-shelf__track">{items.map((item) => <PosterCard key={`${item.type}:${item.id}`} item={item} onOpen={onOpen} />)}</div></section>
}
