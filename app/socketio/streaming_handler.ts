import type { Server as SocketIOServer } from 'socket.io'
import type { Socket } from 'socket.io'
import logger from '@adonisjs/core/services/logger'
import OpenAIService from '#services/openai_service'
import Conversation from '#models/conversation'
import Message from '#models/message'
import { DateTime } from 'luxon'
import { authenticateSocket } from '#middleware/socketio_auth'

interface StreamMessagePayload {
  conversationId?: number
  message: string
}

/**
 * Setup Socket.IO event handlers for streaming
 */
export function setupSocketIOHandlers(io: SocketIOServer): void {
  // Namespace for streaming
  const streamingNamespace = io.of('/streaming')

  // Authentication middleware for the namespace
  streamingNamespace.use(async (socket: Socket, next) => {
    try {
      const authenticated = await authenticateSocket(socket)
      if (authenticated) {
        next()
      } else {
        next(new Error('Authentication failed'))
      }
    } catch (error) {
      logger.error('Socket.IO authentication error', {
        error: error instanceof Error ? error.message : String(error),
        socketId: socket.id,
      })
      next(new Error('Authentication error'))
    }
  })

  // Handle connection
  streamingNamespace.on('connection', (socket: Socket) => {
    const userId = (socket.data as any).userId
    logger.info('Socket.IO client connected', {
      socketId: socket.id,
      userId,
    })

    // Handle stream message request
    socket.on('message', async (payload: StreamMessagePayload) => {
      await handleStreamMessage(socket, payload)
    })

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info('Socket.IO client disconnected', {
        socketId: socket.id,
        userId,
        reason,
      })
    })

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket.IO error', {
        socketId: socket.id,
        userId,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  })
}

/**
 * Handle stream message request
 */
async function handleStreamMessage(socket: Socket, payload: StreamMessagePayload): Promise<void> {
  const startTime = Date.now()
  const userId = (socket.data as any).userId
  const { conversationId, message } = payload

  if (!userId) {
    socket.emit('stream:error', { message: 'Unauthorized' })
    return
  }

  try {
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      socket.emit('stream:error', { message: 'Message is required' })
      return
    }

    logger.info('Starting Socket.IO stream message', {
      userId,
      conversationId,
      messageLength: message.length,
      socketId: socket.id,
    })

    const openaiService = new OpenAIService()

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
    socket.emit('stream:start', {
      conversationId: conversation.id,
      messageId: userMessage.id,
    })

    // Stream AI response
    let fullResponse = ''
    let chunkCount = 0

    for await (const chunk of openaiService.generateStreamingResponse({
      messages: chatMessages,
      temperature: 0.7,
      maxTokens: 1000,
    })) {
      fullResponse += chunk
      chunkCount++

      // Send chunk to client in real-time
      socket.emit('stream:chunk', {
        content: chunk,
      })

      // Log every 10 chunks to avoid spam
      if (chunkCount % 10 === 0) {
        logger.debug('Streaming chunks', {
          chunkCount,
          totalLength: fullResponse.length,
          socketId: socket.id,
        })
      }
    }

    logger.info('OpenAI streaming completed', {
      chunkCount,
      totalLength: fullResponse.length,
      socketId: socket.id,
    })

    // Analyze sentiment
    const sentimentAnalysis = await openaiService.analyzeSentiment(message)

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
    socket.emit('stream:complete', {
      messageId: assistantMessage.id,
      sentiment: sentimentAnalysis,
    })

    const processingTime = Date.now() - startTime
    logger.info('Socket.IO stream message completed', {
      userId,
      conversationId: conversation.id,
      processingTimeMs: processingTime,
      responseLength: fullResponse.length,
      socketId: socket.id,
    })
  } catch (error) {
    const processingTime = Date.now() - startTime
    logger.error('Error in Socket.IO stream message', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      processingTimeMs: processingTime,
      socketId: socket.id,
    })
    socket.emit('stream:error', {
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
