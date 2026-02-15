import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasOne } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasOne } from '@adonisjs/lucid/types/relations'
import NotificationChannel from '#models/notification_channel'
import NotificationType from '#models/notification_type'
import NotificationTemplate from '#models/notification_template'
import Notification from '#models/notification'

export type DeliveryStatus = 'pending' | 'sent' | 'failed'

export default class NotificationDelivery extends BaseModel {
  static table = 'notification_deliveries'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare recipientType: string // 'user' | 'therapist'

  @column()
  declare recipientId: number

  @column()
  declare channelId: number

  @column()
  declare notificationTypeId: number

  @column()
  declare templateId: number | null

  @column()
  declare status: DeliveryStatus

  @column()
  declare retryCount: number

  @column()
  declare maxRetries: number

  @column()
  declare lastError: string | null

  @column()
  declare metadata: Record<string, unknown> | null

  @column.dateTime()
  declare sentAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => NotificationChannel)
  declare channel: BelongsTo<typeof NotificationChannel>

  @belongsTo(() => NotificationType)
  declare notificationType: BelongsTo<typeof NotificationType>

  @belongsTo(() => NotificationTemplate)
  declare template: BelongsTo<typeof NotificationTemplate>

  @hasOne(() => Notification)
  declare notification: HasOne<typeof Notification>
}
