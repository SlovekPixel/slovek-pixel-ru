import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { GetTeamSpeakStatus } from '#application/get_teamspeak_status'
import { toStatusDto } from '#domain/teamspeak_status_format'

@inject()
export default class HomeController {
  constructor(private getTeamSpeakStatus: GetTeamSpeakStatus) {}

  async show({ view }: HttpContext) {
    return view.render('pages/home', {
      teamspeak: await this.dto(),
    })
  }

  async status({ response }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    return response.json(await this.dto())
  }

  private async dto() {
    const teamspeak = await this.getTeamSpeakStatus.execute()
    return toStatusDto(teamspeak, env.get('DOMAIN'))
  }
}
