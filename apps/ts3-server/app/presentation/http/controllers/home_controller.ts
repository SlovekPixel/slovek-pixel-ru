import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { GetTeamSpeakStatus } from '#application/get_teamspeak_status'

@inject()
export default class HomeController {
  constructor(private getTeamSpeakStatus: GetTeamSpeakStatus) {}

  async show({ view }: HttpContext) {
    const teamspeak = await this.getTeamSpeakStatus.execute()
    return view.render('pages/home', {
      teamspeak,
      voiceHost: env.get('DOMAIN'),
    })
  }
}
