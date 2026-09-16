export const LOGIN_ATTEMPT_RETENTION_DAYS = 3
export const LOGIN_ATTEMPT_RETENTION_MS = LOGIN_ATTEMPT_RETENTION_DAYS * 24 * 60 * 60 * 1000

export type AdminIdentity = {
  id: number
  username: string
}

export const ADMIN_IDENTITY: AdminIdentity = {
  id: 1,
  username: 'admin',
}

const ADMIN_PASSWORD = 'admin'

export function matchesAdminCredentials(username: string, password: string): boolean {
  return username === ADMIN_IDENTITY.username && password === ADMIN_PASSWORD
}
