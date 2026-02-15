import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import NotificationCategory from '#models/notification_category'
import NotificationTemplate from '#models/notification_template'
import NotificationDelivery from '#models/notification_delivery'
import Notification from '#models/notification'

export default class NotificationType extends BaseModel {
  static table = 'notification_types'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare categoryId: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare description: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => NotificationCategory)
  declare category: BelongsTo<typeof NotificationCategory>

  @hasMany(() => NotificationTemplate)
  declare templates: HasMany<typeof NotificationTemplate>

  @hasMany(() => NotificationDelivery)
  declare deliveries: HasMany<typeof NotificationDelivery>

  @hasMany(() => Notification)
  declare notifications: HasMany<typeof Notification>
}
