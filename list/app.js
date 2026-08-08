// Default sorting used when the URL does not contain a valid ?sort= value.
// Available values:
//   'title-asc'  = A-Z
//   'title-desc' = Z-A
//   'added-desc' = Newest first
//   'added-asc'  = Oldest first
const DEFAULT_SORT = 'added-desc';

// Number of days an entry should be marked as NEW.
// Example: 14 means the added date plus the following 13 days.
const NEW_BADGE_DAYS = 7;

// Repository location used by the per-format Download buttons.
const CHEATS_REPOSITORY_BRANCH = 'master';
const CHEATS_REPOSITORY_API_BASE_URL =
  'https://api.github.com/repos/TeeKay87/HEN-Cheats-Collection';
const CHEATS_NEW_ISSUE_URL =
  'https://github.com/TeeKay87/HEN-Cheats-Collection/issues/new';
const CHEATS_TREE_API_URL =
  `${CHEATS_REPOSITORY_API_BASE_URL}/git/trees/${CHEATS_REPOSITORY_BRANCH}?recursive=1`;
const CHEATS_RAW_BASE_URL =
  `https://raw.githubusercontent.com/TeeKay87/HEN-Cheats-Collection/${CHEATS_REPOSITORY_BRANCH}/cheats`;
const DOWNLOADABLE_FORMATS = new Set(['json', 'mc4', 'shn']);

// Google AdSense configuration.
// Create one responsive Display ad unit in AdSense and paste its values here.
// Leave either value empty to disable the in-list ad placements completely.
const ADSENSE_CLIENT_ID = ''; // Example: 'ca-pub-1234567890123456'
const ADSENSE_GAME_LIST_SLOT_ID = ''; // Example: '1234567890'

// Insert one full-width responsive ad after this many game cards.
// The ad is only inserted when there are more game results after it.
const ADSENSE_GAME_INTERVAL = 12;

const state = {
  entries: [],
  covers: new Map(),
  addedDates: new Map(),
  notes: new Map(),
  pinned: new Set(),
  favorites: new Set(),
  activeFilter: 'all',
  activeSort: DEFAULT_SORT,
  searchTerm: '',
  searchActive: false,
  filteredEntries: [],
  activeEntryKey: null,
  totalGames: 0,
  generatedUtc: null,
  renderedCount: 0,
};

const elements = {
  siteHeader: document.getElementById('siteHeader'),
  siteFooter: document.getElementById('siteFooter'),
  searchInput: document.getElementById('searchInput'),
  cardsGrid: document.getElementById('cardsGrid'),
  statusMessage: document.getElementById('statusMessage'),
  emptyState: document.getElementById('emptyState'),
  resultsLine: document.getElementById('resultsLine'),
  sortSelect: document.getElementById('sortSelect'),
  footerGenerated: document.getElementById('footerGenerated'),
  footerCreated: document.getElementById('footerCreated'),
  modalRoot: document.getElementById('modalRoot'),
  modalBackdrop: document.getElementById('modalBackdrop'),
  modalClose: document.getElementById('modalClose'),
  modalHero: document.getElementById('modalHero'),
  modalTitle: document.getElementById('modalTitle'),
  modalIdVersion: document.getElementById('modalIdVersion'),
  modalCheatsTotal: document.getElementById('modalCheatsTotal'),
  modalCreators: document.getElementById('modalCreators'),
  modalNotes: document.getElementById('modalNotes'),
  modalNotesContent: document.getElementById('modalNotesContent'),
  modalGameId: document.getElementById('modalGameId'),
  modalVersion: document.getElementById('modalVersion'),
  modalFormats: document.getElementById('modalFormats'),
  modalFavoriteBtn: document.getElementById('modalFavoriteBtn'),
  modalCheatGroups: document.getElementById('modalCheatGroups'),
  toggleButtons: [...document.querySelectorAll('.toggle-btn')],
  cardTemplate: document.getElementById('cardTemplate'),
};

const STORAGE_KEY = 'hen-cheats-favorites';
const SEARCH_PARAM = 'q';
const FILTER_PARAM = 'view';
const SORT_PARAM = 'sort';
const HASH_SEPARATOR = '-';
const COVERART_SIZE = '384';
const COVERART_SUFFIX = '?w=' + COVERART_SIZE + '&thumb=false';
const COVERART_SUFFIX_HERO = '?w=1024&thumb=false';
const COVERART_FALLBACK = 'https://upload.wikimedia.org/wikipedia/commons/9/99/Playstation_logo_colour2.svg';
const MINIMUM_CHARS_FOR_SEARCH = 2;

const RENDER_BATCH_SIZE = 60;
const SEARCH_DEBOUNCE_MS = 150;
const VALID_SORTS = new Set(['title-asc', 'title-desc', 'added-desc', 'added-asc']);
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MARKDOWN_ALLOWED_TAGS = [
  'p',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong',
  'em',
  'blockquote',
  'ol', 'ul', 'li',
  'code',
  'hr',
  'a',
  'br',
];
const MARKDOWN_ALLOWED_ATTRIBUTES = ['href', 'title'];

function entryKey(entry) {
  return `${entry.id}${HASH_SEPARATOR}${entry.version}`;
}

// notes.json and pinned.json use ID_VERSION keys.
// Keep this separate from entryKey() so favorites, URL hashes/deep links,
// and added.json retain their existing ID-version behavior.
function metadataEntryKey(entry) {
  return `${entry.id}_${entry.version}`;
}

function parseDateOnlyUtc(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
}

