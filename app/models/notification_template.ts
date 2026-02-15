import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import NotificationType from '#models/notification_type'
import NotificationChannel from '#models/notification_channel'

export default class NotificationTemplate extends BaseModel {
  static table = 'notification_templates'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare notificationTypeId: number

  @column()
  declare channelId: number

  @column()
  declare productType: string // 'user' | 'therapist'

  @column()
  declare locale: string

  @column()
  declare subject: string | null

  @column()
  declare bodyHtml: string

  @column()
  declare bodyText: string | null

  @column({
    prepare: (value: string[] | null) => (value == null ? null : JSON.stringify(value)),
    consume: (value: string | null) =>
      value == null ? [] : typeof value === 'string' ? JSON.parse(value) : value,
  })
  declare templateVariables: string[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => NotificationType)
  declare notificationType: BelongsTo<typeof NotificationType>

  @belongsTo(() => NotificationChannel)
  declare channel: BelongsTo<typeof NotificationChannel>
}
