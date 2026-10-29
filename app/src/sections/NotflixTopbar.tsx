import { ArrowLeft, Menu } from 'lucide-react'
import { localizedPageTitle, type PageId } from '@/lib/navigation'

interface NotflixTopbarProps {
  title: string
  subtitle: string
  live: boolean
  page: PageId
  onToggleMenu: () => void
  onBack?: () => void
  language?: string
  onLanguage?: (language: string) => void
}

export default function NotflixTopbar({
  title,
  subtitle,
  live,
  page,
  onToggleMenu,
  onBack,
  language = 'tr',
  onLanguage,
}: NotflixTopbarProps) {
  const english = language === 'en'
  const translatedTitle = localizedPageTitle(page, language)
  return (
    <header className="nf-topbar">
      <button type="button" className="nf-topbar__menu" onClick={onToggleMenu} aria-label={english ? 'Toggle menu' : 'Menüyü aç veya kapat'}>
        <Menu size={22} />
      </button>
      {onBack && <button type="button" className="nf-topbar__back" onClick={onBack} aria-label={english ? 'Go back' : 'Geri dön'}><ArrowLeft size={16} /></button>}
      <div className="nf-topbar__mobile-brand" aria-hidden="true">NOTFLİX</div>

      <div className="nf-topbar__title">
        <strong>{translatedTitle}</strong>
        <span>{subtitle}</span>
      </div>

      <div className="nf-topbar__right">
        <select className="nf-topbar__language" value={language} onChange={(event) => onLanguage?.(event.target.value)} aria-label={english ? 'Language' : 'Dil'}><option value="tr">TR</option><option value="en">EN</option></select>
        {live && (
          <span className="nf-topbar__live is-talking">
            <i />
            {english ? 'LIVE' : 'YAYINDA'}
          </span>
        )}
      </div>
    </header>
  )
}
