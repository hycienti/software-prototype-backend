import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Remove OAuth-related columns
      table.dropColumn('oauth_provider')
      table.dropColumn('oauth_provider_id')

      // Ensure email_verified exists (it should already)
      // Add full_name if it doesn't exist (it should already)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Restore OAuth columns if needed
      table.enum('oauth_provider', ['google', 'apple']).notNullable()
      table.string('oauth_provider_id').notNullable()
      table.unique(['oauth_provider', 'oauth_provider_id'])
    })
  }
}
