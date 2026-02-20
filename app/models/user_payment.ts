import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Session from '#models/session'
import Therapist from '#models/therapist'

export default class UserPayment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare amountCents: number

  @column()
  declare currency: string

  @column()
  declare status: 'pending' | 'completed' | 'failed' | 'refunded'

  @column()
  declare sessionId: number | null

  @column()
  declare therapistId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Session)
  declare session: BelongsTo<typeof Session>

  @belongsTo(() => Therapist)
  declare therapist: BelongsTo<typeof Therapist>
}
