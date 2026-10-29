import { useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import NotflixLogo from '@/sections/NotflixLogo'
import NotflixFooter from '@/sections/NotflixFooter'

const LOCAL_USER_KEY = 'notflix_local_user_v1'
const DEVICE_ID_KEY = 'notflix_device_id'

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
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_ID_KEY, id) }
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
  const [checking, setChecking] = useState(false)
  function continueToAccount(account: LocalAccount) {
    try { localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(account)) } catch { /* device storage unavailable */ }
    window.dispatchEvent(new CustomEvent('notflix-local-activated', { detail: account }))
    onLoggedIn(account.username)
    onActivated()
  }

  function continueWithoutCode() {
    if (checking) return
    setChecking(true)
    window.setTimeout(() => {
      const existing = readAccount()
      const currentDeviceId = deviceId()
      const account: LocalAccount = existing?.deviceId === currentDeviceId && existing.username
        ? existing
        : { username: 'Notflix Kullanıcısı', code: '', tier: 'free', activatedAt: Date.now(), expiresAt: null, deviceId: currentDeviceId, localIp: localIpHint() }
      setChecking(false)
      continueToAccount(account)
    }, 80)
  }

  return (
    <div className="nf-login">
      <div className="nf-login__glow" aria-hidden="true" />
      <div className="nf-login__grain" aria-hidden="true" />
      <div className="nf-login__brand"><NotflixLogo /></div>
      <main className="nf-login__card">
        <span className="nf-login__welcome-logo"><NotflixLogo /></span>
        <div className="nf-login__heading">
          <h1>Notflix’e hoş geldiniz</h1>
          <p>Film, dizi ve canlı yayınları keşfedin.</p>
        </div>
        <div className="nf-login__form">
          <button type="button" className="nf-login__submit" disabled={checking} onClick={continueWithoutCode}>{checking ? <><Loader2 className="nf-spin" size={18}/> Açılıyor…</> : <>Keşfetmeye başla <ArrowRight size={18}/></>}</button>
        </div>
      </main>
      <NotflixFooter />
    </div>
  )
}
