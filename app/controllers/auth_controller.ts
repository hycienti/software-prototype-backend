import type { HttpContext } from '@adonisjs/core/http'
import UserService from '#services/user_service'
import notificationSendService from '#services/notification_send_service'
import {
  emailValidator,
  verifyOtpValidator,
  completeSignupValidator,
} from '#validators/auth_validator'
import { successResponse, errorResponse, ErrorCodes } from '#utils/response_helper'

const userService = new UserService()

function serializeUser(user: { id: number; email: string; fullName: string | null; avatarUrl: string | null; emailVerified: boolean }) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
  }
}

export default class AuthController {
  /**
   * @sendOtp
   * @summary Send OTP to email
   * @tag Auth
   */
  async sendOtp(ctx: HttpContext) {
    const { email } = await emailValidator.validate(ctx.request.all())

    const result = await userService.sendOtp(email)

    if ('rateLimited' in result && result.rateLimited) {
      return ctx.response.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Please wait before requesting another OTP code',
          details: { retryAfter: result.retryAfter },
        },
      })
    }

    const otp = 'otp' in result ? result.otp : null
    if (!otp) throw new Error('Unexpected state after sendOtp')

    try {
      const { ok } = await notificationSendService.send({
        notificationTypeSlug: 'otp_verification',
        channelSlug: 'email',
        productType: 'user',
        recipientType: 'user',
        recipientId: 0,
        recipientEmail: email,
        variables: {
          title: 'Your Verification Code',
          heading: 'Verification Code',
          body:
            'Please use the following code to verify your email address and continue with your Haven account:',
          otpCode: otp.code,
          footer:
            "This code will expire in 10 minutes. If you didn't request this code, please ignore this email.",
        },
      })
      if (!ok) throw new Error('Send failed')
    } catch (error) {
      await userService.deleteOtp(otp)
      return errorResponse(
        ctx,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to send OTP email. Please try again later.',
        500
      )
    }

    return successResponse(ctx, { message: 'OTP sent successfully', expiresIn: 600 })
  }

  /**
   * @verifyOtp
   * @summary Verify OTP code
   * @tag Auth
   */
  async verifyOtp(ctx: HttpContext) {
    const { email, code } = await verifyOtpValidator.validate(ctx.request.all())

    const result = await userService.verifyOtp(email, code)

    if ('error' in result) {
      if (result.error === 'NO_OTP') {
        return errorResponse(
          ctx,
          ErrorCodes.BAD_REQUEST,
          'No OTP found for this email. Please request a new code.',
          400
        )
      }
      if (result.error === 'EXPIRED') {
        return errorResponse(
          ctx,
          ErrorCodes.BAD_REQUEST,
          'OTP code has expired. Please request a new code.',
          400
        )
      }
      return errorResponse(
        ctx,
        ErrorCodes.BAD_REQUEST,
        'Invalid OTP code. Please try again.',
        400
      )
    }

    if (result.requiresSignup) {
      return successResponse(ctx, {
        requiresSignup: true,
        email: result.email,
        message: 'Please complete your signup by providing your full name',
      })
    }

    return successResponse(ctx, {
      user: serializeUser(result.user),
      token: result.token,
      requiresSignup: false,
    })
  }

  /**
   * @completeSignup
   * @summary Complete signup with fullname
   * @tag Auth
   */
  async completeSignup(ctx: HttpContext) {
    const { email, fullName } = await completeSignupValidator.validate(ctx.request.all())

    const result = await userService.completeSignup(email, fullName)

    if ('error' in result) {
      if (result.error === 'USER_EXISTS') {
        return errorResponse(
          ctx,
          ErrorCodes.BAD_REQUEST,
          'User already exists. Please sign in instead.',
          400
        )
      }
      return errorResponse(
        ctx,
        ErrorCodes.BAD_REQUEST,
        'Please verify your email with OTP first.',
        400
      )
    }

    return successResponse(ctx, {
      user: serializeUser(result.user),
      token: result.token,
    })
  }

  /**
   * @refresh
   * @summary Refresh access token
   * @tag Auth
   */
  async refresh(ctx: HttpContext) {
    const user = ctx.auth.user! as import('#models/user').default
    const token = await userService.refresh(user)
    return successResponse(ctx, { token })
  }

  /**
   * @logout
   * @summary Logout
   * @tag Auth
   */
  async logout(ctx: HttpContext) {
    const user = ctx.auth.user! as import('#models/user').default
    await userService.logout(user)
    return successResponse(ctx, { message: 'Logged out successfully' })
  }
}
