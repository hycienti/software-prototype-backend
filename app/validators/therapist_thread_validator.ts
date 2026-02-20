import vine from '@vinejs/vine'

export const sendTherapistThreadMessageValidator = vine.compile(
  vine.object({
    body: vine.string().trim().maxLength(5000).optional(),
    voiceUrl: vine.string().trim().url().optional(),
    attachmentUrls: vine.array(vine.string().trim().url()).optional(),
  })
)
