import vine from '@vinejs/vine'
import { SessionSentiment, FeedbackSentimentAfter } from '#enums/session'

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
    userSummaryMainTopics: vine.array(vine.string()).optional(),
    userSummaryActionItems: vine.array(vine.string()).optional(),
    userSummaryKeyReflection: vine.string().trim().maxLength(2000).optional(),
  })
)

export const sessionFeedbackValidator = vine.compile(
  vine.object({
    rating: vine.number().min(1).max(5),
    sentimentAfter: vine.enum(FeedbackSentimentAfter),
    comment: vine.string().trim().maxLength(2000).optional(),
  })
)
