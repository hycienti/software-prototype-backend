import vine from '@vinejs/vine'

export const createPaymentValidator = vine.compile(
  vine.object({
    therapistId: vine.number(),
    amountCents: vine.number().positive(),
    currency: vine.string().trim().maxLength(3).optional(),
    scheduledAt: vine.string(),
    durationMinutes: vine.number().min(1).optional(),
  })
)
