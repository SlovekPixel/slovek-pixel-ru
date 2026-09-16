import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

router
  .get('/', [() => import('#presentation/http/controllers/home_controller'), 'show'])
  .as('home')
  .use(middleware.auth())

router
  .group(() => {
    router
      .get('/login', [() => import('#presentation/http/controllers/session_controller'), 'create'])
      .as('session.create')
    router
      .post('/login', [() => import('#presentation/http/controllers/session_controller'), 'store'])
      .as('session.store')
  })
  .use(middleware.guest())

router
  .post('/logout', [() => import('#presentation/http/controllers/session_controller'), 'destroy'])
  .as('session.destroy')
  .use(middleware.auth())

router
  .get('/login/logging', [
    () => import('#presentation/http/controllers/login_log_controller'),
    'index',
  ])
  .as('login.logging')
  .use(middleware.auth())

router
  .get('/login/unban', [() => import('#presentation/http/controllers/ip_ban_controller'), 'index'])
  .as('login.unban')
  .use(middleware.auth())

router
  .post('/login/unban', [
    () => import('#presentation/http/controllers/ip_ban_controller'),
    'destroy',
  ])
  .as('login.unban.destroy')
  .use(middleware.auth())
