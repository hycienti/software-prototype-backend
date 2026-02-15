import vine from '@vinejs/vine'

/**
 * Channel create/update
 */
export const createChannelValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(64),
    slug: vine.string().trim().minLength(1).maxLength(32),
  })
)

export const updateChannelValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(64).optional(),
    slug: vine.string().trim().minLength(1).maxLength(32).optional(),
  })
)

/**
 * Category create/update
 */
export const createCategoryValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(64),
    slug: vine.string().trim().minLength(1).maxLength(32),
  })
)

export const updateCategoryValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(64).optional(),
    slug: vine.string().trim().minLength(1).maxLength(32).optional(),
  })
)

/**
 * Notification type create/update
 */
export const createTypeValidator = vine.compile(
  vine.object({
    categoryId: vine.number().positive(),
    name: vine.string().trim().minLength(1).maxLength(128),
    slug: vine.string().trim().minLength(1).maxLength(64),
    description: vine.string().trim().maxLength(500).optional(),
  })
)

export const updateTypeValidator = vine.compile(
  vine.object({
    categoryId: vine.number().positive().optional(),
    name: vine.string().trim().minLength(1).maxLength(128).optional(),
    slug: vine.string().trim().minLength(1).maxLength(64).optional(),
    description: vine.string().trim().maxLength(500).optional(),
  })
)

/**
 * Notification template create/update
 */
export const createTemplateValidator = vine.compile(
  vine.object({
    notificationTypeId: vine.number().positive(),
    channelId: vine.number().positive(),
    productType: vine.enum(['user', 'therapist']),
    locale: vine.string().trim().minLength(1).maxLength(8).optional(),
    subject: vine.string().trim().maxLength(255).optional(),
    bodyHtml: vine.string().trim().minLength(1),
    bodyText: vine.string().trim().optional(),
    templateVariables: vine.array(vine.string()).optional(),
  })
)

export const updateTemplateValidator = vine.compile(
  vine.object({
    notificationTypeId: vine.number().positive().optional(),
    channelId: vine.number().positive().optional(),
    productType: vine.enum(['user', 'therapist']).optional(),
    locale: vine.string().trim().minLength(1).maxLength(8).optional(),
    subject: vine.string().trim().maxLength(255).optional(),
    bodyHtml: vine.string().trim().minLength(1).optional(),
    bodyText: vine.string().trim().optional(),
    templateVariables: vine.array(vine.string()).optional(),
  })
)
