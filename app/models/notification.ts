import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import User from '#models/user'
import Therapist from '#models/therapist'
import NotificationType from '#models/notification_type'
import NotificationCategory from '#models/notification_category'
import NotificationDelivery from '#models/notification_delivery'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Notification extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number | null

  @column()
  declare therapistId: number | null

  @column()
  declare notificationTypeId: number | null

  @column()
  declare categoryId: number | null

  @column()
  declare deliveryId: number | null

  @column()
  declare title: string

  @column()
  declare message: string

  @column()
  declare type: string

  @column()
  declare isRead: boolean

  @column()
  declare data: any

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Therapist)
  declare therapist: BelongsTo<typeof Therapist>

  @belongsTo(() => NotificationType)
  declare notificationType: BelongsTo<typeof NotificationType>

  @belongsTo(() => NotificationCategory)
  declare category: BelongsTo<typeof NotificationCategory>

  @belongsTo(() => NotificationDelivery)
  declare delivery: BelongsTo<typeof NotificationDelivery>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
