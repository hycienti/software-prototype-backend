import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasOne } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasOne } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Therapist from '#models/therapist'
import AvailabilitySlot from '#models/availability_slot'
import TherapistThread from '#models/therapist_thread'
import { SessionStatus, SessionSentiment } from '#enums/session'

export default class Session extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({
    consume: (value: number | null | undefined) => value ?? null,
  })
  declare userId: number | null

  @column()
  declare therapistId: number

  @column({
    consume: (value: number | null | undefined) => value ?? null,
  })
  declare availabilitySlotId: number | null

  @column.dateTime()
  declare scheduledAt: DateTime

  @column()
  declare durationMinutes: number

  @column()
  declare status: SessionStatus

  @column()
  declare meetingId: string | null

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

  @column({
    prepare: (value: string[] | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | null) => (value ? (typeof value === 'string' ? JSON.parse(value) : value) : null),
  })
  declare userSummaryMainTopics: string[] | null

  @column({
    prepare: (value: string[] | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | null) => (value ? (typeof value === 'string' ? JSON.parse(value) : value) : null),
  })
  declare userSummaryActionItems: string[] | null

  @column()
  declare userSummaryKeyReflection: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Therapist)
  declare therapist: BelongsTo<typeof Therapist>

  @belongsTo(() => AvailabilitySlot)
  declare availabilitySlot: BelongsTo<typeof AvailabilitySlot>

  @hasOne(() => TherapistThread)
  declare therapistThread: HasOne<typeof TherapistThread>
}
