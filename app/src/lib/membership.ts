export interface MembershipSummary {
  username: string
  hasSubscription: boolean
  subscriptionExpiresAt: string | null
  banned: boolean
}

export interface LocalMembership {
  username: string
  code: string
  tier: 'free' | 'premium'
  activatedAt: number
  expiresAt: number | null
  deviceId: string
  localIp: string
}

const STORAGE_KEY = 'notflix_local_user_v1'

export async function checkMembership(): Promise<MembershipSummary | null> {
  try {
    const account = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as LocalMembership | null
    if (!account?.username || !account.code || account.deviceId !== getDeviceId()) return null
    const active = account.tier === 'premium' || (account.expiresAt !== null && account.expiresAt > Date.now())
    return { username: account.username, hasSubscription: active, subscriptionExpiresAt: account.expiresAt ? new Date(account.expiresAt).toISOString() : null, banned: false }
  } catch { return null }
}

export const membershipFromSession = checkMembership

export function getLocalMembership(): LocalMembership | null {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as LocalMembership | null } catch { return null }
}

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem('notflix_device_id')
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem('notflix_device_id', id)
    return id
  } catch { return '' }
}

export async function registerMember(payload: { username: string }): Promise<string> {
  const id = getDeviceId()
  const record: LocalMembership = { username: payload.username, code: '', tier: 'free', activatedAt: Date.now(), expiresAt: null, deviceId: id, localIp: 'unavailable-in-browser' }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  return record.username
}

export async function redeemGiftCode(payload: { username: string; code: string }): Promise<MembershipSummary> {
  if (payload.code !== '69SAdTXj9') throw new Error('Hediye kodu geçersiz.')
  const id = getDeviceId()
  const old = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as LocalMembership | null } catch { return null } })()
  if (old?.tier === 'free' && old.code === '69SAdTXj9' && old.username === payload.username.trim()) throw new Error('Bu cihazdaki hediye paketi zaten aktiftir; siteyi açabilirsiniz.')
  const record: LocalMembership = { username: payload.username.trim(), code: payload.code, tier: 'free', activatedAt: Date.now(), expiresAt: Date.now() + 365 * 86400000, deviceId: id, localIp: old?.localIp || 'unavailable-in-browser' }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  return { username: record.username, hasSubscription: true, subscriptionExpiresAt: new Date(record.expiresAt!).toISOString(), banned: false }
}

export async function loginMember(payload: { username: string }): Promise<string> {
  const account = await checkMembership()
  if (!account || account.username !== payload.username) throw new Error('Bu cihazda bu kullanıcı adı için aktivasyon kaydı bulunamadı.')
  return account.username
}

export async function logoutMember(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY)
}
