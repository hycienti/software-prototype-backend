import vine from '@vinejs/vine'

/**
 * One availability slot: either recurring (days of week) or one-off (specific date).
 * - Recurring: days (0-6), startTime, endTime, optional label/id
 * - One-off: date (YYYY-MM-DD), startTime, endTime, optional label/id
 */
const availabilitySlotSchema = vine.object({
  id: vine.string().trim().maxLength(64).optional(),
  label: vine.string().trim().maxLength(128).optional(),
  type: vine.enum(['recurring', 'one_off']).optional(),
  /** 0 = Sunday, 1 = Monday, ... 6 = Saturday. Required for recurring. */
  days: vine.array(vine.number().min(0).max(6)).optional(),
  /** YYYY-MM-DD. Required for one_off. */
  date: vine.string().trim().maxLength(10).optional(),
  startTime: vine.string().trim().maxLength(8),
  endTime: vine.string().trim().maxLength(8),
})

export const updateAvailabilityValidator = vine.compile(
  vine.object({
    acceptingNewClients: vine.boolean().optional(),
    personalMeetingLink: vine.string().trim().maxLength(512).optional(),
    availabilitySlots: vine.array(availabilitySlotSchema).optional(),
  })
)
