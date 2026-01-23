import { Resend } from 'resend'
import env from '#start/env'

/**
 * Email Service using Resend
 * Handles sending emails for authentication and notifications
 */
export default class EmailService {
  private resend: Resend
  private fromEmail: string
  private fromName: string

  constructor() {
    const apiKey = env.get('RESEND_API_KEY')
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured in environment variables')
    }

    this.resend = new Resend(apiKey)
    this.fromEmail = env.get('RESEND_FROM_EMAIL', 'noreply@haven.app')
    this.fromName = env.get('RESEND_FROM_NAME', 'Haven')
  }

  /**
   * Send OTP email to user
   * @param email - Recipient email address
   * @param otpCode - 6-digit OTP code
   * @returns Promise with email send result
   */
  async sendOTP(email: string, otpCode: string): Promise<void> {
    try {
      const { error } = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [email],
        subject: 'Your Haven Verification Code',
        html: this.getOTPEmailTemplate(otpCode),
        text: this.getOTPEmailText(otpCode),
      })

      if (error) {
        console.error('Resend API error:', error)
        throw new Error(`Failed to send OTP email: ${error.message || 'Unknown error'}`)
      }

      console.log(`OTP email sent successfully to ${email}`)
    } catch (error: any) {
      console.error('Error sending OTP email:', error)
      throw new Error(`Failed to send OTP email: ${error.message || 'Unknown error'}`)
    }
  }

  /**
   * Get HTML email template for OTP
   */
  private getOTPEmailTemplate(otpCode: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Verification Code</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0 0 10px 0; color: #111d21; font-size: 28px; font-weight: 700;">Haven</h1>
              <p style="margin: 0 0 30px 0; color: #64748b; font-size: 16px;">Your safe space for mental health</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #111d21; font-size: 24px; font-weight: 600;">Verification Code</h2>
              <p style="margin: 0 0 30px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                Please use the following code to verify your email address and continue with your Haven account:
              </p>
              <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
                <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #19b3e6; font-family: 'Courier New', monospace;">
                  ${otpCode}
                </div>
              </div>
              <p style="margin: 30px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                This code will expire in 10 minutes. If you didn't request this code, please ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} Haven. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim()
  }

  /**
   * Get plain text email for OTP
   */
  private getOTPEmailText(otpCode: string): string {
    return `
Haven - Your Verification Code

Please use the following code to verify your email address:

${otpCode}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.

© ${new Date().getFullYear()} Haven. All rights reserved.
    `.trim()
  }
}
