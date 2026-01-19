import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import OAuthService from '#services/oauth_service'
import { googleAuthValidator, appleAuthValidator } from '#validators/auth_validator'

export default class AuthController {
  private oauthService = new OAuthService()

  /**
   * @googleRedirect
   * @summary Redirect to Google OAuth
   * @description Initiates Google OAuth flow by redirecting to Google's consent screen
   * @responseBody 302 - Redirects to Google OAuth
   */
  async googleRedirect({ ally }: HttpContext) {
    return ally.use('google').redirect()
  }

  /**
   * @googleCallback
   * @summary Google OAuth callback
   * @description Handles the callback from Google OAuth and returns user + token
   * @responseBody 200 - {"user": {...}, "token": {"type": "bearer", "value": "...", "expiresAt": "..."}}
   * @responseBody 400 - {"message": "OAuth error"}
   * @responseBody 401 - {"message": "Access denied"}
   */
  async googleCallback({ ally, response }: HttpContext) {
    const google = ally.use('google')

    if (google.accessDenied()) {
      return response.unauthorized({ message: 'Access denied' })
    }

    if (google.stateMisMatch()) {
      return response.unauthorized({ message: 'Invalid OAuth state' })
    }

    if (google.hasError()) {
      return response.badRequest({ message: google.getError() || 'OAuth error' })
    }

    const socialUser = await google.user()

    const user = await this.oauthService.findOrCreateUser('google', {
      providerId: socialUser.id,
      email: socialUser.email || '',
      emailVerified: true,
      fullName: socialUser.name || null,
      avatarUrl: socialUser.avatarUrl || null,
    })

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

  /**
   * @google
   * @summary Sign in with Google (mobile)
   * @tag Auth
   * @description Exchanges a Google ID token (from mobile SDK) for an API bearer token
   * @requestBody {"idToken": "eyJ...", "fullName": "John Doe"}
   * @responseBody 200 - {"user": {...}, "token": {"type": "bearer", "value": "...", "expiresAt": "..."}}
   * @responseBody 400 - {"message": "Invalid Google token"}
   * @responseBody 422 - Validation error
   */
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

  /**
   * @apple
   * @summary Sign in with Apple (mobile)
   * @tag Auth
   * @description Exchanges an Apple ID token (from mobile SDK) for an API bearer token
   * @requestBody {"idToken": "eyJ...", "fullName": "John Doe", "authorizationCode": "..."}
   * @responseBody 200 - {"user": {...}, "token": {"type": "bearer", "value": "...", "expiresAt": "..."}}
   * @responseBody 400 - {"message": "Invalid Apple token"}
   * @responseBody 422 - Validation error
   */
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

  /**
   * @refresh
   * @summary Refresh access token
   * @description Rotates the current bearer token (deletes old, issues new)
   * @responseBody 200 - {"token": {"type": "bearer", "value": "...", "expiresAt": "..."}}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
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

  /**
   * @logout
   * @summary Logout
   * @tag Auth
   * @description Invalidates the current bearer token
   * @responseBody 200 - {"message": "Logged out successfully"}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async logout({ auth, response }: HttpContext) {
    const user = auth.user!

    await User.accessTokens.delete(user, auth.user!.currentAccessToken.identifier)

    return response.ok({ message: 'Logged out successfully' })
  }
}
