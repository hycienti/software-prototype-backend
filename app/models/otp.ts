import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Otp extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare email: string

  @column()
  declare code: string

  @column()
  declare verified: boolean

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  /**
   * Check if OTP is expired
   */
  isExpired(): boolean {
    return DateTime.now() > this.expiresAt
  }

  /**
   * Check if OTP is valid (not expired and not verified)
   */
  isValid(): boolean {
    return !this.verified && !this.isExpired()
  }
}
