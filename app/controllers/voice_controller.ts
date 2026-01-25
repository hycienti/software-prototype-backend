import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import zlib from 'node:zlib'
import { promisify } from 'node:util'
import Conversation from '#models/conversation'
import Message from '#models/message'
import OpenAIService from '#services/openai_service'
import ElevenLabsService from '#services/elevenlabs_service'
import { processVoiceMessageValidator, textToSpeechValidator } from '#validators/voice_validator'
import logger from '@adonisjs/core/services/logger'

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

export default class VoiceController {
  private openaiService = new OpenAIService()
  private elevenlabsService = new ElevenLabsService()

  /**
   * @processVoiceMessage
   * @summary Process voice message (STT + AI + TTS)
   * @tag Voice
   * @description Convert speech to text, get AI response, and convert response to speech
   * @requestBody {"conversationId": 1, "audioData": "base64...", "audioFormat": "mp3"}
   * @responseBody 200 - {"conversation": {...}, "transcript": "...", "response": "...", "audioUrl": "..."}
   * @responseBody 400 - {"message": "Validation error"}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async processVoiceMessage({ request, response, auth }: HttpContext) {
    const startTime = Date.now()
    try {
      const user = auth.user!
      const payload = await processVoiceMessageValidator.validate(request.all())

      logger.info('Processing voice message', {
        userId: user.id,
        conversationId: payload.conversationId,
        audioFormat: payload.audioFormat,
        audioSize: payload.audioData.length,
      })

      // Decode base64 audio
      let audioBuffer = Buffer.from(payload.audioData, 'base64')

      // Compress audio if it's large (optional optimization)
      const MAX_UNCOMPRESSED_SIZE = 1024 * 1024 // 1MB
      if (audioBuffer.length > MAX_UNCOMPRESSED_SIZE) {
        logger.info('Compressing large audio file', {
          originalSize: audioBuffer.length,
        })
        // Note: Audio compression should be done client-side for better performance
        // This is just a placeholder for server-side compression if needed
      }

      // Convert speech to text
      const transcript = await this.elevenlabsService.speechToText({
        audioData: audioBuffer,
        language: payload.language || 'en',
      })

      if (!transcript || transcript.trim().length === 0) {
        return response.badRequest({
          message: 'Could not transcribe audio. Please try again.',
        })
      }

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
          mode: 'voice',
          title: null,
        })
      }

      // Save user message (transcript)
      await Message.create({
        conversationId: conversation.id,
        role: 'user',
        content: transcript,
        metadata: {
          audioFormat: payload.audioFormat,
          isVoice: true,
        },
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

      // Analyze sentiment
      const sentimentAnalysis = await this.openaiService.analyzeSentiment(transcript)

      // Generate AI response
      const aiResponse = await this.openaiService.generateResponse({
        messages: chatMessages,
        temperature: 0.7,
        maxTokens: 500, // Shorter for voice
      })

      // Save AI response
      const assistantMessage = await Message.create({
        conversationId: conversation.id,
        role: 'assistant',
        content: aiResponse,
        metadata: {
          sentiment: sentimentAnalysis.sentiment,
          crisisIndicators: sentimentAnalysis.crisisIndicators,
          confidence: sentimentAnalysis.confidence,
          isVoice: true,
        },
      })

      // Convert AI response to speech
      const responseAudioBuffer = await this.elevenlabsService.textToSpeech({
        text: aiResponse,
        stability: 0.5,
        similarityBoost: 0.75,
      })

      // Convert audio buffer to base64 for response
      const audioBase64 = responseAudioBuffer.toString('base64')

      // Update conversation
      conversation.lastMessageAt = DateTime.now()
      conversation.metadata = {
        ...(conversation.metadata || {}),
        lastSentiment: sentimentAnalysis.sentiment,
        hasCrisisIndicators: sentimentAnalysis.crisisIndicators.length > 0,
      }
      await conversation.save()

      const processingTime = Date.now() - startTime
      logger.info('Voice message processed successfully', {
        userId: user.id,
        conversationId: conversation.id,
        transcriptLength: transcript.length,
        responseLength: aiResponse.length,
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
        transcript,
        response: {
          id: assistantMessage.id,
          content: assistantMessage.content,
          metadata: assistantMessage.metadata,
        },
        audioData: audioBase64,
        audioFormat: 'mp3',
        sentiment: sentimentAnalysis,
      })
    } catch (error) {
      const processingTime = Date.now() - startTime
      logger.error('Error processing voice message', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: auth.user?.id,
        processingTimeMs: processingTime,
      })
      return response.internalServerError({
        message: 'Failed to process voice message',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * @textToSpeech
   * @summary Convert text to speech
   * @tag Voice
   * @description Convert text to speech audio
   * @requestBody {"text": "Hello", "voiceId": "optional", "conversationId": 1}
   * @responseBody 200 - {"audioData": "base64...", "audioFormat": "mp3"}
   * @responseBody 400 - {"message": "Validation error"}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async textToSpeech({ request, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const payload = await textToSpeechValidator.validate(request.all())

      // Convert text to speech
      const audioBuffer = await this.elevenlabsService.textToSpeech({
        text: payload.text,
        voiceId: payload.voiceId,
        stability: 0.5,
        similarityBoost: 0.75,
      })

      // Convert to base64
      const audioBase64 = audioBuffer.toString('base64')

      // Optionally save to conversation if conversationId provided
      if (payload.conversationId) {
        const conversation = await Conversation.query()
          .where('id', payload.conversationId)
          .where('user_id', user.id)
          .firstOrFail()

        await Message.create({
          conversationId: conversation.id,
          role: 'assistant',
          content: payload.text,
          metadata: {
            isVoice: true,
            isTTS: true,
          },
        })
      }

      return response.ok({
        audioData: audioBase64,
        audioFormat: 'mp3',
      })
    } catch (error) {
      logger.error('Error converting text to speech', { error, userId: auth.user?.id })
      return response.internalServerError({
        message: 'Failed to convert text to speech',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}
