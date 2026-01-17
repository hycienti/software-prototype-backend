/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'

const AuthController = () => import('#controllers/auth_controller')

router.get('/', async () => ({ status: 'ok', message: 'Haven API is running' }))

router
  .group(() => {
    router
      .group(() => {
        router.post('/google', [AuthController, 'google'])
        router.post('/apple', [AuthController, 'apple'])
        router.post('/refresh', [AuthController, 'refresh']).use(middleware.auth())
        router.post('/logout', [AuthController, 'logout']).use(middleware.auth())
      })
      .prefix('/auth')

    router.get('/user/me', [AuthController, 'me']).use(middleware.auth())
  })
  .prefix('/api/v1')

