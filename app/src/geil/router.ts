import { useEffect, useState } from 'react'

export interface RouteState {
  hash: string
  view: 'home' | 'library' | 'channels' | 'social' | 'search' | 'settings' | 'catalog' | 'item'
  parts: string[]
  query: URLSearchParams
}

export function parseHash(hash = window.location.hash || '#/'): RouteState {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const [pathPart, queryPart] = raw.split('?')
  const parts = pathPart.split('/').filter(Boolean)
  const view = (parts[0] || 'home') as RouteState['view']
  return {
    hash,
    view: ['home', 'library', 'channels', 'social', 'search', 'settings', 'catalog', 'item'].includes(view) ? view : 'home',
    parts,
    query: new URLSearchParams(queryPart || ''),
  }
}

export function useHashRoute(): RouteState {
  const [route, setRoute] = useState<RouteState>(() => parseHash())
  useEffect(() => {
    const update = () => {
      const next = parseHash()
      setRoute(next)
    }
    window.addEventListener('hashchange', update)
    window.addEventListener('popstate', update)
    if (route.view === 'item') {
      const previous = window.sessionStorage.getItem('notflix_geil_previous_route')
      if (previous && previous !== route.hash) window.sessionStorage.setItem('notflix_geil_previous_route', previous)
    } else if (route.view !== 'home') {
      window.sessionStorage.setItem('notflix_geil_previous_route', route.hash)
    }
    return () => {
      window.removeEventListener('hashchange', update)
      window.removeEventListener('popstate', update)
    }
  }, [route.view, route.hash])
  return route
}

export function navigate(path: string) {
  const next = path.startsWith('#') ? path : `#${path}`
  if (window.location.hash === next) return
  window.history.pushState({ notflixRoute: next }, '', next)
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
}

export function goBack(fallback = '#/') {
  const current = parseHash()
  if (current.view === 'item') {
    const previous = window.sessionStorage.getItem('notflix_geil_previous_route')
    if (previous && previous !== current.hash) {
      navigate(previous)
      return
    }
  }
  if (window.history.length > 1 && current.view !== 'home' && current.hash !== '') window.history.back()
  else navigate(fallback)
}

export function itemHref(addonId: string, type: string, id: string): string {
  const normalizedType = type === 'movie' ? 'video' : type
  return `#/item/${encodeURIComponent(addonId)}/${encodeURIComponent(normalizedType)}/${encodeURIComponent(id)}`
}

export function catalogHref(addonId: string, type: string, catalogId: string, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams(extra)
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return `#/catalog/${encodeURIComponent(addonId)}/${encodeURIComponent(type)}/${encodeURIComponent(catalogId)}${suffix}`
}

export function searchHref(query: string): string {
  return query ? `#/search?q=${encodeURIComponent(query)}` : '#/search'
}
