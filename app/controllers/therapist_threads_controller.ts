import type { HttpContext } from '@adonisjs/core/http'
import TherapistThread from '#models/therapist_thread'
import TherapistThreadMessage from '#models/therapist_thread_message'
import Therapist from '#models/therapist'
import { sendTherapistThreadMessageValidator } from '#validators/therapist_thread_validator'
import { successResponse, errorResponse, ErrorCodes } from '#utils/response_helper'

/** Serialize therapist for thread list/detail (safe fields only) */
function serializeTherapist(t: Therapist) {
  return {
    id: t.id,
    fullName: t.fullName,
    professionalTitle: t.professionalTitle,
  }
}

function serializeMessage(m: TherapistThreadMessage) {
  return {
    id: m.id,
    threadId: m.threadId,
    senderType: m.senderType,
    body: m.body,
    createdAt: m.createdAt.toISO(),
  }
}

export default class TherapistThreadsController {
  /**
   * GET /therapist-threads — list threads for current user (with therapist + last message).
   * GET /therapist-threads?therapistId= — get or create thread with that therapist, return thread + messages (paginated).
   */
  async index(ctx: HttpContext) {
    const user = ctx.auth.use('api').user
    if (!user) {
      return errorResponse(ctx, ErrorCodes.UNAUTHORIZED, 'Authentication required', 401)
    }

    const therapistIdParam = ctx.request.input('therapistId')
    if (therapistIdParam != null && therapistIdParam !== '') {
      return this.getOrCreateByTherapistId(ctx, user.id, therapistIdParam)
    }

    const threads = await TherapistThread.query()
      .where('user_id', user.id)
      .preload('therapist')
      .preload('messages', (q) => q.orderBy('created_at', 'desc').limit(1))
      .orderBy('updated_at', 'desc')

    const list = threads.map((t) => {
      const lastMsg = t.messages[0]
      return {
        id: t.id,
        userId: t.userId,
        therapistId: t.therapistId,
        therapist: t.therapist ? serializeTherapist(t.therapist) : null,
        lastMessage: lastMsg ? serializeMessage(lastMsg) : null,
        createdAt: t.createdAt.toISO(),
        updatedAt: t.updatedAt.toISO(),
      }
    })

    return successResponse(ctx, { threads: list })
  }

  private async getOrCreateByTherapistId(ctx: HttpContext, userId: number, therapistIdParam: string) {
    const therapistId = Number(therapistIdParam)
    if (Number.isNaN(therapistId)) {
      return errorResponse(ctx, ErrorCodes.BAD_REQUEST, 'Invalid therapistId', 400)
    }
    let thread = await TherapistThread.query()
      .where('user_id', userId)
      .where('therapist_id', therapistId)
      .preload('therapist')
      .first()
    if (!thread) {
      const therapist = await Therapist.find(therapistId)
      if (!therapist) {
        return errorResponse(ctx, ErrorCodes.NOT_FOUND, 'Therapist not found', 404)
      }
      thread = await TherapistThread.create({ userId, therapistId })
      await thread.load('therapist')
    }
    const page = Math.max(1, Number(ctx.request.input('page', 1)))
    const limit = Math.min(50, Math.max(1, Number(ctx.request.input('limit', 20))))
    const messagesQuery = TherapistThreadMessage.query()
      .where('thread_id', thread.id)
      .orderBy('created_at', 'desc')
    const total = await messagesQuery.clone().count('* as total').first()
    const totalCount = Number(total?.$extras?.total ?? 0)
    const messages = await messagesQuery.offset((page - 1) * limit).limit(limit)
    return successResponse(ctx, {
      thread: {
        id: thread.id,
        userId: thread.userId,
        therapistId: thread.therapistId,
        therapist: thread.therapist ? serializeTherapist(thread.therapist) : null,
        createdAt: thread.createdAt.toISO(),
        updatedAt: thread.updatedAt.toISO(),
      },
      messages: messages.map(serializeMessage).reverse(),
      meta: { page, limit, total: totalCount },
    })
  }

  /**
   * GET /therapist-threads/:id — get thread by id, return messages (paginated)
   */
  async show(ctx: HttpContext) {
    const user = ctx.auth.use('api').user
    if (!user) {
      return errorResponse(ctx, ErrorCodes.UNAUTHORIZED, 'Authentication required', 401)
    }

    const id = Number(ctx.params.id)
    if (Number.isNaN(id)) {
      return errorResponse(ctx, ErrorCodes.BAD_REQUEST, 'Invalid thread id', 400)
    }

    const thread = await TherapistThread.query()
      .where('id', id)
      .where('user_id', user.id)
      .preload('therapist')
      .first()
    if (!thread) {
      return errorResponse(ctx, ErrorCodes.NOT_FOUND, 'Thread not found', 404)
    }

    const page = Math.max(1, Number(ctx.request.input('page', 1)))
    const limit = Math.min(50, Math.max(1, Number(ctx.request.input('limit', 20))))
    const messagesQuery = TherapistThreadMessage.query()
      .where('thread_id', thread.id)
      .orderBy('created_at', 'desc')
    const total = await messagesQuery.clone().count('* as total').first()
    const totalCount = Number(total?.$extras?.total ?? 0)
    const messages = await messagesQuery.offset((page - 1) * limit).limit(limit)

    return successResponse(ctx, {
      thread: {
        id: thread.id,
        userId: thread.userId,
        therapistId: thread.therapistId,
        therapist: thread.therapist ? serializeTherapist(thread.therapist) : null,
        createdAt: thread.createdAt.toISO(),
        updatedAt: thread.updatedAt.toISO(),
      },
      messages: messages.map(serializeMessage).reverse(),
      meta: { page, limit, total: totalCount },
    })
  }

  /**
   * POST /therapist-threads/:id/messages — send a message (user auth)
   */
  async createMessage(ctx: HttpContext) {
    const user = ctx.auth.use('api').user
    if (!user) {
      return errorResponse(ctx, ErrorCodes.UNAUTHORIZED, 'Authentication required', 401)
    }

    const id = Number(ctx.params.id)
    if (Number.isNaN(id)) {
      return errorResponse(ctx, ErrorCodes.BAD_REQUEST, 'Invalid thread id', 400)
    }

    const thread = await TherapistThread.query()
      .where('id', id)
      .where('user_id', user.id)
      .first()
    if (!thread) {
      return errorResponse(ctx, ErrorCodes.NOT_FOUND, 'Thread not found', 404)
    }

    const payload = await sendTherapistThreadMessageValidator.validate(ctx.request.all())
    const message = await TherapistThreadMessage.create({
      threadId: thread.id,
      senderType: 'user',
      body: payload.body,
    })

    return ctx.response.status(201).json({
      success: true,
      data: { message: serializeMessage(message) },
    })
  }
}
