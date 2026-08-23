import { platformFor } from './catalog'

export const HOME_TITLE = 'HEN Cheats Collection'
export const HOME_DESCRIPTION = 'Browse the largest collection of cheats for the PlayStation 4 and PlayStation 5. Play Your Way. | HEN Cheats Collection'
export const HOME_SOCIAL_TITLE = 'PlayStation 4 and PlayStation 5 cheats | HEN Cheats Collection'
export const HOME_SOCIAL_DESCRIPTION = 'Browse the largest collection of cheats for the PlayStation 4 and PlayStation 5. Play Your Way.'
export const HOME_SOCIAL_IMAGE = 'https://hencheats.vercel.app/meta-image.png?v=2'
export const HOME_SOCIAL_IMAGE_ALT = 'HEN Cheats Collection banner'

export const platformNameForSocial = (id: string) => {
  const value = platformFor(id)
  if (value === 'PS4') return 'PlayStation 4'
  if (value === 'PS5') return 'PlayStation 5'
  return 'PlayStation'
}

export const setMeta = (selector: string, attribute: 'name' | 'property', key: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.content = content
}

export const removeMeta = (selector: string) => document.head.querySelector(selector)?.remove()

export const syncPageUrls = (shareUrlLike: string | URL = window.location.href, canonicalUrlLike: string | URL = shareUrlLike) => {
  const shareUrl = shareUrlLike instanceof URL ? shareUrlLike : new URL(shareUrlLike, window.location.origin)
  const canonicalUrl = canonicalUrlLike instanceof URL ? canonicalUrlLike : new URL(canonicalUrlLike, window.location.origin)

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }
  canonical.href = canonicalUrl.href

  let openGraphUrl = document.head.querySelector<HTMLMetaElement>('meta[property="og:url"]')
  if (!openGraphUrl) {
    openGraphUrl = document.createElement('meta')
    openGraphUrl.setAttribute('property', 'og:url')
    document.head.appendChild(openGraphUrl)
  }
  openGraphUrl.content = shareUrl.href
}

export const syncRobotsMeta = (content: 'index,follow' | 'noindex,follow') => {
  let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
  if (!robots) {
    robots = document.createElement('meta')
    robots.name = 'robots'
    document.head.appendChild(robots)
  }
  robots.content = content
}

export const syncStructuredData = (data: Record<string, unknown>) => {
  const id = 'hencc-structured-data'
  let script = document.head.querySelector<HTMLScriptElement>(`script#${id}`)
  if (!script) {
    script = document.createElement('script')
    script.id = id
    script.type = 'application/ld+json'
    document.head.appendChild(script)
  }
  script.textContent = JSON.stringify(data)
}
