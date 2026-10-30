import type { GeilItem } from './types'
import { posterUrl } from './api'

export interface SavedItem {
  id: string
  type: string
  name: string
  poster: string
  addonId: string
  at: number
}

const FAVORITES_KEY = 'notflix_geil_favorites'
const HISTORY_KEY = 'notflix_geil_history'
const PROGRESS_KEY = 'notflix_geil_progress'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    window.dispatchEvent(new CustomEvent('notflix-geil-storage'))
  } catch {
    // Local storage may be blocked; the app remains usable.
  }
}

export function savedFromItem(item: GeilItem, addonId = 'tmdb'): SavedItem {
  return {
    id: item.id,
    type: item.type,
    name: item.name,
    poster: posterUrl(item, 'medium'),
    addonId,
    at: Date.now(),
  }
}

export function getFavorites(): SavedItem[] {
  return read<SavedItem[]>(FAVORITES_KEY, [])
}

export function isFavorite(id: string): boolean {
  return getFavorites().some((entry) => entry.id === id)
}

export function toggleFavorite(item: GeilItem, addonId = 'tmdb'): boolean {
  const current = getFavorites()
  const exists = current.some((entry) => entry.id === item.id)
  const next = exists
    ? current.filter((entry) => entry.id !== item.id)
    : [savedFromItem(item, addonId), ...current].slice(0, 200)
  write(FAVORITES_KEY, next)
  return !exists
}

export function getHistory(): SavedItem[] {
  return read<SavedItem[]>(HISTORY_KEY, [])
}

export function pushHistory(item: GeilItem, addonId = 'tmdb') {
  const current = getHistory().filter((entry) => entry.id !== item.id)
  write(HISTORY_KEY, [savedFromItem(item, addonId), ...current].slice(0, 120))
}

export function clearHistory() {
  write(HISTORY_KEY, [])
}

export function getProgress(id: string): number {
  const map = read<Record<string, number>>(PROGRESS_KEY, {})
  return Number(map[id] || 0)
}

export function setProgress(id: string, value: number) {
  const map = read<Record<string, number>>(PROGRESS_KEY, {})
  map[id] = Math.max(0, Math.min(1, value))
  write(PROGRESS_KEY, map)
}
