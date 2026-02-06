import type { HttpContext } from '@adonisjs/core/http'
import Session from '#models/session'
import TherapistWallet from '#models/therapist_wallet'
import { DateTime } from 'luxon'

/**
 * Dashboard stats for therapist: sessions today, new requests, monthly revenue.
 */
export default class TherapistDashboardController {
  /**
   * @responseBody 200 - {"sessionsToday": 2, "newRequests": 1, "monthlyRevenue": "500.00", "monthlyRevenueCents": 50000, "balance": "100.00", "balanceCents": 10000}
   */
  async index({ auth, response }: HttpContext) {
    const therapist = auth.use('therapist').user!

    const todayStart = DateTime.now().startOf('day')
    const todayEnd = DateTime.now().endOf('day')
    const monthStart = DateTime.now().startOf('month')
    const monthEnd = DateTime.now().endOf('month')

    const [sessionsToday, newRequests, monthlySessions, wallet] = await Promise.all([
      Session.query()
        .where('therapist_id', therapist.id)
        .whereBetween('scheduled_at', [todayStart.toSQL()!, todayEnd.toSQL()!])
        .whereIn('status', ['scheduled', 'completed'])
        .count('* as total'),
      Session.query()
        .where('therapist_id', therapist.id)
        .where('status', 'scheduled')
        .where('scheduled_at', '>=', todayStart.toSQL()!)
        .count('* as total'),
      Session.query()
        .where('therapist_id', therapist.id)
        .whereBetween('scheduled_at', [monthStart.toSQL()!, monthEnd.toSQL()!])
        .where('status', 'completed')
        .count('* as total'),
      TherapistWallet.findBy('therapist_id', therapist.id),
    ])

    const sessionsTodayCount = Number((sessionsToday as unknown as { total: string }[])[0]?.total ?? 0)
    const newRequestsCount = Number((newRequests as unknown as { total: string }[])[0]?.total ?? 0)
    const monthlyCompletedCount = Number(
      (monthlySessions as unknown as { total: string }[])[0]?.total ?? 0
    )

    // Simple revenue: assume $100 per completed session for demo; in production use transaction sum
    const monthlyRevenueCents = monthlyCompletedCount * 10000 // $100
    const monthlyRevenue = (monthlyRevenueCents / 100).toFixed(2)
    const balanceCents = wallet?.balanceCents ?? 0
    const balance = (balanceCents / 100).toFixed(2)

    return response.ok({
      sessionsToday: sessionsTodayCount,
      newRequests: newRequestsCount,
      monthlyRevenue,
      monthlyRevenueCents,
      balance,
      balanceCents,
    })
  }
}
