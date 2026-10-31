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

const CONTINUE_KEY = 'notflix_geil_continue'
const CONTINUE_LIMIT = 40

export interface ContinueEntry {
  key: string
  id: string
  type: string
  name: string
  poster: string
  addonId: string
  season?: number
  episode?: number
  episodeName?: string
  position: number
  duration: number
  progress: number
  updatedAt: number
  item: GeilItem
  episodeItem?: GeilItem | null
}

export function getContinueWatching(): ContinueEntry[] {
  return read<ContinueEntry[]>(CONTINUE_KEY, [])
    .filter((entry) => entry && entry.progress > 0.01 && entry.progress < 0.98)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getContinueEntry(key: string): ContinueEntry | null {
  return getContinueWatching().find((entry) => entry.key === key) || null
}

export function saveContinueWatching(entry: Omit<ContinueEntry, 'updatedAt'>): void {
  if (!entry.key || !Number.isFinite(entry.progress)) return
  const current = read<ContinueEntry[]>(CONTINUE_KEY, []).filter((item) => item.key !== entry.key)
  let next = current
  if (entry.progress > 0.015 && entry.progress < 0.98) {
    next = [{ ...entry, updatedAt: Date.now() }, ...current].slice(0, CONTINUE_LIMIT)
  }
  write(CONTINUE_KEY, next)
}

export function removeContinueWatching(key: string): void {
  const next = read<ContinueEntry[]>(CONTINUE_KEY, []).filter((entry) => entry.key !== key)
  write(CONTINUE_KEY, next)
}

export function clearContinueWatching(): void {
  write(CONTINUE_KEY, [])
}

export function clearAllData(): void {
  try {
    const keys: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key && (key.startsWith('notflix') || key === 'lang' || key.startsWith('geil'))) keys.push(key)
    }
    keys.forEach((key) => localStorage.removeItem(key))
  } catch {
    // Storage can be blocked; the UI still reports completion.
  }
  window.dispatchEvent(new CustomEvent('notflix-geil-storage'))
  window.dispatchEvent(new CustomEvent('notflix-geil-live-favorites'))
}
