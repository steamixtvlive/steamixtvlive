/* ------------------------------------------------------------------ *
 * Request bus that drives the on-screen loading states.
 *
 * The catalog lives on a remote box, so the first response can take a
 * second or two on a weak connection. Rather than show a blank shell, the
 * app takes the screen over with a branded loader while that first answer
 * is late, and falls back to a slim progress rail for every later request
 * once content is already on screen.
 * ------------------------------------------------------------------ */

const SLOW_AFTER_MS = 420

type Listener = (state: LoadingState) => void

export interface LoadingState {
  /** 'idle' hides everything; 'takeover' covers the shell; 'rail' is the thin top bar. */
  mode: 'idle' | 'takeover' | 'rail'
  /** How many requests are still unanswered. */
  pending: number
}

let pending = 0
let delivered = false
let mode: LoadingState['mode'] = 'idle'
let slowTimer: number | null = null
const listeners = new Set<Listener>()

function publish() {
  const state: LoadingState = { mode, pending }
  for (const listener of listeners) listener(state)
}

function reschedule() {
  if (slowTimer !== null) {
    window.clearTimeout(slowTimer)
    slowTimer = null
  }
  const next = pending > 0 && !delivered ? 'takeover' : pending > 0 ? 'rail' : 'idle'
  if (next === 'idle') {
    // An empty answer is still an answer: drop the rail without a flicker.
    if (mode !== 'idle') {
      mode = 'idle'
      publish()
    }
    return
  }
  if (mode === next) return
  if (next === 'takeover') {
    // A fast connection never sees the takeover, so it is worth the wait.
    slowTimer = window.setTimeout(() => {
      slowTimer = null
      if (pending > 0 && !delivered) {
        mode = 'takeover'
        publish()
      }
    }, SLOW_AFTER_MS)
    return
  }
  mode = 'rail'
  publish()
}

export function beginLoading() {
  pending += 1
  reschedule()
}

export function endLoading() {
  pending = Math.max(0, pending - 1)
  reschedule()
}

/** Called once the shell has painted real content — the takeover must never come back. */
export function markDelivered() {
  if (delivered) return
  delivered = true
  reschedule()
}

export function isDelivered() {
  return delivered
}

export function subscribeLoading(listener: Listener): () => void {
  listeners.add(listener)
  listener({ mode, pending })
  return () => listeners.delete(listener)
}
