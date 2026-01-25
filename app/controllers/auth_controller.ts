import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Otp from '#models/otp'
import EmailService from '#services/email_service'
import {
  emailValidator,
  verifyOtpValidator,
  completeSignupValidator,
} from '#validators/auth_validator'
import { DateTime } from 'luxon'
import crypto from 'node:crypto'

export default class AuthController {
  private emailService = new EmailService()

  /**
   * @openapi
   * /auth/send-otp:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Send OTP to email
   *     description: Sends a 6-digit OTP code to the provided email address.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *                 example: user@example.com
   *     responses:
   *       200:
   *         description: OTP sent successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 expiresIn:
   *                   type: integer
   *       422:
   *         description: Validation error
   *       429:
   *         description: Too many requests (rate limiting)
   */
  async sendOtp({ request, response }: HttpContext) {
    const { email } = await emailValidator.validate(request.all())

    // Rate limiting: Check if OTP was sent recently (within last 60 seconds)
    const recentOtp = await Otp.query()
      .where('email', email)
      .where('created_at', '>', DateTime.now().minus({ seconds: 60 }).toSQL()!)
      .where('verified', false)
      .first()

    if (recentOtp) {
      return response.tooManyRequests({
        message: 'Please wait before requesting another OTP code',
        retryAfter: 60,
      })
    }

    // Invalidate any existing unverified OTPs for this email
    await Otp.query().where('email', email).where('verified', false).update({ verified: true })

    // Generate 6-digit OTP
    const code = crypto.randomInt(100000, 999999).toString()

    // Create OTP record (expires in 10 minutes)
    const otp = await Otp.create({
      email,
      code,
      verified: false,
      expiresAt: DateTime.now().plus({ minutes: 10 }),
    })

    // Send OTP email
    try {
      await this.emailService.sendOTP(email, code)
    } catch (error: any) {
      console.error('Failed to send OTP email:', error)
      // Delete OTP record if email sending fails
      await otp.delete()
      return response.internalServerError({
        message: 'Failed to send OTP email. Please try again later.',
      })
    }

    return response.ok({
      message: 'OTP sent successfully',
      expiresIn: 600, // 10 minutes in seconds
    })
  }

  /**
   * @openapi
   * /auth/verify-otp:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Verify OTP code
   *     description: Verifies the OTP code and returns user info or indicates if signup is needed.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *                 example: user@example.com
   *               code:
   *                 type: string
   *                 example: "123456"
   *     responses:
   *       200:
   *         description: OTP verified or signup required
   *         content:
   *           application/json:
   *             schema:
   *               oneOf:
   *                 - type: object
   *                   properties:
   *                     user:
   *                       type: object
   *                     token:
   *                       type: object
   *                     requiresSignup:
   *                       type: boolean
   *                 - type: object
   *                   properties:
   *                     requiresSignup:
   *                       type: boolean
   *                     email:
   *                       type: string
   *       400:
   *         description: Invalid or expired OTP
   *       422:
   *         description: Validation error
   */
  async verifyOtp({ request, response }: HttpContext) {
    const { email, code } = await verifyOtpValidator.validate(request.all())

    // Find the most recent unverified OTP for this email
    const otp = await Otp.query()
      .where('email', email)
      .where('verified', false)
      .orderBy('created_at', 'desc')
      .first()

    if (!otp) {
      return response.badRequest({
        message: 'No OTP found for this email. Please request a new code.',
      })
    }

    // Check if OTP is expired
    if (otp.isExpired()) {
      await otp.merge({ verified: true }).save()
      return response.badRequest({
        message: 'OTP code has expired. Please request a new code.',
      })
    }

    // Verify code
    if (otp.code !== code) {
      return response.badRequest({
        message: 'Invalid OTP code. Please try again.',
      })
    }

    // Mark OTP as verified
    await otp.merge({ verified: true }).save()

    // Check if user exists
    const user = await User.findBy('email', email)

    if (!user) {
      // New user - requires signup (fullname)
      return response.ok({
        requiresSignup: true,
        email,
        message: 'Please complete your signup by providing your full name',
      })
    }

    // Existing user - update last login and create token
    await user
      .merge({
        emailVerified: true,
        lastLoginAt: DateTime.now(),
      })
      .save()

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
      requiresSignup: false,
    })
  }

  /**
   * @openapi
   * /auth/complete-signup:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Complete signup with fullname
   *     description: Completes the signup process for new users by saving their fullname.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *                 example: user@example.com
   *               fullName:
   *                 type: string
   *                 example: John Doe
   *     responses:
   *       200:
   *         description: Signup completed
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user:
   *                   type: object
   *                 token:
   *                   type: object
   *       400:
   *         description: User already exists or OTP not verified
   *       422:
   *         description: Validation error
   */
  async completeSignup({ request, response }: HttpContext) {
    const { email, fullName } = await completeSignupValidator.validate(request.all())

    // Check if user already exists
    const existingUser = await User.findBy('email', email)
    if (existingUser) {
      return response.badRequest({
        message: 'User already exists. Please sign in instead.',
      })
    }

    // Verify that OTP was verified for this email
    const verifiedOtp = await Otp.query()
      .where('email', email)
      .where('verified', true)
      .where('expires_at', '>', DateTime.now().minus({ minutes: 10 }).toSQL()!)
      .orderBy('created_at', 'desc')
      .first()

    if (!verifiedOtp) {
      return response.badRequest({
        message: 'Please verify your email with OTP first.',
      })
    }

    // Create new user
    const user = await User.create({
      email,
      fullName,
      emailVerified: true,
      lastLoginAt: DateTime.now(),
    })

    // Create access token
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
   * @openapi
   * /auth/refresh:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Refresh access token
   *     description: Rotates the current bearer token (deletes old, issues new).
   *     responses:
   *       200:
   *         description: Token refreshed
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: object
   *                   properties:
   *                     type:
   *                       type: string
   *                     value:
   *                       type: string
   *                     expiresAt:
   *                       type: string
   *       401:
   *         description: Unauthorized
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
   * @openapi
   * /auth/logout:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Logout
   *     description: Invalidates the current bearer token.
   *     responses:
   *       200:
   *         description: Logged out successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *       401:
   *         description: Unauthorized
   */
  async logout({ auth, response }: HttpContext) {
    const user = auth.user!

    await User.accessTokens.delete(user, auth.user!.currentAccessToken.identifier)

    return response.ok({ message: 'Logged out successfully' })
  }
}
