import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { AuthenticateUser } from '#application/authenticate_user'
import { loginValidator } from '#presentation/http/validators/login_validator'

@inject()
export default class SessionController {
  constructor(private authenticateUser: AuthenticateUser) {}

  async create({ view }: HttpContext) {
    return view.render('pages/auth/login')
  }

  async store({ request, auth, response, session, view }: HttpContext) {
    const { username, password } = await request.validateUsing(loginValidator)
    const result = await this.authenticateUser.execute({
      username,
      password,
      ip: request.ip(),
    })

    if (!result.ok) {
      if (result.blocked) {
        return response.status(403).send(await view.render('pages/errors/blocked'))
      }

      session.flashExcept(['password'])
      session.flash('error', 'Invalid username or password')
      return response.redirect().toRoute('session.create')
    }

    await auth.use('web').login(result.user)
    return response.redirect().toRoute('home')
  }

  async destroy({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    return response.redirect().toRoute('session.create')
  }
}
