import vine from '@vinejs/vine'

/** Accepts a full URL (http/https) or a path starting with / (e.g. from upload endpoint). */
const photoUrlSchema = vine.union([
  vine.union.if(
    (value) => typeof value === 'string' && (value as string).startsWith('/'),
    vine.string().trim().minLength(1).maxLength(2048)
  ),
  vine.union.else(vine.string().trim().url()),
]).optional()

export const createGratitudeValidator = vine.compile(
  vine.object({
    entries: vine
      .array(vine.string().trim().minLength(1).maxLength(1000))
      .minLength(1)
      .maxLength(10),
    photoUrl: photoUrlSchema,
    entryDate: vine.date().optional(), // If not provided, defaults to today
    metadata: vine.object({}).optional(),
  })
)

export const updateGratitudeValidator = vine.compile(
  vine.object({
    entries: vine
      .array(vine.string().trim().minLength(1).maxLength(1000))
      .minLength(1)
      .maxLength(10)
      .optional(),
    photoUrl: photoUrlSchema,
    metadata: vine.object({}).optional(),
  })
)

export const getGratitudeHistoryValidator = vine.compile(
  vine.object({
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(100).optional(),
    startDate: vine.date().optional(),
    endDate: vine.date().optional(),
  })
)
