import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, CreditCard, Gift } from 'lucide-react'
import NotflixLogo from '@/sections/NotflixLogo'
import NotflixFooter from '@/sections/NotflixFooter'
import { loginMember, redeemGiftCode, registerMember } from '@/lib/membership'
import { checkMembership } from '@/lib/membership'

const ACTIVATION_CODE = import.meta.env.VITE_DEVELOPER_ACTIVATION_CODE || 'W&Q%*8M*Afree'

const SHOPIER_PLANS = [
  { title: '1 Aylık', url: 'https://www.shopier.com/platool/49623989', period: '30 gün' },
  { title: '3 Aylık', url: 'https://www.shopier.com/platool/49624003', period: '90 gün' },
  { title: '12 Aylık', url: 'https://www.shopier.com/platool/49624023', period: '365 gün' },
]

interface NotflixLoginProps {
  onActivated: () => void
  onLoggedIn: (username: string) => void
}

export default function NotflixLogin({ onActivated, onLoggedIn }: NotflixLoginProps) {
  const [code, setCode] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [pricingOpen, setPricingOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [developerMode, setDeveloperMode] = useState(false)
  const [pricingNotice, setPricingNotice] = useState(false)
  const [giftOpen, setGiftOpen] = useState(false)
  const [accountEmail, setAccountEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginMode, setLoginMode] = useState(false)
  const [rememberMe, setRememberMe] = useState(() => { try { return localStorage.getItem('notflix_remember') === 'true' } catch { return false } })
  const [rememberedName, setRememberedName] = useState('')

  useEffect(() => {
    const handler = () => setDeveloperMode(true)
    window.addEventListener('notflix-developer-activated', handler)
    return () => window.removeEventListener('notflix-developer-activated', handler)
  }, [])

  useEffect(() => {
    try { setRememberedName(localStorage.getItem('notflix_remembered_username') || '') } catch { setRememberedName('') }
    let live = true
    void checkMembership().then((member) => { if (live && member) onLoggedIn(member.username) }).catch(() => {})
    return () => { live = false }
  }, [onLoggedIn])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (checking) return
    const cleanUsername = username.trim()
      if (loginMode) {
      setChecking(true)
      try {
        const loggedInUsername = await loginMember({ username: cleanUsername, password })
        try {
          localStorage.setItem('notflix_remember', String(rememberMe))
          if (rememberMe) localStorage.setItem('notflix_remembered_username', loggedInUsername)
          else localStorage.removeItem('notflix_remembered_username')
        } catch { /* remember me is optional */ }
        onLoggedIn(loggedInUsername)
      } catch (loginError) { setError(loginError instanceof Error ? loginError.message : 'Giriş başarısız') }
      finally { setChecking(false) }
      return
    }
    if (!/^[a-zA-Z0-9_.-]{4,20}$/.test(cleanUsername) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail.trim()) || password.length < 8 || password.length > 12 || !/[!@#$%^&*(),.?":{}|<>_\-]/.test(password)) {
      setError('Kullanıcı adı (4–20), geçerli e-posta ve özel karakter içeren 8–12 karakterli şifre girin.')
      return
    }
    setError('')
    setChecking(true)
    try {
      const registeredUsername = await registerMember({ username: cleanUsername, email: accountEmail.trim(), password })
      onLoggedIn(registeredUsername)
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : 'Kayıt servisine ulaşılamadı. Kayıt oluşturulmadı.')
    } finally { setChecking(false) }
  }

  async function redeemGift() {
    if (code.trim() !== ACTIVATION_CODE) { setError('Hediye kodu geçersiz.'); return }
    if (!username.trim()) { setError('Önce kullanıcı adınızı girin.'); return }
    setChecking(true)
    try {
      const membership = await redeemGiftCode({ username: username.trim(), code: code.trim() })
      window.dispatchEvent(new CustomEvent('notflix-developer-activated', { detail: { username: username.trim() } }))
      setDeveloperMode(true)
      onLoggedIn(membership.username)
    } catch (giftError) { setError(giftError instanceof Error ? giftError.message : 'Hediye kodu doğrulanamadı.') }
    finally { setChecking(false) }
  }

  function openPlans() {
    if (!username.trim()) { setError('Planları açmadan önce kullanıcı adınızı yazın; destek ekibi aktivasyonu bu adla eşleştirecektir.'); return }
    setError('')
    setPricingOpen(true)
  }

  function openPricing() {
    setError('Üyelik servisi hazır değilse satın alma adımlarını göstermek mümkün değil; önce kullanıcı adınızı girin.')
    openPlans()
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
          <h1>Notflix’e kayıt ol</h1>
          {developerMode ? <p className="nf-login__dev-banner">Geliştirici modunu kullanıyorsunuz, fiyatlandırmadan muafsınız.</p> : <p>
            Hesap oluşturun. Abonelik satın almadan katalogları inceleyebilirsiniz.
          </p>}
          {!developerMode && <button type="button" className="nf-login__pricing-inline" onClick={openPlans}><CreditCard size={16} /> Ücretli paketleri incele</button>}
          <button type="button" className="nf-login__pricing-inline" onClick={() => { setLoginMode((mode) => !mode); setError('') }}>{loginMode ? 'Yeni hesap oluştur' : 'Zaten hesabın var mı? Giriş yap'}</button>
        </div>

        <form className="nf-login__form" onSubmit={handleSubmit} noValidate>
          <label className="nf-login__label" htmlFor="activation-username">Kullanıcı adı</label>
          <input id="activation-username" className="nf-login__input" value={username} onChange={(event) => setUsername(event.target.value.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 20))} placeholder={loginMode && rememberedName ? rememberedName : 'Kullanıcı adı'} autoComplete="username" minLength={4} maxLength={20} disabled={checking} />
          {!loginMode && <><label className="nf-login__label" htmlFor="activation-email">E-posta</label><input id="activation-email" className="nf-login__input" type="email" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} placeholder="ornek@eposta.com" autoComplete="email" disabled={checking} /></>}
          <label className="nf-login__label" htmlFor="activation-password">{loginMode ? 'Şifre' : 'Şifre (8–12 karakter, özel karakter zorunlu)'}</label>
          <div className={`nf-login__input-wrap ${error ? 'has-error' : ''}`}><KeyRound className="nf-login__input-icon" size={19} aria-hidden="true" /><input id="activation-password" className="nf-login__input" type={visible ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value.slice(0, 12))} placeholder="Şifreniz" autoComplete={loginMode ? 'current-password' : 'new-password'} minLength={8} maxLength={12} disabled={checking} /><button type="button" className="nf-login__eye" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Şifreyi gizle' : 'Şifreyi göster'}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>

          {error && (
            <p className="nf-login__error" id="activation-error" role="alert">
              {error}
            </p>
          )}

          <button className="nf-login__submit" type="submit" disabled={checking}>
            {checking ? (
              <>
                <Loader2 className="nf-spin" size={18} />
                Aktivasyon doğrulanıyor...
              </>
            ) : (
              <>
        {loginMode ? 'Giriş Yap' : 'Kayıt Ol'}
                <ArrowRight size={18} />
              </>
            )}
          </button>

          {loginMode && <label className="nf-login__remember"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /> Beni Hatırla</label>}

          {developerMode && <p className="nf-login__secure">Geliştirici modunu kullanıyorsunuz, fiyatlandırmadan muafsınız.</p>}
        </form>

        <button type="button" className="nf-login__pricing-inline" onClick={() => setGiftOpen((open) => !open)}><Gift size={16} /> Hediye kodun mu var?</button>
        {giftOpen && <div className="nf-login__gift"><label htmlFor="activation-code">Sabit ücretsiz geliştirici kodu</label><div className="nf-login__input-wrap"><KeyRound className="nf-login__input-icon" size={19}/><input id="activation-code" className="nf-login__input" type={visible ? 'text' : 'password'} value={code} onChange={(event) => setCode(event.target.value)} placeholder="Hediye kodu" autoComplete="off"/><button type="button" className="nf-login__eye" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Kodu gizle' : 'Kodu göster'}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div><button type="button" className="nf-login__submit" onClick={redeemGift}>Kodu doğrula</button></div>}
        <p className="nf-login__secure">
          <ShieldCheck size={13} />
          Bağlantı şifrelenir · güvenli aktivasyon
        </p>
      </main>

      {pricingNotice && <div className="nf-pricing-notice" role="status">Geliştirici modunu kullanıyorsunuz, fiyatlandırmadan muafsınız.</div>}
      {pricingOpen && <div className="nf-pricing-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPricingOpen(false) }}><section className="nf-pricing-modal" role="dialog" aria-modal="true" aria-labelledby="nf-pricing-title"><button type="button" className="nf-pricing-close" onClick={() => setPricingOpen(false)} aria-label="Kapat">×</button><p className="nf-kicker">NOTFLİX · PLANLAR</p><h2 id="nf-pricing-title">Fiyatlandırma</h2><p>Aktivasyon yapılacak kullanıcı adı: <b>{username}</b></p><div className="nf-pricing-grid">{SHOPIER_PLANS.map((plan) => <article key={plan.title}><h3>{plan.title}</h3><p>{plan.period}</p><ul><li>SD · HD · Full HD · 4K yayın</li><li>5.000+ kanal</li><li>15.000+ VOD içerik</li><li>Android · PC · Smart TV · iOS</li><li>Güncel içerik · hızlı sunucu</li><li>Çevrimiçi destek 7/24</li></ul><a href={plan.url} target="_blank" rel="noreferrer">Shopier’den satın al</a></article>)}</div><div className="nf-pricing-note"><b>Aktivasyon adımları</b><ol><li>Shopier üzerinden dilediğiniz paketi satın alın.</li><li>Ödeme dekontunun veya ekran görüntüsünün kopyasını hazırlayın.</li><li>Notflix kullanıcı adınızı (<b>{username}</b>) ve paket adını belirterek <a href="https://t.me/streamsupport00" target="_blank" rel="noreferrer">Telegram destek adresimize</a> iletin.</li><li>Ekibimiz doğrulayıp abonelik sürenizi hesabınıza tanımlayıp başlatır.</li></ol></div></section></div>}

      <NotflixFooter />
    </div>
  )
}
