import vine from '@vinejs/vine'

export const createMoodValidator = vine.compile(
  vine.object({
    mood: vine.enum(['happy', 'calm', 'anxious', 'sad', 'angry']),
    intensity: vine.number().min(1).max(10),
    notes: vine.string().trim().maxLength(5000).optional(),
    photoUrl: vine.string().url().optional(),
    entryDate: vine.date().optional(), // If not provided, defaults to today
    tags: vine.array(vine.string().trim().maxLength(50)).optional(),
    metadata: vine.object({}).optional(),
  })
)

export const updateMoodValidator = vine.compile(
  vine.object({
    mood: vine.enum(['happy', 'calm', 'anxious', 'sad', 'angry']).optional(),
    intensity: vine.number().min(1).max(10).optional(),
    notes: vine.string().trim().maxLength(5000).optional(),
    photoUrl: vine.string().url().optional(),
    tags: vine.array(vine.string().trim().maxLength(50)).optional(),
    metadata: vine.object({}).optional(),
  })
)

export const getMoodHistoryValidator = vine.compile(
  vine.object({
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(100).optional(),
    startDate: vine.date().optional(),
    endDate: vine.date().optional(),
    mood: vine.enum(['happy', 'calm', 'anxious', 'sad', 'angry']).optional(),
  })
)
