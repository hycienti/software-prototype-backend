import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'session_feedbacks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('session_id')
        .unsigned()
        .references('sessions.id')
        .onDelete('CASCADE')
        .notNullable()
      table.integer('rating').unsigned().notNullable() // 1-5
      table.string('sentiment_after').notNullable() // better | same | worse
      table.text('comment').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['session_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
