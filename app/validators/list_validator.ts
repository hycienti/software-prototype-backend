import vine from '@vinejs/vine'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

/**
 * Common pagination query params: page (1-based), limit.
 */
export const paginationValidator = vine.compile(
  vine.object({
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(MAX_LIMIT).optional(),
  })
)

export const defaultListParams = { page: 1, limit: DEFAULT_LIMIT }

/**
 * Sessions list: pagination + optional status filter.
 */
export const sessionsListValidator = vine.compile(
  vine.object({
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(MAX_LIMIT).optional(),
    status: vine.enum(['scheduled', 'completed', 'cancelled']).optional(),
  })
)

/**
 * Clients list: pagination + optional search (fullName/email).
 */
export const clientsListValidator = vine.compile(
  vine.object({
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(MAX_LIMIT).optional(),
    search: vine.string().trim().maxLength(200).optional(),
  })
)

/**
 * Notifications list: pagination + optional isRead filter (query string "true"/"false").
 */
export const notificationsListValidator = vine.compile(
  vine.object({
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(MAX_LIMIT).optional(),
    isRead: vine.string().optional(), // "true" | "false" parsed in controller
  })
)

/**
 * Wallet index: optional limits and pages for transactions and withdrawals.
 */
export const walletListValidator = vine.compile(
  vine.object({
    transactionsPage: vine.number().positive().optional(),
    transactionsLimit: vine.number().positive().max(100).optional(),
    withdrawalsPage: vine.number().positive().optional(),
    withdrawalsLimit: vine.number().positive().max(100).optional(),
  })
)

/**
 * Notification templates list: optional filters.
 */
export const notificationTemplatesListValidator = vine.compile(
  vine.object({
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(MAX_LIMIT).optional(),
    notificationTypeId: vine.number().positive().optional(),
    channelId: vine.number().positive().optional(),
    productType: vine.enum(['user', 'therapist']).optional(),
  })
)

/**
 * Notification deliveries list: pagination + optional filters.
 */
export const notificationDeliveriesListValidator = vine.compile(
  vine.object({
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(MAX_LIMIT).optional(),
    status: vine.enum(['pending', 'sent', 'failed']).optional(),
    recipientType: vine.enum(['user', 'therapist']).optional(),
    notificationTypeSlug: vine.string().trim().maxLength(64).optional(),
  })
)

export { DEFAULT_LIMIT, MAX_LIMIT }
