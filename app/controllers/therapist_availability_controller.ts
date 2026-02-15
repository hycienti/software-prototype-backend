import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import AvailabilitySlot from '#models/availability_slot'
import logger from '@adonisjs/core/services/logger'
import { updateAvailabilityValidator } from '#validators/availability_validator'

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

/**
 * GET/PUT therapist availability and meeting link.
 * Slots are stored in availability_slots table.
 */
export default class TherapistAvailabilityController {
  /**
   * @responseBody 200 - {"acceptingNewClients": true, "personalMeetingLink": "https://zoom.us/j/123", "availabilitySlots": []}
   */
  async show({ auth, response }: HttpContext) {
    const therapist = auth.use('therapist').user!
    await therapist.load('availabilitySlots', (q) => q.orderBy('sort_order'))
    return response.ok({
      acceptingNewClients: therapist.acceptingNewClients ?? true,
      personalMeetingLink: therapist.personalMeetingLink ?? null,
      availabilitySlots: (therapist.availabilitySlots ?? []).map(serializeSlot),
    })
  }

  /**
   * @responseBody 200 - {"acceptingNewClients": true, "personalMeetingLink": "https://zoom.us/j/123", "availabilitySlots": []}
   */
  async update({ auth, request, response }: HttpContext) {
    const therapist = auth.use('therapist').user!
    const payload = await updateAvailabilityValidator.validate(request.all())

    if (payload.acceptingNewClients !== undefined) {
      therapist.acceptingNewClients = payload.acceptingNewClients
    }
    if (payload.personalMeetingLink !== undefined) {
      therapist.personalMeetingLink = payload.personalMeetingLink || null
    }
    await therapist.save()

    if (payload.availabilitySlots !== undefined) {
      await AvailabilitySlot.query().where('therapist_id', therapist.id).delete()
      for (let i = 0; i < payload.availabilitySlots.length; i++) {
        const s = payload.availabilitySlots[i]
        const type = s.type ?? (s.date ? 'one_off' : 'recurring')
        await AvailabilitySlot.create({
          therapistId: therapist.id,
          type,
          label: s.label || null,
          days: type === 'recurring' && s.days ? s.days : null,
          date: type === 'one_off' && s.date ? DateTime.fromISO(s.date) : null,
          startTime: s.startTime,
          endTime: s.endTime,
          sortOrder: i,
        })
      }
    }

    await therapist.load('availabilitySlots', (q) => q.orderBy('sort_order'))
    logger.info({ therapistId: therapist.id }, 'Therapist availability updated')

    return response.ok({
      acceptingNewClients: therapist.acceptingNewClients,
      personalMeetingLink: therapist.personalMeetingLink,
      availabilitySlots: (therapist.availabilitySlots ?? []).map(serializeSlot),
    })
  }
}
