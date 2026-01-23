import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ai_insights'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('user_id')
        .notNullable()
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('type').notNullable() // 'gratitude' or 'mood'
      table.string('period').notNullable() // 'weekly' or 'monthly'
      table.text('insights').notNullable() // JSON string of AI-generated insights
      table.dateTime('generated_at').notNullable() // When insights were generated
      table.dateTime('expires_at').notNullable() // When insights expire (24 hours)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Ensure one insight per user per type per period
      table.unique(['user_id', 'type', 'period'])
      table.index(['user_id', 'type'])
      table.index(['expires_at']) // For cleanup queries
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
