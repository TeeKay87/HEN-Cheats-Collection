import { useEffect, useRef, useState } from 'react'
import {
  ADSENSE_CATALOG_SLOT_ID,
  ADSENSE_CLIENT_ID,
  ADSENSE_ENABLED,
} from '../config'

type AdSenseWindow = Window & {
  adsbygoogle?: Record<string, unknown>[]
}

const isConfigured = () => (
  ADSENSE_ENABLED
  && /^ca-pub-\d+$/.test(ADSENSE_CLIENT_ID)
  && /^\d+$/.test(ADSENSE_CATALOG_SLOT_ID)
)

export function AdSenseSlot() {
  const adRef = useRef<HTMLModElement | null>(null)
  const [hasRenderedAd, setHasRenderedAd] = useState(false)

  useEffect(() => {
    const ad = adRef.current
    if (!ad || !isConfigured()) return

    const syncRenderedState = () => {
      setHasRenderedAd(ad.getBoundingClientRect().height > 1)
    }

    const resizeObserver = new ResizeObserver(syncRenderedState)
    resizeObserver.observe(ad)

    if (!ad.dataset.adsbygoogleStatus) {
      try {
        const adsWindow = window as AdSenseWindow
        adsWindow.adsbygoogle = adsWindow.adsbygoogle ?? []
        adsWindow.adsbygoogle.push({})
      } catch (error) {
        console.warn('Could not initialize the AdSense catalog slot.', error)
      }
    }

    syncRenderedState()
    return () => resizeObserver.disconnect()
  }, [])

  if (!isConfigured()) return null

  return (
    <aside className={`catalog-ad-slot ${hasRenderedAd ? 'is-filled' : ''}`} aria-label="Advertisement">
      {hasRenderedAd && <span className="catalog-ad-label">Advertisement</span>}
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={ADSENSE_CATALOG_SLOT_ID}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  )
}
