import type { HttpContext } from '@adonisjs/core/http'
import Notification from '#models/notification'
import { notificationsListValidator } from '#validators/list_validator'
import { defaultListParams } from '#validators/list_validator'

/**
 * Notifications for therapist app. All operations filter by therapist_id.
 * Query: page, limit, isRead (optional "true" | "false").
 */
export default class TherapistNotificationsController {
  async index({ auth, request, response }: HttpContext) {
    const therapist = auth.use('therapist').user!
    const raw = await notificationsListValidator.validate(request.qs())
    const page = raw.page ?? defaultListParams.page
    const limit = raw.limit ?? defaultListParams.limit
    const isReadFilter =
      raw.isRead === undefined ? undefined : raw.isRead === 'true' || raw.isRead === true

    let query = Notification.query()
      .where('therapist_id', therapist.id)
      .orderBy('created_at', 'desc')

    if (isReadFilter !== undefined) {
      query = query.where('is_read', isReadFilter)
    }

    const total = await query.clone().count('* as total').first()
    const totalCount = Number(total?.$extras?.total ?? 0)

    const notifications = await query.offset((page - 1) * limit).limit(limit)

    return response.ok({
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        isRead: n.isRead,
        data: n.data,
        createdAt: n.createdAt.toISO(),
      })),
      meta: { page, limit, total: totalCount },
    })
  }

  async markAllAsRead({ auth, response }: HttpContext) {
    const therapist = auth.use('therapist').user!
    await Notification.query()
      .where('therapist_id', therapist.id)
      .where('is_read', false)
      .update({ is_read: true })

    return response.noContent()
  }

  async update({ auth, params, response }: HttpContext) {
    const therapist = auth.use('therapist').user!
    const notification = await Notification.query()
      .where('id', params.id)
      .where('therapist_id', therapist.id)
      .firstOrFail()

    notification.isRead = true
    await notification.save()

    return response.ok(notification)
  }

  async destroy({ auth, params, response }: HttpContext) {
    const therapist = auth.use('therapist').user!
    const notification = await Notification.query()
      .where('id', params.id)
      .where('therapist_id', therapist.id)
      .firstOrFail()

    await notification.delete()
    return response.noContent()
  }
}
