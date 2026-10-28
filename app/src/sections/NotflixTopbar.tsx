import { Menu } from 'lucide-react'

interface NotflixTopbarProps {
  title: string
  subtitle: string
  live: boolean
  onToggleMenu: () => void
  onProfile: () => void
}

export default function NotflixTopbar({
  title,
  subtitle,
  live,
  onToggleMenu,
  onProfile,
}: NotflixTopbarProps) {
  return (
    <header className="nf-topbar">
      <button type="button" className="nf-topbar__menu" onClick={onToggleMenu} aria-label="Menüyü aç veya kapat">
        <Menu size={21} />
      </button>

      <div className="nf-topbar__mobile-brand" aria-hidden="true">NOTFLİX</div>

      <div className="nf-topbar__title">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>

      <div className="nf-topbar__right">
        {live && (
          <span className="nf-topbar__live is-talking">
            <i />
            YAYINDA
          </span>
        )}
        <button type="button" className="nf-topbar__avatar" onClick={onProfile} aria-label="Profil ve ayarlar">
          R
        </button>
      </div>
    </header>
  )
}
