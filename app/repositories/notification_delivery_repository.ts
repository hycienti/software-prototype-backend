import NotificationDelivery from '#models/notification_delivery'

export default class NotificationDeliveryRepository {
  async listPaginated(
    page: number,
    limit: number,
    filters?: { status?: string; recipientType?: string; notificationTypeSlug?: string }
  ): Promise<{ data: NotificationDelivery[]; total: number }> {
    const q = NotificationDelivery.query()
    if (filters?.status) q.where('status', filters.status)
    if (filters?.recipientType) q.where('recipient_type', filters.recipientType)
    if (filters?.notificationTypeSlug) {
      q.whereHas('notificationType', (qb) => qb.where('slug', filters!.notificationTypeSlug!))
    }
    const total = await q.clone().count('* as total').first()
    const data = await q
      .preload('channel')
      .preload('notificationType')
      .orderBy('created_at', 'desc')
      .offset((page - 1) * limit)
      .limit(limit)
    return { data, total: Number(total?.$extras?.total ?? 0) }
  }
}
