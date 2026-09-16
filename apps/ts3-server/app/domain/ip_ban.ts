export const MAX_FAILED_LOGINS_PER_IP = 3
export const IP_BAN_DURATION_MS = 24 * 60 * 60 * 1000

export class IpBan {
  constructor(
    readonly ip: string,
    readonly expiresAt: Date,
    readonly createdAt: Date,
    readonly id?: number
  ) {}

  isActive(at: Date = new Date()): boolean {
    return this.expiresAt.getTime() > at.getTime()
  }
}

export function ipBanExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + IP_BAN_DURATION_MS)
}

export function failedLoginWindowStart(latestBan: IpBan | null, now: Date = new Date()): Date {
  const windowStart = new Date(now.getTime() - IP_BAN_DURATION_MS)
  if (latestBan && latestBan.expiresAt.getTime() > windowStart.getTime()) {
    return latestBan.expiresAt
  }
  return windowStart
}

export function shouldBanIp(failedCount: number): boolean {
  return failedCount >= MAX_FAILED_LOGINS_PER_IP
}
