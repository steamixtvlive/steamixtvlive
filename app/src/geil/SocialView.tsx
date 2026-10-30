import { SocialIcon } from './icons'

export default function SocialView() {
  return (
    <div className="catalog-view">
      <div className="catalog-head">
        <h1>Social</h1>
      </div>
      <div className="empty-lib">
        <div className="empty-card">
          <div className="empty-card-icon"><SocialIcon size={28} /></div>
          <h3 className="empty-card-title">Sosyal akış yakında</h3>
          <p className="empty-card-desc">Bu sürümde sosyal özellikler henüz aktif değil.</p>
        </div>
      </div>
    </div>
  )
}
