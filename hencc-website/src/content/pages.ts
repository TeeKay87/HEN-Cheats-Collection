import pageManifest from './pages.json'

export type ContentPageDefinition = {
  slug: string
  path: string
  title: string
  seoTitle: string
  description: string
  file: string
  eyebrow: string
}

const rawPages = import.meta.glob('./pages/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

export const contentPages = (pageManifest as ContentPageDefinition[]).map((page) => ({
  ...page,
  markdown: rawPages[`./pages/${page.file}`] ?? '',
}))

const normalizePath = (value: string) => {
  if (!value) return '/'
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

export const getContentPageByPath = (pathname: string, basePath = '/') => {
  const normalizedBase = normalizePath(basePath)
  let relative = pathname
  if (normalizedBase !== '/' && relative.startsWith(normalizedBase)) {
    relative = `/${relative.slice(normalizedBase.length)}`
  }
  const normalizedPath = normalizePath(relative)
  return contentPages.find((page) => page.path === normalizedPath) ?? null
}
