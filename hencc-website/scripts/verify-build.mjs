import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  dataRoot,
  dateOnlyFromTimestamp,
  distRoot,
  gameDetailPath,
  isHidden,
  readJson,
} from './lib/build-utils.mjs'

const projectRoot = process.cwd()
const reportPath = path.join(projectRoot, '.hencc-build-report.json')
const errors = []
const checks = []
const state = {
  catalogGames: 0,
  visibleGames: 0,
  generatedGamePages: 0,
  substantiveGamePages: 0,
  noindexGamePages: 0,
  editorialPages: 0,
  sitemapUrls: 0,
  sitemapUrlsWithLastmod: 0,
  parityPages: 0,
  hiddenSourceChecks: 0,
  javascriptChunks: 0,
  cssAssets: 0,
}

const check = (condition, message) => {
  checks.push({ ok: Boolean(condition), message })
  if (!condition) errors.push(message)
}

const errorMessage = (error) => error instanceof Error ? error.message : String(error)
const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
const decodeHtml = (value) => String(value ?? '')
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'")
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replaceAll('&amp;', '&')

const htmlTagAttrs = (tag) => {
  const attrs = {}
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)) {
    attrs[match[1].toLowerCase()] = decodeHtml(match[2])
  }
  return attrs
}
const tags = (html, tagName) => html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) ?? []
const metaValues = (html, attribute, key) => tags(html, 'meta')
  .map(htmlTagAttrs)
  .filter((attrs) => attrs[attribute] === key)
  .map((attrs) => attrs.content ?? '')
const canonicalValues = (html) => tags(html, 'link')
  .map(htmlTagAttrs)
  .filter((attrs) => attrs.rel === 'canonical')
  .map((attrs) => attrs.href ?? '')
