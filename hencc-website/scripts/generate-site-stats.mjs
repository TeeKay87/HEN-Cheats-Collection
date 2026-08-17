import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = process.cwd()
const dataRoot = path.join(projectRoot, 'public', 'data')
const catalogPath = path.join(dataRoot, 'catalog.json')
const outputPath = path.join(dataRoot, 'stats.json')

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))

let filesWithCheats = 0
let rows = 0

for (const entry of catalog.entries ?? []) {
  if (entry.hidden === true || entry.hide === true) continue

  for (const version of entry.versions ?? []) {
    const detailPath = path.join(dataRoot, 'games', entry.id, `${version.version}.json`)
    const detail = JSON.parse(await readFile(detailPath, 'utf8'))

    for (const file of detail.files ?? []) {
      if (file.hidden === true || file.hide === true || !Array.isArray(file.cheats) || file.cheats.length === 0) continue
      filesWithCheats += 1
      rows += file.cheats.length
    }
  }
}

const stats = {
  schema: 1,
  generatedUtc: catalog.generatedUtc ?? new Date().toISOString(),
  filesWithCheats,
  rows,
}

await writeFile(outputPath, `${JSON.stringify(stats, null, 2)}\n`, 'utf8')
console.log(`Generated site stats: ${filesWithCheats.toLocaleString('en-US')} files, ${rows.toLocaleString('en-US')} rows.`)
