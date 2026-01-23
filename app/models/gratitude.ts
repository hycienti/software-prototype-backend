import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.js'

export default class Gratitude extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column({
    prepare: (value: string[]) => JSON.stringify(value),
    serialize: (value: string | string[]) => {
      if (typeof value === 'string') {
        return JSON.parse(value)
      }
      return value
    },
  })
  declare entries: string[] // Array of gratitude entries

  @column()
  declare photoUrl: string | null

  @column.date()
  declare entryDate: DateTime

  @column({
    prepare: (value: Record<string, any> | null) => {
      return value ? JSON.stringify(value) : null
    },
    serialize: (value: string | Record<string, any> | null) => {
      if (value === null) return null
      if (typeof value === 'string') {
        return JSON.parse(value)
      }
      return value
    },
  })
  declare metadata: Record<string, any> | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
