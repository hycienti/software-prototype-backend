import router from '@adonisjs/core/services/router'
import AutoSwagger from 'adonis-autoswagger'
import swagger from './config/swagger.js'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

async function generate() {
  const spec = AutoSwagger.default.docs(router.toJSON(), swagger)
  const __dirname = dirname(fileURLToPath(import.meta.url))
  await writeFile(join(__dirname, 'docs/openapi.yml'), spec)
  console.log('OpenAPI spec generated to docs/openapi.yml')
}

generate().catch(console.error)
