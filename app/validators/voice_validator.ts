import vine from '@vinejs/vine'

export const processVoiceMessageValidator = vine.compile(
  vine.object({
    conversationId: vine.number().optional(),
    audioData: vine.string(), // Base64 encoded audio
    audioFormat: vine.enum(['mp3', 'wav', 'm4a', 'ogg']).optional(),
    language: vine.string().maxLength(10).optional(),
  })
)

export const textToSpeechValidator = vine.compile(
  vine.object({
    text: vine.string().trim().minLength(1).maxLength(5000),
    voiceId: vine.string().optional(),
    conversationId: vine.number().optional(),
  })
)
