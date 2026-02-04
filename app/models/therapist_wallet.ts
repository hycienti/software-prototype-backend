import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Therapist from '#models/therapist'

export default class TherapistWallet extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare therapistId: number

  @column()
  declare balanceCents: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Therapist)
  declare therapist: BelongsTo<typeof Therapist>
}
