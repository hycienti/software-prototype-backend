/**
 * Swagger/OpenAPI spec generator for local development.
 * 
 * Usage (after starting the app):
 *   pnpm swagger:generate
 * 
 * This generates the swagger spec from the running app's routes.
 * During Docker builds, we use the pre-generated static file as fallback.
 */
import router from '@adonisjs/core/services/router'
import AutoSwagger from 'adonis-autoswagger'
import swagger from './config/swagger.js'
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function generate() {
  try {
    const spec = AutoSwagger.default.docs(router.toJSON(), swagger)
    await mkdir(join(__dirname, 'docs'), { recursive: true })
    await writeFile(join(__dirname, 'docs/openapi.yml'), spec)
    console.log('✓ OpenAPI spec generated successfully to docs/openapi.yml')
  } catch (error) {
    console.error('✗ Failed to generate OpenAPI spec:', error instanceof Error ? error.message : error)
    console.error('  Note: This script must be run while the dev server is running.')
    console.error('  Start the server with: pnpm dev')
    console.error('  Then in another terminal: pnpm swagger:generate')
  }
}

generate()
