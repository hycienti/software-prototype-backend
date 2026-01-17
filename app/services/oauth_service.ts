import env from '#start/env'
import User, { type OAuthProvider } from '#models/user'
import { DateTime } from 'luxon'
import jwt from 'jsonwebtoken'

interface GoogleTokenPayload {
  sub: string
  email: string
  email_verified: boolean
  name?: string
  picture?: string
  aud?: string
}

interface AppleTokenPayload {
  sub: string
  email?: string
  email_verified?: boolean | string
}

interface AppleKeysResponse {
  keys: Array<{ kid: string; kty: string; n: string; e: string }>
}

interface OAuthUserData {
  providerId: string
  email: string
  emailVerified: boolean
  fullName: string | null
  avatarUrl: string | null
}

export default class OAuthService {
  async verifyGoogleToken(idToken: string): Promise<OAuthUserData> {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    )

    if (!response.ok) {
      throw new Error('Invalid Google token')
    }

    const payload = (await response.json()) as GoogleTokenPayload

    if (payload.aud !== env.get('GOOGLE_CLIENT_ID')) {
      throw new Error('Invalid Google client ID')
    }

    return {
      providerId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified,
      fullName: payload.name || null,
      avatarUrl: payload.picture || null,
    }
  }

  async verifyAppleToken(idToken: string): Promise<OAuthUserData> {
    const appleKeysResponse = await fetch('https://appleid.apple.com/auth/keys')
    const appleKeys = (await appleKeysResponse.json()) as AppleKeysResponse

    const decodedHeader = jwt.decode(idToken, { complete: true })
    if (!decodedHeader) {
      throw new Error('Invalid Apple token')
    }

    const key = appleKeys.keys.find((k) => k.kid === decodedHeader.header.kid)
    if (!key) {
      throw new Error('Apple signing key not found')
    }

    const publicKey = await this.jwkToPem(key)
    const payload = jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      issuer: 'https://appleid.apple.com',
      audience: env.get('APPLE_CLIENT_ID'),
    }) as AppleTokenPayload

    return {
      providerId: payload.sub,
      email: payload.email || '',
      emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      fullName: null,
      avatarUrl: null,
    }
  }

  private async jwkToPem(jwk: {
    kty: string
    n: string
    e: string
  }): Promise<string> {
    const keyData = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      true,
      ['verify']
    )
    const exported = await crypto.subtle.exportKey('spki', keyData)
    const base64 = Buffer.from(exported).toString('base64')
    return `-----BEGIN PUBLIC KEY-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`
  }

  async findOrCreateUser(
    provider: OAuthProvider,
    userData: OAuthUserData
  ): Promise<User> {
    let user = await User.query()
      .where('oauth_provider', provider)
      .where('oauth_provider_id', userData.providerId)
      .first()

    if (user) {
      user.lastLoginAt = DateTime.now()
      if (userData.fullName && !user.fullName) {
        user.fullName = userData.fullName
      }
      if (userData.avatarUrl) {
        user.avatarUrl = userData.avatarUrl
      }
      await user.save()
      return user
    }

    user = await User.create({
      email: userData.email,
      emailVerified: userData.emailVerified,
      fullName: userData.fullName,
      avatarUrl: userData.avatarUrl,
      oauthProvider: provider,
      oauthProviderId: userData.providerId,
      lastLoginAt: DateTime.now(),
    })

    return user
  }
}
