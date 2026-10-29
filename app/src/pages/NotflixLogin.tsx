import { useEffect, useState } from 'react'
import { ArrowRight, Eye, EyeOff, Gift, KeyRound, Loader2 } from 'lucide-react'
import NotflixLogo from '@/sections/NotflixLogo'
import NotflixFooter from '@/sections/NotflixFooter'

const GIFT_CODE = '69SAdTXj9'
const LOCAL_USER_KEY = 'notflix_local_user_v1'

interface LocalAccount {
  username: string
  code: string
  tier: 'free' | 'premium'
  activatedAt: number
  expiresAt: number | null
  deviceId: string
  localIp: string
}

function deviceId(): string {
  try {
    let id = localStorage.getItem('notflix_device_id')
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('notflix_device_id', id) }
    return id
  } catch { return '' }
}

function localIpHint(): string {
  // Browsers do not expose the LAN/local IP to ordinary web pages.
  try { return localStorage.getItem('notflix_local_ip_label') || 'IP tarayıcıdan okunamıyor' } catch { return 'IP tarayıcıdan okunamıyor' }
}

function readAccount(): LocalAccount | null {
  try { return JSON.parse(localStorage.getItem(LOCAL_USER_KEY) || 'null') as LocalAccount | null } catch { return null }
}

export function getLocalMembership(): LocalAccount | null { return readAccount() }

export default function NotflixLogin({ onActivated, onLoggedIn }: { onActivated: () => void; onLoggedIn: (username: string) => void }) {
  const [code, setCode] = useState('')
  const [username, setUsername] = useState('')
  const [visible, setVisible] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [alreadyActive, setAlreadyActive] = useState(false)

  useEffect(() => {
    const account = readAccount()
    if (account?.username && account.deviceId === deviceId()) {
      setUsername(account.username)
      setCode(account.code)
      setAlreadyActive(true)
    }
  }, [])

  function continueToAccount(account: LocalAccount) {
    try { localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(account)) } catch { /* device storage unavailable */ }
    window.dispatchEvent(new CustomEvent('notflix-local-activated', { detail: account }))
    onLoggedIn(account.username)
    onActivated()
  }

  function submit() {
    if (checking) return
    setError('')
    const cleanCode = code.trim()
    const cleanUsername = username.trim()
    if (!cleanUsername) { setError('Kullanıcı adınızı girin.'); return }
    if (!cleanCode) { setError('Aktivasyon kodunuzu girin.'); return }
    if (cleanCode !== GIFT_CODE) { setError('Hediye kodu geçersiz.'); return }

    setChecking(true)
    window.setTimeout(() => {
      const existing = readAccount()
      if (existing?.tier === 'free' && existing.code === GIFT_CODE) {
        setError('Bu cihazda hediye kodu daha önce kullanılmış.')
        setChecking(false)
        return
      }
      const now = Date.now()
      const account: LocalAccount = {
        username: cleanUsername,
        code: cleanCode,
        tier: 'free',
        activatedAt: now,
        expiresAt: now + 365 * 24 * 60 * 60 * 1000,
        deviceId: deviceId(),
        localIp: localIpHint(),
      }
      setAlreadyActive(true)
      setChecking(false)
      continueToAccount(account)
    }, 180)
  }

  return (
    <div className="nf-login">
      <div className="nf-login__glow" aria-hidden="true" />
      <div className="nf-login__grain" aria-hidden="true" />
      <div className="nf-login__brand"><NotflixLogo /></div>
      <main className="nf-login__card">
        <span className="nf-login__badge"><Gift size={15} /> NOTFLİX · AKTİVASYON</span>
        <div className="nf-login__heading">
          <span className="nf-login__ornament" aria-hidden="true"><KeyRound size={20} /></span>
          <h1>{alreadyActive ? 'Free Plan Aktif' : 'Aktivasyon kodunuzu girin'}</h1>
          <p>{alreadyActive ? 'Hediye paketi hazır. Siteye devam edebilirsiniz.' : 'Hediye veya premium kodunuzla Notflix’i açın.'}</p>
        </div>
        <div className="nf-login__form">
          <label className="nf-login__label" htmlFor="notflix-username">Kullanıcı adı</label>
          <input id="notflix-username" className="nf-login__input" value={username} onChange={(event) => setUsername(event.target.value.trim().slice(0, 24))} placeholder="Kullanıcı adınız" autoComplete="username" maxLength={24} disabled={checking} />
          
          <div className={`nf-login__input-wrap ${error ? 'has-error' : ''}`}><KeyRound className="nf-login__input-icon" size={19} aria-hidden="true"/><input id="notflix-code" className="nf-login__input" type={visible ? 'text' : 'password'} value={code} onChange={(event) => setCode(event.target.value)} placeholder="Kodunuzu girin" autoComplete="off" disabled={checking}/><button type="button" className="nf-login__eye" onClick={() => setVisible((value) => !value)} aria-label={visible ? 'Kodu gizle' : 'Kodu göster'}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
          {error && <p className="nf-login__error" role="alert">{error}</p>}
          <button type="button" className="nf-login__submit" disabled={checking} onClick={submit}>{checking ? <><Loader2 className="nf-spin" size={18}/> Açılıyor…</> : <>Siteye gir <ArrowRight size={18}/></>}</button>
        </div>
      </main>
      <NotflixFooter />
    </div>
  )
}
