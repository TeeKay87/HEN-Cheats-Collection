import { access } from 'node:fs/promises'
import path from 'node:path'
import {
  dataRoot,
  gameDetailPath,
  isPlainObject,
  isValidDateOnly,
  readJson,
  readOptionalJson,
  safePathSegment,
  safeRelativeFilePath,
} from './lib/build-utils.mjs'

const errors = []
const fail = (message) => errors.push(message)
const expect = (condition, message) => { if (!condition) fail(message) }
const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string')
const optionalBoolean = (value) => value === undefined || typeof value === 'boolean'

const requiredPaths = {
  catalog: path.join(dataRoot, 'catalog.json'),
  covers: path.join(dataRoot, 'covers.json'),
  games: path.join(dataRoot, 'games'),
}

for (const [name, target] of Object.entries(requiredPaths)) {
  try {
    await access(target)
  } catch {
    fail(`Missing required public data ${name}: ${path.relative(process.cwd(), target)}`)
  }
}

if (errors.length) {
  console.error('Public-data validation failed before parsing:')
  for (const error of errors) console.error(`  ERROR: ${error}`)
  process.exitCode = 1
  process.exit()
}

let catalog
let covers
let added
let updated
try {
  [catalog, covers, added, updated] = await Promise.all([
    readJson(requiredPaths.catalog),
    readJson(requiredPaths.covers),
    readOptionalJson(path.join(dataRoot, 'added.json'), {}),
    readOptionalJson(path.join(dataRoot, 'updated.json'), {}),
  ])
} catch (error) {
  console.error(`Public-data JSON could not be parsed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

expect(isPlainObject(catalog), 'catalog.json must contain an object.')
expect(Number.isInteger(catalog?.schema), 'catalog.json schema must be an integer.')
expect(typeof catalog?.generatedUtc === 'string' && !Number.isNaN(Date.parse(catalog.generatedUtc)), 'catalog.json generatedUtc must be a valid timestamp.')
expect(Array.isArray(catalog?.entries), 'catalog.json entries must be an array.')
expect(isPlainObject(covers), 'covers.json must contain an object.')
expect(isPlainObject(covers?.titles), 'covers.json titles must be an object.')
expect(isPlainObject(added), 'added.json must be an object when present.')
expect(isPlainObject(updated), 'updated.json must be an object when present.')

const gameIds = new Set()
let versionCount = 0
let sourceCount = 0

for (const [entryIndex, entry] of (catalog?.entries ?? []).entries()) {
  const label = `catalog.entries[${entryIndex}]`
  if (!isPlainObject(entry)) {
    fail(`${label} must be an object.`)
    continue
  }

  expect(safePathSegment(entry.id), `${label}.id must be a non-empty safe path segment.`)
  expect(typeof entry.title === 'string' && entry.title.trim().length > 0, `${label}.title must be a non-empty string.`)
  expect(typeof entry.pinned === 'boolean', `${label}.pinned must be boolean.`)
  expect(optionalBoolean(entry.hidden), `${label}.hidden must be boolean when present.`)
  expect(optionalBoolean(entry.hide), `${label}.hide must be boolean when present.`)
  expect(Array.isArray(entry.versions) && entry.versions.length > 0, `${label}.versions must contain at least one version.`)

  if (gameIds.has(entry.id)) fail(`Duplicate game ID in catalog.json: ${entry.id}`)
  gameIds.add(entry.id)

  const versions = new Set()
  for (const [versionIndex, version] of (entry.versions ?? []).entries()) {
    versionCount += 1
    const versionLabel = `${entry.id} versions[${versionIndex}]`
    if (!isPlainObject(version)) {
      fail(`${versionLabel} must be an object.`)
      continue
    }

    expect(safePathSegment(version.version), `${versionLabel}.version must be a non-empty safe path segment.`)
    expect(isStringArray(version.creators), `${versionLabel}.creators must be an array of strings.`)
    expect(isStringArray(version.formats), `${versionLabel}.formats must be an array of strings.`)
    if (versions.has(version.version)) fail(`Duplicate version for ${entry.id}: ${version.version}`)
    versions.add(version.version)

    let detail
    try {
      detail = await readJson(gameDetailPath(entry, version))
    } catch (error) {
      fail(`Could not parse referenced detail ${entry.id}/${version.version}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }

    expect(isPlainObject(detail), `Detail ${entry.id}/${version.version} must contain an object.`)
    expect(Number.isInteger(detail?.schema), `Detail ${entry.id}/${version.version} schema must be an integer.`)
    expect(detail?.id === entry.id, `Detail ${entry.id}/${version.version} id must equal catalog ID.`)
    expect(detail?.version === version.version, `Detail ${entry.id}/${version.version} version must equal catalog version.`)
    expect(Array.isArray(detail?.files), `Detail ${entry.id}/${version.version} files must be an array.`)

    const sourceIds = new Set()
    for (const [fileIndex, file] of (detail?.files ?? []).entries()) {
      sourceCount += 1
      const fileLabel = `${entry.id}/${version.version} files[${fileIndex}]`
      if (!isPlainObject(file)) {
        fail(`${fileLabel} must be an object.`)
        continue
      }
      expect(typeof file.sourceId === 'string' && file.sourceId.trim().length > 0, `${fileLabel}.sourceId must be a non-empty string.`)
      expect(typeof file.file === 'string' && file.file.trim().length > 0, `${fileLabel}.file must be a non-empty string.`)
      expect(safeRelativeFilePath(file.path), `${fileLabel}.path must be a safe relative path.`)
      expect(typeof file.format === 'string' && file.format.trim().length > 0, `${fileLabel}.format must be a non-empty string.`)
      expect(typeof file.process === 'string', `${fileLabel}.process must be a string.`)
      expect(isStringArray(file.creators), `${fileLabel}.creators must be an array of strings.`)
      expect(isStringArray(file.cheats), `${fileLabel}.cheats must be an array of strings.`)
      expect(optionalBoolean(file.hidden), `${fileLabel}.hidden must be boolean when present.`)
      expect(optionalBoolean(file.hide), `${fileLabel}.hide must be boolean when present.`)
      expect(optionalBoolean(file.issue), `${fileLabel}.issue must be boolean when present.`)
      expect(file.notes === undefined || file.notes === null || typeof file.notes === 'string', `${fileLabel}.notes must be string, null or absent.`)
      if (sourceIds.has(file.sourceId)) fail(`Duplicate sourceId in ${entry.id}/${version.version}: ${file.sourceId}`)
      sourceIds.add(file.sourceId)
    }
  }
}

for (const [name, map] of [['added.json', added], ['updated.json', updated]]) {
  if (!isPlainObject(map)) continue
  for (const [key, value] of Object.entries(map)) {
    if (!isValidDateOnly(value)) fail(`${name} has an invalid YYYY-MM-DD date for ${key}: ${String(value)}`)
  }
}

if (isPlainObject(covers?.titles)) {
  for (const [key, value] of Object.entries(covers.titles)) {
    if (typeof key !== 'string' || !key.trim()) fail('covers.json contains an empty title key.')
    if (typeof value !== 'string') fail(`covers.json value for ${key} must be a string.`)
  }
}

if (errors.length) {
  console.error(`Public-data validation failed with ${errors.length} error${errors.length === 1 ? '' : 's'}:`)
  for (const error of errors) console.error(`  ERROR: ${error}`)
  process.exit(1)
}

console.log(`Public-data validation passed: ${gameIds.size.toLocaleString('en-US')} games, ${versionCount.toLocaleString('en-US')} versions, ${sourceCount.toLocaleString('en-US')} source records.`)
