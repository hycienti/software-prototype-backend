import Pusher from 'pusher'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

class PusherService {
  private pusher: Pusher | null = null

  constructor() {
    const appId = env.get('PUSHER_APP_ID')
    const key = env.get('PUSHER_KEY')
    const secret = env.get('PUSHER_SECRET')
    const cluster = env.get('PUSHER_CLUSTER')

    if (appId && key && secret && cluster) {
      this.pusher = new Pusher({
        appId,
        key,
        secret,
        cluster,
        useTLS: env.get('PUSHER_USE_TLS') ?? true,
      })
    } else {
      logger.warn('Pusher credentials missing. Real-time features will be disabled.')
    }
  }

  async trigger(channel: string, event: string, data: any) {
    if (!this.pusher) {
      logger.debug(`Pusher disabled. Skipping event ${event} on channel ${channel}`)
      return
    }

    try {
      await this.pusher.trigger(channel, event, data)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      logger.error(`Error triggering Pusher event: ${message}`, {
        channel,
        event,
        stack,
      })
    }
  }


  async stream(
    conversationId: number,
    event: 'start' | 'chunk' | 'complete' | 'error' | 'typing',
    data: any
  ) {
    const channel = `conversation-${conversationId}`
    const pusherEvent = event === 'typing' ? 'typing' : `stream:${event}`
    await this.trigger(channel, pusherEvent, data)
  }

  /** Single event (use only when payload is small; voice result with audio exceeds 10KB). */
  async triggerVoiceResult(userId: number, data: Record<string, unknown>) {
    await this.trigger(`user-${userId}`, 'voice:result', data)
  }

  private static readonly TEXT_CHUNK_SIZE = 8_000
  private static readonly AUDIO_CHUNK_SIZE = 8_000

  /**
   * Send voice result in chunks to stay under Pusher's 10KB per-event limit.
   * Events: voice:result:start (metadata, no long content), voice:response:chunk (text),
   * voice:audio:chunk (base64), voice:result:complete.
   */
  async triggerVoiceResultChunked(
    userId: number,
    payload: {
      jobId: string
      conversationId: number
      transcript: string
      response: { id: number; content: string; metadata?: Record<string, unknown> }
      audioData: string
      audioFormat: string
      sentiment?: Record<string, unknown>
    }
  ): Promise<void> {
    const channel = `user-${userId}`
    const { TEXT_CHUNK_SIZE, AUDIO_CHUNK_SIZE } = PusherService

    await this.trigger(channel, 'voice:result:start', {
      jobId: payload.jobId,
      conversationId: payload.conversationId,
      transcript: payload.transcript,
      response: { id: payload.response.id, metadata: payload.response.metadata },
      audioFormat: payload.audioFormat,
      sentiment: payload.sentiment,
      totalResponseChunks: Math.ceil(payload.response.content.length / TEXT_CHUNK_SIZE),
      totalAudioChunks: Math.ceil(payload.audioData.length / AUDIO_CHUNK_SIZE),
    })

    for (let i = 0; i < payload.response.content.length; i += TEXT_CHUNK_SIZE) {
      const chunk = payload.response.content.slice(i, i + TEXT_CHUNK_SIZE)
      await this.trigger(channel, 'voice:response:chunk', {
        jobId: payload.jobId,
        index: Math.floor(i / TEXT_CHUNK_SIZE),
        chunk,
      })
    }

    for (let i = 0; i < payload.audioData.length; i += AUDIO_CHUNK_SIZE) {
      const chunk = payload.audioData.slice(i, i + AUDIO_CHUNK_SIZE)
      await this.trigger(channel, 'voice:audio:chunk', {
        jobId: payload.jobId,
        index: Math.floor(i / AUDIO_CHUNK_SIZE),
        chunk,
      })
    }

    await this.trigger(channel, 'voice:result:complete', { jobId: payload.jobId })
  }

  async triggerVoiceError(userId: number, data: { jobId: string; code: string; message: string }) {
    await this.trigger(`user-${userId}`, 'voice:error', data)
  }

  async triggerVoiceProgress(userId: number, data: { jobId: string; step: string }) {
    await this.trigger(`user-${userId}`, 'voice:progress', data)
  }
}

export default new PusherService()
