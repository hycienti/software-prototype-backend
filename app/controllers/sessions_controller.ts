import type { HttpContext } from '@adonisjs/core/http'
import Session from '#models/session'
import Therapist from '#models/therapist'
import { bookSessionValidator, sessionSummaryValidator } from '#validators/session_validator'
import { sessionsListValidator, defaultListParams } from '#validators/list_validator'
import { SessionStatus } from '#enums/session'
import { DateTime } from 'luxon'
import { VideoSdkService } from '#services/videosdk_service'
import logger from '@adonisjs/core/services/logger'

export default class SessionsController {
  /**
   * @show
   * @summary Get a single session
   * @tag Sessions
   * @description Returns session by id. User sees own sessions; therapist sees own sessions.
   */
  async show({ auth, params, response }: HttpContext) {
    const session = await Session.query()
      .where('id', params.id)
      .preload('user')
      .preload('therapist')
      .first()

    if (!session) {
      return response.notFound({ message: 'Session not found' })
    }

    if (auth.use('therapist').isAuthenticated) {
      const therapist = auth.use('therapist').user!
      if (session.therapistId !== therapist.id) {
        return response.forbidden({ message: 'Not authorized to view this session' })
      }
    } else if (auth.use('api').isAuthenticated) {
      const user = auth.use('api').user!
      if (session.userId !== user.id) {
        return response.forbidden({ message: 'Not authorized to view this session' })
      }
    } else {
      return response.unauthorized({ message: 'Authentication required' })
    }

    return response.ok({
      session: {
        id: session.id,
        userId: session.userId,
        therapistId: session.therapistId,
        scheduledAt: session.scheduledAt.toISO(),
        durationMinutes: session.durationMinutes,
        status: session.status,
        meetingId: session.meetingId,
        sentiment: session.sentiment,
        engagementLevel: session.engagementLevel,
        clinicalNotes: session.clinicalNotes,
        followUpAt: session.followUpAt?.toISO() ?? null,
        summaryCompletedAt: session.summaryCompletedAt?.toISO() ?? null,
        createdAt: session.createdAt.toISO(),
        updatedAt: session.updatedAt.toISO(),
        user: session.user
          ? {
              id: session.user.id,
              fullName: session.user.fullName,
              email: session.user.email,
              avatarUrl: session.user.avatarUrl,
            }
          : undefined,
        therapist: session.therapist
          ? {
              id: session.therapist.id,
              fullName: session.therapist.fullName,
              professionalTitle: session.therapist.professionalTitle,
            }
          : undefined,
      },
    })
  }

  /**
   * @createTestRoom
   * @summary Create a video room for testing (Therapist only)
   * @tag Sessions
   * @description Creates a VideoSDK room via backend (no session required). Returns meetingId and token for client. Use for "Test video call" in the app.
   * @responseBody 200 - {"meetingId": "xxx", "token": "..."}
   */
  async createTestRoom({ auth, response }: HttpContext) {
    auth.use('therapist').authenticate()
    const videoSdk = new VideoSdkService()
    try {
      const { roomId, token } = await videoSdk.createRoom()
      logger.info({ meetingId: roomId }, 'Test video room created')
      return response.ok({ meetingId: roomId, token })
    } catch (err) {
      logger.error({ err }, 'Failed to create test video room')
      return response.serviceUnavailable({
        message: err instanceof Error ? err.message : 'Failed to create video room',
      })
    }
  }

  /**
   * @createRoom
   * @summary Create video room for a session (Therapist only)
   * @tag Sessions
   * @description Creates a VideoSDK room, stores meetingId on session, returns meetingId and token for client.
   */
  async createRoom({ auth, params, response }: HttpContext) {
    const therapist = auth.use('therapist').user!
    const session = await Session.query()
      .where('id', params.id)
      .where('therapist_id', therapist.id)
      .first()

    if (!session) {
      return response.notFound({ message: 'Session not found' })
    }

    if (session.status !== SessionStatus.SCHEDULED) {
      return response.badRequest({
        message: 'Only scheduled sessions can start a video room',
      })
    }

    try {
      const videoSdk = new VideoSdkService()
      const { roomId, token } = await videoSdk.createRoom()
      session.meetingId = roomId
      await session.save()
      logger.info({ sessionId: session.id, meetingId: roomId }, 'Video room created for session')
      return response.ok({ meetingId: roomId, token })
    } catch (err) {
      logger.error({ err, sessionId: session.id }, 'Failed to create video room')
      return response.serviceUnavailable({
        message: err instanceof Error ? err.message : 'Failed to create video room',
      })
    }
  }

