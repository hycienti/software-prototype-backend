import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'gratitudes'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['user_id', 'entry_date'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.unique(['user_id', 'entry_date'])
    })
  }
}
