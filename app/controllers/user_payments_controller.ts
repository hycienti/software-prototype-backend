import type { HttpContext } from '@adonisjs/core/http'
import UserPayment from '#models/user_payment'
import SessionService from '#services/session_service'
import { createPaymentValidator } from '#validators/payment_validator'
import { paginationValidator, defaultListParams, DEFAULT_LIMIT, MAX_LIMIT } from '#validators/list_validator'
import { DateTime } from 'luxon'
import { successResponse, errorResponse, ErrorCodes } from '#utils/response_helper'

const sessionService = new SessionService()

function serializePayment(p: UserPayment, options?: { includeTherapist?: boolean }) {
  const out: Record<string, unknown> = {
    id: p.id,
    userId: p.userId,
    amountCents: p.amountCents,
    currency: p.currency,
    status: p.status,
    sessionId: p.sessionId,
    therapistId: p.therapistId,
    createdAt: p.createdAt.toISO(),
    updatedAt: p.updatedAt?.toISO() ?? null,
  }
  if (options?.includeTherapist && p.therapist) {
    out.therapist = {
      id: p.therapist.id,
      fullName: p.therapist.fullName,
      professionalTitle: p.therapist.professionalTitle,
    }
  }
  return out
}

export default class UserPaymentsController {
  /**
   * POST /api/v1/payments — mock payment + book session (user auth).
   * Creates payment record with status completed and creates the session.
   * If session booking fails (e.g. no slot), returns 400 and does not create payment.
   */
  async store(ctx: HttpContext) {
    const user = ctx.auth.use('api').user!
    const payload = await createPaymentValidator.validate(ctx.request.all())

    const scheduledAt = DateTime.fromISO(payload.scheduledAt)
    const durationMinutes = payload.durationMinutes ?? 50
    const currency = payload.currency ?? 'USD'

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
    const payment = await UserPayment.create({
      userId: user.id,
      amountCents: payload.amountCents,
      currency,
      status: 'completed',
      sessionId: session.id,
      therapistId: payload.therapistId,
    })

    return successResponse(
      ctx,
      {
        payment: serializePayment(payment),
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
   * GET /api/v1/payments — list current user's payments (paginated).
   */
  async index(ctx: HttpContext) {
    const user = ctx.auth.use('api').user!
    const validated = await paginationValidator.validate(ctx.request.qs())
    const page = validated.page ?? defaultListParams.page
    const limit = Math.min(validated.limit ?? DEFAULT_LIMIT, MAX_LIMIT)

    const q = UserPayment.query()
      .where('user_id', user.id)
      .orderBy('created_at', 'desc')
      .preload('therapist', (t) => t.select('id', 'full_name', 'professional_title'))

    const total = await q.clone().count('* as total').first()
    const totalCount = Number(total?.$extras?.total ?? 0)
    const payments = await q.offset((page - 1) * limit).limit(limit)

    return successResponse(ctx, {
      payments: payments.map((p) => serializePayment(p, { includeTherapist: true })),
      meta: { page, limit, total: totalCount },
    })
  }
}
