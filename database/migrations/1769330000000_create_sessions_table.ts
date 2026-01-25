import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sessions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('user_id').unsigned().references('users.id').onDelete('CASCADE').notNullable()
      table
        .integer('therapist_id')
        .unsigned()
        .references('therapists.id')
        .onDelete('CASCADE')
        .notNullable()

      table.timestamp('scheduled_at').notNullable()
      table.integer('duration_minutes').defaultTo(50)
      table.string('status').defaultTo('scheduled').notNullable()

      // Summary fields
      table.string('sentiment').nullable()
      table.integer('engagement_level').nullable() // e.g. 0-100
      table.text('clinical_notes').nullable()
      table.timestamp('follow_up_at').nullable()
      table.timestamp('summary_completed_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
