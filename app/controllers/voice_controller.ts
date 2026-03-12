import type { HttpContext } from '@adonisjs/core/http'
import { randomUUID } from 'node:crypto'
import { runVoiceGraph } from '#orchestration/voice_graph'
import { successResponse, errorResponse, ErrorCodes } from '#utils/response_helper'
import { processVoiceMessageValidator } from '#validators/voice_validator'
import pusherService from '#services/pusher_service'
import logger from '@adonisjs/core/services/logger'

export default class VoiceController {
  /**
   * @processVoiceMessage
   * @summary Process voice message (STT + AI)
   * @tag Voice
   * @description Convert speech to text, get AI response. Client uses expo-speech for TTS.
   * @requestBody {"conversationId": 1, "audioData": "base64...", "audioFormat": "mp3"}
   * @responseBody 200 - {"success": true, "data": {"conversation": {...}, "transcript": "...", "response": {...}, "sentiment": {...}}}
   * @responseBody 400 - {"success": false, "error": {"code": "BAD_REQUEST", "message": "..."}}
   * @responseBody 401 - {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Unauthorized"}}
   */
  async processVoiceMessage(ctx: HttpContext) {
    const { request, auth } = ctx
    const startTime = Date.now()
    try {
      const user = auth.user!
      const payload = await processVoiceMessageValidator.validate(request.all())
      const hasAudio =
        payload.audioData != null && payload.audioData.length > 0
      const hasTranscript =
        payload.transcript != null && payload.transcript.trim().length > 0
      if (!hasAudio && !hasTranscript) {
        return errorResponse(
          ctx,
          ErrorCodes.VALIDATION_ERROR,
          'Either audioData or transcript must be provided',
          422
        )
      }
      const useAsync = payload.async === true

      logger.info('Processing voice message', {
        userId: user.id,
        conversationId: payload.conversationId,
        hasTranscript: !!payload.transcript,
        hasAudioData: !!payload.audioData,
        async: useAsync,
      })

      const graphInput = {
        userId: user.id,
        language: payload.language || 'en',
        conversationId: payload.conversationId ?? undefined,
        ...(payload.transcript != null && payload.transcript.trim().length > 0
          ? { transcript: payload.transcript.trim() }
          : {
              audioData: payload.audioData!,
              audioFormat: payload.audioFormat ?? 'mp3',
            }),
      }

      if (useAsync) {
        const jobId = randomUUID()
        setImmediate(() => {
          this.runVoiceJob(user.id, jobId, graphInput).catch((err) => {
            logger.error('Voice job failed', { jobId, error: err })
          })
        })
        return successResponse(ctx, { jobId, status: 'processing' }, 202)
      }

      const result = await runVoiceGraph(graphInput)

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
      userId: number
      transcript?: string
      audioData?: string
      audioFormat?: string
      language: string
      conversationId?: number
    }
  ): Promise<void> {
    try {
      await pusherService.triggerVoiceProgress(userId, { jobId, step: 'processing' })
      const result = await runVoiceGraph(payload)
      await pusherService.triggerVoiceResultChunked(userId, {
        jobId,
        conversationId: result.conversation.id,
        transcript: result.transcript,
        response: {
          id: result.assistantMessage.id,
          content: result.assistantMessage.content,
          metadata: result.assistantMessage.metadata ?? undefined,
        },
        audioFormat: 'mp3',
        sentiment: result.sentiment as unknown as Record<string, unknown>,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const code = message.includes('transcribe') ? ErrorCodes.BAD_REQUEST : ErrorCodes.INTERNAL_SERVER_ERROR
      await pusherService.triggerVoiceError(userId, { jobId, code, message })
    }
  }

}
