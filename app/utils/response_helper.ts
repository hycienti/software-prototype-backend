import type { HttpContext } from '@adonisjs/core/http'

/** Standard API success shape for JSON responses */
export function successResponse(ctx: HttpContext, data: unknown, status: number = 200) {
  return ctx.response.status(status).json({ success: true, data })
}

/** Standard API error shape: { success: false, error: { code, message, details? } } */
export function errorResponse(
  ctx: HttpContext,
  code: string,
  message: string,
  status: number,
  details?: unknown
) {
  return ctx.response.status(status).json({
    success: false,
    error: details !== undefined ? { code, message, details } : { code, message },
  })
}

/** Common error codes for the exception handler and controllers */
export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const
