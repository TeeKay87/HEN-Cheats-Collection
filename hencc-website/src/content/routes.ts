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

export const contentPageDefinitions = pageManifest as ContentPageDefinition[]

const normalizePath = (value: string) => {
  if (!value) return '/'
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

export const contentPathFromLocation = (pathname: string, basePath = '/') => {
  const normalizedBase = normalizePath(basePath)
  let relative = pathname
  if (normalizedBase !== '/' && relative.startsWith(normalizedBase)) {
    relative = `/${relative.slice(normalizedBase.length)}`
  }
  return normalizePath(relative)
}

export const getContentPageDefinitionByPath = (pathname: string, basePath = '/') => {
  const normalizedPath = contentPathFromLocation(pathname, basePath)
  return contentPageDefinitions.find((page) => page.path === normalizedPath) ?? null
}
