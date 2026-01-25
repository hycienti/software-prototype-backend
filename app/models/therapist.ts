import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { Specialty } from '#enums/specialty'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'

export default class Therapist extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare email: string

  @column()
  declare fullName: string | null

  @column()
  declare professionalTitle: string | null

  @column()
  declare licenseUrl: string | null

  @column()
  declare identityUrl: string | null

  @column()
  declare specialties: Specialty[] | null

  @column()
  declare emailVerified: boolean

  @column.dateTime()
  declare lastLoginAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  static accessTokens = DbAccessTokensProvider.forModel(Therapist, {
    expiresIn: '30 days',
    prefix: 'oat_',
    table: 'access_tokens',
    type: 'auth_token',
  })
}
