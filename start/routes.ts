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
const GratitudeController = () => import('#controllers/gratitude_controller')
const MoodController = () => import('#controllers/mood_controller')
const AchievementsController = () => import('#controllers/achievements_controller')
const TherapistsController = () => import('#controllers/therapists_controller')
const SessionsController = () => import('#controllers/sessions_controller')
const NotificationsController = () => import('#controllers/notifications_controller')
const TherapistNotificationsController = () => import('#controllers/therapist_notifications_controller')
const TherapistDashboardController = () => import('#controllers/therapist_dashboard_controller')
const TherapistClientsController = () => import('#controllers/therapist_clients_controller')
const TherapistAvailabilityController = () => import('#controllers/therapist_availability_controller')
const TherapistWalletController = () => import('#controllers/therapist_wallet_controller')
const TherapistDocumentsController = () => import('#controllers/therapist_documents_controller')
const UserTherapistsController = () => import('#controllers/user_therapists_controller')
const TherapistThreadsController = () => import('#controllers/therapist_threads_controller')
const UserPaymentsController = () => import('#controllers/user_payments_controller')
const NotificationModuleController = () => import('#controllers/notification_module_controller')

router.get('/', async () => ({
  status: 'ok',
  message: 'Haven API is running 🏃, lets go to the moon 🚀',
}))

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

    // Therapist Auth routes
    router
      .group(() => {
        router.post('/send-otp', [TherapistsController, 'sendOtp'])
        router.post('/verify-otp', [TherapistsController, 'verifyOtp'])
        router.post('/onboard', [TherapistsController, 'onboard'])
        router.get('/specialties', [TherapistsController, 'specialties'])
        router
          .group(() => {
            router.get('/me', [TherapistsController, 'me'])
            router.patch('/me', [TherapistsController, 'updateMe'])
            router.post('/documents/upload', [TherapistDocumentsController, 'upload'])
          })
          .use(middleware.auth({ guards: ['therapist'] }))
      })
      .prefix('/therapist/auth')

    // Therapist app routes (all require therapist auth)
    router
      .group(() => {
        router.get('/dashboard', [TherapistDashboardController, 'index'])
        router.get('/clients', [TherapistClientsController, 'index'])
        router.get('/availability', [TherapistAvailabilityController, 'show'])
        router.put('/availability', [TherapistAvailabilityController, 'update'])
        router.get('/wallet', [TherapistWalletController, 'index'])
        router.post('/wallet/withdraw', [TherapistWalletController, 'withdraw'])
        router.get('/notifications', [TherapistNotificationsController, 'index'])
        router.patch('/notifications/mark-all-read', [TherapistNotificationsController, 'markAllAsRead'])
        router.patch('/notifications/:id', [TherapistNotificationsController, 'update'])
        router.delete('/notifications/:id', [TherapistNotificationsController, 'destroy'])
      })
      .prefix('/therapist')
      .use(middleware.auth({ guards: ['therapist'] }))

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
        router.get('/stream/status', [ConversationsController, 'getStreamStatus'])
        router.get('/history', [ConversationsController, 'getHistory'])
        router.post('/typing', [ConversationsController, 'typing'])
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

    // Gratitude routes
    router
      .group(() => {
        router.post('/', [GratitudeController, 'create'])
        router.post('/upload-photo', [GratitudeController, 'uploadPhoto'])
        router.get('/', [GratitudeController, 'index'])
        router.get('/streak', [GratitudeController, 'streak'])
        router.get('/insights', [GratitudeController, 'insights'])
        router.get('/quotes/random', [GratitudeController, 'randomQuote'])
        router.get('/:id', [GratitudeController, 'show'])
        router.patch('/:id', [GratitudeController, 'update'])
        router.delete('/:id', [GratitudeController, 'destroy'])
      })
      .prefix('/gratitudes')
      .use(middleware.auth())

    // Mood routes
    router
      .group(() => {
        router.post('/', [MoodController, 'create'])
        router.get('/', [MoodController, 'index'])
        router.get('/streak', [MoodController, 'streak'])
        router.get('/insights', [MoodController, 'insights'])
        router.get('/:id', [MoodController, 'show'])
        router.patch('/:id', [MoodController, 'update'])
        router.delete('/:id', [MoodController, 'destroy'])
      })
      .prefix('/moods')
      .use(middleware.auth())

    // Achievements routes
    router
      .group(() => {
        router.get('/', [AchievementsController, 'index'])
        router.get('/:id', [AchievementsController, 'show'])
      })
      .prefix('/achievements')
      .use(middleware.auth())

    // User-facing therapists (list and detail; api auth only)
    router
      .group(() => {
        router.get('/', [UserTherapistsController, 'index'])
        router.get('/:id', [UserTherapistsController, 'show'])
      })
      .prefix('/therapists')
      .use(middleware.auth())

    // Therapist–user messaging (user auth)
    router
      .group(() => {
        router.post('/upload', [TherapistThreadsController, 'upload'])
        router.get('/', [TherapistThreadsController, 'index'])
        router.get('/:id', [TherapistThreadsController, 'show'])
        router.post('/:id/messages', [TherapistThreadsController, 'createMessage'])
      })
      .prefix('/therapist-threads')
      .use(middleware.auth())

    // User payments (mock payment + book session, list payments)
    router
      .group(() => {
        router.post('/', [UserPaymentsController, 'store'])
        router.get('/', [UserPaymentsController, 'index'])
      })
      .prefix('/payments')
      .use(middleware.auth())

    // Session routes
    router
      .group(() => {
        router.post('/', [SessionsController, 'book']).use(middleware.auth())
        router
          .get('/', [SessionsController, 'index'])
          .use(middleware.auth({ guards: ['api', 'therapist'] }))
        router
          .get('/:id/join-room', [SessionsController, 'joinRoom'])
          .use(middleware.auth())
        router
          .get('/:id', [SessionsController, 'show'])
          .use(middleware.auth({ guards: ['api', 'therapist'] }))
        router
          .post('/test-room', [SessionsController, 'createTestRoom'])
          .use(middleware.auth({ guards: ['therapist'] }))
        router
          .post('/:id/create-room', [SessionsController, 'createRoom'])
          .use(middleware.auth({ guards: ['therapist'] }))
        router
          .patch('/:id/summary', [SessionsController, 'submitSummary'])
          .use(middleware.auth({ guards: ['therapist'] }))
        router
          .post('/:id/feedback', [SessionsController, 'submitFeedback'])
          .use(middleware.auth())
      })
      .prefix('/sessions')

    // Notifications routes
    router
      .group(() => {
        router.get('/', [NotificationsController, 'index'])
        router.patch('/mark-all-read', [NotificationsController, 'markAllAsRead'])
        router.patch('/:id', [NotificationsController, 'update'])
        router.delete('/:id', [NotificationsController, 'destroy'])
      })
      .prefix('/notifications')
      .use(middleware.auth())

    // Notification module: CRUD for channels, categories, types, templates; list deliveries
    router
      .group(() => {
        router.get('/', [NotificationModuleController, 'channels'])
        router.get('/:id', [NotificationModuleController, 'showChannel'])
        router.post('/', [NotificationModuleController, 'storeChannel'])
        router.patch('/:id', [NotificationModuleController, 'updateChannel'])
        router.delete('/:id', [NotificationModuleController, 'destroyChannel'])
      })
      .prefix('/notification-channels')
    router
      .group(() => {
        router.get('/', [NotificationModuleController, 'categories'])
        router.get('/:id', [NotificationModuleController, 'showCategory'])
        router.post('/', [NotificationModuleController, 'storeCategory'])
        router.patch('/:id', [NotificationModuleController, 'updateCategory'])
        router.delete('/:id', [NotificationModuleController, 'destroyCategory'])
      })
      .prefix('/notification-categories')
    router
      .group(() => {
        router.get('/', [NotificationModuleController, 'types'])
        router.get('/:id', [NotificationModuleController, 'showType'])
        router.post('/', [NotificationModuleController, 'storeType'])
        router.patch('/:id', [NotificationModuleController, 'updateType'])
        router.delete('/:id', [NotificationModuleController, 'destroyType'])
      })
      .prefix('/notification-types')
    router
      .group(() => {
        router.get('/', [NotificationModuleController, 'templates'])
        router.get('/:id', [NotificationModuleController, 'showTemplate'])
        router.post('/', [NotificationModuleController, 'storeTemplate'])
        router.patch('/:id', [NotificationModuleController, 'updateTemplate'])
        router.delete('/:id', [NotificationModuleController, 'destroyTemplate'])
      })
      .prefix('/notification-templates')
    router.get('/notification-deliveries', [NotificationModuleController, 'deliveries'])
  })
  .prefix('/api/v1')
