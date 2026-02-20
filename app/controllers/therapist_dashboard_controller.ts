import type { HttpContext } from '@adonisjs/core/http'
import SessionService from '#services/session_service'
import { successResponse } from '#utils/response_helper'

const sessionService = new SessionService()

export default class TherapistDashboardController {
  /**
   * @responseBody 200 - {"sessionsToday": 2, "newRequests": 1, "monthlyRevenue": "500.00", "monthlyRevenueCents": 50000, "balance": "100.00", "balanceCents": 10000}
   */
  async index(ctx: HttpContext) {
    const therapist = ctx.auth.use('therapist').user!
    const stats = await sessionService.getDashboardStats(therapist.id)
    return successResponse(ctx, {
      sessionsToday: stats.sessionsToday,
      newRequests: stats.newRequests,
      monthlyRevenue: (stats.monthlyRevenueCents / 100).toFixed(2),
      monthlyRevenueCents: stats.monthlyRevenueCents,
      balance: (stats.balanceCents / 100).toFixed(2),
      balanceCents: stats.balanceCents,
    })
  }
}
