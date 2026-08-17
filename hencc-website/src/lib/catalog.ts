import type { CatalogEntry, Platform } from '../types/catalog'

type Hideable = {
  hidden?: boolean
  hide?: boolean
}

export const isHidden = (value: Hideable) => value.hidden === true || value.hide === true

const SEARCH_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'by',
  'for',
  'from',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
])

/**
 * Normalize text for human-friendly catalog searches.
 *
 * - Diacritics/case are ignored.
 * - Ampersands are treated as the word "and" so "Ratchet and Clank"
 *   matches "Ratchet & Clank".
 * - Dots and apostrophes are removed without creating a word break so
 *   "Stalker" matches "S.T.A.L.K.E.R" and "Assassins" matches "Assassin's".
 * - Other punctuation/symbols become word separators.
 */
export const normalizeSearch = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.'’‘`´]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const compactSearch = (value: string) => normalizeSearch(value).replace(/\s+/g, '')

const searchTokens = (value: string) => normalizeSearch(value).split(' ').filter(Boolean)

const significantTokens = (value: string) => {
  const tokens = searchTokens(value)
  const useful = tokens.filter((token) => !SEARCH_STOP_WORDS.has(token))
  return useful.length ? useful : tokens
}

const tokenMatchStrength = (queryToken: string, candidateToken: string) => {
  if (candidateToken === queryToken) return 1
  if (candidateToken.startsWith(queryToken)) return 0.9
  if (candidateToken.includes(queryToken)) return 0.75
  return 0
}

const fieldTokenScore = (query: string, candidate: string) => {
  const queryParts = significantTokens(query)
  if (!queryParts.length) return { matched: 0, total: 0, strength: 0 }

  const candidateParts = searchTokens(candidate)
  const candidateCompact = compactSearch(candidate)
  let matched = 0
  let strength = 0

  for (const queryPart of queryParts) {
    let best = 0
    for (const candidatePart of candidateParts) {
      best = Math.max(best, tokenMatchStrength(queryPart, candidatePart))
    }

    // Also allow punctuation-separated names such as Spider-Man to match
    // an unseparated query token such as "spiderman".
    if (!best && candidateCompact.includes(queryPart)) best = 0.8

    if (best > 0) {
      matched += 1
      strength += best
    }
  }

  return { matched, total: queryParts.length, strength }
}

const scoreTextField = (
  query: string,
  candidate: string,
  weights: {
    exact: number
    startsWith: number
    phrase: number
    compact: number
    allTokens: number
    partialTokens: number
  },
) => {
  const normalizedQuery = normalizeSearch(query)
  const normalizedCandidate = normalizeSearch(candidate)
  if (!normalizedQuery || !normalizedCandidate) return 0

  if (normalizedCandidate === normalizedQuery) return weights.exact

  const lengthSimilarity = Math.min(1, normalizedQuery.length / normalizedCandidate.length)
  const lengthFactor = 0.92 + lengthSimilarity * 0.08

  if (normalizedCandidate.startsWith(normalizedQuery)) return weights.startsWith * lengthFactor
  if (normalizedCandidate.includes(normalizedQuery)) return weights.phrase * lengthFactor

  const compactQuery = compactSearch(query)
  const compactCandidate = compactSearch(candidate)
  if (compactQuery && compactCandidate.includes(compactQuery)) {
    const compactLengthSimilarity = Math.min(1, compactQuery.length / compactCandidate.length)
    return weights.compact * (0.92 + compactLengthSimilarity * 0.08)
  }

  const tokenScore = fieldTokenScore(query, candidate)
  if (!tokenScore.matched || !tokenScore.total) return 0

  const coverage = tokenScore.matched / tokenScore.total
  const averageStrength = tokenScore.strength / tokenScore.total

  if (tokenScore.matched === tokenScore.total) {
    const candidateTokenCount = significantTokens(candidate).length
    const extraTokens = Math.max(0, candidateTokenCount - tokenScore.total)
    const brevityFactor = Math.max(0.82, 1 - extraTokens * 0.045)
    return weights.allTokens * (0.85 + averageStrength * 0.15) * brevityFactor
  }

  // Partial matches intentionally remain searchable, but rank below entries
  // containing all meaningful words from the query.
  return weights.partialTokens * coverage * (0.75 + averageStrength * 0.25)
}

