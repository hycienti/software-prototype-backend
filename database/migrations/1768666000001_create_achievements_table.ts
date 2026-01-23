import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'achievements'

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
      table.string('type').notNullable() // e.g., 'gratitude_streak', 'gratitude_count', etc.
      table.string('title').notNullable()
      table.text('description').nullable()
      table.string('icon').nullable() // Icon identifier
      table.string('icon_color').nullable() // Icon color
      table.string('icon_bg_color').nullable() // Icon background color
      table.integer('threshold').nullable() // Threshold value (e.g., 7 for 7-day streak)
      table.integer('progress').notNullable().defaultTo(0) // Current progress
      table.boolean('is_completed').notNullable().defaultTo(false)
      table.timestamp('completed_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Ensure unique achievement type per user
      table.unique(['user_id', 'type'])
      table.index(['user_id', 'is_completed'])
      table.index(['user_id', 'type'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
