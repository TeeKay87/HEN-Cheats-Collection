export const CHEAT_DOWNLOAD_BASE_URL = 'https://raw.githubusercontent.com/TeeKay87/HEN-Cheats-Collection/master/cheats'
export const CHEAT_NEW_ISSUE_URL = 'https://github.com/TeeKay87/HEN-Cheats-Collection/issues/new'
export const PUBLIC_SITE_URL = 'https://hencheats.vercel.app'

// Central cover-image configuration.
// Change these values here to adjust image sizes across the whole website.
export const COVER_LIST_SIZE = 256
export const COVER_DETAIL_SIZE = 1024
export const COVER_FALLBACK_URL = 'https://upload.wikimedia.org/wikipedia/commons/9/99/Playstation_logo_colour2.svg'

export const buildCoverImageUrl = (coverUrl: string | null | undefined, size: number) => {
  const requested = coverUrl?.trim()
  const source = !requested || requested.toLowerCase() === 'no-image'
    ? COVER_FALLBACK_URL
    : requested

  try {
    const url = new URL(source)

    // Sony's PlayStation image service supports server-side resizing.
    // Leave non-Sony URLs (including the fallback image) untouched.
    if (url.hostname.toLowerCase() === 'image.api.playstation.com') {
      url.searchParams.set('w', String(size))
      url.searchParams.set('thumb', 'false')
    }

    return url.toString()
  } catch {
    return source
  }
}
// Google AdSense configuration. Values come from .env so the publisher/ad-unit
// settings can be changed without touching the React components.
export const ADSENSE_ENABLED = import.meta.env.VITE_ADSENSE_ENABLED === 'true'
export const ADSENSE_CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID ?? ''
export const ADSENSE_CATALOG_SLOT_ID = import.meta.env.VITE_ADSENSE_CATALOG_SLOT_ID ?? ''
export const ADSENSE_CATALOG_INTERVAL = Math.max(1, Number.parseInt(import.meta.env.VITE_ADSENSE_CATALOG_INTERVAL ?? '24', 10) || 24)

