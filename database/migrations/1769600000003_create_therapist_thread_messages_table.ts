import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'therapist_thread_messages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('thread_id')
        .unsigned()
        .references('therapist_threads.id')
        .onDelete('CASCADE')
        .notNullable()
      table.string('sender_type', 20).notNullable() // 'user' | 'therapist'
      table.text('body').notNullable()
      table.timestamp('created_at').notNullable()

      table.index('thread_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
