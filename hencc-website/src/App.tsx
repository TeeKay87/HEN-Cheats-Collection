import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import './App.css'
import { AdSenseSlot } from './components/AdSenseSlot'
import { DetailsPanel } from './components/DetailsPanel'
import { GameCard } from './components/GameCard'
import { Icon } from './components/Icon'
import { ADSENSE_CATALOG_INTERVAL, ADSENSE_ENABLED, buildCoverImageUrl, COVER_DETAIL_SIZE, COVER_FALLBACK_URL } from './config'
import { catalogSearchScore, compareVersions, makeGamePath, normalizeSearch, parseGamePath, parseHash, platformFor } from './lib/catalog'
import type { AddedResponse, CatalogEntry, CatalogResponse, CoversResponse, Platform, SiteStatsResponse } from './types/catalog'

type ViewMode = 'all' | 'favorites'
type SortMode = 'featured' | 'title' | 'newest' | 'versions'
type PlatformFilter = 'All' | Platform

type AppData = {
  catalog: CatalogResponse
  covers: CoversResponse
  added: AddedResponse
  stats: SiteStatsResponse
}

const baseUrl = import.meta.env.BASE_URL
const PAGE_SIZE = 48
const FAVORITES_KEY = 'hencc:favorites:v2'

function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<ViewMode>('all')
  const [platform, setPlatform] = useState<PlatformFilter>('All')
  const [format, setFormat] = useState('All')
  const [sort, setSort] = useState<SortMode>('featured')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState<{ entry: CatalogEntry; version?: string } | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]') as string[]
      return new Set(saved)
    } catch {
      return new Set()
    }
  })
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetch(`${baseUrl}data/catalog.json`, { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error(`catalog ${response.status}`)
        return response.json() as Promise<CatalogResponse>
      }),
      fetch(`${baseUrl}data/covers.json`, { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error(`covers ${response.status}`)
        return response.json() as Promise<CoversResponse>
      }),
      fetch(`${baseUrl}data/added.json`, { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error(`added ${response.status}`)
        return response.json() as Promise<AddedResponse>
      }),
      fetch(`${baseUrl}data/stats.json`, { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error(`stats ${response.status}`)
        return response.json() as Promise<SiteStatsResponse>
      }),
    ])
      .then(([catalog, covers, added, stats]) => setData({ catalog, covers, added, stats }))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setLoadError('The catalog data could not be loaded.')
      })
    return () => controller.abort()
  }, [])

  const latestAddedByGame = useMemo(() => {
    if (!data) return new Map<string, string>()
    const result = new Map<string, string>()
    for (const [key, date] of Object.entries(data.added)) {
      const id = key.split('-')[0]
      const existing = result.get(id)
      if (!existing || date > existing) result.set(id, date)
    }
    return result
  }, [data])

  const visibleEntries = useMemo(() => {
    if (!data) return []
    const normalizedQuery = normalizeSearch(query)
    const scoredEntries = data.catalog.entries.flatMap((entry) => {
      if (entry.hidden) return []
      if (view === 'favorites' && !favorites.has(entry.id)) return []
      if (platform !== 'All' && platformFor(entry.id) !== platform) return []
      if (format !== 'All' && !entry.versions.some((version) => version.formats.includes(format))) return []

      const searchScore = normalizedQuery ? catalogSearchScore(entry, query) : 0
      if (normalizedQuery && searchScore <= 0) return []

      return [{ entry, searchScore }]
    })

    const compareBySelectedSort = (a: CatalogEntry, b: CatalogEntry) => {
      if (sort === 'title') return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
      if (sort === 'newest') {
        const aa = latestAddedByGame.get(a.id) ?? ''
        const bb = latestAddedByGame.get(b.id) ?? ''
        return bb.localeCompare(aa) || a.title.localeCompare(b.title)
      }
      if (sort === 'versions') return b.versions.length - a.versions.length || a.title.localeCompare(b.title)
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      const aa = latestAddedByGame.get(a.id) ?? ''
      const bb = latestAddedByGame.get(b.id) ?? ''
      return bb.localeCompare(aa) || a.title.localeCompare(b.title)
    }

    scoredEntries.sort((a, b) => {
      // While searching, relevance always comes first. The selected catalog
      // sort remains the tie-breaker for equally relevant matches.
      if (normalizedQuery && a.searchScore !== b.searchScore) {
        return b.searchScore - a.searchScore
      }
      return compareBySelectedSort(a.entry, b.entry)
    })

    return scoredEntries.map(({ entry }) => entry)
  }, [data, favorites, format, latestAddedByGame, platform, query, sort, view])

  useEffect(() => setVisibleCount(PAGE_SIZE), [query, view, platform, format, sort])

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current
    if (!sentinel || visibleCount >= visibleEntries.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => Math.min(count + PAGE_SIZE, visibleEntries.length))
        }
      },
      { rootMargin: '800px 0px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [visibleCount, visibleEntries.length])

  const findEntry = useCallback((id: string) => data?.catalog.entries.find((entry) => entry.id === id), [data])

  const syncFromLocation = useCallback(() => {
    if (!data) return

    const route = parseGamePath(window.location.pathname, baseUrl)
    const legacyHash = route ? null : parseHash(window.location.hash)
    const parsed = route ?? legacyHash

    if (!parsed) {
      setSelected(null)
      return
    }

    const entry = findEntry(parsed.id)
    if (!entry || entry.hidden) {
      setSelected(null)
      return
    }

    const requestedVersion = parsed.version && entry.versions.some((version) => version.version === parsed.version)
      ? parsed.version
      : [...entry.versions].sort((a, b) => compareVersions(b.version, a.version))[0]?.version

    setSelected({ entry, version: requestedVersion })

    if (legacyHash && requestedVersion) {
      history.replaceState('', document.title, makeGamePath(entry.id, requestedVersion, baseUrl))
    }
  }, [data, findEntry])

  useEffect(() => {
    syncFromLocation()
    window.addEventListener('popstate', syncFromLocation)
    window.addEventListener('hashchange', syncFromLocation)
    return () => {
      window.removeEventListener('popstate', syncFromLocation)
      window.removeEventListener('hashchange', syncFromLocation)
    }
  }, [syncFromLocation])

  useEffect(() => {
    const defaultTitle = 'HEN Cheats Collection'
    const defaultDescription = 'The largest collection of PlayStation 4 and PlayStation 5 cheats. Play Your Way.'

    const setMeta = (selector: string, attribute: 'name' | 'property', key: string, content: string) => {
      let element = document.head.querySelector<HTMLMetaElement>(selector)
      if (!element) {
        element = document.createElement('meta')
        element.setAttribute(attribute, key)
        document.head.appendChild(element)
      }
      element.content = content
    }

    const removeMeta = (selector: string) => document.head.querySelector(selector)?.remove()

    if (!selected) {
      document.title = defaultTitle
      setMeta('meta[name="description"]', 'name', 'description', defaultDescription)
      setMeta('meta[property="og:title"]', 'property', 'og:title', defaultTitle)
      setMeta('meta[property="og:description"]', 'property', 'og:description', defaultDescription)
      setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', defaultTitle)
      setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', defaultDescription)
      removeMeta('meta[property="og:image"]')
      removeMeta('meta[name="twitter:image"]')
      return
    }

    const versionLabel = selected.version ? ` v${selected.version}` : ''
    const pageTitle = `${selected.entry.title}${versionLabel} | HEN Cheats Collection`
    const description = `${platformFor(selected.entry.id)} cheats for ${selected.entry.title}${selected.version ? `, version ${selected.version}` : ''}. HEN Cheats Collection.`
    const cover = buildCoverImageUrl(coverFor(selected.entry), COVER_DETAIL_SIZE)

    document.title = pageTitle
    setMeta('meta[name="description"]', 'name', 'description', description)
    setMeta('meta[property="og:title"]', 'property', 'og:title', pageTitle)
    setMeta('meta[property="og:description"]', 'property', 'og:description', description)
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', pageTitle)
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description)

    if (/^https?:\/\//i.test(cover)) {
      setMeta('meta[property="og:image"]', 'property', 'og:image', cover)
      setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', cover)
    } else {
      removeMeta('meta[property="og:image"]')
      removeMeta('meta[name="twitter:image"]')
    }
  }, [selected, data])

  const openEntry = (entry: CatalogEntry) => {
    const version = [...entry.versions].sort((a, b) => compareVersions(b.version, a.version))[0]?.version
    if (!version) return
    setSelected({ entry, version })
    history.pushState('', document.title, makeGamePath(entry.id, version, baseUrl))
  }

  const closeDetails = useCallback(() => {
    setSelected(null)
    history.pushState('', document.title, baseUrl)
  }, [])

  const selectVersion = (version: string) => {
    if (!selected) return
    setSelected({ ...selected, version })
    history.replaceState('', document.title, makeGamePath(selected.entry.id, version, baseUrl))
  }

  const toggleFavorite = (id: string) => {
    setFavorites((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(next)))
      return next
    })
  }

  const coverFor = (entry: CatalogEntry) => data?.covers.titles[entry.title.trim().toLowerCase()] ?? COVER_FALLBACK_URL

  const catalogStats = useMemo(() => {
    if (!data) return null
    const entries = data.catalog.entries.filter((entry) => !entry.hidden)
    const versionCount = entries.reduce((sum, entry) => sum + entry.versions.length, 0)
    return { games: entries.length, versions: versionCount, files: data.stats.filesWithCheats }
  }, [data])

  const activeFilterCount = (platform !== 'All' ? 1 : 0) + (format !== 'All' ? 1 : 0)
  const hasFilters = Boolean(query) || view === 'favorites' || activeFilterCount > 0

  const clearFilters = () => {
    setQuery('')
    setView('all')
    setPlatform('All')
    setFormat('All')
    setSort('featured')
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <button className="brand" type="button" onClick={clearFilters} aria-label="HEN Cheats Collection home">
            <span className="brand-mark">H</span>
            <span className="brand-copy"><strong>HEN Cheats</strong><small>Collection</small></span>
          </button>
          <nav className="desktop-nav" aria-label="Primary">
            <button className={view === 'all' ? 'active' : ''} type="button" onClick={() => setView('all')}>Browse</button>
            <button className={view === 'favorites' ? 'active' : ''} type="button" onClick={() => setView('favorites')}><Icon name="heart" /> Favorites <span className="nav-count">{favorites.size}</span></button>
          </nav>
          <a className="github-link" href="https://github.com/TeeKay87/HEN-Cheats-Collection" target="_blank" rel="noreferrer"><Icon name="github" /><span>GitHub</span></a>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-glow hero-glow-one" />
          <div className="hero-glow hero-glow-two" />
          <div className="hero-inner">
            <h1>HEN Cheats Collection</h1>
            <p>The largest collection of PlayStation 4 and PlayStation 5 cheats. Play Your Way.</p>
            <div className="hero-search-wrap">
              <Icon name="search" />
              <input
                type="search"
                value={query}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
                placeholder="Search by game, Title ID, creator…"
                aria-label="Search catalog"
              />
              {query && <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Clear search"><Icon name="x" /></button>}
              <kbd>/</kbd>
            </div>
            {catalogStats && (
              <div className="hero-stats">
                <div><strong>{catalogStats.games.toLocaleString()}</strong><span>Games</span></div>
                <span className="stat-divider" />
                <div><strong>{catalogStats.versions.toLocaleString()}</strong><span>Versions</span></div>
                <span className="stat-divider" />
                <div><strong>{catalogStats.files.toLocaleString()}</strong><span>Files</span></div>
              </div>
            )}
          </div>
        </section>

        <section className="catalog-section">
          <div className="catalog-toolbar">
            <div className="view-switcher">
              <button type="button" className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}>All games</button>
              <button type="button" className={view === 'favorites' ? 'active' : ''} onClick={() => setView('favorites')}><Icon name="heart" /> Favorites <span>{favorites.size}</span></button>
            </div>
            <div className="toolbar-right">
              <button className={`mobile-filter-button ${activeFilterCount ? 'active' : ''}`} type="button" onClick={() => setMobileFiltersOpen((current) => !current)}>
                <Icon name="filter" /> Filters {activeFilterCount ? <span>{activeFilterCount}</span> : null}
              </button>
              <label className="select-wrap desktop-filter">
                <span>Platform</span>
                <select value={platform} onChange={(event: ChangeEvent<HTMLSelectElement>) => setPlatform(event.target.value as PlatformFilter)}>
                  <option>All</option><option>PS4</option><option>PS5</option><option>Other</option>
                </select>
                <Icon name="chevronDown" />
              </label>
              <label className="select-wrap desktop-filter">
                <span>Format</span>
                <select value={format} onChange={(event: ChangeEvent<HTMLSelectElement>) => setFormat(event.target.value)}>
                  <option>All</option><option value="json">JSON</option><option value="mc4">MC4</option><option value="shn">SHN</option>
                </select>
                <Icon name="chevronDown" />
              </label>
              <label className="select-wrap sort-select">
                <span>Sort</span>
                <select value={sort} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSort(event.target.value as SortMode)}>
                  <option value="featured">Featured</option>
                  <option value="newest">Recently added</option>
                  <option value="title">Title A–Z</option>
                  <option value="versions">Most versions</option>
                </select>
                <Icon name="chevronDown" />
              </label>
            </div>
          </div>

          {mobileFiltersOpen && (
            <div className="mobile-filter-panel">
              <div className="mobile-filter-group"><span>Platform</span><div className="chip-row">{(['All', 'PS4', 'PS5', 'Other'] as PlatformFilter[]).map((value) => <button key={value} type="button" className={platform === value ? 'active' : ''} onClick={() => setPlatform(value)}>{value}</button>)}</div></div>
              <div className="mobile-filter-group"><span>Format</span><div className="chip-row">{['All', 'json', 'mc4', 'shn'].map((value) => <button key={value} type="button" className={format === value ? 'active' : ''} onClick={() => setFormat(value)}>{value === 'All' ? value : value.toUpperCase()}</button>)}</div></div>
            </div>
          )}

          <div className="catalog-heading-row">
            <div>
              {(view === 'favorites' || query) && <h2>{view === 'favorites' ? 'Your favorites' : 'Search results'}</h2>}
              <p>{data ? `${visibleEntries.length.toLocaleString()} ${visibleEntries.length === 1 ? 'game' : 'games'} found` : 'Loading catalog…'}</p>
            </div>
            {hasFilters && <button className="clear-all" type="button" onClick={clearFilters}>Clear filters</button>}
          </div>

          {loadError && <div className="page-state error-state"><Icon name="database" /><h2>Catalog unavailable</h2><p>{loadError}</p></div>}
          {!data && !loadError && <div className="cards-grid skeleton-grid">{Array.from({ length: 12 }, (_, index) => <div className="game-card skeleton-card" key={index}><div className="skeleton-cover" /><div className="game-card-body"><span /><h2 /><p /></div></div>)}</div>}

          {data && visibleEntries.length > 0 && (
            <>
              <div className="cards-grid">
                {visibleEntries.slice(0, visibleCount).flatMap((entry, index) => {
                  const gameNumber = index + 1
                  const cards = [
                    <GameCard
                      key={entry.id}
                      entry={entry}
                      coverUrl={coverFor(entry)}
                      favorite={favorites.has(entry.id)}
                      latestAdded={latestAddedByGame.get(entry.id)}
                      onOpen={openEntry}
                      onToggleFavorite={toggleFavorite}
                    />,
                  ]

                  if (
                    ADSENSE_ENABLED
                    && gameNumber % ADSENSE_CATALOG_INTERVAL === 0
                    && gameNumber < visibleEntries.length
                  ) {
                    cards.push(<AdSenseSlot key={`catalog-ad-${gameNumber}`} />)
                  }

                  return cards
                })}
              </div>
              {visibleCount < visibleEntries.length && (
                <div ref={loadMoreSentinelRef} className="catalog-load-sentinel" aria-hidden="true" />
              )}
            </>
          )}

          {data && visibleEntries.length === 0 && (
            <div className="page-state empty-state">
              <div className="empty-icon"><Icon name={view === 'favorites' ? 'heart' : 'search'} /></div>
              <h2>{view === 'favorites' && favorites.size === 0 ? 'No favorites yet' : 'No games found'}</h2>
              <p>{view === 'favorites' && favorites.size === 0 ? 'Save games with the heart button and they will appear here.' : 'Try a different title, Title ID, creator or filter combination.'}</p>
              {hasFilters && <button className="button secondary" type="button" onClick={clearFilters}>Reset filters</button>}
            </div>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand"><span className="brand-mark small">H</span><div><strong>HEN Cheats Collection</strong><p>A community-maintained PlayStation cheat archive.</p></div></div>
          <div className="footer-meta">
            {data && <span>Data generated {new Date(data.catalog.generatedUtc).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })}</span>}
            <a href="https://github.com/TeeKay87/HEN-Cheats-Collection" target="_blank" rel="noreferrer"><Icon name="github" /> GitHub <Icon name="external" /></a>
          </div>
        </div>
      </footer>

      {selected && data && (
        <DetailsPanel
          entry={selected.entry}
          coverUrl={coverFor(selected.entry)}
          selectedVersion={selected.version}
          addedDates={data.added}
          favorite={favorites.has(selected.entry.id)}
          onClose={closeDetails}
          onSelectVersion={selectVersion}
          onToggleFavorite={toggleFavorite}
        />
      )}
    </div>
  )
}

export default App
