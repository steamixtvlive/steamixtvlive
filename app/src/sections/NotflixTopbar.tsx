import { ArrowLeft, Menu } from 'lucide-react'

interface NotflixTopbarProps {
  title: string
  subtitle: string
  live: boolean
  onToggleMenu: () => void
  onBack?: () => void
  language?: string
  onLanguage?: (language: string) => void
}

export default function NotflixTopbar({
  title,
  subtitle,
  live,
  onToggleMenu,
  onBack,
  language = 'tr',
  onLanguage,
}: NotflixTopbarProps) {
  return (
    <header className="nf-topbar">
      <button type="button" className="nf-topbar__menu" onClick={onToggleMenu} aria-label="Menüyü aç veya kapat">
        <span className="nf-topbar__menu-mark">N</span><Menu size={20} />
      </button>
      {onBack && <button type="button" className="nf-topbar__back" onClick={onBack} aria-label="Geri dön"><ArrowLeft size={16} /></button>}
      <div className="nf-topbar__mobile-brand" aria-hidden="true">NOTFLİX</div>

      <div className="nf-topbar__title">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>

      <div className="nf-topbar__right">
        <select className="nf-topbar__language" value={language} onChange={(event) => onLanguage?.(event.target.value)} aria-label="Language / Dil"><option value="tr">TR</option><option value="en">EN</option></select>
        {live && (
          <span className="nf-topbar__live is-talking">
            <i />
            YAYINDA
          </span>
        )}
      </div>
    </header>
  )
}
