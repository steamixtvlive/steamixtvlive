export const TV_MODE_KEY = 'notflix_tv_mode'

/** Smart TVs and TV sticks announce themselves in the user agent, so the interface can
    switch to remote navigation on its own without asking the viewer for a setting. The Android
    shell appends ANDROIDTV only on a device it classifies as a TV, so phones keep the touch
    layout while a box or Google TV gets the D-pad interface without any manual switch. */
function isTvDevice(): boolean {
  return /smart[-_ ]?tv|internet[-_ ]?tv|browser[-_ ]?tv|tizen|webos|bravia|viera|aquos|hisense|haier|hbbtv|googletv|androidtv|appletv|firetv|samsungbrowser|lgbrowser/i.test(navigator.userAgent)
}

export { isTvDevice }

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

/** The Android shell marks its WebView, and the page hands hardware keys to it instead of
    translating them into history steps of its own. */
export function isShellApp(): boolean {
  return /notflixapp/i.test(navigator.userAgent)
}

/** A TV box's Chrome and a smart TV's browser put nothing in their user agent that gives them
    away, and the viewer cannot flip a setting on with a remote that does not work yet. So the
    interface asks the one question it can answer by itself: is this session driven by keys? The
    first press turns the D-pad layer on, a click with the mouse turns it back off. */
let keyDriven = false
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => { keyDriven = true }, true)
  window.addEventListener('pointerdown', () => { keyDriven = false }, true)
}

export function remoteDriven(): boolean {
  return keyDriven || readTvMode() || isTvDevice() || isShellApp()
}

/** Android TVs and TV boxes report most of their remote as bare numeric key codes, often without
    naming the key at all ('Unidentified'), so those presses join the same command bus the D-pad
    already walks. The numbers are Android's own KeyEvent codes: 3 Home, 4 Back, 19-22 the D-pad,
    13/23/66 Enter and DPAD-Centre, 24/25/164 the volume row, 85/126/127 play-pause, 128/129 and
    166/167 the channel row, 133/134 the skip keys and 82 the menu key, which opens whatever list
    the current screen owns. They are only read from an unnamed key, because
    a real keyboard answers the same numbers with printable keys (82 is 'R', 19 is 'S'). */
const ANDROID_KEY_COMMANDS: Record<number, string> = {
  3: 'home',
  4: 'back',
  19: 'up',
  20: 'down',
  21: 'left',
  22: 'right',
  13: 'ok',
  23: 'ok',
  24: 'volup',
  25: 'voldown',
  66: 'ok',
  82: 'menu',
  85: 'playpause',
  126: 'playpause',
  127: 'playpause',
  128: 'chup',
  129: 'chdown',
  133: 'forward',
  134: 'rewind',
  164: 'mute',
  166: 'chup',
  167: 'chdown',
  179: 'source',
}

const NAMED_KEY_COMMANDS: Record<string, string> = {
  MediaPlayPause: 'playpause',
  MediaPlay: 'playpause',
  MediaPause: 'playpause',
  MediaTrackNext: 'chup',
  MediaTrackPrevious: 'chdown',
  MediaFastForward: 'forward',
  MediaRewind: 'rewind',
  VolumeUp: 'volup',
  VolumeDown: 'voldown',
  VolumeMute: 'mute',
  ChannelUp: 'chup',
  ChannelDown: 'chdown',
  GoBack: 'back',
  Back: 'back',
  Menu: 'menu',
  ContextMenu: 'menu',
}

export function androidKeyCommand(keyCode: number, key = ''): string | null {
  if (key === 'Unidentified' || key === '') return ANDROID_KEY_COMMANDS[keyCode] || null
  return NAMED_KEY_COMMANDS[key] || null
}

/** The browser's own Back on a TV remote arrives as Escape or Backspace on desktop layouts and as
    keyCode 10009 in WebViews that never name the key at all. */
export function isBackKey(event: KeyboardEvent): boolean {
  return event.key === 'Escape' || event.keyCode === 10009 || event.key === 'GoBack'
}

/* Custom controls in this skin are plain divs given a role, so a role-based query is part of the
   walkable set — otherwise the D-pad would skip whole sections of the interface. */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="button"]:not([disabled]), [role="link"], [tabindex="0"]'

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

let walked: HTMLElement | null = null

