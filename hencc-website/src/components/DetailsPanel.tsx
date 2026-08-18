import { useEffect, useMemo, useState } from 'react'
import Markdown from 'markdown-to-jsx/react'
import type { MouseEvent } from 'react'
import { Icon } from './Icon'
import { buildCoverImageUrl, CHEAT_DOWNLOAD_BASE_URL, CHEAT_NEW_ISSUE_URL, COVER_DETAIL_SIZE, PUBLIC_SITE_URL } from '../config'
import { compareVersions, displayDate, formatLabel, isHidden, makeGamePath, platformFor } from '../lib/catalog'
import type { CatalogEntry, GameVersionResponse, SourceFile } from '../types/catalog'

interface DetailsPanelProps {
  entry: CatalogEntry
  coverUrl: string
  selectedVersion?: string
  addedDates: Record<string, string>
  updatedDates: Record<string, string>
  favorite: boolean
  onClose: () => void
  onSelectVersion: (version: string) => void
  onToggleFavorite: (id: string) => void
}

const baseUrl = import.meta.env.BASE_URL
const DOWNLOADED_STORAGE_KEY = 'hencc:downloaded:v1'

const loadDownloadedFiles = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(DOWNLOADED_STORAGE_KEY) ?? '[]') as string[]
    return new Set(stored)
  } catch {
    return new Set<string>()
  }
}

