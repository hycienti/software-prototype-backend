import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.js'

export default class Achievement extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare type: string // e.g., 'gratitude_streak_7', 'gratitude_count_10', etc.

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column()
  declare icon: string | null

  @column()
  declare iconColor: string | null

  @column()
  declare iconBgColor: string | null

  @column()
  declare threshold: number | null

  @column()
  declare progress: number

  @column()
  declare isCompleted: boolean

  @column.dateTime()
  declare completedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
