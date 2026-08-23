import Markdown from 'markdown-to-jsx/react'
import type { ContentPageDefinition } from '../content/pages'
import { Icon } from './Icon'
import { SiteFooter } from './SiteFooter'

interface ContentPageProps {
  page: ContentPageDefinition & { markdown: string }
}

export function ContentPage({ page }: ContentPageProps) {
  return (
    <div className="app-shell content-app-shell">
      <header className="site-header content-site-header">
        <div className="header-inner">
          <a className="brand" href="/" aria-label="HEN Cheats Collection home">
            <span className="brand-mark">H</span>
            <span className="brand-copy"><strong>HEN Cheats</strong><small>Collection</small></span>
          </a>
          <nav className="content-header-nav" aria-label="Content navigation">
            <a href="/">Browse</a>
            <a href="/guides/">Guides</a>
            <a href="/faq/">FAQ</a>
          </nav>
          <a className="github-link" href="https://github.com/TeeKay87/HEN-Cheats-Collection" target="_blank" rel="noreferrer"><Icon name="github" /><span>GitHub</span></a>
        </div>
      </header>

      <main className="content-main">
        <article className="content-page">
          <div className="content-page-heading">
            <span>{page.eyebrow}</span>
            <p>{page.description}</p>
          </div>
          <div className="content-markdown">
            <Markdown>{page.markdown}</Markdown>
          </div>
        </article>
      </main>

      <SiteFooter />
    </div>
  )
}
