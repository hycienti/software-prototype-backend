import { DateTime } from 'luxon'
import Therapist from '#models/therapist'
import type TherapistModel from '#models/therapist'
import type Otp from '#models/otp'
import TherapistRepository from '#repositories/therapist_repository'
import OtpRepository from '#repositories/otp_repository'
import AvailabilitySlotRepository from '#repositories/availability_slot_repository'

const therapistRepository = new TherapistRepository()
const otpRepository = new OtpRepository()
const availabilitySlotRepository = new AvailabilitySlotRepository()

export default class TherapistService {
  async sendOtp(email: string): Promise<
    | { otp: Otp }
    | { rateLimited: true; retryAfter: number }
  > {
    const recentOtp = await otpRepository.findRecentUnverifiedByEmail(email, 60)
    if (recentOtp) return { rateLimited: true, retryAfter: 60 }
    await otpRepository.markAllUnverifiedByEmail(email)
    const code = await import('node:crypto').then((c) =>
      c.randomInt(100000, 999999).toString()
    )
    const otp = await otpRepository.create({
      email,
      code,
      verified: false,
      expiresAt: DateTime.now().plus({ minutes: 10 }),
    })
    return { otp }
  }

  async deleteOtp(otp: Otp): Promise<void> {
    await otpRepository.delete(otp)
  }

  async verifyOtp(
    email: string,
    code: string
  ): Promise<
    | { therapist: TherapistModel; token: { type: string; value: string; expiresAt: string | undefined }; requiresOnboarding: false }
    | { requiresOnboarding: true; email: string; emailVerified: boolean }
    | { error: 'NO_OTP' | 'EXPIRED' | 'INVALID_CODE' }
  > {
    const otp = await otpRepository.findLatestUnverifiedByEmail(email)
    if (!otp) return { error: 'NO_OTP' }
    if (otp.isExpired()) {
      await otpRepository.markVerified(otp)
      return { error: 'EXPIRED' }
    }
    if (otp.code !== code) return { error: 'INVALID_CODE' }
    await otpRepository.markVerified(otp)

    let therapist = await therapistRepository.findByEmail(email)
    if (!therapist) {
      therapist = await therapistRepository.create({ email, emailVerified: true })
    } else if (!therapist.emailVerified) {
      await therapistRepository.update(therapist, { emailVerified: true })
    }

    if (!therapist.fullName) {
      return {
        requiresOnboarding: true,
        email,
        emailVerified: therapist.emailVerified,
      }
    }

    await therapistRepository.update(therapist, { lastLoginAt: DateTime.now() })
    const token = await Therapist.accessTokens.create(therapist)
    return {
      therapist,
      token: {
        type: 'bearer',
        value: token.value!.release(),
        expiresAt: token.expiresAt != null ? (typeof (token.expiresAt as any).toISO === 'function' ? (token.expiresAt as any).toISO() : (token.expiresAt as Date).toISOString()) : undefined,
      },
      requiresOnboarding: false,
    }
  }

  async onboard(payload: {
    email: string
    fullName: string
    professionalTitle?: string | null
    licenseUrl?: string | null
    identityUrl?: string | null
    specialties?: import('#enums/specialty').Specialty[] | null
  }): Promise<
    | { therapist: TherapistModel; token: { type: string; value: string; expiresAt: string | undefined } }
    | { error: 'ALREADY_ONBOARDED' | 'OTP_NOT_VERIFIED' }
  > {
    const existing = await therapistRepository.findByEmail(payload.email)
    if (existing?.fullName) return { error: 'ALREADY_ONBOARDED' }

    const verifiedOtp = await otpRepository.findLatestVerifiedByEmail(
      payload.email,
      DateTime.now().minus({ minutes: 10 })
    )
    if (!verifiedOtp) return { error: 'OTP_NOT_VERIFIED' }

    let therapist = existing
    if (!therapist) {
      therapist = await therapistRepository.create({ email: payload.email })
    }
    await therapistRepository.update(therapist, {
      fullName: payload.fullName,
      professionalTitle: payload.professionalTitle ?? null,
      licenseUrl: payload.licenseUrl ?? null,
      identityUrl: payload.identityUrl ?? null,
      specialties: payload.specialties ?? null,
      emailVerified: true,
      lastLoginAt: DateTime.now(),
    } as any)

    const token = await Therapist.accessTokens.create(therapist)
    return {
      therapist,
      token: {
        type: 'bearer',
        value: token.value!.release(),
        expiresAt: token.expiresAt != null ? (typeof (token.expiresAt as any).toISO === 'function' ? (token.expiresAt as any).toISO() : (token.expiresAt as Date).toISOString()) : undefined,
      },
    }
  }

  async getMeWithSlots(therapistId: number): Promise<{
    therapist: TherapistModel
    availabilitySlots: Awaited<ReturnType<AvailabilitySlotRepository['listByTherapistId']>>
  }> {
    const therapist = await therapistRepository.findById(therapistId)
    if (!therapist) throw new Error('Therapist not found')
    const availabilitySlots = await availabilitySlotRepository.listByTherapistId(therapistId)
    return { therapist, availabilitySlots }
  }

  async updateMe(therapistId: number, payload: Partial<TherapistModel>): Promise<TherapistModel> {
    const therapist = await therapistRepository.findById(therapistId)
    if (!therapist) throw new Error('Therapist not found')
    return therapistRepository.update(therapist, payload)
  }

  async replaceAvailabilitySlots(
    therapistId: number,
    slots: Array<{
      type: 'recurring' | 'one_off'
      label?: string | null
      days?: number[] | null
      date?: string | null
      startTime: string
      endTime: string
    }>
  ): Promise<void> {
    await availabilitySlotRepository.deleteAllByTherapistId(therapistId)
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]
      const type = s.type ?? (s.date ? 'one_off' : 'recurring')
      await availabilitySlotRepository.create({
        therapistId,
        type,
        label: s.label ?? null,
        days: type === 'recurring' && s.days ? s.days : null,
        date: type === 'one_off' && s.date ? DateTime.fromISO(s.date) : null,
        startTime: s.startTime,
        endTime: s.endTime,
        sortOrder: i,
      })
    }
  }
}
