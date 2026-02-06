import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'therapists'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('accepting_new_clients').defaultTo(true)
      table.string('personal_meeting_link', 512).nullable()
      table.jsonb('availability_slots').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('accepting_new_clients')
      table.dropColumn('personal_meeting_link')
      table.dropColumn('availability_slots')
    })
  }
}
