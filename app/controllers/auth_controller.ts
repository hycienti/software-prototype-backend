import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import OAuthService from '#services/oauth_service'
import { googleAuthValidator, appleAuthValidator } from '#validators/auth_validator'

export default class AuthController {
  private oauthService = new OAuthService()

  async google({ request, response }: HttpContext) {
    const payload = await googleAuthValidator.validate(request.all())

    const userData = await this.oauthService.verifyGoogleToken(payload.idToken)

    if (payload.fullName && !userData.fullName) {
      userData.fullName = payload.fullName
    }

    const user = await this.oauthService.findOrCreateUser('google', userData)
    const token = await User.accessTokens.create(user)

    return response.ok({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
      },
      token: {
        type: 'bearer',
        value: token.value!.release(),
        expiresAt: token.expiresAt?.toISOString(),
      },
    })
  }

  async apple({ request, response }: HttpContext) {
    const payload = await appleAuthValidator.validate(request.all())

    const userData = await this.oauthService.verifyAppleToken(payload.idToken)

    if (payload.fullName && !userData.fullName) {
      userData.fullName = payload.fullName
    }

    const user = await this.oauthService.findOrCreateUser('apple', userData)
    const token = await User.accessTokens.create(user)

    return response.ok({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
      },
      token: {
        type: 'bearer',
        value: token.value!.release(),
        expiresAt: token.expiresAt?.toISOString(),
      },
    })
  }

  async me({ auth, response }: HttpContext) {
    const user = auth.user!

    return response.ok({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt?.toISO(),
        createdAt: user.createdAt.toISO(),
      },
    })
  }

  async refresh({ auth, response }: HttpContext) {
    const user = auth.user!

    await User.accessTokens.delete(user, auth.user!.currentAccessToken.identifier)

    const token = await User.accessTokens.create(user)

    return response.ok({
      token: {
        type: 'bearer',
        value: token.value!.release(),
        expiresAt: token.expiresAt?.toISOString(),
      },
    })
  }

  async logout({ auth, response }: HttpContext) {
    const user = auth.user!

    await User.accessTokens.delete(user, auth.user!.currentAccessToken.identifier)

    return response.ok({ message: 'Logged out successfully' })
  }
}
