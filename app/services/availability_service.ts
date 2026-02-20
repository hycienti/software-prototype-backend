import { DateTime } from 'luxon'
import type AvailabilitySlot from '#models/availability_slot'
import type Session from '#models/session'
import AvailabilitySlotRepository from '#repositories/availability_slot_repository'
import SessionRepository from '#repositories/session_repository'

const availabilitySlotRepository = new AvailabilitySlotRepository()
const sessionRepository = new SessionRepository()

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

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Check if [start, start+duration) overlaps [sessionStart, sessionEnd). */
function overlaps(
  start: DateTime,
  durationMinutes: number,
  session: Session
): boolean {
  const end = start.plus({ minutes: durationMinutes })
  const sessionStart = session.scheduledAt
  const sessionEnd = sessionStart.plus({ minutes: session.durationMinutes })
  return start < sessionEnd && end > sessionStart
}

export interface BookableSlotDate {
  date: string
  timeSlots: string[]
}

/**
 * Returns bookable (date, time) slots for a therapist in a date range.
 * Only includes times within availability windows and not occupied by a non-cancelled session.
 * Times are in UTC (e.g. "09:00" = 09:00 UTC) to match the book endpoint.
 */
export async function getBookableSlots(
  therapistId: number,
  fromDate: string,
  toDate: string,
  durationMinutes: number = 50
): Promise<BookableSlotDate[]> {
  const from = DateTime.fromISO(fromDate, { zone: 'utc' }).startOf('day')
  const to = DateTime.fromISO(toDate, { zone: 'utc' }).endOf('day')
  const slots = await availabilitySlotRepository.listByTherapistId(therapistId)
  const sessions = await sessionRepository.listNonCancelledByTherapistBetween(
    therapistId,
    from,
    to
  )

  const slotStepMinutes = 60
  const byDate = new Map<string, Set<string>>()

  let cursor = from
  while (cursor <= to) {
    const dateStr = cursor.toISODate()!
    const weekday = cursor.weekday % 7

    const candidateTimes: number[] = []
    for (const slot of slots) {
      if (slot.type === 'recurring') {
        if (!slot.days?.includes(weekday)) continue
      } else {
        if (!slot.date) continue
        const slotDate =
          typeof slot.date === 'string' ? slot.date : slot.date.toISODate() ?? null
        if (!slotDate || dateStr !== slotDate) continue
      }
      const startMins = timeToMinutes(slot.startTime)
      const endMins = timeToMinutes(slot.endTime)
      for (let m = startMins; m + durationMinutes <= endMins; m += slotStepMinutes) {
        candidateTimes.push(m)
      }
    }

    const uniqueMinutes = [...new Set(candidateTimes)].sort((a, b) => a - b)
    for (const mins of uniqueMinutes) {
      const timeStr = formatTime(mins)
      const scheduledAt = DateTime.fromISO(`${dateStr}T${timeStr}:00.000Z`, {
        zone: 'utc',
      })
      const taken = sessions.some((s) => overlaps(scheduledAt, durationMinutes, s))
      if (!taken) {
        if (!byDate.has(dateStr)) byDate.set(dateStr, new Set())
        byDate.get(dateStr)!.add(timeStr)
      }
    }
    cursor = cursor.plus({ days: 1 })
  }

  const sortedDates = [...byDate.keys()].sort()
  return sortedDates.map((date) => ({
    date,
    timeSlots: [...(byDate.get(date) ?? [])].sort(),
  }))
}

export { availabilitySlotRepository }
