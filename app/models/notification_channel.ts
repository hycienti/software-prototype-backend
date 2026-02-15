import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import NotificationTemplate from '#models/notification_template'
import NotificationDelivery from '#models/notification_delivery'

export default class NotificationChannel extends BaseModel {
  static table = 'notification_channels'

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

  @hasMany(() => NotificationTemplate)
  declare templates: HasMany<typeof NotificationTemplate>

  @hasMany(() => NotificationDelivery)
  declare deliveries: HasMany<typeof NotificationDelivery>
}
