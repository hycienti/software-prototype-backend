import vine from '@vinejs/vine'
import { SessionSentiment } from '#enums/session'

export const bookSessionValidator = vine.compile(
  vine.object({
    therapistId: vine.number(),
    scheduledAt: vine.string(),
    durationMinutes: vine.number().min(1).optional(),
  })
)

export const sessionSummaryValidator = vine.compile(
  vine.object({
    sentiment: vine.enum(SessionSentiment),
    engagementLevel: vine.number().min(0).max(100),
    clinicalNotes: vine.string().trim().minLength(1),
    followUpAt: vine.string().optional(),
  })
)