function getTodayUtcTimestamp() {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

function isNewEntry(entry) {
  const addedTimestamp = parseDateOnlyUtc(entry.addedDate);
  if (addedTimestamp === null) return false;

  const ageInDays = Math.floor(
    (getTodayUtcTimestamp() - addedTimestamp) / MILLISECONDS_PER_DAY
  );

  return ageInDays >= 0 && ageInDays < NEW_BADGE_DAYS;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderBasicMarkdown(markdownText) {
  const source = String(markdownText || '').trim();
  if (!source) return '';

  if (!window.marked?.Marked || !window.marked?.Renderer || !window.DOMPurify) {
    console.warn('Markdown libraries are unavailable. Showing the note as plain text.');
    return `<p>${escapeHtml(source).replaceAll('\n', '<br>')}</p>`;
  }

  const renderer = new window.marked.Renderer();

  // Raw HTML is not part of the supported notes syntax.
  renderer.html = ({ text }) => escapeHtml(text);

  // Images are intentionally unsupported and are shown as their alt text only.
  renderer.image = ({ text }) => escapeHtml(text || '');

  // Only inline code is supported. Block/fenced code is displayed as plain text.
  renderer.code = ({ text }) => `<p>${escapeHtml(text)}</p>`;

  const markdownParser = new window.marked.Marked({
    renderer,
    gfm: false,
    breaks: false,
    pedantic: false,
  });

  const parsedHtml = markdownParser.parse(source);
  const sanitizedHtml = window.DOMPurify.sanitize(parsedHtml, {
    ALLOWED_TAGS: MARKDOWN_ALLOWED_TAGS,
    ALLOWED_ATTR: MARKDOWN_ALLOWED_ATTRIBUTES,
  });

  const template = document.createElement('template');
  template.innerHTML = sanitizedHtml;

  template.content.querySelectorAll('a').forEach((link) => {
    const href = link.getAttribute('href');

    try {
      const url = new URL(href || '', window.location.href);
      if (!['http:', 'https:'].includes(url.protocol)) {
        link.removeAttribute('href');
        link.removeAttribute('title');
        return;
      }

      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    } catch {
      link.removeAttribute('href');
      link.removeAttribute('title');
    }
  });

  return template.innerHTML;
}

function normalize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeSearch(value) {
  return normalize(value)
    .replace(/[.'’‘`´]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCoverUrl(entry) {
  const titleCover = state.covers.get(normalize(entry.title));
  if (titleCover && titleCover !== 'no-image') return titleCover;

  const idCover = state.covers.get(normalize(`${entry.title} ${entry.id}`));
  if (idCover && idCover !== 'no-image') return idCover;

  return null;
}

async function loadOptionalJson(url, fallbackValue) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status !== 404) {
        console.warn(`Could not load ${url}: HTTP ${response.status}`);
      }
      return fallbackValue;
    }

    return await response.json();
  } catch (error) {
    console.warn(`Could not load ${url}:`, error);
    return fallbackValue;
  }
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function saveFavorites() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.favorites]));
}

function setFavorite(key, isFavorite) {
  if (isFavorite) state.favorites.add(key);
  else state.favorites.delete(key);
  saveFavorites();
}

function parseGeneratedDate(utcString) {
  if (!utcString) return null;
  const date = new Date(utcString);
  if (Number.isNaN(date.getTime())) return null;
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC`;
}

function formatCreators(creators = []) {
  return creators.length ? creators.join(', ') : 'Unknown';
}

function countUniqueGames(entries) {
  return new Set(entries.map((entry) => normalize(entry.title))).size;
}

function syncFooter() {
  const year = new Date().getFullYear();
  elements.footerCreated.textContent = `Created by TeeKay87 © ${year}`;
  elements.footerGenerated.textContent = state.generatedUtc
    ? `Generated with HEN-CM | ${state.generatedUtc}`
    : '';
}

function syncLayoutOffsets() {
  const headerHeight = elements.siteHeader.getBoundingClientRect().height;
  const footerHeight = elements.siteFooter.getBoundingClientRect().height;
  document.documentElement.style.setProperty('--header-height', `${Math.ceil(headerHeight)}px`);
  document.documentElement.style.setProperty('--footer-height', `${Math.ceil(footerHeight)}px`);
}

function syncHeaderState() {
  elements.siteHeader.classList.toggle('is-condensed', window.scrollY > 24);
}

function getSearchParams() {
  const params = new URLSearchParams(window.location.search);
  const requestedSort = params.get(SORT_PARAM) || DEFAULT_SORT;

  return {
    q: params.get(SEARCH_PARAM) || '',
    view: params.get(FILTER_PARAM) === 'favorites' ? 'favorites' : 'all',
    sort: VALID_SORTS.has(requestedSort) ? requestedSort : DEFAULT_SORT,
  };
}

function getHashEntryKey() {
  const raw = decodeURIComponent(window.location.hash.replace(/^#/, '')).trim();
  return raw || null;
}

function buildUrl({ preserveHash = true } = {}) {
  const params = new URLSearchParams(window.location.search);
  const activeSearch = state.searchTerm.trim();

  if (activeSearch) params.set(SEARCH_PARAM, activeSearch);
  else params.delete(SEARCH_PARAM);

  if (state.activeFilter === 'favorites') params.set(FILTER_PARAM, 'favorites');
  else params.delete(FILTER_PARAM);

  if (state.activeSort !== DEFAULT_SORT) params.set(SORT_PARAM, state.activeSort);
  else params.delete(SORT_PARAM);

  const nextQuery = params.toString();
  const nextHash =
    preserveHash && state.activeEntryKey
      ? `#${encodeURIComponent(state.activeEntryKey)}`
      : '';

  return `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${nextHash}`;
}

