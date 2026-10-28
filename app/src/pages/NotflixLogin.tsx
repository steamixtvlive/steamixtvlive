import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import NotflixLogo from '@/sections/NotflixLogo'
import NotflixFooter from '@/sections/NotflixFooter'

const ACTIVATION_CODE = 'test12345'

interface NotflixLoginProps {
  onActivated: () => void
}

export default function NotflixLogin({ onActivated }: NotflixLoginProps) {
  const [code, setCode] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (checking) return

    const value = code.trim()
    if (!value) {
      setError('Lütfen aktivasyon kodunuzu giriniz.')
      return
    }

    if (value.toLocaleLowerCase('tr') !== ACTIVATION_CODE) {
      setError('Geçersiz aktivasyon kodu. Lütfen kodu kontrol edip tekrar deneyin.')
      return
    }

    setError('')
    setChecking(true)
    window.setTimeout(() => onActivated(), 720)
  }

  return (
    <div className="nf-login">
      <div className="nf-login__glow" aria-hidden="true" />
      <div className="nf-login__grain" aria-hidden="true" />

      <div className="nf-login__brand">
        <NotflixLogo />
      </div>

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
          <p>
            Yayın kataloğunu açmak için size özel aktivasyon kodunu kullanın.
            Kodunuz yalnızca bu oturumda doğrulanır.
          </p>
        </div>

        <form className="nf-login__form" onSubmit={handleSubmit} noValidate>
          <label className="nf-login__label" htmlFor="activation-code">
            Aktivasyon kodu
          </label>

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

          {error && (
            <p className="nf-login__error" id="activation-error" role="alert">
              {error}
            </p>
          )}

          <button className="nf-login__submit" type="submit" disabled={checking || code.trim().length === 0}>
            {checking ? (
              <>
                <Loader2 className="nf-spin" size={18} />
                Aktivasyon doğrulanıyor...
              </>
            ) : (
              <>
                Aktivasyonu Başlat
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <div className="nf-login__demo">
            <span>
              <Sparkles size={14} />
              Şablon demo kodu
            </span>
            <button
              type="button"
              onClick={() => {
                setCode(ACTIVATION_CODE)
                setError('')
              }}
            >
              {ACTIVATION_CODE}
            </button>
          </div>
        </form>

        <p className="nf-login__secure">
          <ShieldCheck size={13} />
          Bağlantı şifrelenir · Vavoo / MediaHubMX altyapısı
        </p>
      </main>

      <NotflixFooter />
    </div>
  )
}
