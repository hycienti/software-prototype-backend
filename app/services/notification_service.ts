import type Notification from '#models/notification'
import NotificationRepository from '#repositories/notification_repository'

const notificationRepository = new NotificationRepository()

export default class NotificationService {
  async listByUserId(userId: number, limit?: number): Promise<Notification[]> {
    return notificationRepository.listByUserId(userId, limit ?? 50)
  }

  async findByIdAndUserId(id: number, userId: number): Promise<Notification> {
    return notificationRepository.findByIdAndUserId(id, userId)
  }

  async markRead(notification: Notification): Promise<Notification> {
    return notificationRepository.markRead(notification)
  }

  async markAllReadByUserId(userId: number): Promise<void> {
    return notificationRepository.markAllReadByUserId(userId)
  }

  async deleteByIdAndUserId(id: number, userId: number): Promise<void> {
    const notification = await notificationRepository.findByIdAndUserId(id, userId)
    await notificationRepository.delete(notification)
  }

  async listByTherapistId(
    therapistId: number,
    page: number,
    limit: number,
    options?: { isRead?: boolean }
  ): Promise<{ data: Notification[]; total: number }> {
    return notificationRepository.listByTherapistIdPaginated(
      therapistId,
      page,
      limit,
      options
    )
  }

  async findByIdAndTherapistId(id: number, therapistId: number): Promise<Notification> {
    return notificationRepository.findByIdAndTherapistId(id, therapistId)
  }

  async markAllReadByTherapistId(therapistId: number): Promise<void> {
    return notificationRepository.markAllReadByTherapistId(therapistId)
  }

  async deleteByIdAndTherapistId(id: number, therapistId: number): Promise<void> {
    const notification = await notificationRepository.findByIdAndTherapistId(id, therapistId)
    await notificationRepository.delete(notification)
  }
}