function updateUrl({ preserveHash = true, mode = 'replace', stateObj = null } = {}) {
  const nextUrl = buildUrl({ preserveHash });

  if (mode === 'push') {
    history.pushState(stateObj, '', nextUrl);
  } else {
    history.replaceState(stateObj, '', nextUrl);
  }
}

function updateHashForModal({ fromNavigation = false } = {}) {
  if (fromNavigation) {
    updateUrl({
      preserveHash: true,
      mode: 'push',
      stateObj: { modal: true, entryKey: state.activeEntryKey },
    });
  } else {
    updateUrl({
      preserveHash: true,
      mode: 'replace',
      stateObj: { modal: false, entryKey: state.activeEntryKey },
    });
  }
}

function clearHash() {
  state.activeEntryKey = null;
  updateUrl({
    preserveHash: false,
    mode: 'replace',
    stateObj: { modal: false, entryKey: null },
  });
}

function applyControlsFromUrl() {
  const params = getSearchParams();
  state.searchTerm = params.q;
  state.activeFilter = params.view;
  state.activeSort = params.sort;
  elements.searchInput.value = params.q;
  elements.sortSelect.value = params.sort;
  elements.toggleButtons.forEach((button) => {
    const isActive = button.dataset.filter === state.activeFilter;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function getEffectiveSearchTerm(value) {
  const normalizedValue = normalizeSearch(value);
  return normalizedValue.length >= MINIMUM_CHARS_FOR_SEARCH ? normalizedValue : '';
}

function compareAlphabetically(a, b, titleDirection = 1) {
  const titleSort = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  if (titleSort !== 0) return titleSort * titleDirection;

  const idSort = a.id.localeCompare(b.id, undefined, { sensitivity: 'base' });
  if (idSort !== 0) return idSort;

  return a.version.localeCompare(b.version, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function compareByAddedDate(a, b, newestFirst) {
  const aTimestamp = parseDateOnlyUtc(a.addedDate);
  const bTimestamp = parseDateOnlyUtc(b.addedDate);
  const aHasDate = aTimestamp !== null;
  const bHasDate = bTimestamp !== null;

  // Entries without a known added date always appear last.
  if (aHasDate !== bHasDate) return aHasDate ? -1 : 1;

  if (aHasDate && bHasDate && aTimestamp !== bTimestamp) {
    return newestFirst
      ? bTimestamp - aTimestamp
      : aTimestamp - bTimestamp;
  }

  return compareAlphabetically(a, b);
}

function sortEntries(entries) {
  return entries.sort((a, b) => {
    const aPinned = state.pinned.has(metadataEntryKey(a));
    const bPinned = state.pinned.has(metadataEntryKey(b));

    // Pinned entries always come first. Within each group, keep using
    // the sort order selected by the user.
    if (aPinned !== bPinned) return aPinned ? -1 : 1;

    switch (state.activeSort) {
      case 'title-desc':
        return compareAlphabetically(a, b, -1);
      case 'added-desc':
        return compareByAddedDate(a, b, true);
      case 'added-asc':
        return compareByAddedDate(a, b, false);
      case 'title-asc':
      default:
        return compareAlphabetically(a, b);
    }
  });
}

function filterEntries() {
  const effectiveSearch = getEffectiveSearchTerm(state.searchTerm);
  const useSearch = effectiveSearch.length >= MINIMUM_CHARS_FOR_SEARCH;

  state.filteredEntries = sortEntries(
    state.entries.filter((entry) => {
      if (state.activeFilter === 'favorites' && !state.favorites.has(entryKey(entry))) {
        return false;
      }

      if (!useSearch) return true;

      return (
        entry.searchBlob.includes(effectiveSearch) ||
        entry.idLower.includes(effectiveSearch) ||
        entry.titleLower.includes(effectiveSearch)
      );
    })
  );

  const shownEntries = state.filteredEntries.length;
  const shownGames = countUniqueGames(state.filteredEntries);
  const totalEntries = state.entries.length;
  const totalGames = state.totalGames;

  elements.resultsLine.textContent = `Showing ${shownEntries} of ${totalEntries} entries · ${shownGames} of ${totalGames} games`;
}

function createPlaceholderSvg(title) {
  const initials = title
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2) || 'HC';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 640" role="img" aria-label="No cover available">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#6ca8ff" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="#8f7cff" stop-opacity="0.9"/>
        </linearGradient>
      </defs>
      <rect width="480" height="640" rx="32" fill="url(#g)" />
      <circle cx="240" cy="200" r="88" fill="rgba(255,255,255,0.12)" />
      <text x="50%" y="220" text-anchor="middle" font-size="84" font-weight="700" fill="#eef4ff" font-family="Arial, sans-serif">${escapeHtml(initials)}</text>
      <text x="50%" y="360" text-anchor="middle" font-size="24" fill="#eef4ff" opacity="0.92" font-family="Arial, sans-serif">No Cover Available</text>
      <text x="50%" y="400" text-anchor="middle" font-size="20" fill="#eef4ff" opacity="0.74" font-family="Arial, sans-serif">HEN Cheats Collection</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

let adsenseScriptPromise = null;

function isAdSenseConfigured() {
  return (
    /^ca-pub-\d+$/.test(ADSENSE_CLIENT_ID) &&
    /^\d+$/.test(ADSENSE_GAME_LIST_SLOT_ID) &&
    Number.isInteger(ADSENSE_GAME_INTERVAL) &&
    ADSENSE_GAME_INTERVAL > 0
  );
}

function ensureAdSenseScript() {
  if (!isAdSenseConfigured()) {
    return Promise.resolve(false);
  }

  if (window.adsbygoogle && document.querySelector('script[data-hen-adsense="true"]')) {
    return Promise.resolve(true);
  }

  if (!adsenseScriptPromise) {
    adsenseScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-hen-adsense="true"]');

      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve(true);
          return;
        }

        existing.addEventListener('load', () => resolve(true), { once: true });
        existing.addEventListener(
          'error',
          () => reject(new Error('Could not load the Google AdSense script.')),
          { once: true }
        );
        return;
      }

      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.henAdsense = 'true';
      script.src =
        'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js' +
        `?client=${encodeURIComponent(ADSENSE_CLIENT_ID)}`;

      script.addEventListener(
        'load',
        () => {
          script.dataset.loaded = 'true';
          resolve(true);
        },
        { once: true }
      );

      script.addEventListener(
        'error',
        () => reject(new Error('Could not load the Google AdSense script.')),
        { once: true }
      );

      document.head.append(script);
    }).catch((error) => {
      adsenseScriptPromise = null;
      console.warn(error);
      return false;
    });
  }

  return adsenseScriptPromise;
}

