import type { HttpContext } from '@adonisjs/core/http'
import Session from '#models/session'
import User from '#models/user'
import { DateTime } from 'luxon'

/**
 * List clients (users) that have at least one session with the authenticated therapist.
 */
export default class TherapistClientsController {
  async index({ auth, response }: HttpContext) {
    const therapist = auth.use('therapist').user!

    const sessions = await Session.query()
      .where('therapist_id', therapist.id)
      .preload('user')
      .orderBy('scheduled_at', 'desc')

    const byUserId = new Map<
      number,
      {
        user: User
        lastSessionAt: DateTime
        nextSessionAt: DateTime | null
        sessionCount: number
      }
    >()

    for (const s of sessions) {
      const uid = s.userId
      const existing = byUserId.get(uid)
      if (!existing) {
        const next = await Session.query()
          .where('therapist_id', therapist.id)
          .where('user_id', uid)
          .where('status', 'scheduled')
          .where('scheduled_at', '>=', DateTime.now().toSQL()!)
          .orderBy('scheduled_at', 'asc')
          .first()
        byUserId.set(uid, {
          user: s.user,
          lastSessionAt: s.scheduledAt,
          nextSessionAt: next?.scheduledAt ?? null,
          sessionCount: 1,
        })
      } else {
        existing.sessionCount += 1
        if (s.scheduledAt > existing.lastSessionAt) {
          existing.lastSessionAt = s.scheduledAt
        }
      }
    }

    const clients = Array.from(byUserId.entries()).map(([userId, data]) => ({
      userId,
      fullName: data.user.fullName,
      email: data.user.email,
      avatarUrl: data.user.avatarUrl,
      lastSessionAt: data.lastSessionAt.toISO(),
      nextSessionAt: data.nextSessionAt?.toISO() ?? null,
      sessionCount: data.sessionCount,
    }))

    return response.ok({ clients })
  }
}
