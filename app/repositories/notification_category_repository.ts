import NotificationCategory from '#models/notification_category'

export default class NotificationCategoryRepository {
  async listAll(): Promise<NotificationCategory[]> {
    return NotificationCategory.query().orderBy('id', 'asc')
  }

  async findById(id: number): Promise<NotificationCategory> {
    return NotificationCategory.findOrFail(id)
  }

  async create(data: { name: string; slug: string }): Promise<NotificationCategory> {
    return NotificationCategory.create(data)
  }

  async update(cat: NotificationCategory, data: { name?: string; slug?: string }): Promise<NotificationCategory> {
    cat.merge(data)
    await cat.save()
    return cat
  }

  async delete(cat: NotificationCategory): Promise<void> {
    await cat.delete()
  }
}
