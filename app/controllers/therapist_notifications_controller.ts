import type { HttpContext } from '@adonisjs/core/http'
import NotificationService from '#services/notification_service'
import { notificationsListValidator } from '#validators/list_validator'
import { defaultListParams } from '#validators/list_validator'
import { successResponse } from '#utils/response_helper'

const notificationService = new NotificationService()

export default class TherapistNotificationsController {
  async index(ctx: HttpContext) {
    const therapist = ctx.auth.use('therapist').user!
    const raw = await notificationsListValidator.validate(ctx.request.qs())
    const page = raw.page ?? defaultListParams.page
    const limit = raw.limit ?? defaultListParams.limit
    const isReadFilter =
      raw.isRead === undefined ? undefined : raw.isRead === 'true'

    const result = await notificationService.listByTherapistId(
      therapist.id,
      page,
      limit,
      { isRead: isReadFilter }
    )

    return successResponse(ctx, {
      notifications: result.data.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        isRead: n.isRead,
        data: n.data,
        createdAt: n.createdAt.toISO(),
      })),
      meta: { page, limit, total: result.total },
    })
  }

  async markAllAsRead(ctx: HttpContext) {
    const therapist = ctx.auth.use('therapist').user!
    await notificationService.markAllReadByTherapistId(therapist.id)
    return ctx.response.status(204).send(null)
  }

  async update(ctx: HttpContext) {
    const therapist = ctx.auth.use('therapist').user!
    const notification = await notificationService.findByIdAndTherapistId(
      Number(ctx.params.id),
      therapist.id
    )
    const updated = await notificationService.markRead(notification)
    return successResponse(ctx, updated)
  }

  async destroy(ctx: HttpContext) {
    const therapist = ctx.auth.use('therapist').user!
    await notificationService.deleteByIdAndTherapistId(Number(ctx.params.id), therapist.id)
    return ctx.response.status(204).send(null)
  }
}
