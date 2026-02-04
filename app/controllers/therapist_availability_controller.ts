import type { HttpContext } from '@adonisjs/core/http'
import Therapist from '#models/therapist'
import vine from '@vinejs/vine'
import logger from '@adonisjs/core/services/logger'

const updateAvailabilityValidator = vine.compile(
  vine.object({
    acceptingNewClients: vine.boolean().optional(),
    personalMeetingLink: vine.string().trim().maxLength(512).optional(),
    availabilitySlots: vine.array(vine.any()).optional(),
  })
)

/**
 * GET/PUT therapist availability and meeting link.
 */
export default class TherapistAvailabilityController {
  async show({ auth, response }: HttpContext) {
    const therapist = auth.use('therapist').user!
    await therapist.refresh()
    return response.ok({
      acceptingNewClients: therapist.acceptingNewClients ?? true,
      personalMeetingLink: therapist.personalMeetingLink ?? null,
      availabilitySlots: therapist.availabilitySlots ?? [],
    })
  }

  async update({ auth, request, response }: HttpContext) {
    const therapist = auth.use('therapist').user!
    const payload = await updateAvailabilityValidator.validate(request.all())

    if (payload.acceptingNewClients !== undefined) {
      therapist.acceptingNewClients = payload.acceptingNewClients
    }
    if (payload.personalMeetingLink !== undefined) {
      therapist.personalMeetingLink = payload.personalMeetingLink || null
    }
    if (payload.availabilitySlots !== undefined) {
      therapist.availabilitySlots = payload.availabilitySlots
    }

    await therapist.save()
    logger.info({ therapistId: therapist.id }, 'Therapist availability updated')

    return response.ok({
      acceptingNewClients: therapist.acceptingNewClients,
      personalMeetingLink: therapist.personalMeetingLink,
      availabilitySlots: therapist.availabilitySlots,
    })
  }
}