function buildGameListAdSlot(gameNumber) {
  if (!isAdSenseConfigured()) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'games-ad-slot';
  wrapper.dataset.afterGame = String(gameNumber);
  wrapper.setAttribute('role', 'complementary');
  wrapper.setAttribute('aria-label', 'Advertisement');

  const ad = document.createElement('ins');
  ad.className = 'adsbygoogle';
  ad.style.display = 'block';
  ad.dataset.adClient = ADSENSE_CLIENT_ID;
  ad.dataset.adSlot = ADSENSE_GAME_LIST_SLOT_ID;
  ad.dataset.adFormat = 'auto';
  ad.dataset.fullWidthResponsive = 'true';

  wrapper.append(ad);
  return wrapper;
}

function initializeGameListAds(adElements) {
  if (!adElements.length || !isAdSenseConfigured()) return;

  // The standard AdSense queue also works while the external script is loading.
  // Loading is started once per page; every newly rendered ad unit is then queued.
  ensureAdSenseScript();

  adElements.forEach((ad) => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      console.warn('Could not initialize an AdSense game-list ad:', error);
    }
  });
}

let scrollSentinel = null;
let scrollObserver = null;

function ensureSentinel() {
  if (!scrollSentinel) {
    scrollSentinel = document.createElement('div');
    scrollSentinel.className = 'scroll-sentinel';
    scrollSentinel.style.cssText = 'grid-column:1/-1;height:1px;';
  }
  if (!scrollObserver) {
    scrollObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          renderMore();
        }
      },
      { rootMargin: '600px 0px' }
    );
  }
}

function buildCard(entry) {
  const clone = elements.cardTemplate.content.cloneNode(true);
  const card = clone.querySelector('.game-card');
  const favoriteButton = clone.querySelector('.favorite-btn');
  const newBadge = clone.querySelector('.new-badge');
  const notesBadge = clone.querySelector('.notes-badge');
  const pinBadge = clone.querySelector('.pin-badge');
  const hitbox = clone.querySelector('.card-hitbox');
  const title = clone.querySelector('.card-title');
  const id = clone.querySelector('.card-id');
  const version = clone.querySelector('.card-version');
  const cheats = clone.querySelector('.card-cheats');
  const cover = clone.querySelector('.card-cover');
  const key = entryKey(entry);
  const metadataKey = metadataEntryKey(entry);
  const isFavorite = state.favorites.has(key);
  const coverUrl = getCoverUrl(entry);

  title.textContent = entry.title;
  id.textContent = entry.id;
  version.textContent = `v${entry.version}`;
  cheats.textContent = `${entry.cheatsTotal} cheat${entry.cheatsTotal === 1 ? '' : 's'}`;

  if (notesBadge && state.notes.has(metadataKey)) {
    notesBadge.hidden = false;
    notesBadge.title = 'This entry has notes';
    notesBadge.setAttribute('aria-label', 'This entry has notes');
  }

  if (pinBadge && state.pinned.has(metadataKey)) {
    pinBadge.hidden = false;
    pinBadge.title = 'Pinned entry';
    pinBadge.setAttribute('aria-label', 'Pinned entry');
  }

  if (newBadge && isNewEntry(entry)) {
    newBadge.hidden = false;
    newBadge.title = `Added ${entry.addedDate}`;
    newBadge.setAttribute('aria-label', `New entry added ${entry.addedDate}`);
  }

  cover.loading = 'lazy';
  cover.decoding = 'async';
  cover.alt = `${entry.title} cover art`;
  if (coverUrl) {
    cover.src = coverUrl + COVERART_SUFFIX;
  } else {
    cover.src = COVERART_FALLBACK + COVERART_SUFFIX;
    cover.dataset.noImage = 'true';
  }

  cover.onerror = () => {
    cover.onerror = null;
    cover.src = COVERART_FALLBACK + COVERART_SUFFIX;
  };

  favoriteButton.classList.toggle('is-favorite', isFavorite);
  favoriteButton.setAttribute('aria-pressed', String(isFavorite));
  favoriteButton.setAttribute(
    'aria-label',
    isFavorite ? `Remove ${entry.title} from favorites` : `Add ${entry.title} to favorites`
  );

  favoriteButton.addEventListener('click', (event) => {
    event.stopPropagation();
    setFavorite(key, !state.favorites.has(key));
    const nowFav = state.favorites.has(key);
    favoriteButton.classList.toggle('is-favorite', nowFav);
    favoriteButton.setAttribute('aria-pressed', String(nowFav));
    if (state.activeFilter === 'favorites' && !nowFav) {
      // entry no longer matches the favorites filter → drop the card
      filterEntries();
      renderCards();
    }
    if (state.activeEntryKey === key) {
      const entryRef = state.entries.find((e) => entryKey(e) === key);
      if (entryRef) renderModal(entryRef);
    }
  });

  hitbox.setAttribute('aria-label', `Open details for ${entry.title} ${entry.id} version ${entry.version}`);
  hitbox.addEventListener('click', () => openModal(key));

  card.dataset.entryKey = key;
  return clone;
}

