import { DatabaseIcon, GlobeIcon, SettingsIcon } from './icons'

export default function SettingsView() {
  return (
    <div className="settings-view">
      <div className="settings-head">
        <h1>Ayarlar</h1>
        <div className="settings-meta">
          <span className="s-chip">NOTFLİX</span>
          <span className="s-chip">v1.0</span>
        </div>
      </div>

      <div className="settings-groups">
        <section className="s-group">
          <div className="s-group-head">
            <span className="s-gicon"><GlobeIcon size={16} /></span>
            <span className="s-group-title">Uygulama</span>
          </div>
          <div className="s-item">
            <div className="s-item-nav">
              <div>
                <div className="s-label">Dil</div>
                <div className="s-sub">Türkçe</div>
              </div>
              <span className="s-value">tr</span>
            </div>
          </div>
          <div className="s-item">
            <div className="s-item-nav">
              <div>
                <div className="s-label">Tema</div>
                <div className="s-sub">Koyu</div>
              </div>
              <span className="s-value">Dark</span>
            </div>
          </div>
        </section>

        <section className="s-group">
          <div className="s-group-head">
            <span className="s-gicon"><DatabaseIcon size={16} /></span>
            <span className="s-group-title">Veri</span>
          </div>
          <div className="s-item">
            <div className="s-item-nav">
              <div>
                <div className="s-label">Önbelleği temizle</div>
                <div className="s-sub">Kaydedilen favoriler ve geçmiş korunur.</div>
              </div>
              <span className="s-chev">›</span>
            </div>
          </div>
        </section>

        <section className="s-group">
          <div className="s-group-head">
            <span className="s-gicon"><SettingsIcon size={16} /></span>
            <span className="s-group-title">Hakkında</span>
          </div>
          <div className="s-item">
            <div className="s-item-nav">
              <div>
                <div className="s-label">NOTFLİX</div>
                <div className="s-sub">mHub / geil.to verileriyle güçlendirilmiş canlı TV ve VOD.</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