  /**
   * @book
   * @summary Book a session with a therapist
   * @tag Sessions
   * @description Allows an authenticated user to book a session with a therapist.
   * @requestBody {"therapistId": 1, "scheduledAt": "2026-01-25T10:00:00Z", "durationMinutes": 50}
   * @responseBody 201 - {"session": {"id": 1, "userId": 1, "therapistId": 1, "scheduledAt": "2026-01-25T10:00:00Z", "status": "scheduled"}}
   * @responseBody 404 - {"message": "Therapist not found"}
   */
  async book({ auth, request, response }: HttpContext) {
    const user = auth.use('api').user!
    const payload = await bookSessionValidator.validate(request.all())

    const therapist = await Therapist.find(payload.therapistId)
    if (!therapist) {
      return response.notFound({ message: 'Therapist not found' })
    }

    const session = await Session.create({
      userId: user.id,
      therapistId: therapist.id,
      scheduledAt: DateTime.fromISO(payload.scheduledAt),
      durationMinutes: payload.durationMinutes || 50,
      status: SessionStatus.SCHEDULED,
    })

    return response.created({ session })
  }

  /**
   * @index
   * @summary List sessions
   * @tag Sessions
   * @description Returns a paginated list of sessions. Query: page, limit, status (optional).
   * @responseBody 200 - {"sessions": [...], "meta": {"page": 1, "limit": 20, "total": 42}}
   */
  async index({ auth, request, response }: HttpContext) {
    const { page = defaultListParams.page, limit = defaultListParams.limit, status } =
      await sessionsListValidator.validate(request.qs())

    let sessionsQuery = Session.query().preload('user').preload('therapist')

    if (auth.use('therapist').isAuthenticated) {
      const therapist = auth.use('therapist').user!
      sessionsQuery = sessionsQuery.where('therapist_id', therapist.id)
    } else {
      const user = auth.use('api').user!
      sessionsQuery = sessionsQuery.where('user_id', user.id)
    }

    if (status) {
      sessionsQuery = sessionsQuery.where('status', status)
    }

    const total = await sessionsQuery.clone().count('* as total').first()
    const totalCount = Number(total?.$extras?.total ?? 0)

    const sessions = await sessionsQuery
      .orderBy('scheduled_at', 'desc')
      .offset((page - 1) * limit)
      .limit(limit)

    return response.ok({
      sessions: sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        therapistId: s.therapistId,
        scheduledAt: s.scheduledAt.toISO(),
        durationMinutes: s.durationMinutes,
        status: s.status,
        meetingId: s.meetingId,
        sentiment: s.sentiment,
        engagementLevel: s.engagementLevel,
        clinicalNotes: s.clinicalNotes,
        followUpAt: s.followUpAt?.toISO() ?? null,
        summaryCompletedAt: s.summaryCompletedAt?.toISO() ?? null,
        user: s.user
          ? { id: s.user.id, fullName: s.user.fullName, email: s.user.email, avatarUrl: s.user.avatarUrl }
          : undefined,
        therapist: s.therapist
          ? { id: s.therapist.id, fullName: s.therapist.fullName, professionalTitle: s.therapist.professionalTitle }
          : undefined,
      })),
      meta: { page, limit, total: totalCount },
    })
  }

  /**
   * @submitSummary
   * @summary Submit session summary (Therapist only)
   * @tag Sessions
   * @description Allows an authenticated therapist to submit a summary for a completed session.
   * @requestBody {"sentiment": "positive", "engagementLevel": 85, "clinicalNotes": "Patient exhibited elevated mood...", "followUpAt": "2026-02-01T10:00:00Z"}
   * @responseBody 200 - {"session": {"id": 1, "sentiment": "positive", "status": "completed", "clinicalNotes": "...", "summaryCompletedAt": "..."}}
   * @responseBody 404 - {"message": "Session not found"}
   */
  async submitSummary({ auth, params, request, response }: HttpContext) {
    const therapist = auth.use('therapist').user!
    const session = await Session.query()
      .where('id', params.id)
      .where('therapist_id', therapist.id)
      .first()

    if (!session) {
      return response.notFound({ message: 'Session not found' })
    }

    const payload = await sessionSummaryValidator.validate(request.all())

    session.merge({
      sentiment: payload.sentiment,
      engagementLevel: payload.engagementLevel,
      clinicalNotes: payload.clinicalNotes,
      followUpAt: payload.followUpAt ? DateTime.fromISO(payload.followUpAt) : null,
      summaryCompletedAt: DateTime.now(),
      status: SessionStatus.COMPLETED,
    })

    await session.save()

    return response.ok({ session })
  }
}
