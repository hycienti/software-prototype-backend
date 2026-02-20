import Notification from '#models/notification'

export default class NotificationRepository {
  async listByUserId(userId: number, limit: number = 50): Promise<Notification[]> {
    return Notification.query()
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
  }

  async findByIdAndUserId(id: number, userId: number): Promise<Notification> {
    return Notification.query()
      .where('id', id)
      .where('user_id', userId)
      .firstOrFail()
  }

  async markRead(notification: Notification): Promise<Notification> {
    notification.isRead = true
    await notification.save()
    return notification
  }

  async markAllReadByUserId(userId: number): Promise<void> {
    await Notification.query()
      .where('user_id', userId)
      .where('is_read', false)
      .update({ is_read: true })
  }

  async delete(notification: Notification): Promise<void> {
    await notification.delete()
  }

  async listByTherapistIdPaginated(
    therapistId: number,
    page: number,
    limit: number,
    options?: { isRead?: boolean }
  ): Promise<{ data: Notification[]; total: number }> {
    const q = Notification.query().where('therapist_id', therapistId)
    if (options?.isRead !== undefined) {
      q.where('is_read', options.isRead)
    }
    const total = await q.clone().count('* as total').first()
    const totalCount = Number(total?.$extras?.total ?? 0)
    const data = await q
      .orderBy('created_at', 'desc')
      .offset((page - 1) * limit)
      .limit(limit)
    return { data, total: totalCount }
  }

  async findByIdAndTherapistId(id: number, therapistId: number): Promise<Notification> {
    return Notification.query()
      .where('id', id)
      .where('therapist_id', therapistId)
      .firstOrFail()
  }

  async markAllReadByTherapistId(therapistId: number): Promise<void> {
    await Notification.query()
      .where('therapist_id', therapistId)
      .where('is_read', false)
      .update({ is_read: true })
  }
}
