import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Therapist from '#models/therapist'
import Session from '#models/session'

export type AvailabilitySlotType = 'recurring' | 'one_off'

export default class AvailabilitySlot extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare therapistId: number

  @column()
  declare type: AvailabilitySlotType

  @column()
  declare label: string | null

  /** 0-6 (Sunday-Saturday) for recurring; JSON array stored as string */
  @column({
    prepare: (value: number[] | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | number[] | null) => {
      if (!value) return null
      return typeof value === 'string' ? JSON.parse(value) : value
    },
  })
  declare days: number[] | null

  /** YYYY-MM-DD for one_off */
  @column.date()
  declare date: DateTime | null

  @column()
  declare startTime: string

  @column()
  declare endTime: string

  @column()
  declare sortOrder: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Therapist)
  declare therapist: BelongsTo<typeof Therapist>

  @hasMany(() => Session)
  declare sessions: HasMany<typeof Session>
}
