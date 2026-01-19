// AutoSwagger configuration for AdonisJS v6
import path from 'node:path'
import url from 'node:url'

export default {
  // Project root path (required for AutoSwagger to find routes, models, validators, etc)
  path: path.dirname(url.fileURLToPath(import.meta.url)) + '/../',

  tagIndex: 3,
  productionEnv: 'production',

  info: {
    title: 'Havens Backend API',
    version: '1.0.0',
    description: 'Auto-generated Swagger docs for Havens Backend',
  },

  snakeCase: true,

  debug: false,
  ignore: ['/swagger', '/docs', '/docs/*'],

  authMiddlewares: ['auth'],
  defaultSecurityScheme: 'BearerAuth',

  persistAuthorization: true,
  showFullPath: false,
} as const