const titleValues = (html) => [...html.matchAll(/<title>([\s\S]*?)<\/title>/gi)].map((match) => decodeHtml(match[1].trim()))
const structuredDataValues = (html) => [...html.matchAll(/<script\b[^>]*id=["']hencc-structured-data["'][^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1])

const checkExactSingle = (values, expected, message) => {
  check(values.length === 1 && values[0] === expected, message)
}

const verifyStructuredSubset = (actual, expected, label, url) => {
  if (expected === null || typeof expected !== 'object' || Array.isArray(expected)) {
    check(actual === expected, `${url}: JSON-LD ${label} must match generated source data.`)
    return
  }

  check(actual !== null && typeof actual === 'object' && !Array.isArray(actual), `${url}: JSON-LD ${label} must be an object.`)
  if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) return

  for (const [key, value] of Object.entries(expected)) {
    verifyStructuredSubset(actual[key], value, label ? `${label}.${key}` : key, url)
  }
}

const verifySeoPage = (html, expected) => {
  const { url } = expected
  checkExactSingle(titleValues(html), expected.title, `${url}: <title> must exactly match the expected route title.`)
  checkExactSingle(metaValues(html, 'name', 'description'), expected.description, `${url}: description must exactly match the expected route description.`)
  checkExactSingle(metaValues(html, 'name', 'robots'), expected.robots, `${url}: robots must be ${expected.robots}.`)
  checkExactSingle(canonicalValues(html), url, `${url}: canonical must be unique and self-referencing.`)

  checkExactSingle(metaValues(html, 'property', 'og:title'), expected.og.title, `${url}: og:title must exactly match the expected route title.`)
  checkExactSingle(metaValues(html, 'property', 'og:description'), expected.og.description, `${url}: og:description must exactly match the expected route description.`)
  checkExactSingle(metaValues(html, 'property', 'og:type'), expected.og.type, `${url}: og:type must exactly match the expected route value.`)
  checkExactSingle(metaValues(html, 'property', 'og:site_name'), expected.og.siteName, `${url}: og:site_name must exactly match the site identity.`)
  checkExactSingle(metaValues(html, 'property', 'og:url'), url, `${url}: og:url must match canonical.`)
  checkExactSingle(metaValues(html, 'property', 'og:image'), expected.og.image, `${url}: og:image must exactly match the expected route image.`)
  checkExactSingle(metaValues(html, 'property', 'og:image:alt'), expected.og.imageAlt, `${url}: og:image:alt must exactly match the expected route image text.`)

  checkExactSingle(metaValues(html, 'name', 'twitter:card'), expected.twitter.card, `${url}: twitter:card must exactly match the expected route value.`)
  checkExactSingle(metaValues(html, 'name', 'twitter:title'), expected.twitter.title, `${url}: twitter:title must exactly match the expected route title.`)
  checkExactSingle(metaValues(html, 'name', 'twitter:description'), expected.twitter.description, `${url}: twitter:description must exactly match the expected route description.`)
  checkExactSingle(metaValues(html, 'name', 'twitter:image'), expected.twitter.image, `${url}: twitter:image must exactly match the expected route image.`)
  checkExactSingle(metaValues(html, 'name', 'twitter:image:alt'), expected.twitter.imageAlt, `${url}: twitter:image:alt must exactly match the expected route image text.`)

  const structured = structuredDataValues(html)
  check(structured.length === 1, `${url}: exactly one JSON-LD block must exist.`)
  if (structured.length === 1) {
    try {
      const parsed = JSON.parse(structured[0])
      verifyStructuredSubset(parsed, expected.structuredData, '', url)
    } catch {
      check(false, `${url}: JSON-LD must be valid JSON.`)
    }
  }
}

const routeFile = (url) => {
  const pathname = new URL(url).pathname
  if (pathname === '/') return path.join(distRoot, 'index.html')
  const relative = pathname.replace(/^\/+|\/+$/g, '')
  return path.join(distRoot, ...relative.split('/'), 'index.html')
}

const sourceBlocksById = (html) => {
  const blocks = []
  for (const match of html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi)) {
    const attrs = htmlTagAttrs(`<article${match[1]}>`)
    const classes = String(attrs.class ?? '').split(/\s+/).filter(Boolean)
    if (!classes.includes('static-source')) continue
    blocks.push({ sourceId: attrs['data-source-id'] ?? '', html: match[0] })
  }
  return blocks
}

const expectedCheatRows = (block) => {
  const list = block.match(/<h3>Cheats<\/h3><ul>([\s\S]*?)<\/ul>/i)
  if (!list) return null
  return [...list[1].matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((match) => decodeHtml(match[1]))
}

const readStringConstant = (source, name) => {
  const match = source.match(new RegExp(`export\\s+const\\s+${name}\\s*=\\s*['"]([^'"]+)['"]`))
  if (!match) throw new Error(`Could not read ${name} from src/config.ts.`)
  return match[1]
}
const readNumberConstant = (source, name) => {
  const match = source.match(new RegExp(`export\\s+const\\s+${name}\\s*=\\s*(\\d+)`))
  if (!match) throw new Error(`Could not read ${name} from src/config.ts.`)
  return Number(match[1])
}

const buildCoverImageUrl = (coverUrl, size, fallbackUrl) => {
  const requested = String(coverUrl || '').trim()
  const source = !requested || requested.toLowerCase() === 'no-image' ? fallbackUrl : requested
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

const platformForSeo = (id) => {
  if (id.startsWith('CUSA')) return 'PlayStation 4'
  if (id.startsWith('PPSA')) return 'PlayStation 5'
  return 'PlayStation'
}

const writeReport = async () => {
  const report = {
    schema: 1,
    generatedUtc: new Date().toISOString(),
    result: errors.length ? 'failed' : 'passed',
    counts: {
      ...state,
      checks: checks.length,
      passedChecks: checks.filter((item) => item.ok).length,
      errors: errors.length,
    },
    errors,
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

const runVerification = async () => {
  const [configSource, sourceIndexHtml] = await Promise.all([
    readFile(path.join(projectRoot, 'src', 'config.ts'), 'utf8'),
    readFile(path.join(projectRoot, 'index.html'), 'utf8'),
  ])
  const PUBLIC_SITE_URL = readStringConstant(configSource, 'PUBLIC_SITE_URL').replace(/\/$/, '')
  const COVER_DETAIL_SIZE = readNumberConstant(configSource, 'COVER_DETAIL_SIZE')
  const COVER_FALLBACK_URL = readStringConstant(configSource, 'COVER_FALLBACK_URL')

  const [catalog, covers, summaries, contentManifest, vercelConfig, detailsPanelSource, appSource, mainSource] = await Promise.all([
    readJson(path.join(dataRoot, 'catalog.json')),
    readJson(path.join(dataRoot, 'covers.json')),
    readJson(path.join(dataRoot, 'game-summaries.json')),
    readJson(path.join(projectRoot, 'src', 'content', 'pages.json')),
    readJson(path.join(projectRoot, 'vercel.json')),
    readFile(path.join(projectRoot, 'src', 'components', 'DetailsPanel.tsx'), 'utf8'),
    readFile(path.join(projectRoot, 'src', 'App.tsx'), 'utf8'),
    readFile(path.join(projectRoot, 'src', 'main.tsx'), 'utf8'),
  ])

  state.catalogGames = (catalog.entries ?? []).length
  state.visibleGames = (catalog.entries ?? []).filter((entry) => !isHidden(entry)).length
  state.editorialPages = contentManifest.length

  const sourceHomeTitle = titleValues(sourceIndexHtml)[0]
  const sourceHomeDescription = metaValues(sourceIndexHtml, 'name', 'description')[0]
  const sourceHomeSocialTitle = metaValues(sourceIndexHtml, 'property', 'og:title')[0]
  const sourceHomeSocialDescription = metaValues(sourceIndexHtml, 'property', 'og:description')[0]
  const sourceHomeSocialImage = metaValues(sourceIndexHtml, 'property', 'og:image')[0]
  const sourceHomeSocialImageAlt = metaValues(sourceIndexHtml, 'property', 'og:image:alt')[0]
  if (!sourceHomeTitle || !sourceHomeDescription || !sourceHomeSocialTitle || !sourceHomeSocialDescription || !sourceHomeSocialImage || !sourceHomeSocialImageAlt) {
    throw new Error('Could not derive the homepage SEO contract from source index.html.')
  }

  const homeUrl = `${PUBLIC_SITE_URL}/`
  const homepageSeo = {
    url: homeUrl,
    title: sourceHomeTitle,
    description: sourceHomeDescription,
    robots: 'index,follow',
    og: {
      title: sourceHomeSocialTitle,
      description: sourceHomeSocialDescription,
      type: 'website',
      siteName: 'HEN Cheats Collection',
      image: sourceHomeSocialImage,
      imageAlt: sourceHomeSocialImageAlt,
    },
    twitter: {
      card: 'summary_large_image',
      title: sourceHomeSocialTitle,
      description: sourceHomeSocialDescription,
      image: sourceHomeSocialImage,
      imageAlt: sourceHomeSocialImageAlt,
    },
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'HEN Cheats Collection',
      url: homeUrl,
      description: sourceHomeSocialDescription,
      creator: { '@type': 'Person', name: 'TeeKay87' },
    },
  }

  const sitemapXml = await readFile(path.join(distRoot, 'sitemap.xml'), 'utf8')
  const sitemapItems = [...sitemapXml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => {
    const block = match[1]
    return {
      loc: decodeHtml(block.match(/<loc>([\s\S]*?)<\/loc>/)?.[1] ?? ''),
      lastmod: decodeHtml(block.match(/<lastmod>([\s\S]*?)<\/lastmod>/)?.[1] ?? '') || null,
    }
  })
  const sitemapByUrl = new Map(sitemapItems.map((item) => [item.loc, item]))
  state.sitemapUrls = sitemapItems.length
  state.sitemapUrlsWithLastmod = sitemapItems.filter((item) => item.lastmod).length
  check(sitemapByUrl.size === sitemapItems.length, 'sitemap.xml must not contain duplicate URLs.')

  const expectedIndexable = new Map()
  expectedIndexable.set(homeUrl, { lastmod: dateOnlyFromTimestamp(catalog.generatedUtc), seo: homepageSeo })
  for (const page of contentManifest) {
    const pageTitle = page.seoTitle || `${page.title} | HEN Cheats Collection`
    const pageUrl = `${PUBLIC_SITE_URL}${page.path}`
    expectedIndexable.set(pageUrl, {
      lastmod: null,
      seo: {
        url: pageUrl,
        title: pageTitle,
        description: page.description,
        robots: 'index,follow',
        og: {
          title: pageTitle,
          description: page.description,
          type: 'website',
          siteName: 'HEN Cheats Collection',
          image: sourceHomeSocialImage,
          imageAlt: sourceHomeSocialImageAlt,
        },
        twitter: {
          card: 'summary_large_image',
          title: pageTitle,
          description: page.description,
          image: sourceHomeSocialImage,
          imageAlt: sourceHomeSocialImageAlt,
        },
        structuredData: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: page.title,
          description: page.description,
          url: pageUrl,
          isPartOf: { '@type': 'WebSite', name: 'HEN Cheats Collection', url: homeUrl },
          author: { '@type': 'Person', name: 'TeeKay87' },
        },
      },
    })
  }

  const verifiedSeoUrls = new Set()

  for (const entry of catalog.entries ?? []) {
    if (isHidden(entry)) {
      for (const version of entry.versions ?? []) {
        const hiddenPath = path.join(distRoot, 'game', entry.id, version.version, 'index.html')
        try {
          await readFile(hiddenPath, 'utf8')
          check(false, `Hidden game route must not be generated: ${entry.id}/${version.version}`)
        } catch (error) {
          check(error?.code === 'ENOENT', `Hidden game route check failed unexpectedly: ${entry.id}/${version.version}`)
        }
      }
      continue
    }

    const summary = summaries.games?.[entry.id]
    check(Boolean(summary), `Runtime summary contract must include visible game ${entry.id}.`)
    if (!summary) continue

    const coverCandidate = buildCoverImageUrl(
      covers.titles?.[entry.title.trim().toLowerCase()] ?? COVER_FALLBACK_URL,
      COVER_DETAIL_SIZE,
      COVER_FALLBACK_URL,
    )
    const cover = /^https?:\/\//i.test(coverCandidate) ? coverCandidate : COVER_FALLBACK_URL

    for (const version of entry.versions ?? []) {
      state.generatedGamePages += 1
      const detail = await readJson(gameDetailPath(entry, version))
      const visibleFiles = (detail.files ?? []).filter((file) => !isHidden(file))
      const hiddenFiles = (detail.files ?? []).filter((file) => isHidden(file))
      const substantive = visibleFiles.some((file) => Array.isArray(file.cheats) && file.cheats.length > 0)
      if (substantive) state.substantiveGamePages += 1
      else state.noindexGamePages += 1

      const pageTitle = `${entry.title} v${version.version} | HEN Cheats Collection`
      const description = `${platformForSeo(entry.id)} cheats for ${entry.title}, version ${version.version}. HEN Cheats Collection.`
      const url = `${PUBLIC_SITE_URL}/game/${encodeURIComponent(entry.id)}/${encodeURIComponent(version.version)}/`
      const expectedSeo = {
        url,
        title: pageTitle,
        description,
        robots: substantive ? 'index,follow' : 'noindex,follow',
        og: {
          title: pageTitle,
          description,
          type: 'website',
          siteName: 'HEN Cheats Collection',
          image: cover,
          imageAlt: `${entry.title} cover`,
        },
        twitter: {
          card: 'summary_large_image',
          title: pageTitle,
          description,
          image: cover,
          imageAlt: `${entry.title} cover`,
        },
        structuredData: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: pageTitle,
          description,
          url,
          isPartOf: { '@type': 'WebSite', name: 'HEN Cheats Collection', url: homeUrl },
          about: { '@type': 'VideoGame', name: entry.title, gamePlatform: platformForSeo(entry.id) },
          image: cover,
        },
      }

      const html = await readFile(routeFile(url), 'utf8')
      verifySeoPage(html, expectedSeo)
      verifiedSeoUrls.add(url)
      check(html.includes('data-prerendered-content="game-version"'), `${url}: static game fallback must exist.`)

      const creators = Array.from(new Set(visibleFiles.flatMap((file) => Array.isArray(file.creators) ? file.creators : []).filter(Boolean)))
      const formats = Array.from(new Set(visibleFiles.map((file) => String(file.format ?? '').toUpperCase()).filter(Boolean)))
      const rows = visibleFiles.reduce((sum, file) => sum + (Array.isArray(file.cheats) ? file.cheats.length : 0), 0)
      const expectedFiles = `<li><strong>Files Total:</strong> ${Number(summary.filesTotal).toLocaleString('en-US')}</li>`
      const expectedUpdated = `<li><strong>Updated:</strong> ${summary.updated ?? 'No Record'}</li>`
      const expectedAdded = `<li><strong>Added:</strong> ${summary.added ?? 'No Record'}</li>`
      const expectedRows = `<li><strong>Rows:</strong> ${rows.toLocaleString('en-US')}</li>`
      const expectedFormats = `<li><strong>Formats:</strong> ${escapeHtml(formats.join(', ') || 'None')}</li>`
      const expectedCreators = `<li><strong>Creator(s):</strong> ${escapeHtml(creators.join(', ') || 'Unknown creator')}</li>`
      check(html.includes(`<h1>${escapeHtml(entry.title)}</h1>`), `${url}: crawler title must match catalog title.`)
      check(html.includes(`<li><strong>Title ID:</strong> ${escapeHtml(entry.id)}</li>`), `${url}: crawler Title ID must match catalog ID.`)
      check(html.includes(`<li><strong>Version:</strong> ${escapeHtml(version.version)}</li>`), `${url}: crawler version must match route/catalog version.`)
      check(html.includes(expectedFiles), `${url}: crawler Files Total must match runtime game-summaries.json.`)
      check(html.includes(expectedUpdated), `${url}: crawler Updated must match runtime game-summaries.json.`)
      check(html.includes(expectedAdded), `${url}: crawler Added must match runtime game-summaries.json.`)
      check(html.includes(expectedRows), `${url}: crawler Rows must match visible version detail rows.`)
      check(html.includes(expectedFormats), `${url}: crawler Formats must match visible version detail formats.`)
      check(html.includes(expectedCreators), `${url}: crawler Creators must match visible version detail creators.`)
      state.parityPages += 1

      const sourceBlocks = sourceBlocksById(html)
      const sourceBlockMap = new Map(sourceBlocks.map((block) => [block.sourceId, block.html]))
      check(sourceBlocks.length === visibleFiles.length, `${url}: static source-block count must match visible source count.`)
      check(sourceBlockMap.size === sourceBlocks.length && !sourceBlockMap.has(''), `${url}: every static source block must have one unique data-source-id.`)

      for (const file of visibleFiles) {
        const block = sourceBlockMap.get(file.sourceId)
        check(Boolean(block), `${url}: visible source must have its own static block (${file.file}, ${file.sourceId}).`)
        if (!block) continue

        const fileCreators = Array.isArray(file.creators) && file.creators.length ? file.creators.join(', ') : 'Unknown creator'
        const cheats = Array.isArray(file.cheats) ? file.cheats : []
        const hasNotes = typeof file.notes === 'string' && file.notes.trim().length > 0
        const hasIssue = file.issue === true

        check(block.includes(`<h3>${escapeHtml(file.file)}</h3>`), `${url}: crawler source filename must match within its source block (${file.file}).`)
        check(block.includes(`<li><strong>Format:</strong> ${escapeHtml(String(file.format ?? '').toUpperCase())}</li>`), `${url}: crawler source format must match within its source block (${file.file}).`)
        check(block.includes(`<li><strong>Process:</strong> ${escapeHtml(file.process || 'Not specified')}</li>`), `${url}: crawler source process must match within its source block (${file.file}).`)
        check(block.includes(`<li><strong>Creator(s):</strong> ${escapeHtml(fileCreators)}</li>`), `${url}: crawler source creators must match within its source block (${file.file}).`)
        check(block.includes(`<li><strong>Rows:</strong> ${cheats.length.toLocaleString('en-US')}</li>`), `${url}: crawler source row count must match within its source block (${file.file}).`)

        const noteMarkup = hasNotes ? `<div class="static-note"><strong>Notes:</strong> ${escapeHtml(file.notes.trim())}</div>` : null
        check(hasNotes ? block.includes(noteMarkup) : !block.includes('class="static-note"'), `${url}: crawler source Notes state/content must match within its source block (${file.file}).`)
        const issueMarkup = '<div class="static-issue"><strong>Known issue:</strong> This source file is currently marked as having a reported issue.</div>'
        check(hasIssue ? block.includes(issueMarkup) : !block.includes('class="static-issue"'), `${url}: crawler source Issue state must match within its source block (${file.file}).`)

        const renderedCheats = expectedCheatRows(block)
        if (cheats.length) {
          check(Array.isArray(renderedCheats), `${url}: crawler source with cheat rows must contain its own Cheats list (${file.file}).`)
          if (Array.isArray(renderedCheats)) {
            check(JSON.stringify(renderedCheats) === JSON.stringify(cheats), `${url}: crawler cheat-row list must exactly match its source block (${file.file}).`)
          }
        } else {
          check(renderedCheats === null && block.includes('<p>No cheat rows are listed for this source file.</p>'), `${url}: zero-row source must contain only its zero-row message (${file.file}).`)
        }
      }

      for (const file of hiddenFiles) {
        state.hiddenSourceChecks += 1
        check(!sourceBlockMap.has(file.sourceId), `${url}: hidden source must not receive a static source block (${file.file}, ${file.sourceId}).`)
      }

      if (substantive) {
        const lastmod = summary.updated ?? summary.added ?? null
        expectedIndexable.set(url, { lastmod, seo: expectedSeo })
      } else {
        check(!sitemapByUrl.has(url), `${url}: noindex dead-end page must not be in sitemap.xml.`)
      }
    }
  }

  for (const [url, expected] of expectedIndexable) {
    check(sitemapByUrl.has(url), `${url}: indexable canonical must be present in sitemap.xml.`)
    if (sitemapByUrl.has(url)) check(sitemapByUrl.get(url).lastmod === expected.lastmod, `${url}: sitemap lastmod must be authoritative or omitted.`)
    if (!verifiedSeoUrls.has(url)) {
      const html = await readFile(routeFile(url), 'utf8')
      verifySeoPage(html, expected.seo)
      verifiedSeoUrls.add(url)
    }
  }
  check(sitemapByUrl.size === expectedIndexable.size, `sitemap.xml URL count must equal expected indexable URL count (${expectedIndexable.size}).`)

  const notFoundHtml = await readFile(path.join(distRoot, '404.html'), 'utf8')
  checkExactSingle(titleValues(notFoundHtml), 'Page Not Found | HEN Cheats Collection', '404.html title must match the generated 404 title.')
  checkExactSingle(metaValues(notFoundHtml, 'name', 'description'), 'The requested HEN Cheats Collection page does not exist.', '404.html description must match the generated 404 description.')
  checkExactSingle(metaValues(notFoundHtml, 'name', 'robots'), 'noindex,follow', '404.html must be noindex,follow.')
  checkExactSingle(metaValues(notFoundHtml, 'property', 'og:title'), 'Page Not Found | HEN Cheats Collection', '404.html og:title must match the generated 404 title.')
  checkExactSingle(metaValues(notFoundHtml, 'property', 'og:description'), 'The requested HEN Cheats Collection page does not exist.', '404.html og:description must match the generated 404 description.')
  checkExactSingle(metaValues(notFoundHtml, 'name', 'twitter:title'), 'Page Not Found | HEN Cheats Collection', '404.html twitter:title must match the generated 404 title.')
  checkExactSingle(metaValues(notFoundHtml, 'name', 'twitter:description'), 'The requested HEN Cheats Collection page does not exist.', '404.html twitter:description must match the generated 404 description.')
  check(canonicalValues(notFoundHtml).length === 0, '404.html must not declare a misleading canonical URL.')
  check(metaValues(notFoundHtml, 'property', 'og:url').length === 0, '404.html must not inherit a misleading homepage og:url.')
  check(!/<script\b/i.test(notFoundHtml), '404.html must remain static and must not hydrate into the catalog.')
  check(notFoundHtml.includes('data-prerendered-content="not-found"'), '404.html must contain static not-found content.')

  const assetsRoot = path.join(distRoot, 'assets')
  const assets = await readdir(assetsRoot)
  const jsAssets = assets.filter((file) => file.endsWith('.js'))
  const cssAssets = assets.filter((file) => file.endsWith('.css'))
  state.javascriptChunks = jsAssets.length
  state.cssAssets = cssAssets.length
  for (const file of [...jsAssets, ...cssAssets]) {
    check(/-[A-Za-z0-9_-]{6,}\.(?:js|css)$/.test(file), `Versioned asset must contain a content hash: ${file}`)
  }
  check(jsAssets.length >= 3, 'JavaScript build must contain split chunks rather than one monolithic bundle.')
  check(jsAssets.some((file) => /^DetailsPanel-/.test(file)), 'DetailsPanel must be emitted as a lazy-loaded JavaScript chunk.')
  check(jsAssets.some((file) => /^EditorialApp-/.test(file)), 'Editorial content must be emitted as a separate JavaScript chunk.')

  check(mainSource.includes("import('./EditorialApp')") && mainSource.includes("import('./App')"), 'main.tsx must route to split editorial/catalog entry chunks.')
  check(appSource.includes('lazy(async () =>') && appSource.includes("import('./components/DetailsPanel')"), 'Catalog app must lazy-load DetailsPanel.')
  check(appSource.includes('<DetailsPanelLoadingFallback') && !appSource.includes('<Suspense fallback={null}>'), 'Lazy DetailsPanel must provide an immediate modal loading fallback instead of a blank Suspense state.')
  check(detailsPanelSource.includes('data/game-summaries.json'), 'DetailsPanel must consume the generated ID-level summary contract.')
  check(!detailsPanelSource.includes('addedDates') && !detailsPanelSource.includes('updatedDates'), 'DetailsPanel must not regress to per-version date-map props.')
  check(detailsPanelSource.indexOf('<span>Files Total</span>') < detailsPanelSource.indexOf('<span>Updated</span>') && detailsPanelSource.indexOf('<span>Updated</span>') < detailsPanelSource.indexOf('<span>Added</span>'), 'Interactive summary order must remain Files Total, Updated, Added.')

  check(vercelConfig.outputDirectory === 'dist', 'vercel.json outputDirectory must be dist.')
  check(!('rewrites' in vercelConfig) && !('routes' in vercelConfig), 'vercel.json must not add a SPA catch-all that would turn invalid routes into soft 200 pages.')
  const headerRules = new Map((vercelConfig.headers ?? []).map((rule) => [rule.source, new Map((rule.headers ?? []).map((header) => [header.key.toLowerCase(), header.value]))]))
  check(headerRules.get('/assets/(.*)')?.get('cache-control') === 'public, max-age=31536000, immutable', 'Hashed assets must use long-lived immutable browser caching.')
  check(headerRules.get('/data/(.*)')?.get('cache-control') === 'public, max-age=0, must-revalidate', 'Mutable collection JSON must revalidate instead of using immutable caching.')
  check(headerRules.get('/sitemap.xml')?.get('cache-control') === 'public, max-age=0, must-revalidate', 'sitemap.xml must revalidate.')
  const securityHeaders = headerRules.get('/(.*)')
  check(securityHeaders?.get('x-content-type-options') === 'nosniff', 'Global X-Content-Type-Options must be nosniff.')
  check(securityHeaders?.get('referrer-policy') === 'strict-origin-when-cross-origin', 'Global Referrer-Policy must remain AdSense/CMP-compatible.')
  check(securityHeaders?.get('permissions-policy') === 'camera=(), microphone=(), geolocation=()', 'Global Permissions-Policy must disable unused sensitive browser capabilities.')
  check(!(vercelConfig.headers ?? []).some((rule) => (rule.headers ?? []).some((header) => header.key.toLowerCase() === 'content-security-policy')), 'No strict CSP may be introduced while AdSense/Funding Choices dependencies are active.')
}

try {
  await runVerification()
} catch (error) {
  errors.push(`Fatal verification error: ${errorMessage(error)}`)
}

try {
  await writeReport()
} catch (error) {
  errors.push(`Could not write .hencc-build-report.json: ${errorMessage(error)}`)
  console.error(`Build verification could not write its report: ${errorMessage(error)}`)
}

if (errors.length) {
  console.error(`Build verification FAILED: ${errors.length.toLocaleString('en-US')} integrity error${errors.length === 1 ? '' : 's'}.`)
  for (const error of errors) console.error(`  ERROR: ${error}`)
  process.exitCode = 1
} else {
  console.log('HENCC build integrity report:')
  console.log(`  Game pages:       ${state.generatedGamePages.toLocaleString('en-US')} (${state.substantiveGamePages.toLocaleString('en-US')} indexable, ${state.noindexGamePages.toLocaleString('en-US')} noindex)`)
  console.log(`  Editorial pages:  ${state.editorialPages.toLocaleString('en-US')}`)
  console.log(`  Sitemap URLs:     ${state.sitemapUrls.toLocaleString('en-US')} (${state.sitemapUrlsWithLastmod.toLocaleString('en-US')} with lastmod)`)
  console.log(`  SPA/crawler parity: ${state.parityPages.toLocaleString('en-US')} game/version pages checked`)
  console.log(`  Hidden-source checks: ${state.hiddenSourceChecks.toLocaleString('en-US')}`)
  console.log(`  JS chunks:        ${state.javascriptChunks.toLocaleString('en-US')}`)
  console.log(`  Integrity checks: ${checks.length.toLocaleString('en-US')} passed`)
  console.log('  Broken canonicals: 0')
  console.log('  Result: PASS')
}
