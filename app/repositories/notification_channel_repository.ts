import NotificationChannel from '#models/notification_channel'

export default class NotificationChannelRepository {
  async listAll(): Promise<NotificationChannel[]> {
    return NotificationChannel.query().orderBy('id', 'asc')
  }

  async findById(id: number): Promise<NotificationChannel> {
    return NotificationChannel.findOrFail(id)
  }

  async create(data: { name: string; slug: string }): Promise<NotificationChannel> {
    return NotificationChannel.create(data)
  }

  async update(channel: NotificationChannel, data: { name?: string; slug?: string }): Promise<NotificationChannel> {
    channel.merge(data)
    await channel.save()
    return channel
  }

  async delete(channel: NotificationChannel): Promise<void> {
    await channel.delete()
  }
}
