import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { Specialty } from '#enums/specialty'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import AvailabilitySlot from '#models/availability_slot'

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
  declare about: string | null

  @column({ serializeAs: 'profilePhotoUrl' })
  declare profilePhotoUrl: string | null

  @column()
  declare rateCents: number | null

  @column()
  declare education: string | null

  @column()
  declare yearsOfExperience: number | null

  @column()
  declare licenseUrl: string | null

  @column()
  declare identityUrl: string | null

  @column({
    prepare: (value: Specialty[] | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | Specialty[] | null) => {
      if (!value) return null
      return typeof value === 'string' ? JSON.parse(value) : value
    },
  })
  declare specialties: Specialty[] | null

  @column()
  declare emailVerified: boolean

  @column()
  declare acceptingNewClients: boolean

  @column()
  declare personalMeetingLink: string | null

  @column.dateTime()
  declare lastLoginAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => AvailabilitySlot)
  declare availabilitySlots: HasMany<typeof AvailabilitySlot>

  static accessTokens = DbAccessTokensProvider.forModel(Therapist, {
    expiresIn: '30 days',
    prefix: 'oat_',
    table: 'auth_access_tokens',
    type: 'auth_token',
  })
}
