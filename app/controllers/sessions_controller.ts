import type { HttpContext } from '@adonisjs/core/http'
import type Session from '#models/session'
import SessionService from '#services/session_service'
import { VideoSdkService } from '#services/videosdk_service'
import { bookSessionValidator, sessionSummaryValidator } from '#validators/session_validator'
import { sessionsListValidator, defaultListParams } from '#validators/list_validator'
import { DateTime } from 'luxon'
import { SessionStatus } from '#enums/session'
import { successResponse, errorResponse, ErrorCodes } from '#utils/response_helper'
import logger from '@adonisjs/core/services/logger'

const sessionService = new SessionService()

function serializeSession(s: Session) {
  return {
    id: s.id,
    userId: s.userId,
    therapistId: s.therapistId,
    availabilitySlotId: s.availabilitySlotId,
    scheduledAt: s.scheduledAt.toISO(),
    durationMinutes: s.durationMinutes,
    status: s.status,
    meetingId: s.meetingId,
    sentiment: s.sentiment,
    engagementLevel: s.engagementLevel,
    clinicalNotes: s.clinicalNotes,
    followUpAt: s.followUpAt?.toISO() ?? null,
    summaryCompletedAt: s.summaryCompletedAt?.toISO() ?? null,
    createdAt: s.createdAt.toISO(),
    updatedAt: s.updatedAt.toISO(),
    user: s.user
      ? { id: s.user.id, fullName: s.user.fullName, email: s.user.email, avatarUrl: s.user.avatarUrl }
      : undefined,
    therapist: s.therapist
      ? { id: s.therapist.id, fullName: s.therapist.fullName, professionalTitle: s.therapist.professionalTitle }
      : undefined,
  }
}

export default class SessionsController {
  /**
   * @show
   * @summary Get a single session
   * @tag Sessions
   */
  async show(ctx: HttpContext) {
    const session = await sessionService.findById(Number(ctx.params.id))
    if (!session) {
      return errorResponse(ctx, ErrorCodes.NOT_FOUND, 'Session not found', 404)
    }

    if (ctx.auth.use('therapist').isAuthenticated) {
      const therapist = ctx.auth.use('therapist').user!
      if (session.therapistId !== therapist.id) {
        return errorResponse(ctx, ErrorCodes.BAD_REQUEST, 'Not authorized to view this session', 403)
      }
    } else if (ctx.auth.use('api').isAuthenticated) {
      const user = ctx.auth.use('api').user!
      if (session.userId !== user.id) {
        return errorResponse(ctx, ErrorCodes.BAD_REQUEST, 'Not authorized to view this session', 403)
      }
    } else {
      return errorResponse(ctx, ErrorCodes.UNAUTHORIZED, 'Authentication required', 401)
    }

    return successResponse(ctx, { session: serializeSession(session) })
  }

  /**
   * @createTestRoom
   * @summary Create a video room for testing (Therapist only)
   * @tag Sessions
   */
  async createTestRoom(ctx: HttpContext) {
    ctx.auth.use('therapist').authenticate()
    const videoSdk = new VideoSdkService()
    try {
      const { roomId, token } = await videoSdk.createRoom()
      logger.info({ meetingId: roomId }, 'Test video room created')
      return successResponse(ctx, { meetingId: roomId, token })
    } catch (err) {
      logger.error({ err }, 'Failed to create test video room')
      return errorResponse(
        ctx,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        err instanceof Error ? err.message : 'Failed to create video room',
        503
      )
    }
  }

  /**
   * @createRoom
   * @summary Create video room for a session (Therapist only)
   * @tag Sessions
   */
  async createRoom(ctx: HttpContext) {
    const therapist = ctx.auth.use('therapist').user!
    const session = await sessionService.findByIdAndTherapistId(
      Number(ctx.params.id),
      therapist.id
    )
    if (!session) {
      return errorResponse(ctx, ErrorCodes.NOT_FOUND, 'Session not found', 404)
    }
    if (session.status !== SessionStatus.SCHEDULED) {
      return errorResponse(
        ctx,
        ErrorCodes.BAD_REQUEST,
        'Only scheduled sessions can start a video room',
        400
      )
    }
    try {
      const videoSdk = new VideoSdkService()
      const { roomId, token } = await videoSdk.createRoom()
      await sessionService.updateMeetingId(session, roomId)
      logger.info({ sessionId: session.id, meetingId: roomId }, 'Video room created for session')
      return successResponse(ctx, { meetingId: roomId, token })
    } catch (err) {
      logger.error({ err, sessionId: session.id }, 'Failed to create video room')
      return errorResponse(
        ctx,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        err instanceof Error ? err.message : 'Failed to create video room',
        503
      )
    }
  }

  /**
   * @book
   * @summary Book a session with a therapist
   * @tag Sessions
   */
  async book(ctx: HttpContext) {
    const user = ctx.auth.use('api').user!
    const payload = await bookSessionValidator.validate(ctx.request.all())

    const scheduledAt = DateTime.fromISO(payload.scheduledAt)
    const durationMinutes = payload.durationMinutes ?? 50

    const result = await sessionService.create({
      userId: user.id,
      therapistId: payload.therapistId,
      scheduledAt,
      durationMinutes,
    })

    if ('error' in result) {
      if (result.error === 'THERAPIST_NOT_FOUND') {
        return errorResponse(ctx, ErrorCodes.NOT_FOUND, 'Therapist not found', 404)
      }
      return errorResponse(
        ctx,
        ErrorCodes.BAD_REQUEST,
        "The requested time is not within the therapist's availability. Please choose a time that falls within their available slots.",
        400
      )
    }

    const session = result.session
    return successResponse(
      ctx,
      {
        session: {
          id: session.id,
          userId: session.userId,
          therapistId: session.therapistId,
          availabilitySlotId: session.availabilitySlotId,
          scheduledAt: session.scheduledAt.toISO(),
          durationMinutes: session.durationMinutes,
          status: session.status,
        },
      },
      201
    )
  }

  /**
   * @index
   * @summary List sessions
   * @tag Sessions
   */
  async index(ctx: HttpContext) {
    const { page = defaultListParams.page, limit = defaultListParams.limit, status } =
      await sessionsListValidator.validate(ctx.request.qs())

    let result: { data: Session[]; total: number }
    if (ctx.auth.use('therapist').isAuthenticated) {
      const therapist = ctx.auth.use('therapist').user!
      result = await sessionService.listForTherapist(therapist.id, { page, limit, status })
    } else {
      const user = ctx.auth.use('api').user!
      result = await sessionService.listForUser(user.id, { page, limit, status })
    }

    return successResponse(ctx, {
      sessions: result.data.map(serializeSession),
      meta: { page, limit, total: result.total },
    })
  }

  /**
   * @submitSummary
   * @summary Submit session summary (Therapist only)
   * @tag Sessions
   */
  async submitSummary(ctx: HttpContext) {
    const therapist = ctx.auth.use('therapist').user!
    const session = await sessionService.findByIdAndTherapistId(
      Number(ctx.params.id),
      therapist.id
    )
    if (!session) {
      return errorResponse(ctx, ErrorCodes.NOT_FOUND, 'Session not found', 404)
    }

    const payload = await sessionSummaryValidator.validate(ctx.request.all())
    const updated = await sessionService.submitSummary(session, {
      sentiment: payload.sentiment,
      engagementLevel: payload.engagementLevel,
      clinicalNotes: payload.clinicalNotes,
      followUpAt: payload.followUpAt,
    })

    return successResponse(ctx, { session: serializeSession(updated) })
  }
}
