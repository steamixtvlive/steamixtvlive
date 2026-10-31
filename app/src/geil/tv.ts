export const TV_MODE_KEY = 'notflix_tv_mode'

export function readTvMode(): boolean {
  try { return localStorage.getItem(TV_MODE_KEY) === '1' } catch { return false }
}

export function applyTvMode(enabled: boolean) {
  document.documentElement.classList.toggle('tv-mode', enabled)
}

export function setTvMode(enabled: boolean) {
  try { localStorage.setItem(TV_MODE_KEY, enabled ? '1' : '0') } catch { /* storage may be unavailable */ }
  applyTvMode(enabled)
  window.dispatchEvent(new CustomEvent('notflix-tv-mode', { detail: { enabled } }))
}

export type FocusDirection = 'up' | 'down' | 'left' | 'right'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]'

function visible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  if (rect.width < 4 || rect.height < 4) return false
  const style = window.getComputedStyle(element)
  return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.05
}

export function focusFirst() {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible)
  candidates[0]?.focus({ preventScroll: true })
}

export function moveFocus(direction: FocusDirection) {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible)
  if (!candidates.length) return
  const active = document.activeElement as HTMLElement | null
  const current = active && candidates.includes(active) ? active : null
  if (!current) { focusFirst(); return }
  const origin = current.getBoundingClientRect()
  const cx = origin.left + origin.width / 2
  const cy = origin.top + origin.height / 2
  let best: { element: HTMLElement; score: number } | null = null
  for (const element of candidates) {
    if (element === current) continue
    const rect = element.getBoundingClientRect()
    const ex = rect.left + rect.width / 2
    const ey = rect.top + rect.height / 2
    const dx = ex - cx
    const dy = ey - cy
    const primary = direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy
    if (primary < 8) continue
    const secondary = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx)
    const score = primary + secondary * 1.6
    if (!best || score < best.score) best = { element, score }
  }
  if (!best) return
  best.element.focus({ preventScroll: true })
  best.element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
}

export function activateFocused(): boolean {
  const active = document.activeElement as HTMLElement | null
  if (!active || active === document.body) return false
  active.click()
  return true
}