export function DetailsPanel({ entry, coverUrl, selectedVersion, addedDates, updatedDates, favorite, onClose, onSelectVersion, onToggleFavorite }: DetailsPanelProps) {
  const versions = useMemo(
    () => [...entry.versions].sort((a, b) => compareVersions(b.version, a.version)),
    [entry.versions],
  )
  const activeVersion = selectedVersion && versions.some((version) => version.version === selectedVersion)
    ? selectedVersion
    : versions[0]?.version
  const [detail, setDetail] = useState<GameVersionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadedFiles, setDownloadedFiles] = useState<Set<string>>(loadDownloadedFiles)

  useEffect(() => {
    if (!activeVersion) return
    const controller = new AbortController()
    let current = true
    setLoading(true)
    setError(null)
    setDownloadError(null)
    setDetail(null)
    setExpandedFiles(new Set())
    fetch(`${baseUrl}data/games/${encodeURIComponent(entry.id)}/${encodeURIComponent(activeVersion)}.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<GameVersionResponse>
      })
      .then((data) => { if (current) setDetail(data) })
      .catch((reason: unknown) => {
        if (!current || (reason instanceof DOMException && reason.name === 'AbortError')) return
        setError('Could not load this version. Please try again.')
      })
      .finally(() => { if (current) setLoading(false) })
    return () => {
      current = false
      controller.abort()
    }
  }, [activeVersion, entry.id])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('modal-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('modal-open')
    }
  }, [onClose])

  const copyLink = async () => {
    if (!activeVersion) return
    const url = new URL(makeGamePath(entry.id, activeVersion, baseUrl), window.location.origin).toString()
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const input = document.createElement('textarea')
      input.value = url
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      input.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const toggleFile = (sourceId: string) => {
    setExpandedFiles((current) => {
      const next = new Set(current)
      if (next.has(sourceId)) next.delete(sourceId)
      else next.add(sourceId)
      return next
    })
  }

  const downloadedKey = (file: SourceFile) => `${entry.id}:${activeVersion ?? ''}:${file.sourceId}`

  const downloadFilename = (file: SourceFile) => {
    const sourceSuffix = `_${file.sourceId}`
    const extensionIndex = file.file.lastIndexOf('.')
    if (extensionIndex < 0) return file.file.endsWith(sourceSuffix) ? file.file.slice(0, -sourceSuffix.length) : file.file

    const stem = file.file.slice(0, extensionIndex)
    return stem.endsWith(sourceSuffix)
      ? `${stem.slice(0, -sourceSuffix.length)}${file.file.slice(extensionIndex)}`
      : file.file
  }

  const markDownloaded = (file: SourceFile) => {
    const key = downloadedKey(file)
    setDownloadedFiles((current) => {
      if (current.has(key)) return current
      const next = new Set(current)
      next.add(key)
      try {
        localStorage.setItem(DOWNLOADED_STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        // Keep the in-session marker even if the browser blocks persistent storage.
      }
      return next
    })
  }

  const buildReportIssueUrl = (file: SourceFile) => {
    const version = activeVersion ?? detail?.version ?? ''
    const creators = file.creators.join(', ')
    const gameUrl = new URL(makeGamePath(entry.id, version, baseUrl), PUBLIC_SITE_URL).toString().replace(/\/$/, '')
    const issueTitle = `Cheat Issue: ${entry.id} | ${version} | ${file.sourceId} | ${entry.title}`
    const issueBody = `## Cheat information

- **Game:** ${entry.title}
- **File:** \`${file.file}\`
- **Creator(s):** ${creators}
- **Link:** [${gameUrl}](${gameUrl})

<!-- HENCC: ${entry.id}/${version}/source:${file.sourceId} -->

## Problem

**Which cheat(s) have problems?**


**What happens when the cheat is enabled?**


## Additional information


`

    const params = new URLSearchParams({ title: issueTitle, body: issueBody })
    return `${CHEAT_NEW_ISSUE_URL}?${params.toString()}`
  }

  const downloadFile = async (file: SourceFile) => {
    const encodedPath = file.path.split('/').map((part) => encodeURIComponent(part)).join('/')
    const url = `${CHEAT_DOWNLOAD_BASE_URL.replace(/\/$/, '')}/${encodedPath}`
    setDownloadError(null)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(String(response.status))
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = downloadFilename(file)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
      markDownloaded(file)
    } catch {
      setDownloadError('The cheat file could not be downloaded from the HEN Cheats Collection repository.')
    }
  }

  const added = activeVersion ? addedDates[`${entry.id}-${activeVersion}`] : undefined
  const updated = activeVersion ? updatedDates[`${entry.id}-${activeVersion}`] : undefined
  const addedDisplayDate = displayDate(added)
  const updatedDisplayDate = displayDate(updated)
  const visibleFiles = detail?.files.filter((file) => !isHidden(file)) ?? []

  return (
    <div className="detail-backdrop" onMouseDown={(event: MouseEvent<HTMLDivElement>) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="detail-panel" role="dialog" aria-modal="true" aria-label={`${entry.title} details`}>
        <button className="detail-close" type="button" onClick={onClose} aria-label="Close details"><Icon name="x" /></button>

        <div className="detail-hero">
          <img src={buildCoverImageUrl(coverUrl, COVER_DETAIL_SIZE)} alt="" className="detail-cover" />
          <div className="detail-hero-gradient" />
          <div className="detail-hero-content">
            <div className="detail-kicker-row">
              <span className={`platform-badge platform-${platformFor(entry.id).toLowerCase()}`}>{platformFor(entry.id)}</span>
              <span className="detail-id">{entry.id}</span>
              {entry.pinned && <span className="detail-featured"><Icon name="star" /> Featured</span>}
            </div>
            <h1>{entry.title}</h1>
            <div className="detail-actions">
              <button className={`button secondary ${favorite ? 'active' : ''}`} type="button" onClick={() => onToggleFavorite(entry.id)}>
                <Icon name={favorite ? 'heartFilled' : 'heart'} /> {favorite ? 'Saved' : 'Favorite'}
              </button>
              <button className="button secondary" type="button" onClick={copyLink}>
                <Icon name={copied ? 'check' : 'copy'} /> {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </div>
        </div>

        <div className="detail-content">
          <div className="version-strip" role="tablist" aria-label="Game versions">
            {versions.map((version) => (
              <button
                className={`version-pill ${version.version === activeVersion ? 'active' : ''}`}
                type="button"
                role="tab"
                aria-selected={version.version === activeVersion}
                key={version.version}
                onClick={() => onSelectVersion(version.version)}
              >
                <span>v{version.version}</span>
                <small>{version.formats.map(formatLabel).join(' · ')}</small>
              </button>
            ))}
          </div>

          <div className="detail-summary-grid">
            <div className="summary-card"><Icon name="file" /><div><strong>{loading || error ? '—' : visibleFiles.length}</strong><span>Files</span></div></div>
            <div className="summary-card"><Icon name="calendar" /><div><strong>{addedDisplayDate ?? '—'}</strong><span>Added</span></div></div>
            <div className="summary-card"><Icon name="calendar" /><div><strong>{updatedDisplayDate && updatedDisplayDate !== addedDisplayDate ? updatedDisplayDate : '—'}</strong><span>Updated</span></div></div>
          </div>

          {downloadError && <div className="notice warning">{downloadError}</div>}
          {loading && <div className="detail-loading"><span className="spinner" /> Loading version data…</div>}
          {error && <div className="notice error">{error}</div>}

          {!loading && !error && (
            <div className="source-list">
              {visibleFiles.map((file) => {
                const expanded = expandedFiles.has(file.sourceId)
                const downloaded = downloadedFiles.has(downloadedKey(file))
                const notes = typeof file.notes === 'string' && file.notes.trim().length > 0 ? file.notes : null
                return (
                  <article className={`source-card ${expanded ? 'expanded' : ''} ${file.issue === true ? 'has-issue' : ''}`} key={file.sourceId}>
                    <div className="source-main" onClick={() => toggleFile(file.sourceId)}>
                      <div className={`file-icon format-bg-${file.format}`}><Icon name="file" /></div>
                      <div className="source-info">
                        <div className="source-title-row">
                          <h3>{file.creators.length ? file.creators.join(', ') : 'Unknown creator'}</h3>
                          <span className={`format format-${file.format}`}>{formatLabel(file.format)}</span>
                          {file.issue === true && <span className="source-issue-badge" title="Known issue">Issue</span>}
                          {downloaded && <span className="format format-downloaded">Downloaded</span>}
                          {notes && <span className="source-note-indicator" title="Notes available" aria-label="Notes available"><Icon name="note" /></span>}
                        </div>
                        <p>{file.cheats.length} {file.cheats.length === 1 ? 'row' : 'rows'}</p>
                        <code>{file.file}</code>
                      </div>
                      <div className="source-actions">
                        <button className="icon-button download-button" type="button" title={`Download ${file.file}`} onClick={(event: MouseEvent<HTMLButtonElement>) => { event.stopPropagation(); void downloadFile(file) }}>
                          <Icon name="download" />
                        </button>
                        <Icon className="expand-chevron" name="chevronDown" />
                      </div>
                    </div>
                    {expanded && (
                      <div className="source-expanded">
                        {notes && (
                          <div className="file-notes">
                            <strong className="file-notes-label">Notes</strong>
                            <Markdown options={{ disableParsingRawHTML: true }}>{notes}</Markdown>
                          </div>
                        )}
                        {file.issue === true && (
                          <div className="file-issue-warning">
                            <strong className="file-issue-warning-label">Warning</strong>
                            <p>This file has been reported to have issues. Some cheats may not work as expected, or the game may crash.</p>
                          </div>
                        )}
                        <ol className="cheat-list">
                          {file.cheats.map((cheat, index) => <li key={`${file.sourceId}-${index}`}><span>{cheat}</span></li>)}
                        </ol>
                        <div className="source-expanded-actions">
                          <button className="button primary" type="button" onClick={() => void downloadFile(file)}><Icon name="download" /> Download {formatLabel(file.format)}</button>
                          <a className="button danger" href={buildReportIssueUrl(file)} target="_blank" rel="noopener noreferrer"><Icon name="alertTriangle" /> Report Issue</a>
                        </div>
                      </div>
                    )}
                  </article>
                )
              })}
              {!visibleFiles.length && <div className="empty-inline">No visible source files are available for this version.</div>}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
