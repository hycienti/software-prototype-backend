import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Session from '#models/session'
import { FeedbackSentimentAfter } from '#enums/session'

export default class SessionFeedback extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare sessionId: number

  @column()
  declare rating: number

  @column()
  declare sentimentAfter: FeedbackSentimentAfter

  @column()
  declare comment: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Session)
  declare session: BelongsTo<typeof Session>
}
