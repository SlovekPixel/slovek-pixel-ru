import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { ListBannedIps } from '#application/list_banned_ips'
import { UnbanIp } from '#application/unban_ip'
import { unbanIpValidator } from '#presentation/http/validators/unban_ip_validator'

@inject()
export default class IpBanController {
  constructor(
    private listBannedIps: ListBannedIps,
    private unbanIp: UnbanIp
  ) {}

  async index({ view }: HttpContext) {
    const bans = await this.listBannedIps.execute()

    return view.render('pages/auth/unban', {
      bans: bans.map((ban) => ({ ip: ban.ip })),
    })
  }

  async destroy({ request, response, session }: HttpContext) {
    const { ip } = await request.validateUsing(unbanIpValidator)
    await this.unbanIp.execute(ip)
    session.flash('success', 'IP unbanned')
    return response.redirect().toRoute('login.unban')
  }
}
