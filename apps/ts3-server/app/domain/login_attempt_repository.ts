import type { LoginAttempt } from '#domain/login_attempt'

export abstract class LoginAttemptRepository {
  abstract add(attempt: LoginAttempt): Promise<void>
  abstract deleteOlderThan(cutoff: Date): Promise<void>
  abstract listRecent(): Promise<LoginAttempt[]>
  abstract countFailedSince(ip: string, since: Date): Promise<number>
  abstract deleteFailedByIp(ip: string): Promise<void>
}
