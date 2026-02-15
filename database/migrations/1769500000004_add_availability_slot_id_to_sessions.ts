import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sessions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('availability_slot_id')
        .unsigned()
        .references('availability_slots.id')
        .onDelete('SET NULL')
        .nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['availability_slot_id'])
      table.dropColumn('availability_slot_id')
    })
  }
}
