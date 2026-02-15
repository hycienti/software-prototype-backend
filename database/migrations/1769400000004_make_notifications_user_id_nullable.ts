import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'

export default class extends BaseSchema {
  protected tableName = 'notifications'

  async up() {
    // Only change nullability; FK already exists from create_notifications_table
    await db.rawQuery('ALTER TABLE "notifications" ALTER COLUMN "user_id" DROP NOT NULL')
  }

  async down() {
    await db.rawQuery('ALTER TABLE "notifications" ALTER COLUMN "user_id" SET NOT NULL')
  }
}
