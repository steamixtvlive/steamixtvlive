import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useLang } from '@/lib/language'

interface ShortcutRow {
  keys: string[]
  label: string
  icon?: ReactNode
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

/* A remote has no letters on it, so its rows are drawn rather than spelled: the glyph the viewer
   actually sees on the plastic, next to the name of what it does here. These are the commands the
   key bus answers, whether the press arrives as a named key or as a bare Android code. */
const REMOTE_ROWS: ShortcutRow[] = [
  { keys: ['↑', '↓', '←', '→'], icon: <DPadIcon />, label: 'shortcuts.focus' },
  { keys: ['OK'], icon: <OkIcon />, label: 'shortcuts.select' },
  { keys: ['‹'], icon: <BackIcon />, label: 'shortcuts.back' },
  { keys: ['⌂'], icon: <HomeIcon />, label: 'shortcuts.home' },
  { keys: ['☰'], icon: <MenuIcon />, label: 'shortcuts.menu' },
  { keys: ['CH ▲', 'CH ▼'], icon: <ChannelIcon />, label: 'shortcuts.channels' },
  { keys: ['＋', '－', 'MUTE'], icon: <VolumeIcon />, label: 'shortcuts.volume' },
  { keys: ['▶', '❚❚'], icon: <PlayIcon />, label: 'shortcuts.playPause' },
  { keys: ['◀◀', '▶▶'], icon: <SkipIcon />, label: 'shortcuts.skip' },
]

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg className="shortcut-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}
function DPadIcon() { return <Glyph><path d="M12 3.5l2.6 2.6H9.4L12 3.5zM12 20.5l2.6-2.6H9.4l2.6 2.6zM3.5 12l2.6-2.6v5.2L3.5 12zM20.5 12l-2.6-2.6v5.2l2.6-2.6z" /><circle cx="12" cy="12" r="2.1" /></Glyph> }
function OkIcon() { return <Glyph><circle cx="12" cy="12" r="8.2" /><path d="M8.4 12.3l2.4 2.4 4.8-5.2" /></Glyph> }
function BackIcon() { return <Glyph><path d="M9 5.5L3.5 11 9 16.5" /><path d="M3.8 11h9.7a5.5 5.5 0 010 11H8" /></Glyph> }
function HomeIcon() { return <Glyph><path d="M4 11l8-6.6 8 6.6" /><path d="M6.2 9.6V19h11.6V9.6" /></Glyph> }
function MenuIcon() { return <Glyph><path d="M4.5 7.5h15M4.5 12h15M4.5 16.5h15" /></Glyph> }
function ChannelIcon() { return <Glyph><path d="M8 10.5L12 6l4 4.5" /><path d="M8 13.5L12 18l4-4.5" /></Glyph> }
function VolumeIcon() { return <Glyph><path d="M4.5 9.5v5h3l4 3.5v-12L7.5 9.5h-3z" /><path d="M16 9a4.2 4.2 0 010 6" /><path d="M18.8 6.4a8 8 0 010 11.2" /></Glyph> }
function PlayIcon() { return <Glyph><path d="M7.5 5.6l7.6 6.4-7.6 6.4z" /><path d="M18 5.6v12.8" /></Glyph> }
function SkipIcon() { return <Glyph><path d="M11 7l-4.6 5 4.6 5" /><path d="M15.6 7l4.4 5-4.4 5" /><path d="M6.4 17V7" /><path d="M19.6 7v10" /></Glyph> }

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
            <h3>{t('shortcuts.remote')}</h3>
            {REMOTE_ROWS.map((row) => (
              <div className="shortcut-row" key={`${row.keys.join('')}-${row.label}`}>
                <span className="shortcut-keys">{row.icon}{row.keys.map((key) => <kbd key={key}>{key}</kbd>)}</span>
                <span className="shortcut-label">{t(row.label)}</span>
              </div>
            ))}
          </section>
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
