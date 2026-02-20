import NotificationType from '#models/notification_type'

export default class NotificationTypeRepository {
  async listAllWithCategory(): Promise<NotificationType[]> {
    return NotificationType.query().preload('category').orderBy('id', 'asc')
  }

  async findByIdWithCategory(id: number): Promise<NotificationType> {
    return NotificationType.query().where('id', id).preload('category').firstOrFail()
  }

  async findById(id: number): Promise<NotificationType> {
    return NotificationType.findOrFail(id)
  }

  async create(data: { categoryId: number; name: string; slug: string; description?: string | null }): Promise<NotificationType> {
    return NotificationType.create(data)
  }

  async update(type: NotificationType, data: Partial<NotificationType>): Promise<NotificationType> {
    type.merge(data)
    await type.save()
    return type
  }

  async delete(type: NotificationType): Promise<void> {
    await type.delete()
  }
}
