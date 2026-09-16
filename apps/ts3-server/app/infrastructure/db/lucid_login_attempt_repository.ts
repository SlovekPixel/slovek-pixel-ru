import { DateTime } from 'luxon'
import { LoginAttempt } from '#domain/login_attempt'
import { LoginAttemptRepository } from '#domain/login_attempt_repository'
import LoginLog from '#infrastructure/db/login_log'

export class LucidLoginAttemptRepository extends LoginAttemptRepository {
  async add(attempt: LoginAttempt): Promise<void> {
    await LoginLog.create({
      username: attempt.username,
      ip: attempt.ip,
      success: attempt.success,
      createdAt: DateTime.fromJSDate(attempt.createdAt),
    })
  }

  async deleteOlderThan(cutoff: Date): Promise<void> {
    await LoginLog.query().where('createdAt', '<', DateTime.fromJSDate(cutoff).toSQL()!).delete()
  }

  async listRecent(): Promise<LoginAttempt[]> {
    const rows = await LoginLog.query().orderBy('createdAt', 'desc')

    return rows.map(
      (row) => new LoginAttempt(row.username, row.ip, row.createdAt.toJSDate(), row.success, row.id)
    )
  }

  async countFailedSince(ip: string, since: Date): Promise<number> {
    const rows = await LoginLog.query()
      .where('ip', ip)
      .where('success', false)
      .where('createdAt', '>', DateTime.fromJSDate(since).toSQL()!)
      .select('id')

    return rows.length
  }

  async deleteFailedByIp(ip: string): Promise<void> {
    await LoginLog.query().where('ip', ip).where('success', false).delete()
  }
}
