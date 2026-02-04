import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

const VIDEO_SDK_BASE = 'https://api.videosdk.live/v2'

export class VideoSdkService {
  /**
   * Create a new meeting room. Returns roomId for use as meetingId.
   * Requires VIDEO_SDK_TOKEN in env.
   */
  async createRoom(): Promise<{ roomId: string; token: string }> {
    const token = env.get('VIDEO_SDK_TOKEN')
    if (!token) {
      logger.warn('VideoSdkService.createRoom called but VIDEO_SDK_TOKEN is not set')
      throw new Error('Video SDK is not configured')
    }

    const res = await fetch(`${VIDEO_SDK_BASE}/rooms`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    if (!res.ok) {
      const errText = await res.text()
      logger.error({ status: res.status, body: errText }, 'VideoSDK create room failed')
      throw new Error(errText || `Video SDK create room failed: ${res.status}`)
    }

    const data = (await res.json()) as { roomId: string }
    return { roomId: data.roomId, token }
  }
}
