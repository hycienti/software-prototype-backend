import type { HttpContext } from '@adonisjs/core/http'
import type Therapist from '#models/therapist'
import type AvailabilitySlot from '#models/availability_slot'
import TherapistService from '#services/therapist_service'
import notificationSendService from '#services/notification_send_service'
import {
  emailValidator,
  verifyOtpValidator,
  therapistOnboardingValidator,
  therapistUpdateProfileValidator,
} from '#validators/auth_validator'
import { SPECIALTIES } from '#enums/specialty'
import { successResponse, errorResponse, ErrorCodes } from '#utils/response_helper'

const therapistService = new TherapistService()

function serializeSlot(slot: AvailabilitySlot) {
  return {
    id: String(slot.id),
    label: slot.label ?? undefined,
    type: slot.type,
    days: slot.days ?? undefined,
    date: slot.date ? slot.date.toISODate()! : undefined,
    startTime: slot.startTime,
    endTime: slot.endTime,
  }
}

function serializeTherapist(t: Therapist, slots?: AvailabilitySlot[]) {
  return {
    id: t.id,
    email: t.email,
    fullName: t.fullName,
    professionalTitle: t.professionalTitle,
    licenseUrl: t.licenseUrl,
    identityUrl: t.identityUrl,
    specialties: t.specialties,
    emailVerified: t.emailVerified,
    acceptingNewClients: t.acceptingNewClients ?? true,
    personalMeetingLink: t.personalMeetingLink ?? null,
    about: t.about ?? null,
    profilePhotoUrl: t.profilePhotoUrl ?? null,
    rateCents: t.rateCents ?? null,
    education: t.education ?? null,
    yearsOfExperience: t.yearsOfExperience ?? null,
    availabilitySlots: (slots ?? []).map(serializeSlot),
    lastLoginAt: t.lastLoginAt?.toISO(),
    createdAt: t.createdAt.toISO(),
  }
}

export default class TherapistsController {
  async sendOtp(ctx: HttpContext) {
    const { email } = await emailValidator.validate(ctx.request.all())
    const result = await therapistService.sendOtp(email)
    if ('rateLimited' in result && result.rateLimited) {
      return ctx.response.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Please wait before requesting another OTP code',
          details: { retryAfter: result.retryAfter },
        },
      })
    }
    const otp = 'otp' in result ? result.otp : null
    if (!otp) throw new Error('Unexpected state after sendOtp')
    try {
      const { ok } = await notificationSendService.send({
        notificationTypeSlug: 'otp_verification',
        channelSlug: 'email',
        productType: 'therapist',
        recipientType: 'therapist',
        recipientId: 0,
        recipientEmail: email,
        variables: {
          title: 'Your Verification Code',
          heading: 'Verification Code',
          body:
            'Please use the following code to verify your email address and continue with your Haven Therapist account:',
          otpCode: otp.code,
          footer:
            "This code will expire in 10 minutes. If you didn't request this code, please ignore this email.",
        },
      })
      if (!ok) throw new Error('Send failed')
    } catch (error) {
      await therapistService.deleteOtp(otp)
      return errorResponse(
        ctx,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to send OTP email. Please try again later.',
        500
      )
    }
    return successResponse(ctx, {
      message: 'OTP sent successfully.',
      expiresIn: 600,
      status: true,
    })
  }

  async verifyOtp(ctx: HttpContext) {
    const { email, code } = await verifyOtpValidator.validate(ctx.request.all())
    const result = await therapistService.verifyOtp(email, code)
    if ('error' in result) {
      if (result.error === 'NO_OTP') {
        return errorResponse(
          ctx,
          ErrorCodes.BAD_REQUEST,
          'No OTP found for this email. Please request a new code.',
          400
        )
      }
      if (result.error === 'EXPIRED') {
        return errorResponse(
          ctx,
          ErrorCodes.BAD_REQUEST,
          'OTP code has expired. Please request a new code.',
          400
        )
      }
      return errorResponse(
        ctx,
        ErrorCodes.BAD_REQUEST,
        'Invalid OTP code. Please try again.',
        400
      )
    }
    if (result.requiresOnboarding) {
      return successResponse(ctx, {
        requiresOnboarding: true,
        email: result.email,
        emailVerified: result.emailVerified,
        message: 'Please complete your onboarding by providing your professional details',
      })
    }
    return successResponse(ctx, {
      therapist: {
        id: result.therapist.id,
        email: result.therapist.email,
        fullName: result.therapist.fullName,
        professionalTitle: result.therapist.professionalTitle,
        emailVerified: result.therapist.emailVerified,
      },
      token: result.token,
      requiresOnboarding: false,
    })
  }

  async onboard(ctx: HttpContext) {
    const payload = await therapistOnboardingValidator.validate(ctx.request.all())
    const result = await therapistService.onboard(payload)
    if ('error' in result) {
      if (result.error === 'ALREADY_ONBOARDED') {
        return errorResponse(
          ctx,
          ErrorCodes.BAD_REQUEST,
          'Therapist already exists. Please sign in instead.',
          400
        )
      }
      return errorResponse(
        ctx,
        ErrorCodes.BAD_REQUEST,
        'Please verify your email with OTP first.',
        400
      )
    }
    return successResponse(ctx, {
      therapist: {
        id: result.therapist.id,
        email: result.therapist.email,
        fullName: result.therapist.fullName,
        professionalTitle: result.therapist.professionalTitle,
        specialties: result.therapist.specialties,
        emailVerified: result.therapist.emailVerified,
      },
      token: result.token,
    })
  }

  async me(ctx: HttpContext) {
    const therapist = ctx.auth.use('therapist').user!
    const { therapist: t, availabilitySlots } = await therapistService.getMeWithSlots(therapist.id)
    return successResponse(ctx, {
      therapist: serializeTherapist(t, availabilitySlots),
    })
  }

  async updateMe(ctx: HttpContext) {
    const therapist = ctx.auth.use('therapist').user!
    const payload = await therapistUpdateProfileValidator.validate(ctx.request.all())
    const updated = await therapistService.updateMe(therapist.id, payload as any)
    const { availabilitySlots } = await therapistService.getMeWithSlots(updated.id)
    return successResponse(ctx, {
      therapist: serializeTherapist(updated, availabilitySlots),
    })
  }

  async specialties(ctx: HttpContext) {
    return successResponse(ctx, SPECIALTIES)
  }
}
