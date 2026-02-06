import type { HttpContext } from '@adonisjs/core/http'
import Therapist from '#models/therapist'
import Otp from '#models/otp'
import EmailService from '#services/email_service'
import {
  emailValidator,
  verifyOtpValidator,
  therapistOnboardingValidator,
  therapistUpdateProfileValidator,
} from '#validators/auth_validator'
import { DateTime } from 'luxon'
import { Specialty, SPECIALTIES } from '#enums/specialty'
import crypto from 'node:crypto'

export default class TherapistsController {
  private emailService = new EmailService()

  /**
   * @sendOtp
   * @summary Send OTP to therapist email
   * @tag Therapist Auth
   * @description Sends a 6-digit OTP code to the provided therapist email address.
   * @requestBody {"email": "therapist@example.com"}
   * @responseBody 200 - {"message": "OTP sent successfully", "expiresIn": 600}
   * @responseBody 422 - {"errors": [{"message": "Invalid email", "field": "email"}]}
   * @responseBody 429 - {"message": "Please wait before requesting another OTP code", "retryAfter": 60}
   */
  async sendOtp({ request, response }: HttpContext) {
    const { email } = await emailValidator.validate(request.all())

    const recentOtp = await Otp.query()
      .where('email', email)
      .where('created_at', '>', DateTime.now().minus({ seconds: 60 }).toSQL()!)
      .where('verified', false)
      .first()

    if (recentOtp) {
      return response.tooManyRequests({
        message: 'Please wait before requesting another OTP code',
        retryAfter: 60,
      })
    }

    await Otp.query().where('email', email).where('verified', false).update({ verified: true })

    const code = crypto.randomInt(100000, 999999).toString()

    const otp = await Otp.create({
      email,
      code,
      verified: false,
      expiresAt: DateTime.now().plus({ minutes: 10 }),
    })

    try {
      await this.emailService.sendOTP(email, code)
    } catch (error: any) {
      console.error('Failed to send OTP email:', error)
      await otp.delete()
      return response.internalServerError({
        message: 'Failed to send OTP email. Please try again later.',
      })
    }

    return response.ok({
      message: 'OTP sent successfully.',
      expiresIn: 600,
      status: true,
      otp: code,
    })
  }

  /**
   * @verifyOtp
   * @summary Verify therapist OTP code
   * @tag Therapist Auth
   * @description Verifies the OTP code and returns therapist info or indicates if onboarding is needed.
   * @requestBody {"email": "therapist@example.com", "code": "123456"}
   * @responseBody 200 - {"therapist": {"id": 1, "email": "therapist@example.com", "fullName": "Dr. Sarah Mitchell", "emailVerified": true}, "token": {"type": "bearer", "value": "..."}, "requiresOnboarding": false}
   * @responseBody 400 - {"message": "Invalid OTP code. Please try again."}
   */
  async verifyOtp({ request, response }: HttpContext) {
    const { email, code } = await verifyOtpValidator.validate(request.all())

    const otp = await Otp.query()
      .where('email', email)
      .where('verified', false)
      .orderBy('created_at', 'desc')
      .first()

    if (!otp) {
      return response.badRequest({
        message: 'No OTP found for this email. Please request a new code.',
      })
    }

    if (otp.isExpired()) {
      await otp.merge({ verified: true }).save()
      return response.badRequest({
        message: 'OTP code has expired. Please request a new code.',
      })
    }

    if (otp.code !== code) {
      return response.badRequest({
        message: 'Invalid OTP code. Please try again.',
      })
    }

    await otp.merge({ verified: true }).save()

    let therapist = await Therapist.findBy('email', email)

    if (!therapist) {
      therapist = new Therapist()
      therapist.email = email
      therapist.emailVerified = true
      await therapist.save()
    } else if (!therapist.emailVerified) {
      therapist.emailVerified = true
      await therapist.save()
    }

    if (!therapist.fullName) {
      return response.ok({
        requiresOnboarding: true,
        email,
        emailVerified: therapist.emailVerified,
        message: 'Please complete your onboarding by providing your professional details',
      })
    }

    await therapist
      .merge({
        lastLoginAt: DateTime.now(),
      })
      .save()

    const token = await Therapist.accessTokens.create(therapist)

    return response.ok({
      therapist: {
        id: therapist.id,
        email: therapist.email,
        fullName: therapist.fullName,
        professionalTitle: therapist.professionalTitle,
        emailVerified: therapist.emailVerified,
      },
      token: {
        type: 'bearer',
        value: token.value!.release(),
        expiresAt: token.expiresAt?.toISOString(),
      },
      requiresOnboarding: false,
    })
  }

