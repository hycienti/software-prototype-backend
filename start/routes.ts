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
import { readFile } from 'node:fs/promises'
import AutoSwagger from 'adonis-autoswagger'
import swagger from '#config/swagger'

const AuthController = () => import('#controllers/auth_controller')

router.get('/', async () => ({ status: 'ok', message: 'Haven API is running' }))

router.get('/docs/openapi.yml', async ({ response }) => {
  const specPath = new URL('../docs/openapi.yml', import.meta.url)
  const spec = await readFile(specPath, 'utf8')
  response.type('text/yaml; charset=utf-8')
  response.header('cache-control', 'no-store')
  return spec
})

router.get('/docs/static', async ({ response }) => {
  response.type('text/html; charset=utf-8')
  response.header('cache-control', 'no-store')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Havens API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #0b1220; }
      .swagger-ui .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/docs/openapi.yml',
        dom_id: '#swagger-ui',
        deepLinking: true,
        persistAuthorization: true,
      })
    </script>
  </body>
</html>`
})

// AutoSwagger (generated from routes, models, validators)
router.get('/swagger', async () => {
  return AutoSwagger.default.docs(router.toJSON(), swagger)
})

router.get('/docs', async () => {
  return AutoSwagger.default.ui('/swagger', swagger)
})

router
  .group(() => {
    router
      .group(() => {
        router.get('/google/redirect', [AuthController, 'googleRedirect'])
        router.get('/google/callback', [AuthController, 'googleCallback'])
        router.post('/google', [AuthController, 'google'])
        router.post('/apple', [AuthController, 'apple'])

        router.post('/refresh', [AuthController, 'refresh']).use(middleware.auth())
        router.post('/logout', [AuthController, 'logout']).use(middleware.auth())
      })
      .prefix('/auth')

    router.get('/user/me', [AuthController, 'me']).use(middleware.auth())
  })
  .prefix('/api/v1')
