import NotificationTemplate from '#models/notification_template'

export default class NotificationTemplateRepository {
  async listPaginated(
    page: number,
    limit: number,
    filters?: { notificationTypeId?: number; channelId?: number; productType?: string }
  ): Promise<{ data: NotificationTemplate[]; total: number }> {
    const q = NotificationTemplate.query()
    if (filters?.notificationTypeId) q.where('notification_type_id', filters.notificationTypeId)
    if (filters?.channelId) q.where('channel_id', filters.channelId)
    if (filters?.productType) q.where('product_type', filters.productType)
    const total = await q.clone().count('* as total').first()
    const data = await q
      .preload('notificationType')
      .preload('channel')
      .orderBy('id', 'asc')
      .offset((page - 1) * limit)
      .limit(limit)
    return { data, total: Number(total?.$extras?.total ?? 0) }
  }

  async findByIdWithRelations(id: number): Promise<NotificationTemplate> {
    return NotificationTemplate.query()
      .where('id', id)
      .preload('notificationType')
      .preload('channel')
      .firstOrFail()
  }

  async create(data: {
    notificationTypeId: number
    channelId: number
    productType: string
    locale: string
    subject?: string | null
    bodyHtml: string
    bodyText?: string | null
    templateVariables?: string[]
  }): Promise<NotificationTemplate> {
    return NotificationTemplate.create(data as any)
  }

  async update(template: NotificationTemplate, data: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
    template.merge(data)
    await template.save()
    return template
  }

  async delete(template: NotificationTemplate): Promise<void> {
    await template.delete()
  }
}
