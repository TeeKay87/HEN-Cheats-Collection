import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const projectRoot = process.cwd()
export const dataRoot = path.join(projectRoot, 'public', 'data')
export const distRoot = path.join(projectRoot, 'dist')

export const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
export const isHidden = (value) => value?.hidden === true || value?.hide === true

export const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'))

export const readOptionalJson = async (filePath, fallback = {}) => {
  try {
    return await readJson(filePath)
  } catch (error) {
    if (error && error.code === 'ENOENT') return fallback
    throw error
  }
}

export const isValidDateOnly = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

export const dateOnlyFromTimestamp = (value) => {
  if (isValidDateOnly(value)) return value
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

export const dateForGame = (dates, id, mode) => {
  const prefix = `${id}-`
  let selected = null
  for (const [key, date] of Object.entries(dates ?? {})) {
    if (!key.startsWith(prefix) || !isValidDateOnly(date)) continue
    if (!selected || (mode === 'earliest' ? date < selected : date > selected)) selected = date
  }
  return selected
}

export const buildGameSummary = (entry, versionDetails, added, updated) => {
  const addedDate = dateForGame(added, entry.id, 'earliest')
  const updatedDate = dateForGame(updated, entry.id, 'latest')
  return {
    filesTotal: versionDetails.reduce(
      (sum, detail) => sum + (detail.files ?? []).filter((file) => !isHidden(file)).length,
      0,
    ),
    added: addedDate,
    updated: updatedDate && updatedDate !== addedDate ? updatedDate : null,
  }
}

export const hasSubstantiveFiles = (files) => (files ?? []).some(
  (file) => !isHidden(file) && Array.isArray(file.cheats) && file.cheats.length > 0,
)

export const gameDetailPath = (entry, version) => path.join(dataRoot, 'games', entry.id, `${version.version}.json`)

export const safePathSegment = (value) => typeof value === 'string'
  && value.length > 0
  && value !== '.'
  && value !== '..'
  && !value.includes('/')
  && !value.includes('\\')
  && !/[\u0000-\u001f]/.test(value)

export const safeRelativeFilePath = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false
  if (path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value)) return false
  const normalized = value.replaceAll('\\', '/')
  return !normalized.split('/').some((part) => part === '..' || part === '')
}
