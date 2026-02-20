/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  APP_URL: Env.schema.string(),
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  GOOGLE_CLIENT_ID: Env.schema.string.optional(),
  GOOGLE_CLIENT_SECRET: Env.schema.string.optional(),
  APPLE_CLIENT_ID: Env.schema.string.optional(),
  APPLE_TEAM_ID: Env.schema.string.optional(),
  APPLE_KEY_ID: Env.schema.string.optional(),
  APPLE_PRIVATE_KEY: Env.schema.string.optional(),

  // AI Services
  OPENAI_API_KEY: Env.schema.string.optional(),
  OPENAI_MODEL: Env.schema.string.optional(),
  ELEVENLABS_API_KEY: Env.schema.string.optional(),
  ELEVENLABS_VOICE_ID: Env.schema.string.optional(),
  ELEVENLABS_MODEL_ID: Env.schema.string.optional(),
  ELEVENLABS_STT_MODEL_ID: Env.schema.string.optional(),

  RESEND_API_KEY: Env.schema.string.optional(),
  RESEND_FROM_EMAIL: Env.schema.string.optional(),
  RESEND_FROM_NAME: Env.schema.string.optional(),

  // Pusher
  PUSHER_APP_ID: Env.schema.string.optional(),
  PUSHER_KEY: Env.schema.string.optional(),
  PUSHER_SECRET: Env.schema.string.optional(),
  PUSHER_CLUSTER: Env.schema.string.optional(),
  PUSHER_USE_TLS: Env.schema.boolean.optional(),

  /** VideoSDK: use API_KEY + SECRET to generate JWTs (recommended), or a pre-generated VIDEO_SDK_TOKEN */
  VIDEO_SDK_API_KEY: Env.schema.string.optional(),
  VIDEO_SDK_SECRET: Env.schema.string.optional(),
  VIDEO_SDK_TOKEN: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the drive package
  |----------------------------------------------------------
  */
  DRIVE_DISK: Env.schema.enum(['fs', 's3', 'r2', 'gcs'] as const),
  AWS_ACCESS_KEY_ID: Env.schema.string.optional(),
  AWS_SECRET_ACCESS_KEY: Env.schema.string.optional(),
  AWS_REGION: Env.schema.string.optional(),
  S3_BUCKET: Env.schema.string.optional(),
  R2_KEY: Env.schema.string.optional(),
  R2_SECRET: Env.schema.string.optional(),
  R2_BUCKET: Env.schema.string.optional(),
  R2_ENDPOINT: Env.schema.string.optional(),
  R2_PUBLIC_URL: Env.schema.string.optional(),
  GCS_KEY: Env.schema.string.optional(),
  GCS_BUCKET: Env.schema.string.optional(),
})
