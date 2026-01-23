import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'moods'

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
      table.string('mood').notNullable() // e.g., 'happy', 'calm', 'anxious', 'sad', 'angry'
      table.integer('intensity').notNullable() // 1-10 scale
      table.text('notes').nullable() // Journal entry text
      table.string('photo_url').nullable() // Optional photo
      table.date('entry_date').notNullable() // Date of the mood entry
      table.json('tags').nullable() // Array of tags (triggers, activities, etc.)
      table.json('metadata').nullable() // Additional data (location, weather, etc.)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Ensure one entry per user per day (optional - can allow multiple)
      // table.unique(['user_id', 'entry_date'])
      table.index(['user_id', 'entry_date'])
      table.index(['user_id', 'created_at'])
      table.index(['user_id', 'mood'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
