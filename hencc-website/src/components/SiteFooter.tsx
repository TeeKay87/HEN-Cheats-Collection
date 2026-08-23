import { Icon } from './Icon'

interface SiteFooterProps {
  generatedUtc?: string
}

export function SiteFooter({ generatedUtc }: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <nav className="footer-links desktop-footer-links" aria-label="Footer">
          <a href="/about/">About</a>
          <a href="/guides/getting-started/">Getting Started</a>
          <a href="/guides/file-formats/">File Formats</a>
          <a href="/guides/title-ids-and-versions/">IDs &amp; Versions</a>
          <a href="/guides/troubleshooting/">Troubleshooting</a>
          <a href="/faq/">FAQ</a>
          <a href="/privacy/">Privacy Policy</a>
          <a href="/contact/">Contact</a>
        </nav>
        <nav className="footer-links mobile-footer-links" aria-label="Footer">
          <a href="/about/">About</a>
          <a href="/guides/">Guides</a>
          <a href="/privacy/">Privacy</a>
          <a href="/contact/">Contact</a>
        </nav>
        <div className="footer-meta">
          {generatedUtc && <span>Data generated {new Date(generatedUtc).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })}</span>}
          <a href="https://github.com/TeeKay87/HEN-Cheats-Collection" target="_blank" rel="noreferrer"><Icon name="github" /> GitHub <Icon name="external" /></a>
        </div>
      </div>
    </footer>
  )
}
