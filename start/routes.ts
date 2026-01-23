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
const UsersController = () => import('#controllers/users_controller')
const ConversationsController = () => import('#controllers/conversations_controller')
const VoiceController = () => import('#controllers/voice_controller')

router.get('/', async () => ({ status: 'ok', message: 'Haven API is running 🏃, lets gooo' }))

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
        // Email/OTP authentication endpoints
        router.post('/send-otp', [AuthController, 'sendOtp'])
        router.post('/verify-otp', [AuthController, 'verifyOtp'])
        router.post('/complete-signup', [AuthController, 'completeSignup'])

        // Token management (requires authentication)
        router.post('/refresh', [AuthController, 'refresh']).use(middleware.auth())
        router.post('/logout', [AuthController, 'logout']).use(middleware.auth())
      })
      .prefix('/auth')

    // User profile routes
    router
      .group(() => {
        router.get('/me', [UsersController, 'me'])
        router.patch('/me', [UsersController, 'update'])
        router.delete('/me', [UsersController, 'destroy'])
      })
      .prefix('/user')
      .use(middleware.auth())

    // Conversation routes
    router
      .group(() => {
        router.post('/message', [ConversationsController, 'sendMessage'])
        router.get('/stream/:id', [ConversationsController, 'streamMessage'])
        router.get('/history', [ConversationsController, 'getHistory'])
        router.get('/:id', [ConversationsController, 'getConversation'])
        router.delete('/:id', [ConversationsController, 'deleteConversation'])
      })
      .prefix('/conversations')
      .use(middleware.auth())

    // Voice routes
    router
      .group(() => {
        router.post('/process', [VoiceController, 'processVoiceMessage'])
        router.post('/tts', [VoiceController, 'textToSpeech'])
      })
      .prefix('/voice')
      .use(middleware.auth())
  })
  .prefix('/api/v1')
