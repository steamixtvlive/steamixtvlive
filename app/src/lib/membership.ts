export interface MembershipSummary {
  username: string
  hasSubscription: boolean
  subscriptionExpiresAt: string | null
  banned: boolean
}

export function membershipFromSession(signal?: AbortSignal): Promise<MembershipSummary | null> {
  return checkMembership(signal)
}

/** Membership is checked by same-origin server endpoints, never by a client key. */
export async function checkMembership(signal?: AbortSignal): Promise<MembershipSummary | null> {
  const response = await fetch('/api/membership/status', { credentials: 'include', headers: { accept: 'application/json', 'x-notflix-device': persistentDeviceId() }, signal, cache: 'no-store' })
  if (response.status === 401 || response.status === 404) return null
  const result = await response.json().catch(() => null) as MembershipSummary | null
  if (!response.ok || !result || !result.username) throw new Error('Üyelik durumu doğrulanamadı')
  return result
}

function persistentDeviceId(): string {
  const key = 'notflix_device_id'
  try {
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(key, id)
    return id
  } catch { return '' }
}

export async function registerMember(payload: { username: string; email: string; password: string }, signal?: AbortSignal): Promise<string> {
  const response = await fetch('/api/membership/register', {
    method: 'POST', credentials: 'include', signal,
    headers: { 'content-type': 'application/json', accept: 'application/json', 'x-notflix-device': persistentDeviceId() },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => null) as { username?: string; error?: string } | null
  if (!response.ok || !result?.username) throw new Error(result?.error || 'Kayıt oluşturulamadı')
  return result.username
}

export async function redeemGiftCode(payload: { username: string; code: string }, signal?: AbortSignal): Promise<MembershipSummary> {
  const response = await fetch('/api/membership/redeem-gift', {
    method: 'POST', credentials: 'include', signal,
    headers: { 'content-type': 'application/json', accept: 'application/json', 'x-notflix-device': persistentDeviceId() },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => null) as (MembershipSummary & { error?: string }) | null
  if (!response.ok || !result?.username || !result.hasSubscription) throw new Error(result?.error || 'Hediye kodu doğrulanamadı')
  return result
}

export async function logoutMember(signal?: AbortSignal): Promise<void> {
  const response = await fetch('/api/membership/logout', { method: 'POST', credentials: 'include', signal, headers: { 'x-notflix-device': persistentDeviceId() } })
  if (!response.ok) throw new Error('Çıkış yapılamadı')
}

export async function loginMember(payload: { username: string; password: string }, signal?: AbortSignal): Promise<string> {
  const response = await fetch('/api/membership/login', { method: 'POST', credentials: 'include', signal, headers: { 'content-type': 'application/json', accept: 'application/json', 'x-notflix-device': persistentDeviceId() }, body: JSON.stringify(payload) })
  const result = await response.json().catch(() => null) as { username?: string; error?: string } | null
  if (!response.ok || !result?.username) throw new Error(result?.error || 'Giriş doğrulanamadı')
  return result.username
}

export async function deleteMemberAccount(signal?: AbortSignal): Promise<void> {
  const response = await fetch('/api/membership/delete-account', { method: 'DELETE', credentials: 'include', signal, headers: { accept: 'application/json', 'x-notflix-device': persistentDeviceId() } })
  const result = await response.json().catch(() => null) as { error?: string } | null
  if (!response.ok) throw new Error(result?.error || 'Hesap silinemedi')
}