  /**
   * @onboard
   * @summary Complete therapist onboarding
   * @tag Therapist Auth
   * @description Completes the onboarding process for new therapists by saving their professional details.
   * @requestBody {"email": "therapist@example.com", "fullName": "Dr. Sarah Mitchell", "professionalTitle": "Psychologist, LCSW", "specialties": ["Anxiety", "Depression"]}
   * @responseBody 200 - {"therapist": {...}, "token": {...}}
   * @responseBody 400 - {"message": "Therapist already exists or OTP not verified"}
   */
  async onboard({ request, response }: HttpContext) {
    const payload = await therapistOnboardingValidator.validate(request.all())

    const existingTherapist = await Therapist.findBy('email', payload.email)
    if (existingTherapist && existingTherapist.fullName) {
      return response.badRequest({
        message: 'Therapist already exists. Please sign in instead.',
      })
    }

    const verifiedOtp = await Otp.query()
      .where('email', payload.email)
      .where('verified', true)
      .where('expires_at', '>', DateTime.now().minus({ minutes: 10 }).toSQL()!)
      .orderBy('created_at', 'desc')
      .first()

    if (!verifiedOtp) {
      return response.badRequest({
        message: 'Please verify your email with OTP first.',
      })
    }

    let therapist = existingTherapist
    if (!therapist) {
      therapist = new Therapist()
      therapist.email = payload.email
    }

    therapist.merge({
      fullName: payload.fullName,
      professionalTitle: payload.professionalTitle,
      licenseUrl: payload.licenseUrl || null,
      identityUrl: payload.identityUrl || null,
      specialties: payload.specialties as Specialty[],
      emailVerified: true,
      lastLoginAt: DateTime.now(),
    })

    await therapist.save()

    const token = await Therapist.accessTokens.create(therapist)

    return response.ok({
      therapist: {
        id: therapist.id,
        email: therapist.email,
        fullName: therapist.fullName,
        professionalTitle: therapist.professionalTitle,
        specialties: therapist.specialties,
        emailVerified: therapist.emailVerified,
      },
      token: {
        type: 'bearer',
        value: token.value!.release(),
        expiresAt: token.expiresAt?.toISOString(),
      },
    })
  }

  /**
   * @me
   * @summary Get current therapist profile
   * @tag Therapist Auth
   * @description Returns the authenticated therapist's profile information
   * @responseBody 200 - {"therapist": {...}}
   */
  async me({ auth, response }: HttpContext) {
    const therapist = auth.use('therapist').user!
    await therapist.refresh()

    return response.ok({
      therapist: {
        id: therapist.id,
        email: therapist.email,
        fullName: therapist.fullName,
        professionalTitle: therapist.professionalTitle,
        licenseUrl: therapist.licenseUrl,
        identityUrl: therapist.identityUrl,
        specialties: therapist.specialties,
        emailVerified: therapist.emailVerified,
        acceptingNewClients: therapist.acceptingNewClients ?? true,
        personalMeetingLink: therapist.personalMeetingLink ?? null,
        availabilitySlots: therapist.availabilitySlots ?? [],
        lastLoginAt: therapist.lastLoginAt?.toISO(),
        createdAt: therapist.createdAt.toISO(),
      },
    })
  }

  /**
   * @updateMe
   * @summary Update current therapist profile
   * @tag Therapist Auth
   */
  async updateMe({ auth, request, response }: HttpContext) {
    const therapist = auth.use('therapist').user!
    const payload = await therapistUpdateProfileValidator.validate(request.all())

    therapist.merge(payload)
    await therapist.save()

    return response.ok({
      therapist: {
        id: therapist.id,
        email: therapist.email,
        fullName: therapist.fullName,
        professionalTitle: therapist.professionalTitle,
        licenseUrl: therapist.licenseUrl,
        identityUrl: therapist.identityUrl,
        specialties: therapist.specialties,
        emailVerified: therapist.emailVerified,
        acceptingNewClients: therapist.acceptingNewClients ?? true,
        personalMeetingLink: therapist.personalMeetingLink ?? null,
        availabilitySlots: therapist.availabilitySlots ?? [],
        lastLoginAt: therapist.lastLoginAt?.toISO(),
        createdAt: therapist.createdAt.toISO(),
      },
    })
  }

  /**
   * @specialties
   * @summary List all available specialties
   * @tag Therapist Auth
   * @description Returns a list of all professional specialties available for therapists
   * @responseBody 200 - ["Anxiety", "Depression", ...]
   */
  async specialties({ response }: HttpContext) {
    return response.ok(SPECIALTIES)
  }
}
