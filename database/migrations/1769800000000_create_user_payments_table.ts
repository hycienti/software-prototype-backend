import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_payments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('user_id').unsigned().references('users.id').onDelete('CASCADE').notNullable()
      table.bigInteger('amount_cents').notNullable()
      table.string('currency', 3).defaultTo('USD').notNullable()
      table.string('status', 32).notNullable() // pending, completed, failed, refunded
      table.integer('session_id').unsigned().references('sessions.id').onDelete('SET NULL').nullable()
      table.integer('therapist_id').unsigned().references('therapists.id').onDelete('SET NULL').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
