import router from '@adonisjs/core/services/router'
import AutoSwagger from 'adonis-autoswagger'
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function generate() {
  try {
    // Import swagger config - works with both source and compiled versions
    const { default: swagger } = await import('./build/config/swagger.js').catch(() => 
      import('./config/swagger.js')
    )
    
    const spec = AutoSwagger.default.docs(router.toJSON(), swagger)
    
    // Ensure docs directory exists
    await mkdir(join(__dirname, 'docs'), { recursive: true })
    
    await writeFile(join(__dirname, 'docs/openapi.yml'), spec)
    console.log('✓ OpenAPI spec generated to docs/openapi.yml')
    process.exit(0)
  } catch (error) {
    console.error('✗ Failed to generate OpenAPI spec:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

generate()
