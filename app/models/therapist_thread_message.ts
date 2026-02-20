import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TherapistThread from '#models/therapist_thread'

export type TherapistThreadMessageSenderType = 'user' | 'therapist'

export default class TherapistThreadMessage extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare threadId: number

  @column()
  declare senderType: TherapistThreadMessageSenderType

  @column()
  declare body: string

  @column()
  declare voiceUrl: string | null

  @column({
    prepare: (value: string[] | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | null) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare attachmentUrls: string[] | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => TherapistThread)
  declare thread: BelongsTo<typeof TherapistThread>
}
