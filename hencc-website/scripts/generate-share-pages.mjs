import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = process.cwd()
const distRoot = path.join(projectRoot, 'dist')
const catalogPath = path.join(projectRoot, 'public', 'data', 'catalog.json')
const coversPath = path.join(projectRoot, 'public', 'data', 'covers.json')
const templatePath = path.join(distRoot, 'index.html')
const configPath = path.join(projectRoot, 'src', 'config.ts')

const [catalog, covers, template, configSource] = await Promise.all([
  readFile(catalogPath, 'utf8').then(JSON.parse),
  readFile(coversPath, 'utf8').then(JSON.parse),
  readFile(templatePath, 'utf8'),
  readFile(configPath, 'utf8'),
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

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
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

const platformFor = (id) => {
  if (id.startsWith('CUSA')) return 'PlayStation 4'
  if (id.startsWith('PPSA')) return 'PlayStation 5'
  return 'PlayStation'
}

let generated = 0
for (const entry of catalog.entries) {
  if (entry.hidden === true || entry.hide === true) continue
  const coverCandidate = buildCoverImageUrl(
    covers.titles[entry.title.trim().toLowerCase()] ?? COVER_FALLBACK_URL,
    COVER_DETAIL_SIZE,
  )
  const cover = /^https?:\/\//i.test(coverCandidate) ? coverCandidate : COVER_FALLBACK_URL

  for (const version of entry.versions) {
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

    html = replaceMeta(html, 'property', 'og:image', cover)
    html = replaceMeta(html, 'property', 'og:image:alt', `${entry.title} cover`)
    html = removeMeta(html, 'property', 'og:image:width')
    html = removeMeta(html, 'property', 'og:image:height')
    html = removeMeta(html, 'property', 'og:image:type')
    html = replaceMeta(html, 'name', 'twitter:image', cover)
    html = replaceMeta(html, 'name', 'twitter:image:alt', `${entry.title} cover`)

    const routeDir = path.join(distRoot, 'game', entry.id, version.version)
    await mkdir(routeDir, { recursive: true })
    await writeFile(path.join(routeDir, 'index.html'), html, 'utf8')
    generated += 1
  }
}

console.log(`Generated ${generated.toLocaleString('en-US')} social/deep-link pages.`)
