import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  dataRoot,
  dateOnlyFromTimestamp,
  distRoot,
  gameDetailPath,
  isHidden,
  readJson,
  readOptionalJson,
} from './lib/build-utils.mjs'

const projectRoot = process.cwd()
const catalogPath = path.join(dataRoot, 'catalog.json')
const coversPath = path.join(dataRoot, 'covers.json')
const statsPath = path.join(dataRoot, 'stats.json')
const gameSummariesPath = path.join(dataRoot, 'game-summaries.json')
const templatePath = path.join(distRoot, 'index.html')
const configPath = path.join(projectRoot, 'src', 'config.ts')
const homepageContentPath = path.join(projectRoot, 'src', 'content', 'homepage.json')
const contentManifestPath = path.join(projectRoot, 'src', 'content', 'pages.json')
const contentPagesRoot = path.join(projectRoot, 'src', 'content', 'pages')

const [catalog, covers, stats, gameSummaries, template, configSource, homepageContent, contentManifest] = await Promise.all([
  readJson(catalogPath),
  readJson(coversPath),
  readOptionalJson(statsPath, { filesWithCheats: 0, rows: 0 }),
  readJson(gameSummariesPath),
  readFile(templatePath, 'utf8'),
  readFile(configPath, 'utf8'),
  readJson(homepageContentPath),
  readJson(contentManifestPath),
])

const readNumberConstant = (name) => {
  const match = configSource.match(new RegExp(`export\\s+const\\s+${name}\\s*=\\s*(\\d+)`))
  if (!match) throw new Error(`Could not read ${name} from src/config.ts.`)
  return Number(match[1])
}

const readStringConstant = (name) => {
  const match = configSource.match(new RegExp(`export\\s+const\\s+${name}\\s*=\\s*['\"]([^'\"]+)['\"]`))
  if (!match) throw new Error(`Could not read ${name} from src/config.ts.`)
  return match[1]
}

const COVER_DETAIL_SIZE = readNumberConstant('COVER_DETAIL_SIZE')
const COVER_FALLBACK_URL = readStringConstant('COVER_FALLBACK_URL')
const PUBLIC_SITE_URL = readStringConstant('PUBLIC_SITE_URL').replace(/\/$/, '')

const buildCoverImageUrl = (coverUrl, size) => {
  const requested = String(coverUrl || '').trim()
  const source = !requested || requested.toLowerCase() === 'no-image'
    ? COVER_FALLBACK_URL
    : requested

  try {
    const url = new URL(source)
    if (url.hostname.toLowerCase() === 'image.api.playstation.com') {
      url.searchParams.set('w', String(size))
      url.searchParams.set('thumb', 'false')
    }
    return url.toString()
  } catch {
    return source
  }
}

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const replaceTitle = (html, title) => {
  const tag = `<title>${escapeHtml(title)}</title>`
  return /<title>.*?<\/title>/i.test(html)
    ? html.replace(/<title>.*?<\/title>/i, tag)
    : html.replace('</head>', `    ${tag}\n  </head>`)
}

const replaceMeta = (html, attribute, key, content) => {
  const expression = new RegExp(`<meta\\s+${attribute}=["']${escapeRegExp(key)}["'][^>]*>`, 'i')
  const tag = `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(content)}" />`
  return expression.test(html)
    ? html.replace(expression, tag)
    : html.replace('</head>', `    ${tag}\n  </head>`)
}

const replaceLink = (html, rel, href) => {
  const expression = new RegExp(`<link\\s+[^>]*rel=["']${escapeRegExp(rel)}["'][^>]*>`, 'i')
  const tag = `<link rel="${escapeHtml(rel)}" href="${escapeHtml(href)}" />`
  return expression.test(html)
    ? html.replace(expression, tag)
    : html.replace('</head>', `    ${tag}\n  </head>`)
}

const removeMeta = (html, attribute, key) => {
  const expression = new RegExp(`\\s*<meta\\s+${attribute}=["']${escapeRegExp(key)}["'][^>]*>\\s*`, 'i')
  return html.replace(expression, '\n')
}

