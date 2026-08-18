import type { MouseEvent } from 'react'
import { Icon } from './Icon'
import { buildCoverImageUrl, COVER_LIST_SIZE } from '../config'
import { displayDate, formatLabel, platformFor } from '../lib/catalog'
import type { CatalogEntry } from '../types/catalog'

interface GameCardProps {
  entry: CatalogEntry
  coverUrl: string
  favorite: boolean
  latestAdded?: string
  onOpen: (entry: CatalogEntry) => void
  onToggleFavorite: (id: string) => void
}

export function GameCard({ entry, coverUrl, favorite, latestAdded, onOpen, onToggleFavorite }: GameCardProps) {
  const platform = platformFor(entry.id)
  const formatSet = Array.from(new Set(entry.versions.flatMap((version) => version.formats)))
  const creatorSet = Array.from(new Set([...entry.versions].reverse().flatMap((version) => version.creators)))
  const newestVersion = entry.versions.at(-1)?.version

  return (
    <article className="game-card" onClick={() => onOpen(entry)}>
      <div className="cover-wrap">
        <img className="cover" src={buildCoverImageUrl(coverUrl, COVER_LIST_SIZE)} alt="" loading="lazy" decoding="async" />
        <div className="cover-gradient" />
        <span className={`platform-badge platform-${platform.toLowerCase()}`}>{platform}</span>
        {entry.pinned && <span className="pin-badge" title="Pinned"><Icon name="star" /></span>}
        <button
          className={`favorite-button ${favorite ? 'is-favorite' : ''}`}
          type="button"
          aria-label={favorite ? `Remove ${entry.title} from favorites` : `Add ${entry.title} to favorites`}
          onClick={(event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation()
            onToggleFavorite(entry.id)
          }}
        >
          <Icon name={favorite ? 'heartFilled' : 'heart'} />
        </button>
        <div className="format-row cover-formats">
          {formatSet.map((format) => <span className={`format format-${format}`} key={format}>{formatLabel(format)}</span>)}
        </div>
      </div>
      <div className="game-card-body">
        <div className="game-id-row">
          <span className="game-id">{entry.id}</span>
          {latestAdded && <span className="added-date">{displayDate(latestAdded)}</span>}
        </div>
        <h2>{entry.title}</h2>
        <p className="card-meta">
          {entry.versions.length} {entry.versions.length === 1 ? 'version' : 'versions'}
          {newestVersion ? <><span className="dot">•</span> Latest {newestVersion}</> : null}
        </p>
        <p className="creator-line" title={creatorSet.join(', ')}>
          {creatorSet.length ? creatorSet.slice(0, 2).join(', ') : 'Unknown creator'}
          {creatorSet.length > 2 ? ` +${creatorSet.length - 2}` : ''}
        </p>
      </div>
    </article>
  )
}
