import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'otps'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('email', 254).notNullable().index()
      table.string('code', 6).notNullable()
      table.boolean('verified').defaultTo(false)
      table.timestamp('expires_at').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['email', 'verified'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
