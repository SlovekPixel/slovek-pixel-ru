import router from '@adonisjs/core/services/router'

const HomeController = () => import('#presentation/http/controllers/home_controller')

router.get('/', [HomeController, 'show']).as('home')
router.get('/api/status', [HomeController, 'status']).as('status')