function renderMore() {
  const remaining = state.filteredEntries.length - state.renderedCount;
  if (remaining <= 0) {
    if (scrollSentinel && scrollSentinel.parentNode) scrollSentinel.parentNode.removeChild(scrollSentinel);
    return;
  }

  const batch = Math.min(RENDER_BATCH_SIZE, remaining);
  const fragment = document.createDocumentFragment();
  const adsToInitialize = [];

  for (let i = 0; i < batch; i++) {
    const entryIndex = state.renderedCount + i;
    const gameNumber = entryIndex + 1;

    fragment.append(buildCard(state.filteredEntries[entryIndex]));

    const hasMoreGames = gameNumber < state.filteredEntries.length;
    if (
      isAdSenseConfigured() &&
      hasMoreGames &&
      gameNumber % ADSENSE_GAME_INTERVAL === 0
    ) {
      const adSlot = buildGameListAdSlot(gameNumber);
      if (adSlot) {
        adsToInitialize.push(adSlot.querySelector('.adsbygoogle'));
        fragment.append(adSlot);
      }
    }
  }

  state.renderedCount += batch;

  // sentinel must remain at the end to trigger the next batch
  if (scrollSentinel && scrollSentinel.parentNode === elements.cardsGrid) {
    elements.cardsGrid.insertBefore(fragment, scrollSentinel);
  } else {
    elements.cardsGrid.append(fragment);
  }

  initializeGameListAds(adsToInitialize.filter(Boolean));

  // remove sentinel once everything is rendered
  if (state.renderedCount >= state.filteredEntries.length) {
    if (scrollSentinel && scrollSentinel.parentNode) scrollSentinel.parentNode.removeChild(scrollSentinel);
  }
}

function renderCards() {
  ensureSentinel();
  if (scrollObserver && scrollSentinel) scrollObserver.unobserve(scrollSentinel);

  elements.cardsGrid.innerHTML = '';
  state.renderedCount = 0;

  if (!state.entries.length) {
    elements.statusMessage.textContent = 'Loading data files…';
    elements.statusMessage.hidden = false;
    elements.emptyState.classList.add('hidden');
    return;
  }

  if (!state.filteredEntries.length) {
    elements.statusMessage.hidden = true;
    elements.emptyState.classList.remove('hidden');
    return;
  }

  elements.statusMessage.hidden = true;
  elements.emptyState.classList.add('hidden');

  renderMore();

  if (state.renderedCount < state.filteredEntries.length) {
    elements.cardsGrid.append(scrollSentinel);
    scrollObserver.observe(scrollSentinel);
  }

  // jump back to the top so the user sees their fresh results
  if (elements.cardsGrid.scrollTop) elements.cardsGrid.scrollTop = 0;
  else window.scrollTo({ top: 0, behavior: 'auto' });
}

let cheatFileIndexPromise = null;
const cheatFormatDirectoryPromises = new Map();

function getCheatDownloadDetails(entry, format) {
  const normalizedFormat = String(format || '').trim().toLowerCase();

  if (!DOWNLOADABLE_FORMATS.has(normalizedFormat)) {
    return null;
  }

  return {
    format: normalizedFormat,
    filePrefix: `${entry.id}_${entry.version}`,
    zipName: `${entry.id}_${entry.version}_${normalizedFormat.toUpperCase()}.zip`,
  };
}

function buildCheatIssueUrl(entry, format) {
  const normalizedFormat = String(format || '').trim().toUpperCase();
  const issueTitle = `Cheat Issue: ${entry.id} | ${entry.version} | ${normalizedFormat} | ${entry.title}`;
  const issueBody = `## Cheat information

- **Game:** ${entry.title}
- **ID:** ${entry.id}
- **Version:** ${entry.version}
- **Format:** ${normalizedFormat}
- **Firmware:** 
- **Cheat Engine:** 

[https://hencheats.vercel.app/#${entry.id}-${entry.version}](https://hencheats.vercel.app/#${entry.id}-${entry.version})

## Problem description



## Expected behavior



## Additional information


`;

  const params = new URLSearchParams({
    title: issueTitle,
    body: issueBody,
  });

  return `${CHEATS_NEW_ISSUE_URL}?${params.toString()}`;
}

function buildRawCheatFileUrl(format, fileName) {
  return [
    CHEATS_RAW_BASE_URL,
    encodeURIComponent(format),
    encodeURIComponent(fileName),
  ].join('/');
}

function isMatchingCheatFile(fileName, filePrefix, format) {
  const normalizedName = String(fileName || '').toLowerCase();
  const normalizedPrefix = String(filePrefix || '').toLowerCase();
  const extension = `.${String(format || '').toLowerCase()}`;

  return (
    normalizedName === `${normalizedPrefix}${extension}` ||
    (
      normalizedName.startsWith(`${normalizedPrefix}_`) &&
      normalizedName.endsWith(extension)
    )
  );
}

function normalizeCheatFile(format, fileName) {
  return {
    format,
    fileName,
    rawUrl: buildRawCheatFileUrl(format, fileName),
  };
}

