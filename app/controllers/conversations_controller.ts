import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { Readable } from 'node:stream'
import Conversation from '#models/conversation'
import Message from '#models/message'
import OpenAIService from '#services/openai_service'
import pusherService from '#services/pusher_service'
import {
  sendMessageValidator,
  getConversationHistoryValidator,
} from '#validators/conversation_validator'
import logger from '@adonisjs/core/services/logger'

export default class ConversationsController {
  private openaiService = new OpenAIService()

  /**
   * @sendMessage
   * @summary Send a message in a conversation
   * @tag Conversations
   * @description Send a text message and get AI response. Creates new conversation if conversationId is not provided.
   * Supports real-time streaming via Pusher on channel `conversation-{id}` with event `stream:chunk`.
   * @requestBody {"conversationId": 1, "message": "Hello", "mode": "text", "stream": true}
   * @responseBody 200 - {"conversation": {...}, "message": {...}, "response": {...}}
   * @responseBody 400 - {"message": "Validation error"}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async sendMessage({ request, response, auth }: HttpContext) {
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

      // Get or create conversation
      let conversation: Conversation
      if (payload.conversationId) {
        conversation = await Conversation.query()
          .where('id', payload.conversationId)
          .where('user_id', user.id)
          .firstOrFail()
      } else {
        conversation = await Conversation.create({
          userId: user.id,
          mode: (payload.mode as 'text' | 'voice') || 'text',
          title: null,
        })
      }

      const userMessage = await Message.create({
        conversationId: conversation.id,
        role: 'user',
        content: payload.message,
        metadata: null,
      })

      // Get conversation history for context
      const previousMessages = await Message.query()
        .where('conversation_id', conversation.id)
        .orderBy('created_at', 'asc')
        .limit(20)

      // Prepare messages for OpenAI
      const chatMessages = previousMessages.map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }))

      // Analyze sentiment and detect crisis (async)
      const sentimentPromise = this.openaiService.analyzeSentiment(payload.message)

      let aiResponse = ''
      if (stream) {
        // Broadcast start event via Pusher
        await pusherService.stream(conversation.id, 'start', {
          messageId: userMessage.id,
        })

        // Generate and stream response
        for await (const chunk of this.openaiService.generateStreamingResponse({
          messages: chatMessages,
          temperature: 0.7,
          maxTokens: 1000,
        })) {
          aiResponse += chunk
          await pusherService.stream(conversation.id, 'chunk', {
            content: chunk,
          })
        }
      } else {
        // Generate full response
        aiResponse = await this.openaiService.generateResponse({
          messages: chatMessages,
          temperature: 0.7,
          maxTokens: 1000,
        })
      }

      const sentimentAnalysis = await sentimentPromise

      // Save AI response
      const assistantMessage = await Message.create({
        conversationId: conversation.id,
        role: 'assistant',
        content: aiResponse,
        metadata: {
          sentiment: sentimentAnalysis.sentiment,
          crisisIndicators: sentimentAnalysis.crisisIndicators,
          confidence: sentimentAnalysis.confidence,
        },
      })

      // Broadcast complete event via Pusher if streaming
      if (stream) {
        await pusherService.stream(conversation.id, 'complete', {
          messageId: assistantMessage.id,
          conversationId: conversation.id,
        })
      }

      // Update conversation metadata and last message time
      conversation.lastMessageAt = DateTime.now()
      conversation.metadata = {
        ...(conversation.metadata || {}),
        lastSentiment: sentimentAnalysis.sentiment,
        hasCrisisIndicators: sentimentAnalysis.crisisIndicators.length > 0,
      }
      await conversation.save()

      // Update conversation title if it's the first message
      if (!conversation.title && previousMessages.length === 1) {
        const { getConversationTitlePrompt } = await import('../prompts/index.js')
        const titlePrompt = getConversationTitlePrompt(payload.message)
        try {
          const titleResponse = await this.openaiService.generateResponse({
            messages: [{ role: 'user', content: titlePrompt }],
            temperature: 0.5,
            maxTokens: 50,
          })
          conversation.title = titleResponse.trim().slice(0, 50)
          await conversation.save()
        } catch (error) {
          logger.warn('Failed to generate conversation title', { error })
        }
      }

      const processingTime = Date.now() - startTime
      logger.info('Chat message processed successfully', {
        userId: user.id,
        conversationId: conversation.id,
        messageId: userMessage.id,
        responseId: assistantMessage.id,
        processingTimeMs: processingTime,
        sentiment: sentimentAnalysis.sentiment,
        hasCrisisIndicators: sentimentAnalysis.crisisIndicators.length > 0,
      })

      return response.ok({
        conversation: {
          id: conversation.id,
          title: conversation.title,
          mode: conversation.mode,
          createdAt: conversation.createdAt,
        },
        message: {
          id: userMessage.id,
          role: userMessage.role,
          content: userMessage.content,
          createdAt: userMessage.createdAt,
        },
        response: {
          id: assistantMessage.id,
          role: assistantMessage.role,
          content: assistantMessage.content,
          metadata: assistantMessage.metadata,
          createdAt: assistantMessage.createdAt,
        },
        sentiment: sentimentAnalysis,
      })
    } catch (error) {
      const processingTime = Date.now() - startTime
      logger.error('Error sending message', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: auth.user?.id,
        processingTimeMs: processingTime,
      })

      // Broadcast error via Pusher if conversationId is known
      if (request.input('stream') === true && request.input('conversationId')) {
        await pusherService.stream(request.input('conversationId'), 'error', {
          message: error instanceof Error ? error.message : 'Failed to generate response',
        })
      }

      return response.internalServerError({
        message: 'Failed to process message',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * @getHistory
   * @summary Get conversation history
   * @tag Conversations
   * @description Get list of conversations with pagination
   * @queryParam page - Page number (default: 1)
   * @queryParam limit - Items per page (default: 20, max: 100)
   * @responseBody 200 - {"conversations": [...], "pagination": {...}}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async getHistory({ request, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const { page = 1, limit = 20 } = await getConversationHistoryValidator.validate(
        request.qs()
      )

      const conversations = await Conversation.query()
        .where('user_id', user.id)
        .orderBy('last_message_at', 'desc')
        .orderBy('created_at', 'desc')
        .paginate(page, limit)

      const conversationsWithMessages = await Promise.all(
        conversations.all().map(async (conv) => {
          const messages = await Message.query()
            .where('conversation_id', conv.id)
            .orderBy('created_at', 'asc')
            .limit(50)

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

      return response.ok({
        conversations: conversationsWithMessages,
        pagination: {
          page: conversations.currentPage,
          perPage: conversations.perPage,
          total: conversations.total,
          lastPage: conversations.lastPage,
        },
      })
    } catch (error) {
      logger.error('Error fetching conversation history', { error, userId: auth.user?.id })
      return response.internalServerError({
        message: 'Failed to fetch conversation history',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * @getConversation
   * @summary Get a specific conversation
   * @tag Conversations
   * @description Get a conversation with all its messages (with pagination)
   * @param conversationId - Conversation ID
   * @queryParam page - Page number for messages (default: 1)
   * @queryParam limit - Messages per page (default: 20, max: 100)
   * @responseBody 200 - {"conversation": {...}, "messages": [...], "pagination": {...}}
   * @responseBody 404 - {"message": "Conversation not found"}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async getConversation({ request, params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const conversationId = Number(params.id)
      const { page = 1, limit = 20 } = await getConversationHistoryValidator.validate(
        request.qs()
      )

      const conversation = await Conversation.query()
        .where('id', conversationId)
        .where('user_id', user.id)
        .firstOrFail()

      const messagesQuery = Message.query()
        .where('conversation_id', conversation.id)
        .orderBy('created_at', 'desc')

      const messages = await messagesQuery.paginate(page, limit)

      return response.ok({
        conversation: {
          id: conversation.id,
          title: conversation.title,
          mode: conversation.mode,
          metadata: conversation.metadata,
          lastMessageAt: conversation.lastMessageAt,
          createdAt: conversation.createdAt,
        },
        messages: messages.all().reverse().map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          metadata: msg.metadata,
          createdAt: msg.createdAt,
        })),
        pagination: {
          page: messages.currentPage,
          perPage: messages.perPage,
          total: messages.total,
          lastPage: messages.lastPage,
        },
      })
    } catch (error) {
      logger.error('Error fetching conversation', { error, conversationId: params.id })
      return response.notFound({
        message: 'Conversation not found',
      })
    }
  }

  /**
   * @deleteConversation
   * @summary Delete a conversation
   * @tag Conversations
   * @description Delete a conversation and all its messages
   * @param conversationId - Conversation ID
   * @responseBody 200 - {"message": "Conversation deleted successfully"}
   * @responseBody 404 - {"message": "Conversation not found"}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async deleteConversation({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const conversationId = Number(params.id)

      const conversation = await Conversation.query()
        .where('id', conversationId)
        .where('user_id', user.id)
        .firstOrFail()

      await conversation.delete()

      logger.info('Conversation deleted', { conversationId, userId: user.id })

      return response.ok({
        message: 'Conversation deleted successfully',
      })
    } catch (error) {
      logger.error('Error deleting conversation', { error, conversationId: params.id })
      return response.notFound({
        message: 'Conversation not found',
      })
    }
  }
}
