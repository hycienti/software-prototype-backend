import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { errors as authErrors } from '@adonisjs/auth'
import { errors as vineErrors } from '@vinejs/vine'

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction
  protected renderStatusPages = false

  async handle(error: unknown, ctx: HttpContext) {
    if (error instanceof authErrors.E_UNAUTHORIZED_ACCESS) {
      return ctx.response.unauthorized({ error: 'Unauthorized' })
    }

    if (error instanceof authErrors.E_INVALID_CREDENTIALS) {
      return ctx.response.unauthorized({ error: 'Invalid credentials' })
    }

    if (error instanceof vineErrors.E_VALIDATION_ERROR) {
      return ctx.response.unprocessableEntity({
        error: 'Validation failed',
        messages: error.messages,
      })
    }

    if (error instanceof Error && error.message.includes('Invalid')) {
      return ctx.response.badRequest({ error: error.message })
    }

    return super.handle(error, ctx)
  }

  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
