import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { errors as authErrors } from '@adonisjs/auth'
import { errors as vineErrors } from '@vinejs/vine'
import { errors as lucidErrors } from '@adonisjs/lucid'
import logger from '@adonisjs/core/services/logger'
import { errorResponse, ErrorCodes } from '#utils/response_helper'

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction
  protected renderStatusPages = false

  async handle(error: unknown, ctx: HttpContext) {
    if (error instanceof authErrors.E_UNAUTHORIZED_ACCESS) {
      return errorResponse(ctx, ErrorCodes.UNAUTHORIZED, 'Unauthorized', 401)
    }

    if (error instanceof authErrors.E_INVALID_CREDENTIALS) {
      return errorResponse(ctx, ErrorCodes.INVALID_CREDENTIALS, 'Invalid credentials', 401)
    }

    if (error instanceof vineErrors.E_VALIDATION_ERROR) {
      const firstMessage = error.messages[0]?.message ?? 'Validation failed'
      return errorResponse(
        ctx,
        ErrorCodes.VALIDATION_ERROR,
        firstMessage,
        422,
        error.messages
      )
    }

    if (error instanceof Error && error.message.includes('Invalid')) {
      return errorResponse(ctx, ErrorCodes.BAD_REQUEST, error.message, 400)
    }

    if (error instanceof lucidErrors.E_ROW_NOT_FOUND) {
      return errorResponse(ctx, ErrorCodes.NOT_FOUND, 'Resource not found', 404)
    }

    const message =
      this.debug && error instanceof Error ? error.message : 'An unexpected error occurred'
    const details = this.debug && error instanceof Error ? { stack: error.stack } : undefined
    return errorResponse(
      ctx,
      ErrorCodes.INTERNAL_SERVER_ERROR,
      message,
      500,
      details
    )
  }

  async report(error: unknown, ctx: HttpContext) {
    if (error instanceof vineErrors.E_VALIDATION_ERROR) {
      logger.warn({ url: ctx.request.url(), messages: error.messages }, 'Validation failed')
    } else if (error instanceof authErrors.E_UNAUTHORIZED_ACCESS) {
      logger.debug({ url: ctx.request.url() }, 'Unauthorized request')
    } else {
      logger.error(
        { err: error, url: ctx.request.url(), method: ctx.request.method() },
        'Request error'
      )
    }
    return super.report(error, ctx)
  }
}
