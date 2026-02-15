import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'availability_slots'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('therapist_id')
        .unsigned()
        .references('therapists.id')
        .onDelete('CASCADE')
        .notNullable()
      /** recurring = weekly by days; one_off = specific date */
      table.string('type', 16).notNullable() // 'recurring' | 'one_off'
      table.string('label', 128).nullable()
      /** JSON array of 0-6 (Sunday-Saturday) for recurring; null for one_off */
      table.jsonb('days').nullable()
      /** YYYY-MM-DD for one_off; null for recurring */
      table.date('date').nullable()
      table.string('start_time', 8).notNullable() // e.g. "09:00"
      table.string('end_time', 8).notNullable()   // e.g. "17:00"
      table.integer('sort_order').unsigned().defaultTo(0)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
