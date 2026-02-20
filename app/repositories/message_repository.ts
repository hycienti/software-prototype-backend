import type { MessageRole } from '#models/message'
import Message from '#models/message'

export default class MessageRepository {
  async create(data: {
    conversationId: number
    role: MessageRole
    content: string
    metadata?: Record<string, unknown> | null
  }): Promise<Message> {
    return Message.create({
      conversationId: data.conversationId,
      role: data.role,
      content: data.content,
      metadata: (data.metadata ?? null) as Record<string, any> | null,
    })
  }

  async listByConversationIdOrdered(
    conversationId: number,
    limit: number = 20
  ): Promise<Message[]> {
    return Message.query()
      .where('conversation_id', conversationId)
      .orderBy('created_at', 'asc')
      .limit(limit)
  }

  async listByConversationIdPaginated(
    conversationId: number,
    page: number,
    limit: number
  ): Promise<{ data: Message[]; total: number; page: number; perPage: number; lastPage: number }> {
    const paginated = await Message.query()
      .where('conversation_id', conversationId)
      .orderBy('created_at', 'desc')
      .paginate(page, limit)
    return {
      data: paginated.all(),
      total: paginated.total,
      page: paginated.currentPage,
      perPage: paginated.perPage,
      lastPage: paginated.lastPage,
    }
  }

  async deleteByConversationId(conversationId: number): Promise<void> {
    await Message.query().where('conversation_id', conversationId).delete()
  }
}
