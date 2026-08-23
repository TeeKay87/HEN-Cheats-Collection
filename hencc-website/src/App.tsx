import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { AdSenseSlot } from './components/AdSenseSlot'
import { GameCard } from './components/GameCard'
import { SiteFooter } from './components/SiteFooter'
import { Icon } from './components/Icon'
import { ADSENSE_CATALOG_INTERVAL, ADSENSE_ENABLED, buildCoverImageUrl, COVER_DETAIL_SIZE, COVER_FALLBACK_URL, PUBLIC_SITE_URL } from './config'
import { catalogSearchScore, compareVersions, isHidden, makeGamePath, normalizeSearch, parseGamePath, parseHash, platformFor } from './lib/catalog'
import { fetchJsonCached, fetchOptionalJsonCached } from './lib/dataClient'
import { HOME_DESCRIPTION, HOME_SOCIAL_DESCRIPTION, HOME_SOCIAL_IMAGE, HOME_SOCIAL_IMAGE_ALT, HOME_SOCIAL_TITLE, HOME_TITLE, platformNameForSocial, removeMeta, setMeta, syncPageUrls, syncRobotsMeta, syncStructuredData } from './lib/seo'
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
const SEARCH_PARAM = 'q'
const SEARCH_URL_DEBOUNCE_MS = 1000
const searchQueryFromLocation = () => {
  // Game URLs intentionally stay clean. The catalog query belongs to the
  // previous history entry and is restored when the user navigates back.
  if (parseGamePath(window.location.pathname, baseUrl)) return ''
  return new URLSearchParams(window.location.search).get(SEARCH_PARAM) ?? ''
}

const makeSearchPath = (query: string) => {
  const params = new URLSearchParams()
  const trimmedQuery = query.trim()
  if (trimmedQuery) params.set(SEARCH_PARAM, trimmedQuery)
  const search = params.toString()
  return `${baseUrl}${search ? `?${search}` : ''}`
}



const loadDetailsPanel = () => import('./components/DetailsPanel')
const DetailsPanel = lazy(async () => ({ default: (await loadDetailsPanel()).DetailsPanel }))

interface DetailsPanelLoadingFallbackProps {
  entry: CatalogEntry
  coverUrl: string
  onClose: () => void
}

function DetailsPanelLoadingFallback({ entry, coverUrl, onClose }: DetailsPanelLoadingFallbackProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('modal-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('modal-open')
    }
  }, [onClose])

  return (
    <div className="detail-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="detail-panel" role="dialog" aria-modal="true" aria-label={`${entry.title} details`}>
        <button className="detail-close" type="button" onClick={onClose} aria-label="Close details"><Icon name="x" /></button>
        <div className="detail-hero">
          <img src={buildCoverImageUrl(coverUrl, COVER_DETAIL_SIZE)} alt="" className="detail-cover" />
          <div className="detail-hero-gradient" />
          <div className="detail-hero-content">
            <div className="detail-kicker-row">
              <span className={`platform-badge platform-${platformFor(entry.id).toLowerCase()}`}>{platformFor(entry.id)}</span>
              <span className="detail-id">{entry.id}</span>
              {entry.pinned && <span className="detail-featured"><Icon name="star" /> Featured</span>}
            </div>
            <h1>{entry.title}</h1>
          </div>
        </div>
        <div className="detail-content">
          <div className="detail-loading"><span className="spinner" /> Loading version data…</div>
        </div>
      </section>
    </div>
  )
}

