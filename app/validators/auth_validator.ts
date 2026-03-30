import vine from '@vinejs/vine'
import type { NormalizeEmailOptions } from 'validator/lib/normalizeEmail.js'
import { Specialty } from '#enums/specialty'

/**
 * Default `normalizeEmail()` strips +labels for Gmail / Outlook / iCloud / Yahoo,
 * so `user+tag@gmail.com` becomes `user@gmail.com` and collides with the base inbox.
 * We keep subaddresses so each alias can be a distinct account.
 */
const emailNormalizeOptions: NormalizeEmailOptions = {
  gmail_remove_subaddress: false,
  outlookdotcom_remove_subaddress: false,
  icloud_remove_subaddress: false,
  yahoo_remove_subaddress: false,
}

/**
 * Validator for email submission (initiate OTP flow)
 */
export const emailValidator = vine.compile(
  vine.object({
    email: vine
      .string()
      .trim()
      .email()
      .normalizeEmail(emailNormalizeOptions)
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
      .normalizeEmail(emailNormalizeOptions)
      .minLength(3)
      .maxLength(254),
    code: vine
      .string()
      .trim()
      .minLength(6)
      .maxLength(6)
      .regex(/^\d{6}$/),
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
      .normalizeEmail(emailNormalizeOptions)
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

/**
 * Validator for therapist onboarding
 */
export const therapistOnboardingValidator = vine.compile(
  vine.object({
    email: vine
      .string()
      .trim()
      .email()
      .normalizeEmail(emailNormalizeOptions)
      .minLength(3)
      .maxLength(254),
    fullName: vine.string().trim().minLength(1).maxLength(255),
    professionalTitle: vine.string().trim().minLength(1).maxLength(255),
    licenseUrl: vine.string().trim().url().optional(),
    identityUrl: vine.string().trim().url().optional(),
    specialties: vine.array(vine.enum(Specialty)).minLength(1),
  })
)

export const therapistUpdateProfileValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(1).maxLength(255).optional(),
    professionalTitle: vine.string().trim().maxLength(255).optional(),
    licenseUrl: vine.string().trim().url().optional().nullable(),
    identityUrl: vine.string().trim().url().optional().nullable(),
    about: vine.string().trim().maxLength(10000).optional().nullable(),
    profilePhotoUrl: vine.string().trim().url().optional().nullable(),
    rateCents: vine.number().min(0).optional().nullable(),
    education: vine.string().trim().maxLength(5000).optional().nullable(),
    yearsOfExperience: vine.number().min(0).optional().nullable(),
  })
)
