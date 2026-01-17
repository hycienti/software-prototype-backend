import vine from '@vinejs/vine'

export const googleAuthValidator = vine.compile(
  vine.object({
    idToken: vine.string().trim(),
    fullName: vine.string().trim().optional(),
  })
)

export const appleAuthValidator = vine.compile(
  vine.object({
    idToken: vine.string().trim(),
    fullName: vine.string().trim().optional(),
    authorizationCode: vine.string().trim().optional(),
  })
)

export const refreshTokenValidator = vine.compile(
  vine.object({
    refreshToken: vine.string().trim(),
  })
)
