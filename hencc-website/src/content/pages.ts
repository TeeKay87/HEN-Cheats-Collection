import { contentPageDefinitions, getContentPageDefinitionByPath } from './routes'
import type { ContentPageDefinition } from './routes'

export type { ContentPageDefinition } from './routes'

const rawPages = import.meta.glob('./pages/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

export const contentPages = contentPageDefinitions.map((page) => ({
  ...page,
  markdown: rawPages[`./pages/${page.file}`] ?? '',
}))

export const getContentPageByPath = (pathname: string, basePath = '/') => {
  const definition = getContentPageDefinitionByPath(pathname, basePath)
  return definition ? contentPages.find((page) => page.path === definition.path) ?? null : null
}

export type ContentPage = ContentPageDefinition & { markdown: string }
