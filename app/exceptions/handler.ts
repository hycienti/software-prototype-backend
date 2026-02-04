import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { errors as authErrors } from '@adonisjs/auth'
import { errors as vineErrors } from '@vinejs/vine'
import logger from '@adonisjs/core/services/logger'

/** Consistent API error shape: { message, errors? } for frontend */
function apiError(message: string, errors?: unknown) {
  return errors !== undefined ? { message, errors } : { message }
}

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction
  protected renderStatusPages = false

  async handle(error: unknown, ctx: HttpContext) {
    if (error instanceof authErrors.E_UNAUTHORIZED_ACCESS) {
      return ctx.response.unauthorized(apiError('Unauthorized'))
    }

    if (error instanceof authErrors.E_INVALID_CREDENTIALS) {
      return ctx.response.unauthorized(apiError('Invalid credentials'))
    }

    if (error instanceof vineErrors.E_VALIDATION_ERROR) {
      const firstMessage = error.messages[0]?.message ?? 'Validation failed'
      return ctx.response.unprocessableEntity(
        apiError(firstMessage, error.messages)
      )
    }

    if (error instanceof Error && error.message.includes('Invalid')) {
      return ctx.response.badRequest(apiError(error.message))
    }

    return super.handle(error, ctx)
  }

  async report(error: unknown, ctx: HttpContext) {
    if (error instanceof vineErrors.E_VALIDATION_ERROR) {
      logger.warn({ url: ctx.request.url(), messages: error.messages }, 'Validation failed')
    } else if (error instanceof authErrors.E_UNAUTHORIZED_ACCESS) {
      logger.debug({ url: ctx.request.url() }, 'Unauthorized request')
    } else {
      logger.error({ err: error, url: ctx.request.url(), method: ctx.request.method() }, 'Request error')
    }
    return super.report(error, ctx)
  }
}
