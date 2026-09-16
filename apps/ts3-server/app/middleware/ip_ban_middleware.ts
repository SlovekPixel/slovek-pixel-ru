import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { IpBanRepository } from '#domain/ip_ban_repository'

@inject()
export default class IpBanMiddleware {
  constructor(private ipBans: IpBanRepository) {}

  async handle(ctx: HttpContext, next: NextFn) {
    const ip = ctx.request.ip()
    if (ip && (await this.ipBans.isBanned(ip))) {
      return ctx.response.status(403).send(await ctx.view.render('pages/errors/blocked'))
    }

    return next()
  }
}