/**
 * Returns a relevance score for a catalog entry. A score of 0 means the entry
 * should not be included for the query. Higher scores are better matches.
 */
export const catalogSearchScore = (entry: CatalogEntry, query: string) => {
  const normalizedQuery = normalizeSearch(query)
  if (!normalizedQuery) return 1

  let score = 0

  score = Math.max(
    score,
    scoreTextField(query, entry.title, {
      exact: 1200,
      startsWith: 1120,
      phrase: 1060,
      compact: 1020,
      allTokens: 940,
      partialTokens: 520,
    }),
  )

  score = Math.max(
    score,
    scoreTextField(query, entry.id, {
      exact: 1180,
      startsWith: 1080,
      phrase: 1000,
      compact: 980,
      allTokens: 900,
      partialTokens: 460,
    }),
  )

  for (const creator of entry.versions.flatMap((version) => version.creators)) {
    score = Math.max(
      score,
      scoreTextField(query, creator, {
        exact: 820,
        startsWith: 760,
        phrase: 720,
        compact: 700,
        allTokens: 650,
        partialTokens: 340,
      }),
    )
  }

  for (const format of entry.versions.flatMap((version) => version.formats)) {
    score = Math.max(
      score,
      scoreTextField(query, format, {
        exact: 300,
        startsWith: 260,
        phrase: 240,
        compact: 230,
        allTokens: 220,
        partialTokens: 120,
      }),
    )
  }

  return score
}

// Kept as a small utility for callers that need the normalized searchable text.
export const catalogSearchText = (entry: CatalogEntry) =>
  normalizeSearch(
    [
      entry.id,
      entry.title,
      ...entry.versions.flatMap((version) => version.creators),
      ...entry.versions.flatMap((version) => version.formats),
    ].join(' '),
  )

export const platformFor = (id: string): Platform => {
  if (id.startsWith('CUSA')) return 'PS4'
  if (id.startsWith('PPSA')) return 'PS5'
  return 'Other'
}

const numberChunks = (value: string) => value.split('.').map((part) => Number(part) || 0)

export const compareVersions = (a: string, b: string) => {
  const aa = numberChunks(a)
  const bb = numberChunks(b)
  const length = Math.max(aa.length, bb.length)
  for (let index = 0; index < length; index += 1) {
    const diff = (aa[index] ?? 0) - (bb[index] ?? 0)
    if (diff !== 0) return diff
  }
  return a.localeCompare(b)
}

export const displayDate = (isoDate: string | undefined) => {
  if (!isoDate) return null
  const date = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return isoDate
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export const formatLabel = (format: string) => format.toUpperCase()

const normalizeBasePath = (basePath: string) => {
  const withLeadingSlash = basePath.startsWith('/') ? basePath : `/${basePath}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

export const makeGamePath = (id: string, version: string, basePath = '/') =>
  `${normalizeBasePath(basePath)}game/${encodeURIComponent(id.toUpperCase())}/${encodeURIComponent(version)}/`

export const parseGamePath = (pathname: string, basePath = '/') => {
  const normalizedBase = normalizeBasePath(basePath)
  if (!pathname.startsWith(normalizedBase)) return null

  const relativePath = pathname.slice(normalizedBase.length)
  const match = relativePath.match(/^game\/([^/]+)\/([^/]+)\/?$/i)
  if (!match) return null

  try {
    return {
      id: decodeURIComponent(match[1]).toUpperCase(),
      version: decodeURIComponent(match[2]),
    }
  } catch {
    return null
  }
}

export const parseHash = (hash: string) => {
  const raw = decodeURIComponent(hash.replace(/^#/, '')).trim()
  if (!raw) return null
  const match = raw.match(/^([A-Za-z0-9]+)(?:-(.+))?$/)
  if (!match) return null
  return { id: match[1].toUpperCase(), version: match[2] }
}
