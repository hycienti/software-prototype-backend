import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import crypto from 'node:crypto'

const VIDEO_SDK_BASE = 'https://api.videosdk.live/v2'

/** JWT expiry for participant tokens (client joining a meeting) */
const PARTICIPANT_TOKEN_EXPIRY_HOURS = 2
const SERVER_TOKEN_EXPIRY_MINUTES = 120

/**
 * Encode to base64url (no padding, URL-safe).
 */
function base64urlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Sign a JWT with HS256 using Node crypto (no external JWT library).
 * Payload must include exp (expiration) as seconds since epoch.
 */
function signJwtHs256(payload: Record<string, unknown>, secret: string, expiryMinutes: number): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payloadWithExp = { ...payload, exp: now + expiryMinutes * 60 }
  const headerB64 = base64urlEncode(JSON.stringify(header))
  const payloadB64 = base64urlEncode(JSON.stringify(payloadWithExp))
  const message = `${headerB64}.${payloadB64}`
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(message)
  const signature = base64urlEncode(hmac.digest())
  return `${message}.${signature}`
}

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
  private generateServerToken(): string {
    const payload = {
      apikey: this.getApiKey(),
      permissions: ['allow_join', 'allow_mod'],
      version: 2,
      roles: ['crawler'],
    }
    return signJwtHs256(payload as Record<string, unknown>, this.getSecret(), SERVER_TOKEN_EXPIRY_MINUTES)
  }

  /**
   * Generate a JWT for a participant to join a specific room.
   * Role "rtc" = run Meeting/Room only, cannot use server-side APIs.
   * Scoped to roomId so the token is only valid for that room.
   */
  private generateParticipantToken(roomId: string): string {
    const payload = {
      apikey: this.getApiKey(),
      permissions: ['allow_join'],
      version: 2,
      roomId,
      roles: ['rtc'],
    }
    const expiryMinutes = PARTICIPANT_TOKEN_EXPIRY_HOURS * 60
    return signJwtHs256(payload as Record<string, unknown>, this.getSecret(), expiryMinutes)
  }

  /**
   * Create a new meeting room and return roomId plus a participant token.
   * Uses JWT generation when VIDEO_SDK_API_KEY and VIDEO_SDK_SECRET are set;
   * otherwise falls back to VIDEO_SDK_TOKEN (returns that same token to the client).
   */
  async createRoom(): Promise<{ roomId: string; token: string }> {
    let authToken: string

    if (this.useJwtGeneration()) {
      authToken = this.generateServerToken()
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
      const participantToken = this.generateParticipantToken(roomId)
      return { roomId, token: participantToken }
    }

    return { roomId, token: authToken }
  }
}
