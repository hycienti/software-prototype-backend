import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'gratitudes'

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
      table.json('entries').notNullable() // Array of gratitude entries (strings)
      table.string('photo_url').nullable() // Optional photo for photo gratitude
      table.date('entry_date').notNullable() // Date of the gratitude entry
      table.json('metadata').nullable() // Additional data (tags, mood, etc.)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Ensure one entry per user per day
      table.unique(['user_id', 'entry_date'])
      table.index(['user_id', 'entry_date'])
      table.index(['user_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
