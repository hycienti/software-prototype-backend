import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Therapist from '#models/therapist'
import Session from '#models/session'
import TherapistThreadMessage from '#models/therapist_thread_message'

export default class TherapistThread extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare therapistId: number

  @column({
    consume: (value: number | null | undefined) => value ?? null,
  })
  declare sessionId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Therapist)
  declare therapist: BelongsTo<typeof Therapist>

  @belongsTo(() => Session)
  declare session: BelongsTo<typeof Session>

  @hasMany(() => TherapistThreadMessage)
  declare messages: HasMany<typeof TherapistThreadMessage>
}
