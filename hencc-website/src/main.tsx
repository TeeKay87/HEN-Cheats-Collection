import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { getContentPageDefinitionByPath } from './content/routes'
import './index.css'
import './App.css'

const baseUrl = import.meta.env.BASE_URL
const isEditorialRoute = Boolean(getContentPageDefinitionByPath(window.location.pathname, baseUrl))
const appModule = isEditorialRoute ? import('./EditorialApp') : import('./App')

void appModule.then(({ default: App }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <Analytics />
    </StrictMode>,
  )
})
