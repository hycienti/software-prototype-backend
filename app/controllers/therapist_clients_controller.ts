import type { HttpContext } from '@adonisjs/core/http'
import SessionService from '#services/session_service'
import { clientsListValidator } from '#validators/list_validator'
import { defaultListParams } from '#validators/list_validator'
import { successResponse } from '#utils/response_helper'

const sessionService = new SessionService()

export default class TherapistClientsController {
  /**
   * @responseBody 200 - {"clients": [...], "meta": {"page": 1, "limit": 20, "total": 1}}
   */
  async index(ctx: HttpContext) {
    const therapist = ctx.auth.use('therapist').user!
    const { page = defaultListParams.page, limit = defaultListParams.limit, search } =
      await clientsListValidator.validate(ctx.request.qs())

    const result = await sessionService.getClientsForTherapist(therapist.id, {
      page,
      limit,
      search,
    })

    return successResponse(ctx, {
      clients: result.clients,
      meta: { page, limit, total: result.total },
    })
  }
}
