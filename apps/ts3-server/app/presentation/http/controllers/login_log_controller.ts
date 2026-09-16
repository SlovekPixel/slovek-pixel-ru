import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { ListLoginAttempts } from '#application/list_login_attempts'

@inject()
export default class LoginLogController {
  constructor(private listLoginAttempts: ListLoginAttempts) {}

  async index({ view }: HttpContext) {
    const attempts = await this.listLoginAttempts.execute()

    return view.render('pages/auth/logging', {
      attempts: attempts.map((attempt) => ({
        username: attempt.username,
        ip: attempt.ip,
        createdAt: attempt.createdAt.toISOString(),
        success: attempt.success,
      })),
    })
  }
}
