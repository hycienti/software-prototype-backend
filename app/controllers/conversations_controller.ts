import type { HttpContext } from '@adonisjs/core/http'
import ConversationService from '#services/conversation_service'
import pusherService from '#services/pusher_service'
import { streamProgressStore } from '#services/stream_progress_store'
import ConversationRepository from '#repositories/conversation_repository'
import MessageRepository from '#repositories/message_repository'
import { runChatGraph } from '#orchestration/chat_graph'
import { successResponse, errorResponse, ErrorCodes } from '#utils/response_helper'
import {
  sendMessageValidator,
  getConversationHistoryValidator,
  streamStatusValidator,
} from '#validators/conversation_validator'
import logger from '@adonisjs/core/services/logger'

const conversationService = new ConversationService()
const conversationRepository = new ConversationRepository()
const messageRepository = new MessageRepository()

export default class ConversationsController {
  /**
   * @sendMessage
   * @summary Send a message in a conversation
   * @tag Conversations
   * @description Send a text message and get AI response. Creates new conversation if conversationId is not provided.
   * Supports real-time streaming via Pusher on channel `conversation-{id}` with event `stream:chunk`.
   * @requestBody {"conversationId": 1, "message": "Hello", "mode": "text", "stream": true}
   * @responseBody 200 - {"success": true, "data": {"conversation": {...}, "message": {...}, "response": {...}}}
   * @responseBody 400 - {"success": false, "error": {"code": "...", "message": "..."}}
   * @responseBody 401 - {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Unauthorized"}}
   */
  async sendMessage(ctx: HttpContext) {
    const { request, auth } = ctx
    const startTime = Date.now()
    try {
      const user = auth.user!
      const payload = await sendMessageValidator.validate(request.all())
      const stream = request.input('stream') === true

      logger.info('Processing chat message', {
        userId: user.id,
        conversationId: payload.conversationId,
        messageLength: payload.message.length,
        mode: payload.mode || 'text',
        stream,
      })

      const mode = (payload.mode as 'text' | 'voice') || 'text'

      if (stream) {
        const conversation = payload.conversationId
          ? await conversationRepository.findByIdAndUserId(payload.conversationId, user.id)
          : await conversationRepository.create({ userId: user.id, mode, title: null })
        const userMessage = await messageRepository.create({
          conversationId: conversation.id,
          role: 'user',
          content: payload.message,
        })
        streamProgressStore.init(conversation.id, userMessage.id)
        await pusherService.stream(conversation.id, 'start', { messageId: userMessage.id })

        runChatGraph({
          userId: user.id,
          conversationId: conversation.id,
          conversation,
          userMessage,
          message: payload.message,
          stream: true,
          mode,
        }).catch((err) => {
          logger.error({ err, conversationId: conversation.id }, 'Chat graph (stream) failed')
          pusherService.stream(conversation.id, 'error', { message: err?.message ?? 'Stream failed' }).catch(() => {})
          streamProgressStore.setError(conversation.id, userMessage.id, err?.message ?? 'Stream failed')
        })

        return successResponse(ctx, { conversationId: conversation.id, userMessageId: userMessage.id, status: 'streaming' }, 202)
      }

      const result = await runChatGraph({
        userId: user.id,
        message: payload.message,
        stream: false,
        mode,
        conversationId: payload.conversationId ?? undefined,
      })

      const processingTime = Date.now() - startTime
      logger.info('Chat message processed successfully', {
        userId: user.id,
        conversationId: result.conversation.id,
        messageId: result.userMessage.id,
        responseId: result.assistantMessage.id,
        processingTimeMs: processingTime,
        sentiment: result.sentiment.sentiment,
        hasCrisisIndicators: result.sentiment.crisisIndicators.length > 0,
      })

      return successResponse(ctx, {
        conversation: {
          id: result.conversation.id,
          title: result.conversation.title,
          mode: result.conversation.mode,
          createdAt: result.conversation.createdAt,
        },
        message: {
          id: result.userMessage.id,
          role: result.userMessage.role,
          content: result.userMessage.content,
          createdAt: result.userMessage.createdAt,
        },
        response: {
          id: result.assistantMessage.id,
          role: result.assistantMessage.role,
          content: result.assistantMessage.content,
          metadata: result.assistantMessage.metadata,
          createdAt: result.assistantMessage.createdAt,
        },
        sentiment: result.sentiment,
      })
    } catch (error) {
      const processingTime = Date.now() - startTime
      logger.error('Error sending message', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: auth.user?.id,
        processingTimeMs: processingTime,
      })

      if (request.input('stream') === true && request.input('conversationId')) {
        await pusherService.stream(request.input('conversationId'), 'error', {
          message: error instanceof Error ? error.message : 'Failed to generate response',
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
        })
      }

      return errorResponse(
        ctx,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to process message',
        500,
        error instanceof Error ? error.message : undefined
      )
    }
  }

  /**
   * @getStreamStatus
   * @summary Get streaming progress (polling fallback)
   * @tag Conversations
   */
  async getStreamStatus(ctx: HttpContext) {
    const { request, auth } = ctx
    try {
      const user = auth.user!
      const { conversationId, userMessageId } = await streamStatusValidator.validate(request.qs())

      const conversation = await conversationService.findByIdAndUserIdOrNull(
        conversationId,
        user.id
      )
      if (!conversation) {
        return errorResponse(ctx, ErrorCodes.NOT_FOUND, 'Conversation not found', 404)
      }

      const { streamProgressStore } = await import('#services/stream_progress_store')
      const state = streamProgressStore.get(conversationId, userMessageId)
      if (!state) {
        return errorResponse(ctx, ErrorCodes.NOT_FOUND, 'Stream not found', 404)
      }

      return successResponse(ctx, {
        status: state.status,
        chunks: state.chunks,
        fullContent: state.fullContent,
        messageId: state.messageId,
        sentiment: state.sentiment,
        error: state.error,
      })
    } catch (error) {
      return errorResponse(
        ctx,
        ErrorCodes.BAD_REQUEST,
        error instanceof Error ? error.message : 'Invalid request',
        400
      )
    }
  }

  /**
   * @getHistory
   * @summary Get conversation history
   * @tag Conversations
   */
  async getHistory(ctx: HttpContext) {
    const { request, auth } = ctx
    try {
      const user = auth.user!
      const { page = 1, limit = 20 } = await getConversationHistoryValidator.validate(
        request.qs()
      )

      const result = await conversationService.listHistory(user.id, page, limit)

      return successResponse(ctx, {
        conversations: result.data,
        pagination: {
          page: result.page,
          perPage: result.perPage,
          total: result.total,
          lastPage: result.lastPage,
        },
      })
    } catch (error) {
      logger.error('Error fetching conversation history', { error, userId: auth.user?.id })
      return errorResponse(
        ctx,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to fetch conversation history',
        500,
        error instanceof Error ? error.message : undefined
      )
    }
  }

  /**
   * @getConversation
   * @summary Get a specific conversation
   * @tag Conversations
   */
  async getConversation(ctx: HttpContext) {
    const { request, params, auth } = ctx
    try {
      const user = auth.user!
      const conversationId = Number(params.id)
      const { page = 1, limit = 20 } = await getConversationHistoryValidator.validate(
        request.qs()
      )

      const result = await conversationService.getConversationWithMessages(
        conversationId,
        user.id,
        page,
        limit
      )

      return successResponse(ctx, {
        conversation: result.conversation,
        messages: result.messages,
        pagination: result.pagination,
      })
    } catch (error) {
      logger.error('Error fetching conversation', { error, conversationId: params.id })
      return errorResponse(ctx, ErrorCodes.NOT_FOUND, 'Conversation not found', 404)
    }
  }

  /**
   * @deleteConversation
   * @summary Delete a conversation
   * @tag Conversations
   */
  async deleteConversation(ctx: HttpContext) {
    const { params, auth } = ctx
    try {
      const user = auth.user!
      const conversationId = Number(params.id)

      await conversationService.deleteConversation(conversationId, user.id)

      logger.info('Conversation deleted', { conversationId, userId: user.id })
      return successResponse(ctx, { message: 'Conversation deleted successfully' })
    } catch (error) {
      logger.error('Error deleting conversation', { error, conversationId: params.id })
      return errorResponse(ctx, ErrorCodes.NOT_FOUND, 'Conversation not found', 404)
    }
  }

  /**
   * @typing
   * @summary Broadcast typing indicator
   * @tag Conversations
   */
  async typing(ctx: HttpContext) {
    const { request, auth } = ctx
    const { conversationId, isTyping } = request.all()
    const user = auth.user!

    await pusherService.stream(conversationId, 'typing', {
      userId: user.id,
      isTyping,
    })

    return successResponse(ctx, { success: true })
  }
}
