import type Conversation from '#models/conversation'
import ConversationRepository from '#repositories/conversation_repository'
import MessageRepository from '#repositories/message_repository'

const conversationRepository = new ConversationRepository()
const messageRepository = new MessageRepository()

export default class ConversationService {
  async findByIdAndUserId(id: number, userId: number): Promise<Conversation> {
    return conversationRepository.findByIdAndUserId(id, userId)
  }

  async findByIdAndUserIdOrNull(id: number, userId: number): Promise<Conversation | null> {
    return conversationRepository.findByIdAndUserIdOrNull(id, userId)
  }

  async listHistory(
    userId: number,
    page: number,
    limit: number
  ): Promise<{
    data: Array<{
      id: number
      title: string | null
      mode: string
      messageCount: number
      lastMessageAt: Conversation['lastMessageAt']
      createdAt: Conversation['createdAt']
      messages: Array<{ id: number; role: string; content: string; createdAt: import('luxon').DateTime }>
    }>
    total: number
    page: number
    perPage: number
    lastPage: number
  }> {
    const paginated = await conversationRepository.listByUserIdPaginated(userId, page, limit)
    const conversationsWithMessages = await Promise.all(
      paginated.data.map(async (conv) => {
        const messages = await messageRepository.listByConversationIdOrdered(conv.id, 50)
        return {
          id: conv.id,
          title: conv.title,
          mode: conv.mode,
          messageCount: messages.length,
          lastMessageAt: conv.lastMessageAt,
          createdAt: conv.createdAt,
          messages: messages.map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt,
          })),
        }
      })
    )
    return {
      data: conversationsWithMessages,
      total: paginated.total,
      page: paginated.page,
      perPage: paginated.perPage,
      lastPage: paginated.lastPage,
    }
  }

  async getConversationWithMessages(
    conversationId: number,
    userId: number,
    page: number,
    limit: number
  ): Promise<{
    conversation: {
      id: number
      title: string | null
      mode: string
      metadata: Conversation['metadata']
      lastMessageAt: Conversation['lastMessageAt']
      createdAt: Conversation['createdAt']
    }
    messages: Array<{
      id: number
      role: string
      content: string
      metadata: unknown
      createdAt: import('luxon').DateTime
    }>
    pagination: { page: number; perPage: number; total: number; lastPage: number }
  }> {
    const conversation = await conversationRepository.findByIdAndUserId(conversationId, userId)
    const messagesPaginated = await messageRepository.listByConversationIdPaginated(
      conversation.id,
      page,
      limit
    )
    const messagesReversed = messagesPaginated.data.reverse()
    return {
      conversation: {
        id: conversation.id,
        title: conversation.title,
        mode: conversation.mode,
        metadata: conversation.metadata,
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
      },
      messages: messagesReversed.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata,
        createdAt: msg.createdAt,
      })),
      pagination: {
        page: messagesPaginated.page,
        perPage: messagesPaginated.perPage,
        total: messagesPaginated.total,
        lastPage: messagesPaginated.lastPage,
      },
    }
  }

  async deleteConversation(conversationId: number, userId: number): Promise<void> {
    const conversation = await conversationRepository.findByIdAndUserId(conversationId, userId)
    await messageRepository.deleteByConversationId(conversation.id)
    await conversationRepository.delete(conversation)
  }
}
