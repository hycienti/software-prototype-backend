import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { updateProfileValidator } from '#validators/auth_validator'

export default class UsersController {
  /**
   * @me
   * @summary Get current user profile
   * @description Returns the authenticated user's profile information
   * @responseBody 200 - {"user": {"id": 1, "email": "user@example.com", "fullName": "John Doe", "avatarUrl": "https://...", "emailVerified": true, "lastLoginAt": "2026-01-19T00:00:00.000Z", "createdAt": "2026-01-19T00:00:00.000Z"}}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
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

  /**
   * @update
   * @summary Update user profile
   * @description Updates the authenticated user's profile (fullName, avatarUrl)
   * @requestBody {"fullName": "Jane Doe", "avatarUrl": "https://example.com/avatar.jpg"}
   * @responseBody 200 - {"user": {"id": 1, "email": "user@example.com", "fullName": "Jane Doe", "avatarUrl": "https://...", "emailVerified": true}}
   * @responseBody 401 - {"message": "Unauthorized"}
   * @responseBody 422 - {"errors": []}
   */
  async update({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const payload = await updateProfileValidator.validate(request.all())

    if (payload.fullName !== undefined) {
      user.fullName = payload.fullName
    }

    if (payload.avatarUrl !== undefined) {
      user.avatarUrl = payload.avatarUrl
    }

    await user.save()

    return response.ok({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
      },
    })
  }

  /**
   * @destroy
   * @summary Delete user account
   * @description Permanently deletes the authenticated user's account and all associated data
   * @responseBody 200 - {"message": "Account deleted successfully"}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async destroy({ auth, response }: HttpContext) {
    const user = auth.user!

    // Delete all access tokens for this user
    await User.accessTokens.delete(user, user.currentAccessToken.identifier)

    // Delete the user account
    await user.delete()

    return response.ok({ message: 'Account deleted successfully' })
  }
}