function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState(searchQueryFromLocation)
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
  const [showHeaderSearch, setShowHeaderSearch] = useState(false)
  const heroSearchRef = useRef<HTMLDivElement | null>(null)
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null)
  const pendingSearchUrlTimerRef = useRef<number | null>(null)
  const latestQueryRef = useRef(query)

  const cancelPendingSearchUrl = useCallback(() => {
    if (pendingSearchUrlTimerRef.current !== null) {
      window.clearTimeout(pendingSearchUrlTimerRef.current)
      pendingSearchUrlTimerRef.current = null
    }
  }, [])

  const replaceCatalogSearchUrl = useCallback((nextQuery: string) => {
    if (parseGamePath(window.location.pathname, baseUrl)) return

    const nextPath = makeSearchPath(nextQuery)
    const nextUrl = new URL(nextPath, window.location.origin)
    const currentPath = `${window.location.pathname}${window.location.search}`

    // Search URLs stay shareable, but search-result permutations are not
    // separate canonical pages. Keep og:url on the shareable ?q= URL while
    // canonical stays on the root catalog.
    if (currentPath === nextPath) {
      syncPageUrls(nextUrl, new URL(baseUrl, window.location.origin))
      syncRobotsMeta(nextQuery.trim() ? 'noindex,follow' : 'index,follow')
      return
    }

    // Use an absolute same-origin URL for maximum browser compatibility.
    history.replaceState(history.state, document.title, nextUrl.href)
    syncPageUrls(nextUrl, new URL(baseUrl, window.location.origin))
    syncRobotsMeta(nextQuery.trim() ? 'noindex,follow' : 'index,follow')
  }, [])

  const flushSearchUrl = useCallback((nextQuery = latestQueryRef.current) => {
    cancelPendingSearchUrl()
    replaceCatalogSearchUrl(nextQuery)
  }, [cancelPendingSearchUrl, replaceCatalogSearchUrl])

  const updateQuery = useCallback((nextQuery: string, immediateUrl = false) => {
    latestQueryRef.current = nextQuery
    setQuery(nextQuery)
    cancelPendingSearchUrl()

    if (parseGamePath(window.location.pathname, baseUrl)) return

    if (immediateUrl) {
      replaceCatalogSearchUrl(nextQuery)
      return
    }

    // Results update immediately, but the shareable URL waits until typing
    // has settled. This prevents Firefox from collecting ?q=a, ?q=as, etc.
    pendingSearchUrlTimerRef.current = window.setTimeout(() => {
      pendingSearchUrlTimerRef.current = null
      replaceCatalogSearchUrl(latestQueryRef.current)
    }, SEARCH_URL_DEBOUNCE_MS)
  }, [cancelPendingSearchUrl, replaceCatalogSearchUrl])

  useEffect(() => {
    let animationFrame = 0

    const updateHeaderSearchVisibility = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0
        const searchBounds = heroSearchRef.current?.getBoundingClientRect()
        const shouldShow = Boolean(searchBounds && searchBounds.bottom <= 0)
        setShowHeaderSearch((current) => current === shouldShow ? current : shouldShow)
      })
    }

    updateHeaderSearchVisibility()
    window.addEventListener('scroll', updateHeaderSearchVisibility, { passive: true })
    window.addEventListener('resize', updateHeaderSearchVisibility)
    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('scroll', updateHeaderSearchVisibility)
      window.removeEventListener('resize', updateHeaderSearchVisibility)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetchJsonCached<CatalogResponse>(`${baseUrl}data/catalog.json`, controller.signal),
      fetchJsonCached<CoversResponse>(`${baseUrl}data/covers.json`, controller.signal),
      fetchOptionalJsonCached<AddedResponse>(`${baseUrl}data/added.json`, {}, controller.signal),
      fetchJsonCached<SiteStatsResponse>(`${baseUrl}data/stats.json`, controller.signal),
    ])
      .then(([catalog, covers, added, stats]) => setData({ catalog, covers, added, stats }))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setLoadError('The catalog data could not be loaded.')
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!data) return
    const timer = window.setTimeout(() => { void loadDetailsPanel() }, 1500)
    return () => window.clearTimeout(timer)
  }, [data])

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
      if (isHidden(entry)) return []
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
    if (route) {
      syncPageUrls()
      syncRobotsMeta('index,follow')
    } else {
      syncPageUrls(window.location.href, new URL(baseUrl, window.location.origin))
      syncRobotsMeta(searchQueryFromLocation().trim() ? 'noindex,follow' : 'index,follow')
    }
    const legacyHash = route ? null : parseHash(window.location.hash)
    const parsed = route ?? legacyHash

    if (!parsed) {
      const restoredQuery = searchQueryFromLocation()
      latestQueryRef.current = restoredQuery
      setSelected(null)
      setQuery(restoredQuery)
      return
    }

    const entry = findEntry(parsed.id)
    if (!entry || isHidden(entry)) {
      setSelected(null)
      return
    }

    const requestedVersion = parsed.version && entry.versions.some((version) => version.version === parsed.version)
      ? parsed.version
      : [...entry.versions].sort((a, b) => compareVersions(b.version, a.version))[0]?.version

    setSelected({ entry, version: requestedVersion })

    if (legacyHash && requestedVersion) {
      const gameUrl = new URL(makeGamePath(entry.id, requestedVersion, baseUrl), window.location.origin)
      history.replaceState(history.state, document.title, gameUrl.href)
      syncPageUrls(gameUrl)
    }
  }, [data, findEntry])

  useEffect(() => {
    const handleLocationChange = () => {
      // A delayed URL write must never overwrite a Back/Forward navigation.
      cancelPendingSearchUrl()
      syncFromLocation()
    }

    syncFromLocation()
    window.addEventListener('popstate', handleLocationChange)
    window.addEventListener('hashchange', handleLocationChange)
    return () => {
      cancelPendingSearchUrl()
      window.removeEventListener('popstate', handleLocationChange)
      window.removeEventListener('hashchange', handleLocationChange)
    }
  }, [cancelPendingSearchUrl, syncFromLocation])

  useEffect(() => {
    if (!selected) {
      document.title = HOME_TITLE
      setMeta('meta[name="description"]', 'name', 'description', HOME_DESCRIPTION)
      setMeta('meta[property="og:title"]', 'property', 'og:title', HOME_SOCIAL_TITLE)
      setMeta('meta[property="og:description"]', 'property', 'og:description', HOME_SOCIAL_DESCRIPTION)
      setMeta('meta[property="og:image"]', 'property', 'og:image', HOME_SOCIAL_IMAGE)
      setMeta('meta[property="og:image:width"]', 'property', 'og:image:width', '1200')
      setMeta('meta[property="og:image:height"]', 'property', 'og:image:height', '630')
      setMeta('meta[property="og:image:type"]', 'property', 'og:image:type', 'image/png')
      setMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt', HOME_SOCIAL_IMAGE_ALT)
      setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', HOME_SOCIAL_TITLE)
      setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', HOME_SOCIAL_DESCRIPTION)
      setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', HOME_SOCIAL_IMAGE)
      setMeta('meta[name="twitter:image:alt"]', 'name', 'twitter:image:alt', HOME_SOCIAL_IMAGE_ALT)
      syncStructuredData({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'HEN Cheats Collection',
        url: `${PUBLIC_SITE_URL}/`,
        description: HOME_SOCIAL_DESCRIPTION,
        creator: { '@type': 'Person', name: 'TeeKay87' },
      })
      syncRobotsMeta(query.trim() ? 'noindex,follow' : 'index,follow')
      return
    }

    const versionLabel = selected.version ? ` v${selected.version}` : ''
    const pageTitle = `${selected.entry.title}${versionLabel} | HEN Cheats Collection`
    const description = `${platformNameForSocial(selected.entry.id)} cheats for ${selected.entry.title}${selected.version ? `, version ${selected.version}` : ''}. HEN Cheats Collection.`
    const coverCandidate = buildCoverImageUrl(coverFor(selected.entry), COVER_DETAIL_SIZE)
    const cover = /^https?:\/\//i.test(coverCandidate) ? coverCandidate : COVER_FALLBACK_URL
    const coverAlt = `${selected.entry.title} cover`

    document.title = pageTitle
    setMeta('meta[name="description"]', 'name', 'description', description)
    setMeta('meta[property="og:title"]', 'property', 'og:title', pageTitle)
    setMeta('meta[property="og:description"]', 'property', 'og:description', description)
    setMeta('meta[property="og:image"]', 'property', 'og:image', cover)
    setMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt', coverAlt)
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', pageTitle)
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description)
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', cover)
    setMeta('meta[name="twitter:image:alt"]', 'name', 'twitter:image:alt', coverAlt)
    removeMeta('meta[property="og:image:width"]')
    removeMeta('meta[property="og:image:height"]')
    removeMeta('meta[property="og:image:type"]')
    syncRobotsMeta('index,follow')
    const gameUrl = new URL(makeGamePath(selected.entry.id, selected.version ?? '', baseUrl), PUBLIC_SITE_URL).toString()
    syncStructuredData({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: pageTitle,
      description,
      url: gameUrl,
      isPartOf: { '@type': 'WebSite', name: 'HEN Cheats Collection', url: `${PUBLIC_SITE_URL}/` },
      about: {
        '@type': 'VideoGame',
        name: selected.entry.title,
        gamePlatform: platformNameForSocial(selected.entry.id),
      },
      image: cover,
    })
  }, [selected, data, query])

  const openEntry = (entry: CatalogEntry) => {
    const version = [...entry.versions].sort((a, b) => compareVersions(b.version, a.version))[0]?.version
    if (!version) return

    // Commit the current catalog search before pushing the clean game URL.
    // Back then restores the exact ?q= search the user opened the game from.
    flushSearchUrl()
    setSelected({ entry, version })
    const gameUrl = new URL(makeGamePath(entry.id, version, baseUrl), window.location.origin)
    history.pushState(
      { henccDetailFromCatalog: true },
      document.title,
      gameUrl.href,
    )
    syncPageUrls(gameUrl)
  }

  const closeDetails = useCallback(() => {
    if (
      history.state
      && typeof history.state === 'object'
      && history.state.henccDetailFromCatalog === true
    ) {
      // This returns to the exact catalog URL that was present before the
      // game was opened, including its ?q= search parameter.
      history.back()
      return
    }

    // A directly opened/shared game has no HENCC catalog entry behind it.
    // Closing it therefore goes to the catalog without manufacturing a
    // browser-history Back target.
    setSelected(null)
    const catalogUrl = new URL(makeSearchPath(''), window.location.origin)
    history.pushState(null, document.title, catalogUrl.href)
    syncPageUrls(catalogUrl, new URL(baseUrl, window.location.origin))
    syncRobotsMeta('index,follow')
  }, [])

  const selectVersion = (version: string) => {
    if (!selected) return
    setSelected({ ...selected, version })
    // Preserve the "opened from catalog" marker so Close/Back still restores
    // the search even after the user switches game version.
    const gameUrl = new URL(makeGamePath(selected.entry.id, version, baseUrl), window.location.origin)
    history.replaceState(history.state, document.title, gameUrl.href)
    syncPageUrls(gameUrl)
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
    const entries = data.catalog.entries.filter((entry) => !isHidden(entry))
    const versionCount = entries.reduce((sum, entry) => sum + entry.versions.length, 0)
    return { games: entries.length, versions: versionCount, files: data.stats.filesWithCheats }
  }, [data])

  const activeFilterCount = (platform !== 'All' ? 1 : 0) + (format !== 'All' ? 1 : 0)
  const hasFilters = Boolean(query) || view === 'favorites' || activeFilterCount > 0
  const adsAllowedOnCurrentCatalogView = view === 'all' && !query.trim() && platform === 'All' && format === 'All'

  const clearFilters = () => {
    updateQuery('', true)
    setView('all')
    setPlatform('All')
    setFormat('All')
    setSort('featured')
  }


  return (
    <div className="app-shell">
      <header className={`site-header${showHeaderSearch ? ' has-header-search' : ''}`}>
        <div className="header-inner">
          <button className="brand" type="button" onClick={clearFilters} aria-label="HEN Cheats Collection home">
            <span className="brand-mark">H</span>
            <span className="brand-copy"><strong>HEN Cheats</strong><small>Collection</small></span>
          </button>
          <nav className="desktop-nav" aria-label="Primary">
            <button className={view === 'all' ? 'active' : ''} type="button" onClick={() => setView('all')}>Browse</button>
            <button className={view === 'favorites' ? 'active' : ''} type="button" onClick={() => setView('favorites')}><Icon name="heart" /> Favorites <span className="nav-count">{favorites.size}</span></button>
          </nav>
          {showHeaderSearch && (
            <div className="header-search-wrap">
              <Icon name="search" />
              <input
                type="search"
                value={query}
                onChange={(event: ChangeEvent<HTMLInputElement>) => updateQuery(event.target.value)}
                onBlur={() => flushSearchUrl()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') flushSearchUrl()
                }}
                placeholder="Search…"
                aria-label="Search catalog from header"
              />
              {query && <button type="button" className="header-search-clear" onClick={() => updateQuery('', true)} aria-label="Clear search"><Icon name="x" /></button>}
            </div>
          )}
          <a className="github-link" href="https://github.com/TeeKay87/HEN-Cheats-Collection" target="_blank" rel="noreferrer"><Icon name="github" /><span>GitHub</span></a>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-glow hero-glow-one" />
          <div className="hero-glow hero-glow-two" />
          <div className="hero-inner">
            <h1><span className="hero-title-full">HEN Cheats Collection</span><span className="hero-title-compact">HEN Cheats</span></h1>
            <p>The largest collection of PlayStation 4 and PlayStation 5 cheats. Play Your Way.</p>
            <div className="hero-search-wrap" ref={heroSearchRef}>
              <Icon name="search" />
              <input
                type="search"
                value={query}
                onChange={(event: ChangeEvent<HTMLInputElement>) => updateQuery(event.target.value)}
                onBlur={() => flushSearchUrl()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') flushSearchUrl()
                }}
                placeholder="Search by game, Title ID, creator…"
                aria-label="Search catalog"
              />
              {query && <button type="button" className="search-clear" onClick={() => updateQuery('', true)} aria-label="Clear search"><Icon name="x" /></button>}
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
                    && adsAllowedOnCurrentCatalogView
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

      <SiteFooter generatedUtc={data?.catalog.generatedUtc} />

      {selected && data && (
        <Suspense fallback={<DetailsPanelLoadingFallback entry={selected.entry} coverUrl={coverFor(selected.entry)} onClose={closeDetails} />}>
          <DetailsPanel
            entry={selected.entry}
            coverUrl={coverFor(selected.entry)}
            selectedVersion={selected.version}
            favorite={favorites.has(selected.entry.id)}
            onClose={closeDetails}
            onSelectVersion={selectVersion}
            onToggleFavorite={toggleFavorite}
          />
        </Suspense>
      )}
    </div>
  )
}

export default App
