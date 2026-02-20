import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import UserService from '#services/user_service'
import { updateProfileValidator } from '#validators/auth_validator'
import { successResponse } from '#utils/response_helper'

const userService = new UserService()

function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    lastLoginAt: user.lastLoginAt?.toISO(),
    createdAt: user.createdAt.toISO(),
  }
}

export default class UsersController {
  /**
   * @me
   * @summary Get current user profile
   */
  async me(ctx: HttpContext) {
    const user = ctx.auth.user! as User
    return successResponse(ctx, { user: serializeUser(user) })
  }

  /**
   * @update
   * @summary Update user profile
   */
  async update(ctx: HttpContext) {
    const user = ctx.auth.user! as User
    const payload = await updateProfileValidator.validate(ctx.request.all())
    const updated = await userService.update(user.id, {
      fullName: payload.fullName,
      avatarUrl: payload.avatarUrl,
    })
    return successResponse(ctx, {
      user: {
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        avatarUrl: updated.avatarUrl,
        emailVerified: updated.emailVerified,
      },
    })
  }

  /**
   * @destroy
   * @summary Delete user account
   */
  async destroy(ctx: HttpContext) {
    const user = ctx.auth.user! as User
    await userService.destroy(user)
    return successResponse(ctx, { message: 'Account deleted successfully' })
  }
}
