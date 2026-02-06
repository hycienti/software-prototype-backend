import type { HttpContext } from '@adonisjs/core/http'
import Notification from '#models/notification'

export default class NotificationsController {
  /**
   * @responseBody 200 - [{"id": 1, "title": "Notification", "message": "Message", "type": "info", "isRead": false, "createdAt": "2026-01-20T10:00:00.000Z"}]
   */
  async index({ auth, response }: HttpContext) {
    const user = auth.user!
    const notifications = await Notification.query()
      .where('userId', user.id)
      .orderBy('createdAt', 'desc')
      .limit(50)

    return response.ok(notifications)
  }

  /**
   * @responseBody 200 - {"id": 1, "title": "Notification", "message": "Message", "type": "info", "isRead": true}
   */
  async update({ auth, params, response }: HttpContext) {
    const user = auth.user!
    const notification = await Notification.query()
      .where('id', params.id)
      .where('userId', user.id)
      .firstOrFail()

    notification.isRead = true
    await notification.save()

    return response.ok(notification)
  }

  /**
   * @responseBody 204 - {}
   */
  async markAllAsRead({ auth, response }: HttpContext) {
    const user = auth.user!
    await Notification.query()
      .where('userId', user.id)
      .where('isRead', false)
      .update({ isRead: true })

    return response.noContent()
  }

  /**
   * @responseBody 204 - {}
   */
  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.user!
    const notification = await Notification.query()
      .where('id', params.id)
      .where('userId', user.id)
      .firstOrFail()

    await notification.delete()

    return response.noContent()
  }
}
