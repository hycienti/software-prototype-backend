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

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => TherapistThread)
  declare thread: BelongsTo<typeof TherapistThread>
}
