import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Therapist from '#models/therapist'
import Session from '#models/session'

export default class TherapistTransaction extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare therapistId: number

  @column()
  declare amountCents: number

  @column()
  declare type: string

  @column()
  declare description: string | null

  @column()
  declare sessionId: number | null

  @column()
  declare withdrawalId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => Therapist)
  declare therapist: BelongsTo<typeof Therapist>

  @belongsTo(() => Session, { foreignKey: 'sessionId' })
  declare session: BelongsTo<typeof Session>
}
