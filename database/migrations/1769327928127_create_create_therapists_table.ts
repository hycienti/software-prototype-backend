import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'therapists'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('email', 254).notNullable().unique()
      table.string('full_name').nullable()
      table.string('professional_title').nullable()
      table.string('license_url').nullable()
      table.string('identity_url').nullable()
      table.json('specialties').nullable()
      table.boolean('email_verified').defaultTo(false)
      table.timestamp('last_login_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
