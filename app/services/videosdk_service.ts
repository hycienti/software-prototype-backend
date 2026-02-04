import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { SignJWT } from 'jose'

const VIDEO_SDK_BASE = 'https://api.videosdk.live/v2'

/** JWT expiry for participant tokens (client joining a meeting) */
const PARTICIPANT_TOKEN_EXPIRY = '2h'

/**
 * VideoSDK service: create rooms and generate JWT tokens.
 * See https://docs.videosdk.live/api-reference/realtime-communication/intro
 *
 * Configure via VIDEO_SDK_API_KEY + VIDEO_SDK_SECRET (recommended) to generate
 * server and participant JWTs, or VIDEO_SDK_TOKEN for a single pre-generated token.
 */
export class VideoSdkService {
  private getApiKey(): string {
    const key = env.get('VIDEO_SDK_API_KEY')
    if (key) return key
    throw new Error('VIDEO_SDK_API_KEY is not set')
  }

  private getSecret(): string {
    const secret = env.get('VIDEO_SDK_SECRET')
    if (secret) return secret
    throw new Error('VIDEO_SDK_SECRET is not set')
  }

  /** Whether to use JWT generation (API_KEY + SECRET) vs legacy VIDEO_SDK_TOKEN */
  private useJwtGeneration(): boolean {
    return !!(env.get('VIDEO_SDK_API_KEY') && env.get('VIDEO_SDK_SECRET'))
  }

  /**
   * Generate a JWT for server-side v2 API calls (e.g. create room).
   * Role "crawler" = v2 API only, cannot run Meeting/Room.
   */
  private async generateServerToken(): Promise<string> {
    const secret = new TextEncoder().encode(this.getSecret())
    const payload = {
      apikey: this.getApiKey(),
      permissions: ['allow_join', 'allow_mod'] as string[],
      version: 2,
      roles: ['crawler'] as string[],
    }
    return await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('120m')
      .sign(secret)
  }

  /**
   * Generate a JWT for a participant to join a specific room.
   * Role "rtc" = run Meeting/Room only, cannot use server-side APIs.
   * Scoped to roomId so the token is only valid for that room.
   */
  private async generateParticipantToken(roomId: string): Promise<string> {
    const secret = new TextEncoder().encode(this.getSecret())
    const payload = {
      apikey: this.getApiKey(),
      permissions: ['allow_join'] as string[],
      version: 2,
      roomId,
      roles: ['rtc'] as string[],
    }
    return await new SignJWT(payload as Record<string, unknown>)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(PARTICIPANT_TOKEN_EXPIRY)
      .sign(secret)
  }

  /**
   * Create a new meeting room and return roomId plus a participant token.
   * Uses JWT generation when VIDEO_SDK_API_KEY and VIDEO_SDK_SECRET are set;
   * otherwise falls back to VIDEO_SDK_TOKEN (returns that same token to the client).
   */
  async createRoom(): Promise<{ roomId: string; token: string }> {
    let authToken: string

    if (this.useJwtGeneration()) {
      authToken = await this.generateServerToken()
    } else {
      const legacy = env.get('VIDEO_SDK_TOKEN')
      if (!legacy) {
        logger.warn('VideoSdkService.createRoom: neither (VIDEO_SDK_API_KEY+SECRET) nor VIDEO_SDK_TOKEN set')
        throw new Error('Video SDK is not configured. Set VIDEO_SDK_API_KEY and VIDEO_SDK_SECRET, or VIDEO_SDK_TOKEN.')
      }
      authToken = legacy
    }

    const res = await fetch(`${VIDEO_SDK_BASE}/rooms`, {
      method: 'POST',
      headers: {
        Authorization: authToken,
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
    const roomId = data.roomId

    if (this.useJwtGeneration()) {
      const participantToken = await this.generateParticipantToken(roomId)
      return { roomId, token: participantToken }
    }

    return { roomId, token: authToken }
  }
}
