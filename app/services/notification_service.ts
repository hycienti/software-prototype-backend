import Notification from '#models/notification'
import pusherService from '#services/pusher_service'

export class NotificationService {
  async notify(
    userId: number,
    payload: {
      title: string
      message: string
      type?: string
      data?: any
    }
  ) {
    const notification = await Notification.create({
      userId,
      title: payload.title,
      message: payload.message,
      type: payload.type || 'info',
      isRead: false,
      data: payload.data,
    })

    await pusherService.trigger(`user-${userId}`, 'notification:received', notification.toJSON())

    return notification
  }

  async markAllAsRead(userId: number) {
    await Notification.query()
      .where('userId', userId)
      .where('isRead', false)
      .update({ isRead: true })
  }
}

export default new NotificationService()
