import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sessions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('user_summary_main_topics').nullable()
      table.jsonb('user_summary_action_items').nullable()
      table.text('user_summary_key_reflection').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('user_summary_main_topics')
      table.dropColumn('user_summary_action_items')
      table.dropColumn('user_summary_key_reflection')
    })
  }
}
