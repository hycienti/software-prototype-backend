import type { HttpContext } from '@adonisjs/core/http'
import Notification from '#models/notification'

/**
 * Notifications for therapist app. All operations filter by therapist_id.
 */
export default class TherapistNotificationsController {
  async index({ auth, response }: HttpContext) {
    const therapist = auth.use('therapist').user!
    const notifications = await Notification.query()
      .where('therapist_id', therapist.id)
      .orderBy('created_at', 'desc')
      .limit(50)

    return response.ok(notifications)
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
