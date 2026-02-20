import type { HttpContext } from '@adonisjs/core/http'
import type AvailabilitySlot from '#models/availability_slot'
import TherapistService from '#services/therapist_service'
import logger from '@adonisjs/core/services/logger'
import { updateAvailabilityValidator } from '#validators/availability_validator'
import { successResponse } from '#utils/response_helper'

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

export default class TherapistAvailabilityController {
  async show(ctx: HttpContext) {
    const therapist = ctx.auth.use('therapist').user!
    const { therapist: t, availabilitySlots } = await therapistService.getMeWithSlots(therapist.id)
    return successResponse(ctx, {
      acceptingNewClients: t.acceptingNewClients ?? true,
      personalMeetingLink: t.personalMeetingLink ?? null,
      availabilitySlots: availabilitySlots.map(serializeSlot),
    })
  }

  async update(ctx: HttpContext) {
    const therapist = ctx.auth.use('therapist').user!
    const payload = await updateAvailabilityValidator.validate(ctx.request.all())

    if (payload.acceptingNewClients !== undefined || payload.personalMeetingLink !== undefined) {
      await therapistService.updateMe(therapist.id, {
        acceptingNewClients: payload.acceptingNewClients,
        personalMeetingLink: payload.personalMeetingLink ?? null,
      } as any)
    }

    if (payload.availabilitySlots !== undefined) {
      const slots = payload.availabilitySlots.map((s) => ({
        type: (s.type ?? (s.date ? 'one_off' : 'recurring')) as 'recurring' | 'one_off',
        label: s.label,
        days: s.days,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
      }))
      await therapistService.replaceAvailabilitySlots(therapist.id, slots)
    }

    const { therapist: t, availabilitySlots } = await therapistService.getMeWithSlots(therapist.id)
    logger.info({ therapistId: therapist.id }, 'Therapist availability updated')
    return successResponse(ctx, {
      acceptingNewClients: t.acceptingNewClients,
      personalMeetingLink: t.personalMeetingLink,
      availabilitySlots: availabilitySlots.map(serializeSlot),
    })
  }
}
