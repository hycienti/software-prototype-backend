import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import NotificationType from '#models/notification_type'
import Notification from '#models/notification'

export default class NotificationCategory extends BaseModel {
  static table = 'notification_categories'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => NotificationType)
  declare types: HasMany<typeof NotificationType>

  @hasMany(() => Notification)
  declare notifications: HasMany<typeof Notification>
}
