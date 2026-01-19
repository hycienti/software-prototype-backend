// AutoSwagger configuration for AdonisJS v6
export default {
  // Project root path (required for AutoSwagger to find routes, models, validators, etc)
  // Use process.cwd() which is /app in Docker (works for both dev and production)
  path: process.cwd() + '/',

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

  common: {
    parameters: {},
    headers: {},
  },

  securitySchemes: {},

  authMiddlewares: ['auth'],
  defaultSecurityScheme: 'BearerAuth',

  persistAuthorization: true,
  showFullPath: false,
}
