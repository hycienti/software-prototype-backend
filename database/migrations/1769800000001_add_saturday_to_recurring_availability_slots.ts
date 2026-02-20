import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'

export default class extends BaseSchema {
  protected tableName = 'availability_slots'

  async up() {
    await db.rawQuery(`
      UPDATE availability_slots
      SET days = '[1,2,3,4,5,6]'::jsonb
      WHERE type = 'recurring'
        AND (days::text = '[1,2,3,4,5]' OR days::text = '[1, 2, 3, 4, 5]')
    `)
  }

  async down() {
    await db.rawQuery(`
      UPDATE availability_slots
      SET days = '[1,2,3,4,5]'::jsonb
      WHERE type = 'recurring'
        AND days::text IN ('[1,2,3,4,5,6]', '[1, 2, 3, 4, 5, 6]')
    `)
  }
}
