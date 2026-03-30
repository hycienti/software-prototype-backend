import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const isProduction = env.get('NODE_ENV') === 'production'
const databaseUrl = env.get('DATABASE_URL')
const useSsl = env.get('DB_SSL') ?? isProduction

const connection = databaseUrl
  ? {
      connectionString: databaseUrl,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    }
  : {
      host: env.get('DB_HOST') ?? '127.0.0.1',
      port: env.get('DB_PORT') ?? 5432,
      user: env.get('DB_USER') ?? 'postgres',
      password: env.get('DB_PASSWORD'),
      database: env.get('DB_DATABASE') ?? 'haven',
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    }

const dbConfig = defineConfig({
  connection: 'postgres',
  connections: {
    postgres: {
      client: 'pg',
      connection,
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },
  },
})

export default dbConfig
