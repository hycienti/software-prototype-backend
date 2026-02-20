import { DateTime } from 'luxon'
import type AvailabilitySlot from '#models/availability_slot'
import AvailabilitySlotRepository from '#repositories/availability_slot_repository'

const availabilitySlotRepository = new AvailabilitySlotRepository()

/**
 * Slot matching uses scheduledAt as a Luxon DateTime (from ISO string, typically UTC).
 * Recurring slot days: 0 = Sunday, 1 = Monday, ..., 6 = Saturday (Luxon weekday % 7).
 * For consistent matching, clients should send scheduledAt in ISO format; the day and
 * time window are evaluated in the same timezone as the DateTime (UTC if ISO has Z).
 */

/**
 * Parses "HH:mm" or "HH:mm:ss" to minutes since midnight.
 */
function timeToMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/**
 * Returns true if the given scheduled time and duration fall within the slot's window
 * for that day (recurring: weekday match; one_off: date match).
 */
function slotContains(slot: AvailabilitySlot, scheduledAt: DateTime, durationMinutes: number): boolean {
  const dayStart = scheduledAt.startOf('day')
  const startMins = timeToMinutes(slot.startTime)
  const endMins = timeToMinutes(slot.endTime)
  const windowStart = dayStart.plus({ minutes: startMins })
  const windowEnd = dayStart.plus({ minutes: endMins })
  const sessionEnd = scheduledAt.plus({ minutes: durationMinutes })

  if (slot.type === 'recurring') {
    const weekday = scheduledAt.weekday % 7 // Luxon 1=Mon..7=Sun -> we use 0=Sun, 1=Mon..6=Sat
    if (!slot.days?.includes(weekday)) return false
  } else {
    if (!slot.date) return false
    const slotDate = typeof slot.date === 'string' ? slot.date : slot.date.toISODate() ?? null
    if (!slotDate || scheduledAt.toISODate() !== slotDate) return false
  }

  return scheduledAt >= windowStart && sessionEnd <= windowEnd
}

/**
 * Finds an availability slot for the given therapist that contains the requested
 * scheduled time and duration. Returns the slot or null.
 */
export async function findMatchingSlot(
  therapistId: number,
  scheduledAt: DateTime,
  durationMinutes: number
): Promise<AvailabilitySlot | null> {
  const slots = await availabilitySlotRepository.listByTherapistId(therapistId)
  for (const slot of slots) {
    if (slotContains(slot, scheduledAt, durationMinutes)) return slot
  }
  return null
}

export { availabilitySlotRepository }
