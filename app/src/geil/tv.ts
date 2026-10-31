export const TV_MODE_KEY = 'notflix_tv_mode'

/** Smart TVs and TV sticks announce themselves in the user agent, so the interface can
    switch to remote navigation on its own without asking the viewer for a setting. */
function isTvDevice(): boolean {
  return /smart[-_ ]?tv|internet[-_ ]?tv|browser[-_ ]?tv|tizen|webos|bravia|viera|aquos|hisense|haier|hbbtv|googletv|appletv|firetv|samsungbrowser|lgbrowser/i.test(navigator.userAgent)
}

export function readTvMode(): boolean {
  try {
    const stored = localStorage.getItem(TV_MODE_KEY)
    if (stored !== null) return stored === '1'
  } catch { /* storage may be unavailable */ }
  return isTvDevice()
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

/** An overlay that is on top of the page marks itself as a focus scope, so the D-pad stops at its
    edge instead of walking out of the player or the source picker into the catalogue behind it.
    The last scope in the document is the one being shown on top of the others. */
function scope(): HTMLElement | null {
  const scopes = Array.from(document.querySelectorAll<HTMLElement>('[data-focus-scope]')).filter(visible)
  return scopes.length ? scopes[scopes.length - 1] : null
}

function candidates(): HTMLElement[] {
  const root = scope() || document
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible)
}

export function focusFirst() {
  candidates()[0]?.focus({ preventScroll: true })
}

export function moveFocus(direction: FocusDirection) {
  const list = candidates()
  if (!list.length) return
  const active = document.activeElement as HTMLElement | null
  const current = active && list.includes(active) ? active : null
  if (!current) { focusFirst(); return }
  const origin = current.getBoundingClientRect()
  const cx = origin.left + origin.width / 2
  const cy = origin.top + origin.height / 2
  let best: { element: HTMLElement; score: number } | null = null
  for (const element of list) {
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
  // A focusable wrapper (the player shell takes focus for its own key handling) has nothing to
  // activate; reporting that lets the caller fall back to a sensible default instead of a no-op.
  if (!candidates().includes(active)) return false
  active.click()
  return true
}