function sortMatchingCheatFiles(files, filePrefix, format) {
  const primaryFileName = `${filePrefix}.${format}`.toLowerCase();

  return files.sort((a, b) => {
    const aIsPrimary = a.fileName.toLowerCase() === primaryFileName;
    const bIsPrimary = b.fileName.toLowerCase() === primaryFileName;

    if (aIsPrimary !== bIsPrimary) return aIsPrimary ? -1 : 1;

    return a.fileName.localeCompare(b.fileName, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

async function fetchGitHubJson(url) {
  const response = await fetch(url, {
    cache: 'no-cache',
    mode: 'cors',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API returned HTTP ${response.status}.`);
  }

  return response.json();
}

async function loadCheatFileIndex() {
  if (!cheatFileIndexPromise) {
    cheatFileIndexPromise = (async () => {
      const treeData = await fetchGitHubJson(CHEATS_TREE_API_URL);

      if (!Array.isArray(treeData.tree)) {
        throw new Error('GitHub returned an invalid repository tree.');
      }

      const filesByFormat = new Map(
        [...DOWNLOADABLE_FORMATS].map((format) => [format, []])
      );

      treeData.tree.forEach((item) => {
        if (item?.type !== 'blob' || typeof item.path !== 'string') return;

        const match = /^cheats\/(json|mc4|shn)\/([^/]+)$/i.exec(item.path);
        if (!match) return;

        const format = match[1].toLowerCase();
        const fileName = match[2];
        filesByFormat.get(format)?.push(normalizeCheatFile(format, fileName));
      });

      return {
        filesByFormat,
        truncated: treeData.truncated === true,
      };
    })().catch((error) => {
      cheatFileIndexPromise = null;
      throw error;
    });
  }

  return cheatFileIndexPromise;
}

async function loadCheatFormatDirectory(format) {
  if (!cheatFormatDirectoryPromises.has(format)) {
    const directoryUrl =
      `${CHEATS_REPOSITORY_API_BASE_URL}/contents/cheats/${encodeURIComponent(format)}` +
      `?ref=${encodeURIComponent(CHEATS_REPOSITORY_BRANCH)}`;

    const promise = fetchGitHubJson(directoryUrl)
      .then((items) => {
        if (!Array.isArray(items)) {
          throw new Error(`GitHub returned an invalid ${format} directory listing.`);
        }

        return items
          .filter((item) => item?.type === 'file' && typeof item.name === 'string')
          .map((item) => normalizeCheatFile(format, item.name));
      })
      .catch((error) => {
        cheatFormatDirectoryPromises.delete(format);
        throw error;
      });

    cheatFormatDirectoryPromises.set(format, promise);
  }

  return cheatFormatDirectoryPromises.get(format);
}

function findMatchesInFiles(files, details) {
  const uniqueFiles = new Map();

  files.forEach((file) => {
    if (
      file?.format === details.format &&
      isMatchingCheatFile(file.fileName, details.filePrefix, details.format)
    ) {
      uniqueFiles.set(file.fileName.toLowerCase(), file);
    }
  });

  return sortMatchingCheatFiles(
    [...uniqueFiles.values()],
    details.filePrefix,
    details.format
  );
}

async function findMatchingCheatFiles(details) {
  let treeMatches = [];
  let treeWasTruncated = false;

  try {
    const treeIndex = await loadCheatFileIndex();
    treeMatches = findMatchesInFiles(
      treeIndex.filesByFormat.get(details.format) || [],
      details
    );
    treeWasTruncated = treeIndex.truncated;

    if (!treeWasTruncated) {
      return treeMatches;
    }
  } catch (error) {
    console.warn('Could not load the GitHub repository tree:', error);
  }

  try {
    const directoryFiles = await loadCheatFormatDirectory(details.format);
    const directoryMatches = findMatchesInFiles(directoryFiles, details);

    return findMatchesInFiles(
      [...treeMatches, ...directoryMatches],
      details
    );
  } catch (directoryError) {
    console.warn(
      `Could not load the GitHub ${details.format} directory:`,
      directoryError
    );

    if (treeMatches.length) {
      return treeMatches;
    }

    // Preserve the original direct-download behavior as a final fallback.
    // This still works for the normal ID_VERSION.ext filename.
    const conventionalFileName = `${details.filePrefix}.${details.format}`;
    return [normalizeCheatFile(details.format, conventionalFileName)];
  }
}

function triggerBlobDownload(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function setDownloadButtonState(button, stateName, label) {
  button.classList.remove('is-loading', 'is-success', 'is-error');

  if (stateName) {
    button.classList.add(stateName);
  }

  button.textContent = label;
}

async function downloadCheatAsZip(entry, format, button) {
  const details = getCheatDownloadDetails(entry, format);
  if (!details) return;

  const defaultLabel = 'Download';
  button.disabled = true;
  button.removeAttribute('title');
  setDownloadButtonState(button, 'is-loading', 'Searching…');

  try {
    if (typeof window.JSZip !== 'function') {
      throw new Error('JSZip is unavailable.');
    }

    const matchingFiles = await findMatchingCheatFiles(details);

    if (!matchingFiles.length) {
      throw new Error(
        `No files matching ${details.filePrefix}*.${details.format} were found.`
      );
    }

    const zip = new window.JSZip();

    for (let index = 0; index < matchingFiles.length; index += 1) {
      const file = matchingFiles[index];
      setDownloadButtonState(
        button,
        'is-loading',
        `Downloading ${index + 1}/${matchingFiles.length}…`
      );

      const response = await fetch(file.rawUrl, {
        cache: 'no-cache',
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(
          `GitHub returned HTTP ${response.status} for ${file.fileName}.`
        );
      }

      zip.file(file.fileName, await response.arrayBuffer());
    }

    setDownloadButtonState(
      button,
      'is-loading',
      `Packing ${matchingFiles.length} file${matchingFiles.length === 1 ? '' : 's'}…`
    );

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    triggerBlobDownload(zipBlob, details.zipName);
    setDownloadButtonState(
      button,
      'is-success',
      matchingFiles.length === 1 ? 'Downloaded' : `Downloaded ${matchingFiles.length}`
    );
  } catch (error) {
    console.error(
      `Could not download ${details.filePrefix}*.${details.format}:`,
      error
    );
    button.title = error instanceof Error
      ? error.message
      : `Could not download ${details.filePrefix}*.${details.format}`;
    setDownloadButtonState(button, 'is-error', 'Failed');
  } finally {
    window.setTimeout(() => {
      button.disabled = false;
      button.removeAttribute('title');
      setDownloadButtonState(button, '', defaultLabel);
    }, 2200);
  }
}

function formatAvailableFormats(entry) {
  return Object.entries(entry.formats || {})
    .filter(([, data]) => data?.hasFile && data.cheatsCount > 0)
    .map(([name, data]) => `${name.toUpperCase()} (${data.cheatsCount})`)
    .join(', ');
}

function renderModal(entry, { fromNavigation = false } = {}) {
  state.activeEntryKey = entryKey(entry);
  const coverUrl = getCoverUrl(entry);
  const favorite = state.favorites.has(state.activeEntryKey);
  const creatorsText = formatCreators(entry.creators);
  const availableFormats = Object.entries(entry.formats || {}).filter(([, data]) => data?.hasFile && data.cheatsCount > 0);

  elements.modalTitle.textContent = entry.title;
  elements.modalIdVersion.textContent = `${entry.id} · ${entry.version}`;
  elements.modalCheatsTotal.textContent = `${entry.cheatsTotal} total cheats`;
  elements.modalCreators.textContent = `By ${creatorsText}`;

  const noteText = state.notes.get(metadataEntryKey(entry));
  if (typeof noteText === 'string' && noteText.trim()) {
    elements.modalNotesContent.innerHTML = renderBasicMarkdown(noteText);
    elements.modalNotes.hidden = false;
  } else {
    elements.modalNotesContent.innerHTML = '';
    elements.modalNotes.hidden = true;
  }

  // modal hero still gets the full-size 1024 image
  elements.modalHero.style.backgroundImage = coverUrl
    ? `linear-gradient(180deg, rgba(5,11,20,0.12), rgba(5,11,20,0.88)), url("${coverUrl.replaceAll('"', '\\"') + COVERART_SUFFIX_HERO}")`
    : 'linear-gradient(135deg, rgba(108, 168, 255, 0.24), rgba(143, 124, 255, 0.28))';

  elements.modalCheatGroups.innerHTML = '';

  availableFormats.forEach(([format, data]) => {
    const section = document.createElement('section');
    section.className = 'cheat-group';
    const downloadDetails = getCheatDownloadDetails(entry, format);

    const items = data.cheats
      .map((cheat) => `<li>${escapeHtml(cheat)}</li>`)
      .join('');

    const reportIssueUrl = buildCheatIssueUrl(entry, format);

    section.innerHTML = `
      <div class="cheat-group-header">
        <h3>${escapeHtml(format)}</h3>
        <div class="cheat-group-actions">
          ${
            downloadDetails
              ? `<button type="button" class="cheat-download-btn" aria-label="Download ${escapeHtml(format.toUpperCase())} cheat file as ZIP">Download</button>`
              : ''
          }
          <a
            class="cheat-report-btn"
            href="${escapeHtml(reportIssueUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Report a problem with ${escapeHtml(entry.title)} ${escapeHtml(entry.id)} version ${escapeHtml(entry.version)}"
          >Report Problem</a>
        </div>
        <span class="cheat-count">${data.cheatsCount} cheat${data.cheatsCount === 1 ? '' : 's'}</span>
      </div>
      <ul class="cheat-list">${items}</ul>
    `;

    const downloadButton = section.querySelector('.cheat-download-btn');
    if (downloadButton) {
      downloadButton.addEventListener('click', () => {
        downloadCheatAsZip(entry, format, downloadButton);
      });
    }

    elements.modalCheatGroups.append(section);
  });

  elements.modalRoot.classList.remove('hidden');
  elements.modalRoot.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  updateHashForModal({ fromNavigation });
}

function hideModal() {
  elements.modalRoot.classList.add('hidden');
  elements.modalRoot.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function closeModal() {
  const hasHash = Boolean(getHashEntryKey());
  const openedFromPushState = Boolean(history.state && history.state.modal);

  if (hasHash && openedFromPushState) {
    history.back();
    return;
  }

  hideModal();
  clearHash();
}

function openModal(key) {
  const entry = state.entries.find((item) => entryKey(item) === key);
  if (!entry) return;
  renderModal(entry, { fromNavigation: true });
}

function maybeRestoreModalFromHash() {
  const hashKey = getHashEntryKey();

  if (!hashKey) {
    hideModal();
    state.activeEntryKey = null;
    return;
  }

  const match = state.entries.find((entry) => entryKey(entry) === hashKey);
  if (match) {
    renderModal(match, { fromNavigation: false });
  } else {
    hideModal();
    state.activeEntryKey = null;
  }
}

function debounce(fn, ms) {
  let timer = null;
  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
  debounced.flush = (...args) => {
    if (timer) clearTimeout(timer);
    timer = null;
    fn(...args);
  };
  return debounced;
}

function runSearch() {
  const previousEffectiveSearch = state._lastEffectiveSearch || '';
  const nextEffectiveSearch = getEffectiveSearchTerm(state.searchTerm);
  state._lastEffectiveSearch = nextEffectiveSearch;

  // nothing changed (e.g. typing inside the 1-char "below threshold" zone) → skip
  if (previousEffectiveSearch === nextEffectiveSearch) return;

  filterEntries();
  renderCards();
}

const debouncedSearch = debounce(runSearch, SEARCH_DEBOUNCE_MS);

function initEvents() {
  elements.searchInput.addEventListener('input', (event) => {
    state.searchTerm = event.target.value;
    updateUrl();
    debouncedSearch();
  });

  // pressing Enter should fire the search instantly without waiting for the debounce
  elements.searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      debouncedSearch.flush();
    }
  });

  elements.toggleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.activeFilter = button.dataset.filter;
      elements.toggleButtons.forEach((item) => {
        const isActive = item === button;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-pressed', String(isActive));
      });
      updateUrl();
      filterEntries();
      renderCards();
    });
  });

  elements.sortSelect.addEventListener('change', (event) => {
    state.activeSort = VALID_SORTS.has(event.target.value)
      ? event.target.value
      : DEFAULT_SORT;
    updateUrl();
    filterEntries();
    renderCards();
  });

  elements.modalClose.addEventListener('click', closeModal);
  elements.modalBackdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !elements.modalRoot.classList.contains('hidden')) closeModal();
  });

  window.addEventListener('scroll', syncHeaderState, { passive: true });
  window.addEventListener('resize', syncLayoutOffsets);
  window.addEventListener('popstate', () => {
    const hashKey = getHashEntryKey();

    if (!hashKey) {
      hideModal();
      state.activeEntryKey = null;
      return;
    }

    maybeRestoreModalFromHash();
  });

  const resizeObserver = new ResizeObserver(syncLayoutOffsets);
  resizeObserver.observe(elements.siteHeader);
  resizeObserver.observe(elements.siteFooter);
}

async function loadData() {
  elements.statusMessage.hidden = false;
  elements.statusMessage.textContent = 'Loading data files…';

  const [cheatsResponse, coversResponse, addedData, notesData, pinnedData] = await Promise.all([
    fetch('./cheatslist.json'),
    fetch('./covers.json'),
    loadOptionalJson('./added.json', {}),
    loadOptionalJson('./notes.json', {}),
    loadOptionalJson('./pinned.json', []),
  ]);

  if (!cheatsResponse.ok || !coversResponse.ok) {
    throw new Error('Could not load cheatslist.json or covers.json');
  }

  const [cheatsData, coversData] = await Promise.all([cheatsResponse.json(), coversResponse.json()]);
  const validAddedData =
    addedData && typeof addedData === 'object' && !Array.isArray(addedData)
      ? addedData
      : {};

  if (validAddedData !== addedData) {
    console.warn('added.json must contain a JSON object. NEW badges have been disabled.');
  }

  state.addedDates = new Map(
    Object.entries(validAddedData).map(([key, date]) => [key, String(date)])
  );

  const validNotesData =
    notesData && typeof notesData === 'object' && !Array.isArray(notesData)
      ? notesData
      : {};

  if (validNotesData !== notesData) {
    console.warn('notes.json must contain a JSON object. Notes have been disabled.');
  }

  state.notes = new Map(
    Object.entries(validNotesData)
      .filter(([, note]) => typeof note === 'string' && note.trim())
      .map(([key, note]) => [key, note])
  );

  const validPinnedData = Array.isArray(pinnedData) ? pinnedData : [];

  if (validPinnedData !== pinnedData) {
    console.warn('pinned.json must contain a JSON array. Pinned entries have been disabled.');
  }

  state.pinned = new Set(
    validPinnedData
      .filter((key) => typeof key === 'string')
      .map((key) => key.trim())
      .filter(Boolean)
  );

  state.generatedUtc = parseGeneratedDate(cheatsData.generatedUtc || cheatsData.generatedUTC || coversData.generatedUtc);
  state.entries = [...(cheatsData.entries || [])].map((entry) => {
    const noteText = state.notes.get(metadataEntryKey(entry)) || '';

    return {
      ...entry,
      addedDate: state.addedDates.get(entryKey(entry)) || null,
      idLower: normalizeSearch(entry.id),
      titleLower: normalizeSearch(entry.title),
      searchBlob: [
        entry.id,
        entry.title,
        ...(entry.creators || []),
        noteText,
      ].map(normalizeSearch).join(' | '),
    };
  });

  state.totalGames = countUniqueGames(state.entries);
  state.covers = new Map(
    Object.entries(coversData.titles || {}).map(([title, url]) => [normalize(title), url])
  );

  syncFooter();
}

async function init() {
  state.favorites = loadFavorites();
  applyControlsFromUrl();
  syncFooter();
  syncHeaderState();
  syncLayoutOffsets();
  initEvents();

  try {
    await loadData();
    filterEntries();
    renderCards();
	state._lastEffectiveSearch = getEffectiveSearchTerm(state.searchTerm);
    maybeRestoreModalFromHash();
  } catch (error) {
    console.error(error);
    elements.statusMessage.hidden = false;
    elements.statusMessage.textContent =
      'Failed to load cheatslist.json or covers.json. Run the site from a web server and make sure both files are in the same folder.';
  } finally {
    syncLayoutOffsets();
  }
}

init();
