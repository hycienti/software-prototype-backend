import { DateTime } from 'luxon'
import type { ConversationMode } from '#models/conversation'
import Conversation from '#models/conversation'

export default class ConversationRepository {
  async findByIdAndUserId(id: number, userId: number): Promise<Conversation> {
    return Conversation.query().where('id', id).where('user_id', userId).firstOrFail()
  }

  async findByIdAndUserIdOrNull(id: number, userId: number): Promise<Conversation | null> {
    return Conversation.query().where('id', id).where('user_id', userId).first()
  }

  async create(data: {
    userId: number
    mode: ConversationMode
    title?: string | null
    metadata?: Record<string, unknown> | null
  }): Promise<Conversation> {
    return Conversation.create({
      userId: data.userId,
      mode: data.mode,
      title: data.title ?? null,
      metadata: data.metadata ?? null,
    })
  }

  async update(
    conversation: Conversation,
    payload: {
      title?: string | null
      lastMessageAt?: DateTime | null
      metadata?: Record<string, unknown> | null
    }
  ): Promise<Conversation> {
    if (payload.title !== undefined) conversation.title = payload.title
    if (payload.lastMessageAt !== undefined) conversation.lastMessageAt = payload.lastMessageAt
    if (payload.metadata !== undefined) conversation.metadata = payload.metadata as Record<string, any> | null
    await conversation.save()
    return conversation
  }

  async listByUserIdPaginated(
    userId: number,
    page: number,
    limit: number
  ): Promise<{
    data: Conversation[]
    total: number
    page: number
    perPage: number
    lastPage: number
  }> {
    const paginated = await Conversation.query()
      .where('user_id', userId)
      .orderBy('last_message_at', 'desc')
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

  async delete(conversation: Conversation): Promise<void> {
    await conversation.delete()
  }
}
