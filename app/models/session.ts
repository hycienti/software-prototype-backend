import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Therapist from '#models/therapist'
import { SessionStatus, SessionSentiment } from '#enums/session'

export default class Session extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare therapistId: number

  @column.dateTime()
  declare scheduledAt: DateTime

  @column()
  declare durationMinutes: number

  @column()
  declare status: SessionStatus

  @column()
  declare sentiment: SessionSentiment | null

  @column()
  declare engagementLevel: number | null

  @column()
  declare clinicalNotes: string | null

  @column.dateTime()
  declare followUpAt: DateTime | null

  @column.dateTime()
  declare summaryCompletedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Therapist)
  declare therapist: BelongsTo<typeof Therapist>
}
