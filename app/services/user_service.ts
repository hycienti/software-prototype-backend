import { DateTime } from 'luxon'
import User from '#models/user'
import type UserModel from '#models/user'
import type Otp from '#models/otp'
import UserRepository from '#repositories/user_repository'
import OtpRepository from '#repositories/otp_repository'

const userRepository = new UserRepository()
const otpRepository = new OtpRepository()

export default class UserService {
  async findByEmail(email: string): Promise<UserModel | null> {
    return userRepository.findByEmail(email)
  }

  async getById(id: number): Promise<UserModel> {
    return userRepository.findById(id)
  }

  async create(data: {
    email: string
    fullName: string | null
    emailVerified?: boolean
    lastLoginAt?: DateTime | null
  }): Promise<UserModel> {
    return userRepository.create(data)
  }

  async update(
    userId: number,
    payload: { fullName?: string | null; avatarUrl?: string | null }
  ): Promise<UserModel> {
    const user = await userRepository.findById(userId)
    return userRepository.update(user, payload)
  }

  async destroy(user: UserModel & { currentAccessToken?: { identifier: string } }): Promise<void> {
    if (!user.currentAccessToken) throw new Error('User must have currentAccessToken to destroy')
    await User.accessTokens.delete(user, user.currentAccessToken.identifier)
    await userRepository.delete(user)
  }

  /**
   * Send OTP: rate limit, invalidate old, create new. Returns { otp } or { rateLimited: true, retryAfter }.
   */
  async sendOtp(email: string): Promise<
    | { otp: Otp }
    | { rateLimited: true; retryAfter: number }
  > {
    const recentOtp = await otpRepository.findRecentUnverifiedByEmail(email, 60)
    if (recentOtp) {
      return { rateLimited: true, retryAfter: 60 }
    }

    await otpRepository.markAllUnverifiedByEmail(email)

    const code = await import('node:crypto').then((c) =>
      c.randomInt(100000, 999999).toString()
    )
    const otp = await otpRepository.create({
      email,
      code,
      verified: false,
      expiresAt: DateTime.now().plus({ minutes: 10 }),
    })
    return { otp }
  }

  /**
   * Verify OTP. Returns { user, token } for existing user, { requiresSignup: true, email } for new user, or error.
   */
  async verifyOtp(
    email: string,
    code: string
  ): Promise<
    | { user: UserModel; token: { type: string; value: string; expiresAt: string | undefined }; requiresSignup: false }
    | { requiresSignup: true; email: string }
    | { error: 'NO_OTP' | 'EXPIRED' | 'INVALID_CODE' }
  > {
    const otp = await otpRepository.findLatestUnverifiedByEmail(email)
    if (!otp) return { error: 'NO_OTP' }
    if (otp.isExpired()) {
      await otpRepository.markVerified(otp)
      return { error: 'EXPIRED' }
    }
    if (otp.code !== code) return { error: 'INVALID_CODE' }

    await otpRepository.markVerified(otp)

    const user = await userRepository.findByEmail(email)
    if (!user) {
      return { requiresSignup: true, email }
    }

    await userRepository.update(user, {
      emailVerified: true,
      lastLoginAt: DateTime.now(),
    })

    const token = await User.accessTokens.create(user)
    return {
      user,
      token: {
        type: 'bearer',
        value: token.value!.release(),
        expiresAt: token.expiresAt != null ? (typeof (token.expiresAt as any).toISO === 'function' ? (token.expiresAt as any).toISO() : (token.expiresAt as Date).toISOString()) : undefined,
      },
      requiresSignup: false,
    }
  }

  /**
   * Complete signup after OTP. Returns { user, token } or error.
   */
  async completeSignup(
    email: string,
    fullName: string
  ): Promise<
    | { user: UserModel; token: { type: string; value: string; expiresAt: string | undefined } }
    | { error: 'USER_EXISTS' | 'OTP_NOT_VERIFIED' }
  > {
    const existingUser = await userRepository.findByEmail(email)
    if (existingUser) return { error: 'USER_EXISTS' }

    const verifiedOtp = await otpRepository.findLatestVerifiedByEmail(
      email,
      DateTime.now().minus({ minutes: 10 })
    )
    if (!verifiedOtp) return { error: 'OTP_NOT_VERIFIED' }

    const user = await userRepository.create({
      email,
      fullName,
      emailVerified: true,
      lastLoginAt: DateTime.now(),
    })

    const token = await User.accessTokens.create(user)
    return {
      user,
      token: {
        type: 'bearer',
        value: token.value!.release(),
        expiresAt: token.expiresAt != null ? (typeof (token.expiresAt as any).toISO === 'function' ? (token.expiresAt as any).toISO() : (token.expiresAt as Date).toISOString()) : undefined,
      },
    }
  }

  /**
   * Refresh token: delete current and create new. Requires the authenticated user.
   */
  async refresh(user: UserModel & { currentAccessToken?: { identifier: string } }): Promise<{ type: string; value: string; expiresAt: string | undefined }> {
    if (!user.currentAccessToken) throw new Error('User must have currentAccessToken to refresh')
    await User.accessTokens.delete(user, user.currentAccessToken.identifier)
    const token = await User.accessTokens.create(user)
    return {
      type: 'bearer',
      value: token.value!.release(),
      expiresAt: token.expiresAt != null ? (typeof (token.expiresAt as any).toISO === 'function' ? (token.expiresAt as any).toISO() : (token.expiresAt as Date).toISOString()) : undefined,
    }
  }

  /**
   * Logout: invalidate current token.
   */
  async logout(user: UserModel & { currentAccessToken?: { identifier: string } }): Promise<void> {
    if (!user.currentAccessToken) throw new Error('User must have currentAccessToken to logout')
    await User.accessTokens.delete(user, user.currentAccessToken.identifier)
  }

  /** Remove an OTP record (e.g. after failed email send). */
  async deleteOtp(otp: Otp): Promise<void> {
    await otpRepository.delete(otp)
  }
}
