import vine from '@vinejs/vine'

export const sendMessageValidator = vine.compile(
  vine.object({
    conversationId: vine.number().optional(),
    message: vine.string().trim().minLength(1).maxLength(5000),
    mode: vine.enum(['text', 'voice']).optional(),
  })
)

export const getConversationHistoryValidator = vine.compile(
  vine.object({
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(100).optional(),
  })
)

export const deleteConversationValidator = vine.compile(
  vine.object({
    conversationId: vine.number().positive(),
  })
)

export const streamStatusValidator = vine.compile(
  vine.object({
    conversationId: vine.number().positive(),
    userMessageId: vine.number().positive(),
  })
)