function focusElement(element: HTMLElement) {
  // A programmatic focus is not a keyboard focus, so no browser would light the ring on its own.
  // The walk leaves its own mark for the stylesheet to follow, on any surface, TV mode or not.
  walked?.removeAttribute('data-dpad-focus')
  walked = element
  element.setAttribute('data-dpad-focus', '')
  element.focus({ preventScroll: true })
  // A div that only carries role="button" is not in the tab order, so the first attempt lands on
  // nothing. Giving it a negative tab stop makes it programmatically focusable without letting it
  // wander into the mouse user's Tab sequence.
  if (document.activeElement !== element) {
    element.tabIndex = -1
    element.focus({ preventScroll: true })
  }
}

/** Where the D-pad lands when it has nothing to walk from: the overlay on screen, else the page
    content rather than the menu rail, so a remote that is picked up mid-programme starts in the
    catalogue instead of on the logo. A screen that opens on its own also skips the text fields —
    a TV would otherwise wake the on-screen keyboard before the viewer wanted it. A caller opening
    a list passes its container, so the walk starts on the first row instead of the panel chrome. */
export function focusFirst(options: { skipInputs?: boolean; root?: HTMLElement | null } = {}) {
  const pooled = options.root
    ? Array.from(options.root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible)
    : candidates()
  const main = options.root || scope() || document.querySelector('.main')
  let inContent = main ? pooled.filter((element) => main.contains(element)) : pooled
  if (options.skipInputs) {
    const withoutFields = inContent.filter((element) => !/^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName) && !element.isContentEditable)
    if (withoutFields.length) inContent = withoutFields
  }
  const [first] = inContent.length ? inContent : pooled
  if (first) focusElement(first)
}

/** The page and every carousel scrolls its own axis, so the walk has to hand the press over to
    whichever container owns it once there is nobody left to focus in that direction. */
function scrollOwner(current: HTMLElement | null, horizontal: boolean): HTMLElement {
  let node: HTMLElement | null = current ? current.parentElement : document.querySelector<HTMLElement>('.main') || document.documentElement
  while (node && node !== document.body) {
    const overflow = horizontal ? window.getComputedStyle(node).overflowX : window.getComputedStyle(node).overflowY
    const span = horizontal ? node.scrollWidth - node.clientWidth : node.scrollHeight - node.clientHeight
    if ((overflow === 'auto' || overflow === 'scroll') && span > 4) return node
    node = node.parentElement
  }
  return document.scrollingElement as HTMLElement || document.documentElement
}

function scrollFrom(current: HTMLElement | null, direction: FocusDirection) {
  const horizontal = direction === 'left' || direction === 'right'
  const container = scrollOwner(current, horizontal)
  const span = horizontal ? container.clientWidth : container.clientHeight
  const step = Math.max(200, span * (horizontal ? 0.7 : 0.6))
  const left = direction === 'right' ? step : direction === 'left' ? -step : 0
  const top = direction === 'down' ? step : direction === 'up' ? -step : 0
  container.scrollBy({ left, top, behavior: 'smooth' })
  // Infinite lists only load their next page when a sentinel scrolls into view, but a D-pad can
  // run out of rows faster than the observer fires — so the edge of the walk is announced too.
  window.dispatchEvent(new CustomEvent('notflix-focus-edge', { detail: { direction } }))
}

export function moveFocus(direction: FocusDirection): boolean {
  const list = candidates()
  if (!list.length) { scrollFrom(null, direction); return false }
  const active = document.activeElement as HTMLElement | null
  const current = active && list.includes(active) ? active : null
  if (!current) { focusFirst(); return true }
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
  if (!best) { scrollFrom(current, direction); return false }
  focusElement(best.element)
  best.element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  return true
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

/** A focused select is the one control whose arrows belong to its value rather than to the layout,
    so the D-pad changes the option instead of walking away from the row it sits on. */
export function stepSelect(direction: FocusDirection): boolean {
  const active = document.activeElement as HTMLSelectElement | null
  if (!active || active.tagName !== 'SELECT' || !active.options.length) return false
  const index = active.selectedIndex + (direction === 'down' || direction === 'right' ? 1 : -1)
  const next = Math.min(Math.max(index, 0), active.options.length - 1)
  if (next === active.selectedIndex) return true
  active.selectedIndex = next
  active.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}
