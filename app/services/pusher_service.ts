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
      logger.error('Error triggering Pusher event', { error, channel, event })
    }
  }

  /**
   * Broadcast a chat stream event
   */
  async stream(conversationId: number, event: 'start' | 'chunk' | 'complete' | 'error', data: any) {
    const channel = `conversation-${conversationId}`
    const pusherEvent = `stream:${event}`
    await this.trigger(channel, pusherEvent, data)
  }
}

export default new PusherService()
