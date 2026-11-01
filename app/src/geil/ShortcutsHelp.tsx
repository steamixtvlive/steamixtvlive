import { useEffect, useRef } from 'react'
import { useLang } from '@/lib/language'

interface ShortcutRow {
  keys: string[]
  label: string
}

const NAV_ROWS: ShortcutRow[] = [
  { keys: ['↑', '↓', '←', '→'], label: 'shortcuts.focus' },
  { keys: ['Enter'], label: 'shortcuts.select' },
  { keys: ['Esc'], label: 'shortcuts.back' },
  { keys: ['Backspace'], label: 'shortcuts.back' },
  { keys: ['Ctrl', 'K'], label: 'shortcuts.search' },
  { keys: ['Shift', 'T'], label: 'shortcuts.tvMode' },
  { keys: ['?', 'H'], label: 'shortcuts.help' },
]

const PLAYER_ROWS: ShortcutRow[] = [
  { keys: ['Space', 'K'], label: 'shortcuts.playPause' },
  { keys: ['J', 'L'], label: 'shortcuts.seek' },
  { keys: ['0–9'], label: 'shortcuts.jump' },
  { keys: ['←', '→'], label: 'shortcuts.seekBar' },
  { keys: ['↑', '↓'], label: 'shortcuts.volumeChannel' },
  { keys: ['M'], label: 'shortcuts.mute' },
  { keys: ['F'], label: 'shortcuts.fullscreen' },
  { keys: ['P'], label: 'shortcuts.pip' },
  { keys: ['C'], label: 'shortcuts.subtitles' },
  { keys: ['A'], label: 'shortcuts.audio' },
  { keys: ['Q'], label: 'shortcuts.quality' },
  { keys: ['S'], label: 'shortcuts.source' },
  { keys: ['E'], label: 'shortcuts.episodes' },
  { keys: ['R'], label: 'shortcuts.speed' },
  { keys: ['L'], label: 'shortcuts.channels' },
  { keys: ['I'], label: 'shortcuts.invite' },
  { keys: ['T'], label: 'shortcuts.secondScreen' },
  { keys: ['X'], label: 'shortcuts.chat' },
  { keys: ['?', 'H'], label: 'shortcuts.help' },
  { keys: ['Esc'], label: 'shortcuts.closeMenu' },
]

export default function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const { t } = useLang()
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.keyCode === 10009 || event.key === 'GoBack') { event.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onClose])

  // The panel has one control; giving it focus is what lets a remote's Back/OK leave it.
  useEffect(() => {
    const timer = window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 80)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="shortcuts-overlay" role="dialog" aria-modal="true" aria-label={t('shortcuts.title')} data-focus-scope onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="shortcuts-panel">
        <div className="shortcuts-head">
          <h2>{t('shortcuts.title')}</h2>
          <button ref={closeRef} type="button" className="shortcuts-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>
        <div className="shortcuts-body">
          <section>
            <h3>{t('shortcuts.nav')}</h3>
            {NAV_ROWS.map((row) => (
              <div className="shortcut-row" key={`${row.keys.join('')}-${row.label}`}>
                <span className="shortcut-keys">{row.keys.map((key) => <kbd key={key}>{key}</kbd>)}</span>
                <span className="shortcut-label">{t(row.label)}</span>
              </div>
            ))}
          </section>
          <section>
            <h3>{t('shortcuts.player')}</h3>
            {PLAYER_ROWS.map((row) => (
              <div className="shortcut-row" key={`${row.keys.join('')}-${row.label}`}>
                <span className="shortcut-keys">{row.keys.map((key) => <kbd key={key}>{key}</kbd>)}</span>
                <span className="shortcut-label">{t(row.label)}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
