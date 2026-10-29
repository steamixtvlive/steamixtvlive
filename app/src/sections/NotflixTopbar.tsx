import { ArrowLeft, Menu, Gift } from 'lucide-react'
import { localizedPageTitle, type PageId } from '@/lib/navigation'

interface NotflixTopbarProps {
  title: string
  subtitle: string
  live: boolean
  page?: PageId
  onToggleMenu: () => void
  onBack?: () => void
  language?: string
  onLanguage?: (language: string) => void
  freeActive?: boolean
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
  freeActive = false,
}: NotflixTopbarProps) {
  const english = language === 'en'
  const translatedTitle = page ? localizedPageTitle(page, language) : title
  return (
    <header className="nf-topbar">
      <button type="button" className="nf-topbar__menu" onClick={onToggleMenu} aria-label={english ? 'Toggle menu' : 'Menüyü aç veya kapat'}>
        <span className="nf-topbar__menu-mark">N</span><Menu size={20} />
      </button>
      {onBack && <button type="button" className="nf-topbar__back" onClick={onBack} aria-label={english ? 'Go back' : 'Geri dön'}><ArrowLeft size={16} /></button>}
      <div className="nf-topbar__mobile-brand" aria-hidden="true">NOTFLİX</div>

      <div className="nf-topbar__title">
        <strong>{translatedTitle}</strong>
        <span>{subtitle}</span>
      </div>

      <div className="nf-topbar__right">
        <select className="nf-topbar__language" value={language} onChange={(event) => onLanguage?.(event.target.value)} aria-label={english ? 'Language' : 'Dil'}><option value="tr">TR</option><option value="en">EN</option></select>
        {freeActive && <span className="nf-free-active" role="status"><Gift size={17}/><b>{english ? 'FREE PLAN ACTIVE' : 'FREE PLAN AKTİF'}</b><i/><span className="nf-free-gifts" aria-hidden="true"><Gift size={14}/><Gift size={12}/><Gift size={16}/></span></span>}
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
