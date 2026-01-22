import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'messages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('conversation_id')
        .notNullable()
        .unsigned()
        .references('id')
        .inTable('conversations')
        .onDelete('CASCADE')
      table.enum('role', ['user', 'assistant', 'system']).notNullable()
      table.text('content').notNullable()
      table.json('metadata').nullable() // Store audio URLs, sentiment, etc.
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['conversation_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
