import vine from '@vinejs/vine'

export const sendTherapistThreadMessageValidator = vine.compile(
  vine.object({
    body: vine.string().trim().minLength(1).maxLength(5000),
  })
)
