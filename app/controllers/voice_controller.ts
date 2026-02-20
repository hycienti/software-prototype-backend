import type { HttpContext } from '@adonisjs/core/http'
import { randomUUID } from 'node:crypto'
import Conversation from '#models/conversation'
import Message from '#models/message'
import { runVoiceGraph } from '#orchestration/voice_graph'
import { successResponse, errorResponse, ErrorCodes } from '#utils/response_helper'
import { processVoiceMessageValidator, textToSpeechValidator } from '#validators/voice_validator'
import ElevenLabsService from '#services/elevenlabs_service'
import pusherService from '#services/pusher_service'
import logger from '@adonisjs/core/services/logger'

export default class VoiceController {
  private elevenlabsService = new ElevenLabsService()

  /**
   * @processVoiceMessage
   * @summary Process voice message (STT + AI + TTS)
   * @tag Voice
   * @description Convert speech to text, get AI response, and convert response to speech
   * @requestBody {"conversationId": 1, "audioData": "base64...", "audioFormat": "mp3"}
   * @responseBody 200 - {"success": true, "data": {"conversation": {...}, "transcript": "...", "response": {...}, "audioData": "..."}}
   * @responseBody 400 - {"success": false, "error": {"code": "BAD_REQUEST", "message": "..."}}
   * @responseBody 401 - {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Unauthorized"}}
   */
  async processVoiceMessage(ctx: HttpContext) {
    const { request, auth } = ctx
    const startTime = Date.now()
    try {
      const user = auth.user!
      const payload = await processVoiceMessageValidator.validate(request.all())
      const useAsync = payload.async === true

      logger.info('Processing voice message', {
        userId: user.id,
        conversationId: payload.conversationId,
        audioFormat: payload.audioFormat,
        audioSize: payload.audioData.length,
        async: useAsync,
      })

      if (useAsync) {
        const jobId = randomUUID()
        setImmediate(() => {
          this.runVoiceJob(user.id, jobId, {
            audioData: payload.audioData,
            audioFormat: payload.audioFormat ?? 'mp3',
            language: payload.language || 'en',
            conversationId: payload.conversationId ?? undefined,
          }).catch((err) => {
            logger.error('Voice job failed', { jobId, error: err })
          })
        })
        return successResponse(ctx, { jobId, status: 'processing' }, 202)
      }

      const result = await runVoiceGraph({
        userId: user.id,
        audioData: payload.audioData,
        audioFormat: payload.audioFormat ?? 'mp3',
        language: payload.language || 'en',
        conversationId: payload.conversationId ?? undefined,
      })

      const processingTime = Date.now() - startTime
      logger.info('Voice message processed successfully', {
        userId: user.id,
        conversationId: result.conversation.id,
        transcriptLength: result.transcript.length,
        responseLength: result.assistantMessage.content.length,
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
        transcript: result.transcript,
        response: {
          id: result.assistantMessage.id,
          content: result.assistantMessage.content,
          metadata: result.assistantMessage.metadata,
        },
        audioData: result.audioBase64,
        audioFormat: 'mp3',
        sentiment: result.sentiment,
      })
    } catch (error) {
      const processingTime = Date.now() - startTime
      logger.error('Error processing voice message', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: auth.user?.id,
        processingTimeMs: processingTime,
      })
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (message.includes('transcribe')) {
        return errorResponse(ctx, ErrorCodes.BAD_REQUEST, message, 400)
      }
      return errorResponse(
        ctx,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to process voice message',
        500,
        message
      )
    }
  }

  private async runVoiceJob(
    userId: number,
    jobId: string,
    payload: {
      audioData: string
      audioFormat: string
      language: string
      conversationId?: number
    }
  ): Promise<void> {
    try {
      await pusherService.triggerVoiceProgress(userId, { jobId, step: 'processing' })
      const result = await runVoiceGraph({
        userId,
        audioData: payload.audioData,
        audioFormat: payload.audioFormat,
        language: payload.language,
        conversationId: payload.conversationId,
      })
      await pusherService.triggerVoiceResult(userId, {
        jobId,
        conversationId: result.conversation.id,
        transcript: result.transcript,
        response: {
          id: result.assistantMessage.id,
          content: result.assistantMessage.content,
          metadata: result.assistantMessage.metadata,
        },
        audioData: result.audioBase64,
        audioFormat: 'mp3',
        sentiment: result.sentiment,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const code = message.includes('transcribe') ? ErrorCodes.BAD_REQUEST : ErrorCodes.INTERNAL_SERVER_ERROR
      await pusherService.triggerVoiceError(userId, { jobId, code, message })
    }
  }

  /**
   * @textToSpeech
   * @summary Convert text to speech
   * @tag Voice
   * @description Convert text to speech audio
   * @requestBody {"text": "Hello", "voiceId": "optional", "conversationId": 1}
   * @responseBody 200 - {"success": true, "data": {"audioData": "base64...", "audioFormat": "mp3"}}
   * @responseBody 400 - {"success": false, "error": {"code": "VALIDATION_ERROR", "message": "..."}}
   * @responseBody 401 - {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Unauthorized"}}
   */
  async textToSpeech(ctx: HttpContext) {
    const { request, auth } = ctx
    try {
      const user = auth.user!
      const payload = await textToSpeechValidator.validate(request.all())

      const audioBuffer = await this.elevenlabsService.textToSpeech({
        text: payload.text,
        voiceId: payload.voiceId,
        stability: 0.5,
        similarityBoost: 0.75,
      })

      const audioBase64 = audioBuffer.toString('base64')

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

      return successResponse(ctx, {
        audioData: audioBase64,
        audioFormat: 'mp3',
      })
    } catch (error) {
      logger.error('Error converting text to speech', { error, userId: auth.user?.id })
      return errorResponse(
        ctx,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to convert text to speech',
        500,
        error instanceof Error ? error.message : undefined
      )
    }
  }
}
