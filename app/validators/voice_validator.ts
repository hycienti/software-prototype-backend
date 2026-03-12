import vine from '@vinejs/vine'

export const processVoiceMessageValidator = vine.compile(
  vine.object({
    conversationId: vine.number().optional(),
    audioData: vine.string().optional(), // Base64 encoded audio (legacy)
    audioFormat: vine.enum(['mp3', 'wav', 'm4a', 'ogg']).optional(),
    transcript: vine.string().trim().minLength(1).optional(), // Client-side STT (e.g. whisper.rn)
    language: vine.string().maxLength(10).optional(),
    async: vine.boolean().optional(),
  })
)
