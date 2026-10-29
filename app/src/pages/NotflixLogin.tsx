import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, CreditCard } from 'lucide-react'
import NotflixLogo from '@/sections/NotflixLogo'
import NotflixFooter from '@/sections/NotflixFooter'

const ACTIVATION_CODE = 'W&Q%*8M*Afree'

const SHOPIER_PLANS = [
  { title: '1 Aylık', url: 'https://www.shopier.com/platool/49623989', period: '30 gün' },
  { title: '3 Aylık', url: 'https://www.shopier.com/platool/49624003', period: '90 gün' },
  { title: '12 Aylık', url: 'https://www.shopier.com/platool/49624023', period: '365 gün' },
]

interface NotflixLoginProps {
  onActivated: () => void
}

export default function NotflixLogin({ onActivated }: NotflixLoginProps) {
  const [code, setCode] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [pricingOpen, setPricingOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [developerMode, setDeveloperMode] = useState(false)
  const [pricingNotice, setPricingNotice] = useState(false)

  useEffect(() => {
    const handler = () => setDeveloperMode(true)
    window.addEventListener('notflix-developer-activated', handler)
    return () => window.removeEventListener('notflix-developer-activated', handler)
  }, [])

  function openPricing() {
    if (developerMode) {
      setPricingNotice(true)
      window.setTimeout(() => setPricingNotice(false), 3200)
      return
    }
    setPricingOpen(true)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (checking) return

    if (developerMode) {
      onActivated()
      return
    }

    const value = code.trim()
    if (!value) {
      setError('Lütfen aktivasyon kodunuzu giriniz.')
      return
    }

    if (value !== ACTIVATION_CODE) {
      setError('Geçersiz aktivasyon kodu. Lütfen kodu kontrol edip tekrar deneyin.')
      return
    }

    if (!fullName.trim() || username.trim().length < 8 || username.trim().length > 12) {
      setError('Ad soyad girin; kullanıcı adı 8–12 karakter olmalıdır.')
      return
    }

    setError('')
    setChecking(true)
    setDeveloperMode(true)
    window.dispatchEvent(new CustomEvent('notflix-developer-activated', { detail: { fullName: fullName.trim(), username: username.trim(), expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000 } }))
    window.setTimeout(() => {
      onActivated()
    }, 720)
  }

  return (
    <div className="nf-login">
      <div className="nf-login__glow" aria-hidden="true" />
      <div className="nf-login__grain" aria-hidden="true" />

      <div className="nf-login__brand">
        <NotflixLogo />
      </div>
      {!developerMode && <button type="button" className="nf-login__pricing-trigger" onClick={openPricing}><CreditCard size={16} /> Fiyatlandırma</button>}

      <main className="nf-login__card">
        <span className="nf-login__badge">
          <ShieldCheck size={14} />
          GÜVENLİ AKTİVASYON
        </span>

        <div className="nf-login__heading">
          <span className="nf-login__ornament" aria-hidden="true">
            <KeyRound size={20} />
          </span>
          <h1>NOTFLİX aktivasyon kodunuzu giriniz</h1>
          {developerMode ? <p className="nf-login__dev-banner">Geliştirici modunu kullanıyorsunuz, fiyatlandırmadan muafsınız.</p> : <p>
            İçeriklere erişmek için aktivasyon kodunuzu girin. Ücretsiz geliştirici beta kodu sınırsız kullanılabilir.
          </p>}
          {!developerMode && <button type="button" className="nf-login__pricing-inline" onClick={openPricing}><CreditCard size={16} /> Ücretli paketleri incele</button>}
        </div>

        <form className="nf-login__form" onSubmit={handleSubmit} noValidate>
          <label className="nf-login__label" htmlFor="activation-fullname">Ad soyad</label>
          <input id="activation-fullname" className="nf-login__input" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Adınız Soyadınız" autoComplete="name" disabled={checking} />
          <label className="nf-login__label" htmlFor="activation-username">Kullanıcı adı (8–12 karakter)</label>
          <input id="activation-username" className="nf-login__input" value={username} onChange={(event) => setUsername(event.target.value.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 12))} placeholder="Kullanıcı adı" autoComplete="username" minLength={8} maxLength={12} disabled={checking} />

          <label className="nf-login__label" htmlFor="activation-code">Aktivasyon kodu</label>

          <div className={`nf-login__input-wrap ${error ? 'has-error' : ''}`}>
            <KeyRound className="nf-login__input-icon" size={19} aria-hidden="true" />
            <input
              id="activation-code"
              className="nf-login__input"
              type={visible ? 'text' : 'password'}
              value={code}
              onChange={(event) => {
                setCode(event.target.value)
                if (error) setError('')
              }}
              placeholder="•••••••••"
              autoComplete="one-time-code"
              autoFocus
              spellCheck={false}
              disabled={checking}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'activation-error' : undefined}
            />
            <button
              type="button"
              className="nf-login__eye"
              onClick={() => setVisible((current) => !current)}
              aria-label={visible ? 'Kodu gizle' : 'Kodu göster'}
              tabIndex={-1}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <span className="nf-login__demo-code">Geliştirici beta erişim kodu: <b>{ACTIVATION_CODE}</b></span>

          {error && (
            <p className="nf-login__error" id="activation-error" role="alert">
              {error}
            </p>
          )}

          <button className="nf-login__submit" type="submit" disabled={checking || code.trim().length === 0 || !fullName.trim() || username.trim().length < 8}>
            {checking ? (
              <>
                <Loader2 className="nf-spin" size={18} />
                Aktivasyon doğrulanıyor...
              </>
            ) : (
              <>
                {developerMode ? 'Abonelik paneline dön' : 'Aktivasyonu Başlat'}
                <ArrowRight size={18} />
              </>
            )}
          </button>

          {developerMode && <p className="nf-login__secure">Geliştirici modunu kullanıyorsunuz, fiyatlandırmadan muafsınız.</p>}
        </form>

        <p className="nf-login__secure">
          <ShieldCheck size={13} />
          Bağlantı şifrelenir · güvenli aktivasyon
        </p>
      </main>

      {pricingNotice && <div className="nf-pricing-notice" role="status">Geliştirici modunu kullanıyorsunuz, fiyatlandırmadan muafsınız.</div>}
      {pricingOpen && <div className="nf-pricing-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPricingOpen(false) }}><section className="nf-pricing-modal" role="dialog" aria-modal="true" aria-labelledby="nf-pricing-title"><button type="button" className="nf-pricing-close" onClick={() => setPricingOpen(false)} aria-label="Kapat">×</button><p className="nf-kicker">NOTFLİX · PLANLAR</p><h2 id="nf-pricing-title">Fiyatlandırma</h2><div className="nf-pricing-grid">{SHOPIER_PLANS.map((plan) => <article key={plan.title}><h3>{plan.title}</h3><p>{plan.period}</p><ul><li>SD · HD · Full HD · 4K yayın</li><li>5.000+ kanal</li><li>15.000+ VOD içerik</li><li>Android · PC · Smart TV · iOS</li><li>Güncel içerik · hızlı sunucu</li><li>Çevrimiçi destek 7/24</li></ul><a href={plan.url} target="_blank" rel="noreferrer">Shopier’den satın al</a></article>)}</div><p className="nf-pricing-note">Satın aldıktan sonra aktivasyon kodunuzu ve satın aldığınıza dair ekran görüntüsünü t.me/streamsupport00 Telegram adresinden iletmeyi unutmayınız.</p></section></div>}

      <NotflixFooter />
    </div>
  )
}
