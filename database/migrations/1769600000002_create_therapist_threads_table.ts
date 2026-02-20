import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'therapist_threads'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('user_id')
        .unsigned()
        .references('users.id')
        .onDelete('CASCADE')
        .notNullable()
      table
        .integer('therapist_id')
        .unsigned()
        .references('therapists.id')
        .onDelete('CASCADE')
        .notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['user_id', 'therapist_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
