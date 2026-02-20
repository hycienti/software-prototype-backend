import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'therapists'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('about').nullable()
      table.string('profile_photo_url', 512).nullable()
      table.integer('rate_cents').nullable()
      table.text('education').nullable()
      table.integer('years_of_experience').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('about')
      table.dropColumn('profile_photo_url')
      table.dropColumn('rate_cents')
      table.dropColumn('education')
      table.dropColumn('years_of_experience')
    })
  }
}
