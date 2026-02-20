import { DateTime } from 'luxon'
import Otp from '#models/otp'

export default class OtpRepository {
  /**
   * Find a recent unverified OTP for the email (within the last `withinSeconds` seconds).
   * Used for rate limiting.
   */
  async findRecentUnverifiedByEmail(
    email: string,
    withinSeconds: number
  ): Promise<Otp | null> {
    return Otp.query()
      .where('email', email)
      .where('created_at', '>', DateTime.now().minus({ seconds: withinSeconds }).toSQL()!)
      .where('verified', false)
      .first()
  }

  /**
   * Find the latest unverified OTP for the email (for verify step).
   */
  async findLatestUnverifiedByEmail(email: string): Promise<Otp | null> {
    return Otp.query()
      .where('email', email)
      .where('verified', false)
      .orderBy('created_at', 'desc')
      .first()
  }

  /**
   * Find the latest verified OTP for the email that is still within the time window (for completeSignup).
   */
  async findLatestVerifiedByEmail(
    email: string,
    since: DateTime
  ): Promise<Otp | null> {
    return Otp.query()
      .where('email', email)
      .where('verified', true)
      .where('expires_at', '>', since.toSQL()!)
      .orderBy('created_at', 'desc')
      .first()
  }

  async create(data: {
    email: string
    code: string
    verified: boolean
    expiresAt: DateTime
  }): Promise<Otp> {
    return Otp.create(data)
  }

  async markVerified(otp: Otp): Promise<void> {
    otp.verified = true
    await otp.save()
  }

  /**
   * Mark all unverified OTPs for this email as verified (invalidate previous codes).
   */
  async markAllUnverifiedByEmail(email: string): Promise<void> {
    await Otp.query().where('email', email).where('verified', false).update({ verified: true })
  }

  async delete(otp: Otp): Promise<void> {
    await otp.delete()
  }
}
