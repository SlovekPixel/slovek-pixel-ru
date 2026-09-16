import router from '@adonisjs/core/services/router'

router.get('/', [() => import('#presentation/http/controllers/home_controller'), 'show']).as('home')