const removeLink = (html, rel) => {
  const expression = new RegExp(`\\s*<link\\s+[^>]*rel=["']${escapeRegExp(rel)}["'][^>]*>\\s*`, 'i')
  return html.replace(expression, '\n')
}

const stripScripts = (html) => html.replace(/\s*<script\b[^>]*>[\s\S]*?<\/script>\s*/gi, '\n')

const replaceStructuredData = (html, data) => {
  const tag = `<script id="hencc-structured-data" type="application/ld+json">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>`
  const expression = /<script\s+id=["']hencc-structured-data["'][^>]*>[\s\S]*?<\/script>/i
  return expression.test(html)
    ? html.replace(expression, tag)
    : html.replace('</head>', `    ${tag}\n  </head>`)
}

const escapeXml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

const renderSitemap = (items) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.map(({ loc, lastmod }) => `  <url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`

const replaceRootContent = (html, content) => {
  // Vite 8 may move the generated module script into <head>, so the React
  // root must be located independently of where Vite emits its script tag.
  // The source shell intentionally contains an empty #root; generated pages
  // are always based on that untouched shell before fallback content is added.
  const root = /<div\s+id=["']root["'][^>]*>\s*<\/div>/i
  if (!root.test(html)) throw new Error('Could not find the empty Vite root element in dist/index.html.')
  return html.replace(root, `<div id="root">${content}</div>`)
}

const platformFor = (id) => {
  if (id.startsWith('CUSA')) return 'PlayStation 4'
  if (id.startsWith('PPSA')) return 'PlayStation 5'
  return 'PlayStation'
}

const formatDate = (value) => value ? escapeHtml(value) : 'No Record'

const renderHomepageStaticContent = () => {
  const visibleEntries = (catalog.entries ?? []).filter((entry) => !isHidden(entry))
  const games = visibleEntries.length
  const versions = visibleEntries.reduce((sum, entry) => sum + (entry.versions?.length ?? 0), 0)
  const sampleLinks = visibleEntries.slice(0, 16).flatMap((entry) => {
    const version = entry.versions?.at(-1)?.version
    if (!version) return []
    const href = `/game/${encodeURIComponent(entry.id)}/${encodeURIComponent(version)}/`
    return `<li><a href="${escapeHtml(href)}">${escapeHtml(entry.title)} — ${escapeHtml(entry.id)} v${escapeHtml(version)}</a></li>`
  }).join('')
  const paragraphs = (homepageContent.paragraphs ?? []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')

  return `
    <div class="static-fallback" data-prerendered-content="homepage">
      <div class="static-fallback-inner">
        <div class="static-brand">HEN Cheats Collection</div>
        <main>
          <h1>HEN Cheats Collection</h1>
          <p class="static-lead">The largest collection of PlayStation 4 and PlayStation 5 cheats. Play Your Way.</p>
          <div class="static-stats" aria-label="Collection statistics">
            <span>${games.toLocaleString('en-US')} games</span>
            <span>${versions.toLocaleString('en-US')} versions</span>
            <span>${Number(stats.filesWithCheats ?? 0).toLocaleString('en-US')} files</span>
            <span>${Number(stats.rows ?? 0).toLocaleString('en-US')} rows</span>
          </div>
          <section aria-labelledby="static-about-heading">
            <h2 id="static-about-heading">${escapeHtml(homepageContent.heading)}</h2>
            ${paragraphs}
            <p><a href="/about/">About HENCC</a> · <a href="/guides/">Guides</a> · <a href="/faq/">FAQ</a> · <a href="/privacy/">Privacy</a> · <a href="/contact/">Contact</a></p>
          </section>
          ${sampleLinks ? `<section aria-labelledby="static-games-heading"><h2 id="static-games-heading">Browse the collection</h2><p>Representative entries from the current catalog. The full interactive catalog loads when JavaScript is available.</p><ul class="static-game-links">${sampleLinks}</ul></section>` : ''}
        </main>
      </div>
    </div>`
}

const renderSource = (file) => {
  const creators = Array.isArray(file.creators) && file.creators.length ? file.creators.join(', ') : 'Unknown creator'
  const cheats = Array.isArray(file.cheats) ? file.cheats : []
  const notes = typeof file.notes === 'string' && file.notes.trim()
    ? `<div class="static-note"><strong>Notes:</strong> ${escapeHtml(file.notes.trim())}</div>`
    : ''
  const issue = file.issue === true
    ? '<div class="static-issue"><strong>Known issue:</strong> This source file is currently marked as having a reported issue.</div>'
    : ''
  const cheatList = cheats.length
    ? `<h3>Cheats</h3><ul>${cheats.map((cheat) => `<li>${escapeHtml(cheat)}</li>`).join('')}</ul>`
    : '<p>No cheat rows are listed for this source file.</p>'

  return `<article class="static-source" data-source-id="${escapeHtml(file.sourceId)}">
    <h3>${escapeHtml(file.file)}</h3>
    <ul class="static-meta">
      <li><strong>Format:</strong> ${escapeHtml(String(file.format ?? '').toUpperCase())}</li>
      <li><strong>Process:</strong> ${escapeHtml(file.process || 'Not specified')}</li>
      <li><strong>Creator(s):</strong> ${escapeHtml(creators)}</li>
      <li><strong>Rows:</strong> ${cheats.length.toLocaleString('en-US')}</li>
    </ul>
    ${notes}
    ${issue}
    ${cheatList}
  </article>`
}

const renderGameStaticContent = ({ entry, version, visibleFiles, pageUrl, gameSummary }) => {
  const creators = Array.from(new Set(visibleFiles.flatMap((file) => Array.isArray(file.creators) ? file.creators : []).filter(Boolean)))
  const formats = Array.from(new Set(visibleFiles.map((file) => String(file.format ?? '').toUpperCase()).filter(Boolean)))
  const rows = visibleFiles.reduce((sum, file) => sum + (Array.isArray(file.cheats) ? file.cheats.length : 0), 0)
  const sources = visibleFiles.map(renderSource).join('')

  return `
    <div class="static-fallback" data-prerendered-content="game-version">
      <div class="static-fallback-inner">
        <div class="static-brand"><a href="/">HEN Cheats Collection</a></div>
        <main>
          <h1>${escapeHtml(entry.title)}</h1>
          <p class="static-lead">${escapeHtml(platformFor(entry.id))} cheat collection entry for ${escapeHtml(entry.title)}, Title ID ${escapeHtml(entry.id)}, version ${escapeHtml(version.version)}.</p>
          <section aria-labelledby="static-game-summary">
            <h2 id="static-game-summary">Game and version information</h2>
            <ul class="static-meta">
              <li><strong>Platform:</strong> ${escapeHtml(platformFor(entry.id))}</li>
              <li><strong>Title ID:</strong> ${escapeHtml(entry.id)}</li>
              <li><strong>Version:</strong> ${escapeHtml(version.version)}</li>
              <li><strong>Files Total:</strong> ${gameSummary.filesTotal.toLocaleString('en-US')}</li>
              <li><strong>Updated:</strong> ${formatDate(gameSummary.updated)}</li>
              <li><strong>Added:</strong> ${formatDate(gameSummary.added)}</li>
              <li><strong>Rows:</strong> ${rows.toLocaleString('en-US')}</li>
              <li><strong>Formats:</strong> ${escapeHtml(formats.join(', ') || 'None')}</li>
              <li><strong>Creator(s):</strong> ${escapeHtml(creators.join(', ') || 'Unknown creator')}</li>
            </ul>
            <p>This page is a static representation of the same collection data used by the interactive HEN Cheats Collection interface. Verify the Title ID and game version before choosing an entry.</p>
            <p><a href="${escapeHtml(pageUrl)}">Canonical game/version link</a> · <a href="/">Browse all games</a></p>
          </section>
          <section aria-labelledby="static-source-files">
            <h2 id="static-source-files">Source files and cheat rows</h2>
            ${sources || '<p>No visible source files are available for this version.</p>'}
          </section>
        </main>
      </div>
    </div>`
}

const renderInlineMarkdown = (value) => {
  let result = escapeHtml(value)
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>')
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  return result
}

const renderEditorialMarkdown = (markdown) => {
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n')
  const output = []
  let paragraph = []
  let listType = null

  const flushParagraph = () => {
    if (!paragraph.length) return
    output.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`)
    paragraph = []
  }

  const closeList = () => {
    if (!listType) return
    output.push(`</${listType}>`)
    listType = null
  }

  const openList = (type) => {
    if (listType === type) return
    closeList()
    output.push(`<${type}>`)
    listType = type
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flushParagraph()
      closeList()
      continue
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      closeList()
      const level = heading[1].length
      output.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`)
      continue
    }

    const checkbox = line.match(/^-\s+\[([ xX])\]\s+(.+)$/)
    if (checkbox) {
      flushParagraph()
      openList('ul')
      output.push(`<li><input type="checkbox" disabled${checkbox[1].toLowerCase() === 'x' ? ' checked' : ''} /> ${renderInlineMarkdown(checkbox[2])}</li>`)
      continue
    }

    const unordered = line.match(/^[-*]\s+(.+)$/)
    if (unordered) {
      flushParagraph()
      openList('ul')
      output.push(`<li>${renderInlineMarkdown(unordered[1])}</li>`)
      continue
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/)
    if (ordered) {
      flushParagraph()
      openList('ol')
      output.push(`<li>${renderInlineMarkdown(ordered[1])}</li>`)
      continue
    }

    closeList()
    paragraph.push(line)
  }

  flushParagraph()
  closeList()
  return output.join('')
}

const renderNotFoundStaticContent = () => `
  <div class="static-fallback" data-prerendered-content="not-found">
    <div class="static-fallback-inner">
      <div class="static-brand"><a href="/">HEN Cheats Collection</a></div>
      <main>
        <h1>Page not found</h1>
        <p class="static-lead">The requested HEN Cheats Collection page does not exist.</p>
        <p><a href="/">Browse the collection</a></p>
      </main>
    </div>
  </div>`

const renderContentStaticContent = (page, renderedMarkdown) => `
  <div class="app-shell content-app-shell" data-prerendered-content="editorial-page">
    <header class="site-header content-site-header">
      <div class="header-inner">
        <a class="brand" href="/" aria-label="HEN Cheats Collection home">
          <span class="brand-mark">H</span>
          <span class="brand-copy"><strong>HEN Cheats</strong><small>Collection</small></span>
        </a>
        <nav class="content-header-nav" aria-label="Content navigation">
          <a href="/">Browse</a><a href="/guides/">Guides</a><a href="/faq/">FAQ</a>
        </nav>
        <a class="github-link" href="https://github.com/TeeKay87/HEN-Cheats-Collection"><span>GitHub</span></a>
      </div>
    </header>
    <main class="content-main">
      <article class="content-page">
        <div class="content-page-heading">
          <span>${escapeHtml(page.eyebrow || 'HENCC')}</span>
          <p>${escapeHtml(page.description)}</p>
        </div>
        <div class="content-markdown">${renderedMarkdown}</div>
      </article>
    </main>
    <footer class="site-footer">
      <div class="footer-inner">
        <nav class="footer-links desktop-footer-links" aria-label="Footer">
          <a href="/about/">About</a><a href="/guides/getting-started/">Getting Started</a><a href="/guides/file-formats/">File Formats</a><a href="/guides/title-ids-and-versions/">IDs &amp; Versions</a><a href="/guides/troubleshooting/">Troubleshooting</a><a href="/faq/">FAQ</a><a href="/privacy/">Privacy Policy</a><a href="/contact/">Contact</a>
        </nav>
        <nav class="footer-links mobile-footer-links" aria-label="Footer">
          <a href="/about/">About</a><a href="/guides/">Guides</a><a href="/privacy/">Privacy</a><a href="/contact/">Contact</a>
        </nav>
        <div class="footer-meta"><a href="https://github.com/TeeKay87/HEN-Cheats-Collection">GitHub</a></div>
      </div>
    </footer>
  </div>`

let generatedEditorialPages = 0
for (const page of contentManifest) {
  const markdown = await readFile(path.join(contentPagesRoot, page.file), 'utf8')
  const pageTitle = page.seoTitle || `${page.title} | HEN Cheats Collection`
  const pageUrl = `${PUBLIC_SITE_URL}${page.path}`
  let html = replaceTitle(template, pageTitle)
  html = replaceMeta(html, 'name', 'description', page.description)
  html = replaceMeta(html, 'property', 'og:title', pageTitle)
  html = replaceMeta(html, 'property', 'og:description', page.description)
  html = replaceMeta(html, 'property', 'og:type', 'website')
  html = replaceMeta(html, 'property', 'og:site_name', 'HEN Cheats Collection')
  html = replaceMeta(html, 'property', 'og:url', pageUrl)
  html = replaceLink(html, 'canonical', pageUrl)
  html = replaceMeta(html, 'name', 'twitter:card', 'summary_large_image')
  html = replaceMeta(html, 'name', 'twitter:title', pageTitle)
  html = replaceMeta(html, 'name', 'twitter:description', page.description)
  html = replaceMeta(html, 'name', 'robots', 'index,follow')
  html = replaceStructuredData(html, {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.title,
    description: page.description,
    url: pageUrl,
    isPartOf: { '@type': 'WebSite', name: 'HEN Cheats Collection', url: `${PUBLIC_SITE_URL}/` },
    author: { '@type': 'Person', name: 'TeeKay87' },
  })
  html = replaceRootContent(html, renderContentStaticContent(page, renderEditorialMarkdown(markdown)))

  const relativePath = page.path.replace(/^\/+|\/+$/g, '')
  const routeDir = path.join(distRoot, ...relativePath.split('/'))
  await mkdir(routeDir, { recursive: true })
  await writeFile(path.join(routeDir, 'index.html'), html, 'utf8')
  generatedEditorialPages += 1
}

let homepageHtml = replaceMeta(template, 'name', 'robots', 'index,follow')
homepageHtml = replaceLink(homepageHtml, 'canonical', `${PUBLIC_SITE_URL}/`)
homepageHtml = replaceMeta(homepageHtml, 'property', 'og:url', `${PUBLIC_SITE_URL}/`)
homepageHtml = replaceStructuredData(homepageHtml, {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'HEN Cheats Collection',
  url: `${PUBLIC_SITE_URL}/`,
  description: 'Browse the largest collection of cheats for the PlayStation 4 and PlayStation 5. Play Your Way.',
  creator: { '@type': 'Person', name: 'TeeKay87' },
})
homepageHtml = replaceRootContent(homepageHtml, renderHomepageStaticContent())
await writeFile(templatePath, homepageHtml, 'utf8')

let notFoundHtml = replaceTitle(template, 'Page Not Found | HEN Cheats Collection')
notFoundHtml = replaceMeta(notFoundHtml, 'name', 'description', 'The requested HEN Cheats Collection page does not exist.')
notFoundHtml = replaceMeta(notFoundHtml, 'name', 'robots', 'noindex,follow')
notFoundHtml = replaceMeta(notFoundHtml, 'property', 'og:title', 'Page Not Found | HEN Cheats Collection')
notFoundHtml = replaceMeta(notFoundHtml, 'property', 'og:description', 'The requested HEN Cheats Collection page does not exist.')
notFoundHtml = replaceMeta(notFoundHtml, 'name', 'twitter:title', 'Page Not Found | HEN Cheats Collection')
notFoundHtml = replaceMeta(notFoundHtml, 'name', 'twitter:description', 'The requested HEN Cheats Collection page does not exist.')
notFoundHtml = removeMeta(notFoundHtml, 'property', 'og:url')
notFoundHtml = removeLink(notFoundHtml, 'canonical')
notFoundHtml = replaceRootContent(notFoundHtml, renderNotFoundStaticContent())
notFoundHtml = stripScripts(notFoundHtml)
await writeFile(path.join(distRoot, '404.html'), notFoundHtml, 'utf8')

const homepageLastmod = dateOnlyFromTimestamp(catalog.generatedUtc)
const sitemapItems = [
  { loc: `${PUBLIC_SITE_URL}/`, lastmod: homepageLastmod },
  ...contentManifest.map((page) => ({ loc: `${PUBLIC_SITE_URL}${page.path}`, lastmod: null })),
]

let generated = 0
let noindexPages = 0
for (const entry of catalog.entries ?? []) {
  if (isHidden(entry)) continue
  const coverCandidate = buildCoverImageUrl(
    covers.titles?.[entry.title.trim().toLowerCase()] ?? COVER_FALLBACK_URL,
    COVER_DETAIL_SIZE,
  )
  const cover = /^https?:\/\//i.test(coverCandidate) ? coverCandidate : COVER_FALLBACK_URL

  const versionDetails = await Promise.all((entry.versions ?? []).map(async (version) => {
    const detail = await readJson(gameDetailPath(entry, version))
    const visibleFiles = (detail.files ?? []).filter((file) => !isHidden(file))
    return { version, visibleFiles }
  }))
  const gameSummary = gameSummaries.games?.[entry.id]
  if (!gameSummary) throw new Error(`Missing generated game summary for visible game ${entry.id}.`)

  for (const { version, visibleFiles } of versionDetails) {
    const hasSubstantiveContent = visibleFiles.some((file) => Array.isArray(file.cheats) && file.cheats.length > 0)

    const pageTitle = `${entry.title} v${version.version} | HEN Cheats Collection`
    const description = `${platformFor(entry.id)} cheats for ${entry.title}, version ${version.version}. HEN Cheats Collection.`
    const pageUrl = `${PUBLIC_SITE_URL}/game/${encodeURIComponent(entry.id)}/${encodeURIComponent(version.version)}/`

    let html = replaceTitle(template, pageTitle)
    html = replaceMeta(html, 'name', 'description', description)
    html = replaceMeta(html, 'property', 'og:title', pageTitle)
    html = replaceMeta(html, 'property', 'og:description', description)
    html = replaceMeta(html, 'property', 'og:type', 'website')
    html = replaceMeta(html, 'property', 'og:site_name', 'HEN Cheats Collection')
    html = replaceMeta(html, 'property', 'og:url', pageUrl)
    html = replaceLink(html, 'canonical', pageUrl)
    html = replaceMeta(html, 'name', 'twitter:card', 'summary_large_image')
    html = replaceMeta(html, 'name', 'twitter:title', pageTitle)
    html = replaceMeta(html, 'name', 'twitter:description', description)
    html = replaceMeta(html, 'name', 'robots', hasSubstantiveContent ? 'index,follow' : 'noindex,follow')

    html = replaceMeta(html, 'property', 'og:image', cover)
    html = replaceMeta(html, 'property', 'og:image:alt', `${entry.title} cover`)
    html = removeMeta(html, 'property', 'og:image:width')
    html = removeMeta(html, 'property', 'og:image:height')
    html = removeMeta(html, 'property', 'og:image:type')
    html = replaceMeta(html, 'name', 'twitter:image', cover)
    html = replaceMeta(html, 'name', 'twitter:image:alt', `${entry.title} cover`)
    html = replaceStructuredData(html, {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: pageTitle,
      description,
      url: pageUrl,
      isPartOf: { '@type': 'WebSite', name: 'HEN Cheats Collection', url: `${PUBLIC_SITE_URL}/` },
      about: { '@type': 'VideoGame', name: entry.title, gamePlatform: platformFor(entry.id) },
      image: cover,
    })
    html = replaceRootContent(html, renderGameStaticContent({ entry, version, visibleFiles, pageUrl, gameSummary }))

    const routeDir = path.join(distRoot, 'game', entry.id, version.version)
    await mkdir(routeDir, { recursive: true })
    await writeFile(path.join(routeDir, 'index.html'), html, 'utf8')
    generated += 1
    if (hasSubstantiveContent) sitemapItems.push({ loc: pageUrl, lastmod: gameSummary.updated ?? gameSummary.added ?? null })
    else noindexPages += 1
  }
}

await writeFile(path.join(distRoot, 'sitemap.xml'), renderSitemap(sitemapItems), 'utf8')

console.log(`Generated ${generatedEditorialPages.toLocaleString('en-US')} static editorial pages and ${generated.toLocaleString('en-US')} static game/version pages with crawlable content (${noindexPages.toLocaleString('en-US')} noindex dead-end pages).`)
console.log(`Generated sitemap.xml with ${sitemapItems.length.toLocaleString('en-US')} indexable URLs (${sitemapItems.filter((item) => item.lastmod).length.toLocaleString('en-US')} with authoritative lastmod).`)
