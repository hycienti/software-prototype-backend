import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import type Therapist from '#models/therapist'
import TherapistRepository from '#repositories/therapist_repository'
import { getBookableSlots } from '#services/availability_service'
import { successResponse, errorResponse, ErrorCodes } from '#utils/response_helper'

const therapistRepository = new TherapistRepository()

/** Safe fields for user-facing therapist list/detail (no licenseUrl, identityUrl, email) */
function serializeTherapistForUser(t: Therapist) {
  return {
    id: t.id,
    fullName: t.fullName,
    professionalTitle: t.professionalTitle,
    specialties: t.specialties ?? [],
    acceptingNewClients: t.acceptingNewClients ?? true,
    about: t.about ?? null,
    profilePhotoUrl: t.profilePhotoUrl ?? null,
    rateCents: t.rateCents ?? null,
    education: t.education ?? null,
    yearsOfExperience: t.yearsOfExperience ?? null,
  }
}

export default class UserTherapistsController {
  /**
   * GET /api/v1/therapists — list therapists (user auth), paginated, optional search
   */
  async index(ctx: HttpContext) {
    const page = Number(ctx.request.input('page', 1))
    const limit = Math.min(Number(ctx.request.input('limit', 20)), 50)
    const search = ctx.request.input('search') as string | undefined
    const { data, total } = await therapistRepository.list({ page, limit, search })
    return successResponse(ctx, {
      therapists: data.map(serializeTherapistForUser),
      meta: { page, limit, total },
    })
  }

  /**
   * GET /api/v1/therapists/:id/bookable-slots — available (date, time) slots for booking.
   * Query: from=YYYY-MM-DD, to=YYYY-MM-DD (default: next 14 days). Times in UTC.
   */
  async bookableSlots(ctx: HttpContext) {
    const id = Number(ctx.params.id)
    if (Number.isNaN(id)) {
      return errorResponse(ctx, ErrorCodes.BAD_REQUEST, 'Invalid therapist id', 400)
    }
    const therapist = await therapistRepository.findById(id)
    if (!therapist) {
      return errorResponse(ctx, ErrorCodes.NOT_FOUND, 'Therapist not found', 404)
    }
    const now = DateTime.utc()
    const defaultFrom = now.startOf('day').toISODate()!
    const defaultTo = now.plus({ days: 13 }).endOf('day').toISODate()!.slice(0, 10)
    const from = (ctx.request.input('from') as string) || defaultFrom
    const to = (ctx.request.input('to') as string) || defaultTo
    const dates = await getBookableSlots(id, from, to, 50)
    return successResponse(ctx, { dates })
  }

  /**
   * GET /api/v1/therapists/:id — single therapist (user auth), safe fields only
   */
  async show(ctx: HttpContext) {
    const id = Number(ctx.params.id)
    if (Number.isNaN(id)) {
      return errorResponse(ctx, ErrorCodes.BAD_REQUEST, 'Invalid therapist id', 400)
    }
    const therapist = await therapistRepository.findById(id)
    if (!therapist) {
      return errorResponse(ctx, ErrorCodes.NOT_FOUND, 'Therapist not found', 404)
    }
    return successResponse(ctx, { therapist: serializeTherapistForUser(therapist) })
  }
}
