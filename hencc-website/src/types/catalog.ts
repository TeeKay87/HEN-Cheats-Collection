export type Platform = 'PS4' | 'PS5' | 'Other'
export type Format = 'json' | 'mc4' | 'shn' | string

export interface CatalogVersion {
  version: string
  creators: string[]
  formats: Format[]
}

export interface CatalogEntry {
  id: string
  title: string
  pinned: boolean
  hidden?: boolean
  hide?: boolean
  versions: CatalogVersion[]
}

export interface CatalogResponse {
  schema: number
  generatedUtc: string
  entries: CatalogEntry[]
}

export interface CoversResponse {
  generatedUtc: string
  titles: Record<string, string>
}

export type AddedResponse = Record<string, string>
export type UpdatedResponse = Record<string, string>

export interface SourceFile {
  sourceId: string
  file: string
  path: string
  format: Format
  process: string
  hidden?: boolean
  hide?: boolean
  issue?: boolean
  creators: string[]
  notes?: string | null
  cheats: string[]
}

export interface GameVersionResponse {
  schema: number
  id: string
  version: string
  files: SourceFile[]
}

export interface SiteStatsResponse {
  schema: number
  generatedUtc: string
  filesWithCheats: number
  rows: number
}
