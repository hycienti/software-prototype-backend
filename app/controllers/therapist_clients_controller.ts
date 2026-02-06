import type { HttpContext } from '@adonisjs/core/http'
import Session from '#models/session'
import User from '#models/user'
import { DateTime } from 'luxon'
import { clientsListValidator } from '#validators/list_validator'
import { defaultListParams } from '#validators/list_validator'

/**
 * List clients (users) that have at least one session with the authenticated therapist.
 * Query: page, limit, search (optional, filters by fullName or email).
 */
export default class TherapistClientsController {
  /**
   * @responseBody 200 - {"clients": [{"userId": 1, "fullName": "Jane Doe", "email": "jane@example.com", "lastSessionAt": "2026-01-20T10:00:00.000Z", "nextSessionAt": "", "sessionCount": 3}], "meta": {"page": 1, "limit": 20, "total": 1}}
   */
  async index({ auth, request, response }: HttpContext) {
    const therapist = auth.use('therapist').user!
    const { page = defaultListParams.page, limit = defaultListParams.limit, search } =
      await clientsListValidator.validate(request.qs())

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

    let clients = Array.from(byUserId.entries()).map(([userId, data]) => ({
      userId,
      fullName: data.user.fullName,
      email: data.user.email,
      avatarUrl: data.user.avatarUrl,
      lastSessionAt: data.lastSessionAt.toISO(),
      nextSessionAt: data.nextSessionAt?.toISO() ?? null,
      sessionCount: data.sessionCount,
    }))

    if (search && search.trim()) {
      const term = search.trim().toLowerCase()
      clients = clients.filter(
        (c) =>
          (c.fullName ?? '').toLowerCase().includes(term) ||
          (c.email ?? '').toLowerCase().includes(term)
      )
    }

    const total = clients.length
    const offset = (page - 1) * limit
    const paginatedClients = clients.slice(offset, offset + limit)

    return response.ok({
      clients: paginatedClients,
      meta: { page, limit, total },
    })
  }
}
