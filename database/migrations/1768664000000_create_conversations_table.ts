import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'conversations'

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
      table.string('title').nullable()
      table.enum('mode', ['text', 'voice']).notNullable().defaultTo('text')
      table.json('metadata').nullable() // Store additional context, sentiment, etc.
      table.timestamp('last_message_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['user_id', 'created_at'])
      table.index(['user_id', 'last_message_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
