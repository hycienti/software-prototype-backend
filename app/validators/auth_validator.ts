import vine from '@vinejs/vine'

/**
 * Validator for email submission (initiate OTP flow)
 */
export const emailValidator = vine.compile(
  vine.object({
    email: vine
      .string()
      .trim()
      .email()
      .normalizeEmail()
      .minLength(3)
      .maxLength(254),
  })
)

/**
 * Validator for OTP verification
 */
export const verifyOtpValidator = vine.compile(
  vine.object({
    email: vine
      .string()
      .trim()
      .email()
      .normalizeEmail()
      .minLength(3)
      .maxLength(254),
    code: vine.string().trim().minLength(6).maxLength(6).regex(/^\d{6}$/),
  })
)

/**
 * Validator for completing signup (fullname for first-time users)
 */
export const completeSignupValidator = vine.compile(
  vine.object({
    email: vine
      .string()
      .trim()
      .email()
      .normalizeEmail()
      .minLength(3)
      .maxLength(254),
    fullName: vine.string().trim().minLength(1).maxLength(255),
  })
)

/**
 * Validator for refresh token
 */
export const refreshTokenValidator = vine.compile(
  vine.object({
    refreshToken: vine.string().trim(),
  })
)

/**
 * Validator for updating user profile
 */
export const updateProfileValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(1).maxLength(255).optional(),
    avatarUrl: vine.string().trim().url().optional(),
  })
)
