const state = {
  entries: [],
  covers: new Map(),
  favorites: new Set(),
  activeFilter: 'all',
  searchTerm: '',
  searchActive: false,
  filteredEntries: [],
  activeEntryKey: null,
  totalGames: 0,
  generatedUtc: null,
};

const elements = {
  siteHeader: document.getElementById('siteHeader'),
  siteFooter: document.getElementById('siteFooter'),
  searchInput: document.getElementById('searchInput'),
  cardsGrid: document.getElementById('cardsGrid'),
  statusMessage: document.getElementById('statusMessage'),
  emptyState: document.getElementById('emptyState'),
  resultsLine: document.getElementById('resultsLine'),
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
const HASH_SEPARATOR = '-';

function entryKey(entry) {
  return `${entry.id}${HASH_SEPARATOR}${entry.version}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getCoverUrl(entry) {
  const titleCover = state.covers.get(normalize(entry.title));
  if (titleCover && titleCover !== 'no-image') return titleCover;

  const idCover = state.covers.get(normalize(`${entry.title} ${entry.id}`));
  if (idCover && idCover !== 'no-image') return idCover;

  return null;
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
  return {
    q: params.get(SEARCH_PARAM) || '',
    view: params.get(FILTER_PARAM) === 'favorites' ? 'favorites' : 'all',
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
  elements.searchInput.value = params.q;
  elements.toggleButtons.forEach((button) => {
    const isActive = button.dataset.filter === state.activeFilter;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function getEffectiveSearchTerm(value) {
  const normalizedValue = normalize(value);
  return normalizedValue.length >= 2 ? normalizedValue : '';
}

function filterEntries() {
  const effectiveSearch = getEffectiveSearchTerm(state.searchTerm);
  const useSearch = effectiveSearch.length >= 2;

  state.filteredEntries = state.entries.filter((entry) => {
    if (state.activeFilter === 'favorites' && !state.favorites.has(entryKey(entry))) {
      return false;
    }

    if (!useSearch) return true;

    return (
      entry.searchBlob.includes(effectiveSearch) ||
      entry.idLower.includes(effectiveSearch) ||
      entry.titleLower.includes(effectiveSearch)
    );
  });

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

function renderCards() {
  elements.cardsGrid.innerHTML = '';

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

  const fragment = document.createDocumentFragment();

  state.filteredEntries.forEach((entry) => {
    const clone = elements.cardTemplate.content.cloneNode(true);
    const card = clone.querySelector('.game-card');
    const favoriteButton = clone.querySelector('.favorite-btn');
    const hitbox = clone.querySelector('.card-hitbox');
    const title = clone.querySelector('.card-title');
    const id = clone.querySelector('.card-id');
    const version = clone.querySelector('.card-version');
    const cheats = clone.querySelector('.card-cheats');
    const cover = clone.querySelector('.card-cover');
    const key = entryKey(entry);
    const isFavorite = state.favorites.has(key);
    const coverUrl = getCoverUrl(entry);

    title.textContent = entry.title;
    id.textContent = entry.id;
    version.textContent = `v${entry.version}`;
    cheats.textContent = `${entry.cheatsTotal} cheat${entry.cheatsTotal === 1 ? '' : 's'}`;

    cover.src = coverUrl || createPlaceholderSvg(entry.title);
    cover.alt = `${entry.title} cover art`;
    if (!coverUrl) cover.dataset.noImage = 'true';

    favoriteButton.classList.toggle('is-favorite', isFavorite);
    favoriteButton.setAttribute('aria-pressed', String(isFavorite));
    favoriteButton.setAttribute('aria-label', isFavorite ? `Remove ${entry.title} from favorites` : `Add ${entry.title} to favorites`);

    favoriteButton.addEventListener('click', (event) => {
      event.stopPropagation();
      setFavorite(key, !state.favorites.has(key));
      filterEntries();
      renderCards();
      if (state.activeEntryKey === key) renderModal(entry);
    });

    hitbox.setAttribute('aria-label', `Open details for ${entry.title} ${entry.id} version ${entry.version}`);
    hitbox.addEventListener('click', () => openModal(key));

    card.dataset.entryKey = key;
    fragment.append(card);
  });

  elements.cardsGrid.append(fragment);
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

  elements.modalHero.style.backgroundImage = coverUrl
    ? `linear-gradient(180deg, rgba(5,11,20,0.12), rgba(5,11,20,0.88)), url("${coverUrl.replaceAll('"', '\\"')}")`
    : 'linear-gradient(135deg, rgba(108, 168, 255, 0.24), rgba(143, 124, 255, 0.28))';

  elements.modalCheatGroups.innerHTML = '';

  availableFormats.forEach(([format, data]) => {
    const section = document.createElement('section');
    section.className = 'cheat-group';

    const items = data.cheats
      .map((cheat) => `<li>${escapeHtml(cheat)}</li>`)
      .join('');

    section.innerHTML = `
      <div class="cheat-group-header">
        <h3>${escapeHtml(format)}</h3>
        <span class="cheat-count">${data.cheatsCount} cheat${data.cheatsCount === 1 ? '' : 's'}</span>
      </div>
      <ul class="cheat-list">${items}</ul>
    `;
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

function initEvents() {
  elements.searchInput.addEventListener('input', (event) => {
  
    const previousEffectiveSearch = getEffectiveSearchTerm(state.searchTerm);
    const nextSearchTerm = event.target.value;
    const nextEffectiveSearch = getEffectiveSearchTerm(nextSearchTerm);
  
    state.searchTerm = nextSearchTerm;
    updateUrl();
  
    // nothing changed → skip heavy render
    if (previousEffectiveSearch === nextEffectiveSearch) return;
  
    // going from active search → inactive search (2 → 1 chars)
    if (previousEffectiveSearch && !nextEffectiveSearch) {
      filterEntries();
      renderCards();
      return;
    }
  
    // active search update
    if (nextEffectiveSearch) {
      filterEntries();
      renderCards();
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

  const [cheatsResponse, coversResponse] = await Promise.all([
    fetch('./cheatslist.json', { cache: 'no-store' }),
    fetch('./covers.json', { cache: 'no-store' }),
  ]);

  if (!cheatsResponse.ok || !coversResponse.ok) {
    throw new Error('Could not load cheatslist.json or covers.json');
  }

  const [cheatsData, coversData] = await Promise.all([cheatsResponse.json(), coversResponse.json()]);

  state.generatedUtc = parseGeneratedDate(cheatsData.generatedUtc || cheatsData.generatedUTC || coversData.generatedUtc);
  state.entries = [...(cheatsData.entries || [])]
    .map((entry) => ({
      ...entry,
      searchBlob: [entry.id, entry.title, ...(entry.creators || [])].map(normalize).join(' | '),
    }))
    .sort((a, b) => {
      const titleSort = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      if (titleSort !== 0) return titleSort;
      const idSort = a.id.localeCompare(b.id, undefined, { sensitivity: 'base' });
      if (idSort !== 0) return idSort;
      return a.version.localeCompare(b.version, undefined, { numeric: true, sensitivity: 'base' });
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
    maybeRestoreModalFromHash();
  } catch (error) {
    console.error(error);
    elements.statusMessage.hidden = false;
    elements.statusMessage.textContent = 'Failed to load cheatslist.json or covers.json. Run the site from a web server and make sure both files are in the same folder.';
  } finally {
    syncLayoutOffsets();
  }
}

init();
