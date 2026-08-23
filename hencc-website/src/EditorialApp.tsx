import { useEffect } from 'react'
import { ContentPage } from './components/ContentPage'
import { PUBLIC_SITE_URL } from './config'
import { getContentPageByPath } from './content/pages'
import {
  HOME_SOCIAL_IMAGE,
  HOME_SOCIAL_IMAGE_ALT,
  setMeta,
  syncPageUrls,
  syncRobotsMeta,
  syncStructuredData,
} from './lib/seo'

const baseUrl = import.meta.env.BASE_URL

export default function EditorialApp() {
  const page = getContentPageByPath(window.location.pathname, baseUrl)

  useEffect(() => {
    if (!page) return
    const pageTitle = page.seoTitle
    syncPageUrls(new URL(page.path, window.location.origin))
    syncRobotsMeta('index,follow')
    document.title = pageTitle
    setMeta('meta[name="description"]', 'name', 'description', page.description)
    setMeta('meta[property="og:title"]', 'property', 'og:title', pageTitle)
    setMeta('meta[property="og:description"]', 'property', 'og:description', page.description)
    setMeta('meta[property="og:image"]', 'property', 'og:image', HOME_SOCIAL_IMAGE)
    setMeta('meta[property="og:image:width"]', 'property', 'og:image:width', '1200')
    setMeta('meta[property="og:image:height"]', 'property', 'og:image:height', '630')
    setMeta('meta[property="og:image:type"]', 'property', 'og:image:type', 'image/png')
    setMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt', HOME_SOCIAL_IMAGE_ALT)
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', pageTitle)
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', page.description)
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', HOME_SOCIAL_IMAGE)
    setMeta('meta[name="twitter:image:alt"]', 'name', 'twitter:image:alt', HOME_SOCIAL_IMAGE_ALT)
    syncStructuredData({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.title,
      description: page.description,
      url: new URL(page.path, PUBLIC_SITE_URL).toString(),
      isPartOf: { '@type': 'WebSite', name: 'HEN Cheats Collection', url: `${PUBLIC_SITE_URL}/` },
      author: { '@type': 'Person', name: 'TeeKay87' },
    })
  }, [page])

  return page ? <ContentPage page={page} /> : null
}
