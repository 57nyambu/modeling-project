import { useCallback, useEffect, useState } from 'react'

// Minimal hash router: #/simulation, #/simulation/12, #/compare/3, #/model/event-graph, ...
// Hash URLs work with both the Vite dev server and Django's single-server mode.

export type Page = 'simulation' | 'compare' | 'model' | 'validation' | 'history'
export interface Route {
  page: Page
  param: string | null
}

const PAGES: Page[] = ['simulation', 'compare', 'model', 'validation', 'history']

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const page = (PAGES as string[]).includes(parts[0] ?? '') ? (parts[0] as Page) : 'simulation'
  return { page, param: parts[1] ? decodeURIComponent(parts[1]) : null }
}

export function hrefFor(page: Page, param?: string | number | null) {
  return param === undefined || param === null ? `#/${page}` : `#/${page}/${encodeURIComponent(String(param))}`
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((page: Page, param?: string | number | null, replace = false) => {
    const href = hrefFor(page, param)
    if (replace) {
      window.history.replaceState(null, '', href)
      setRoute(parseHash(href))
    } else {
      window.location.hash = href.slice(1)
    }
  }, [])

  return { route, navigate }
}
