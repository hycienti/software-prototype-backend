import type { HttpContext } from '@adonisjs/core/http'
import NotificationService from '#services/notification_service'
import { successResponse } from '#utils/response_helper'

const notificationService = new NotificationService()

export default class NotificationsController {
  async index(ctx: HttpContext) {
    const user = ctx.auth.user!
    const notifications = await notificationService.listByUserId(user.id)
    return successResponse(ctx, notifications)
  }

  async update(ctx: HttpContext) {
    const user = ctx.auth.user!
    const notification = await notificationService.findByIdAndUserId(
      Number(ctx.params.id),
      user.id
    )
    const updated = await notificationService.markRead(notification)
    return successResponse(ctx, updated)
  }

  async markAllAsRead(ctx: HttpContext) {
    const user = ctx.auth.user!
    await notificationService.markAllReadByUserId(user.id)
    return ctx.response.status(204).send(null)
  }

  async destroy(ctx: HttpContext) {
    const user = ctx.auth.user!
    await notificationService.deleteByIdAndUserId(Number(ctx.params.id), user.id)
    return ctx.response.status(204).send(null)
  }
}
