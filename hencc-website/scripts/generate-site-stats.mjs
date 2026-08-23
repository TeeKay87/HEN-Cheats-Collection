import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  buildGameSummary,
  dataRoot,
  gameDetailPath,
  isHidden,
  readJson,
  readOptionalJson,
} from './lib/build-utils.mjs'

const catalog = await readJson(path.join(dataRoot, 'catalog.json'))
const [added, updated] = await Promise.all([
  readOptionalJson(path.join(dataRoot, 'added.json'), {}),
  readOptionalJson(path.join(dataRoot, 'updated.json'), {}),
])

let filesWithCheats = 0
let rows = 0
const games = {}

for (const entry of catalog.entries ?? []) {
  const versionDetails = await Promise.all((entry.versions ?? []).map((version) => readJson(gameDetailPath(entry, version))))

  if (!isHidden(entry)) {
    for (const detail of versionDetails) {
      for (const file of detail.files ?? []) {
        if (isHidden(file) || !Array.isArray(file.cheats) || file.cheats.length === 0) continue
        filesWithCheats += 1
        rows += file.cheats.length
      }
    }

    games[entry.id] = buildGameSummary(entry, versionDetails, added, updated)
  }
}

const generatedUtc = catalog.generatedUtc ?? new Date().toISOString()
const stats = {
  schema: 1,
  generatedUtc,
  filesWithCheats,
  rows,
}
const summaries = {
  schema: 1,
  generatedUtc,
  games,
}

await Promise.all([
  writeFile(path.join(dataRoot, 'stats.json'), `${JSON.stringify(stats, null, 2)}\n`, 'utf8'),
  writeFile(path.join(dataRoot, 'game-summaries.json'), `${JSON.stringify(summaries, null, 2)}\n`, 'utf8'),
])

console.log(`Generated site stats: ${filesWithCheats.toLocaleString('en-US')} files, ${rows.toLocaleString('en-US')} rows.`)
console.log(`Generated ID-level game summaries for ${Object.keys(games).length.toLocaleString('en-US')} visible games.`)
