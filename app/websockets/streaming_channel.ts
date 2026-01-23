// @ts-ignore - WsContext is available from the websocket package
import WsContext from '@adonisjs/websocket/src/Context'
import logger from '@adonisjs/core/services/logger'
import OpenAIService from '#services/openai_service'
import Conversation from '#models/conversation'
import Message from '#models/message'
import { DateTime } from 'luxon'
import { websocketAuth } from '#middleware/websocket_auth'

interface StreamMessagePayload {
  conversationId?: number
  message: string
}

export class StreamingChannel {
  private openaiService = new OpenAIService()

  /**
   * Handle incoming WebSocket connection
   */
  async onConnect(ctx: WsContext) {
    // Authenticate connection
    const authenticated = await websocketAuth(ctx)
    if (!authenticated) {
      return
    }

    logger.info('WebSocket client connected', {
      socketId: ctx.socket.id,
      userId: ctx.socket.data.userId,
    })
  }

  /**
   * Handle WebSocket disconnection
   */
  async onDisconnect(ctx: WsContext) {
    logger.info('WebSocket client disconnected', { socketId: ctx.socket.id })
  }

  /**
   * Handle stream message request
   * AdonisJS WebSocket routes events by method name matching the event
   * The client sends: { event: 'message', data: {...} }
   * AdonisJS will call onMessage() method
   * 
   * Alternative: Client can also send raw message and we handle it here
   */
  async onMessage(ctx: WsContext, payload: any) {
    logger.info('WebSocket onMessage received', {
      socketId: ctx.socket.id,
      payloadType: typeof payload,
      payloadKeys: payload ? Object.keys(payload) : [],
      payloadString: typeof payload === 'string' 
        ? payload.substring(0, 200) 
        : JSON.stringify(payload).substring(0, 200),
    })

    // Handle string payload (raw JSON string)
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload)
      } catch (error) {
        logger.error('Failed to parse string payload as JSON', { error, payload })
        ctx.socket.emit('stream:error', { message: 'Invalid message format' })
        return
      }
    }

    // Handle both direct payload and wrapped event format
    // AdonisJS may pass the payload directly or wrapped
    let messagePayload: StreamMessagePayload
    
    if (payload && payload.data) {
      // Wrapped format: { event: 'message', data: {...} }
      messagePayload = payload.data
    } else if (payload && (payload.conversationId !== undefined || payload.message)) {
      // Direct format: { conversationId, message }
      messagePayload = payload
    } else {
      // Try to extract from any nested structure
      messagePayload = payload as StreamMessagePayload
    }

    const startTime = Date.now()
    const { conversationId, message } = messagePayload
    const userId = ctx.socket.data.userId

    logger.info('WebSocket message parsed', {
      userId,
      conversationId,
      hasMessage: !!message,
      messageLength: message?.length || 0,
      socketId: ctx.socket.id,
    })

    if (!userId) {
      logger.warn('WebSocket message rejected: No userId', { socketId: ctx.socket.id })
      ctx.socket.emit('stream:error', { message: 'Unauthorized' })
      return
    }

    try {
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        logger.warn('WebSocket message rejected: Invalid message', {
          message: message?.substring(0, 50),
          socketId: ctx.socket.id,
        })
        ctx.socket.emit('stream:error', { message: 'Message is required' })
        return
      }

      logger.info('Starting WebSocket stream message', {
        userId,
        conversationId,
        messageLength: message.length,
        socketId: ctx.socket.id,
      })

      // Get or create conversation
      let conversation: Conversation
      if (conversationId) {
        conversation = await Conversation.query()
          .where('id', conversationId)
          .where('user_id', userId)
          .firstOrFail()
      } else {
        conversation = await Conversation.create({
          userId,
          mode: 'text',
          title: null,
        })
      }

      // Save user message
      const userMessage = await Message.create({
        conversationId: conversation.id,
        role: 'user',
        content: message,
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

      // Send start event
      logger.debug('Emitting stream:start event', {
        conversationId: conversation.id,
        messageId: userMessage.id,
        socketId: ctx.socket.id,
      })
      ctx.socket.emit('stream:start', {
        conversationId: conversation.id,
        messageId: userMessage.id,
      })

      // Stream AI response
      let fullResponse = ''
      let chunkCount = 0
      logger.debug('Starting OpenAI streaming', { socketId: ctx.socket.id })
      
      for await (const chunk of this.openaiService.generateStreamingResponse({
        messages: chatMessages,
        temperature: 0.7,
        maxTokens: 1000,
      })) {
        fullResponse += chunk
        chunkCount++
        
        // Send chunk to client in real-time
        ctx.socket.emit('stream:chunk', {
          content: chunk,
        })
        
        // Log every 10 chunks to avoid spam
        if (chunkCount % 10 === 0) {
          logger.debug('Streaming chunks', {
            chunkCount,
            totalLength: fullResponse.length,
            socketId: ctx.socket.id,
          })
        }
      }
      
      logger.info('OpenAI streaming completed', {
        chunkCount,
        totalLength: fullResponse.length,
        socketId: ctx.socket.id,
      })

      // Analyze sentiment
      const sentimentAnalysis = await this.openaiService.analyzeSentiment(message)

      // Save AI response
      const assistantMessage = await Message.create({
        conversationId: conversation.id,
        role: 'assistant',
        content: fullResponse,
        metadata: {
          sentiment: sentimentAnalysis.sentiment,
          crisisIndicators: sentimentAnalysis.crisisIndicators,
          confidence: sentimentAnalysis.confidence,
        },
      })

      // Update conversation
      conversation.lastMessageAt = DateTime.now()
      conversation.metadata = {
        ...(conversation.metadata || {}),
        lastSentiment: sentimentAnalysis.sentiment,
        hasCrisisIndicators: sentimentAnalysis.crisisIndicators.length > 0,
      }
      await conversation.save()

      // Send completion event
      logger.debug('Emitting stream:complete event', {
        messageId: assistantMessage.id,
        socketId: ctx.socket.id,
      })
      ctx.socket.emit('stream:complete', {
        messageId: assistantMessage.id,
        sentiment: sentimentAnalysis,
      })

      const processingTime = Date.now() - startTime
      logger.info('WebSocket stream message completed', {
        userId,
        conversationId: conversation.id,
        processingTimeMs: processingTime,
        responseLength: fullResponse.length,
        socketId: ctx.socket.id,
      })
    } catch (error) {
      const processingTime = Date.now() - startTime
      logger.error('Error in WebSocket stream message', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        processingTimeMs: processingTime,
        socketId: ctx.socket.id,
      })
      ctx.socket.emit('stream:error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}
