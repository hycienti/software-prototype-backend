import { BaseSchema } from '@adonisjs/lucid/schema'
import db from '@adonisjs/lucid/services/db'

const OTP_EMAIL_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0 0 10px 0; color: #111d21; font-size: 28px; font-weight: 700;">{{appName}}</h1>
              <p style="margin: 0 0 30px 0; color: #64748b; font-size: 16px;">{{tagline}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #111d21; font-size: 24px; font-weight: 600;">{{heading}}</h2>
              <p style="margin: 0 0 30px 0; color: #475569; font-size: 16px; line-height: 1.6;">{{body}}</p>
              <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
                <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #19b3e6; font-family: 'Courier New', monospace;">{{otpCode}}</div>
              </div>
              <p style="margin: 30px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">{{footer}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">© {{year}} {{appName}}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

const GENERIC_EMAIL_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0 0 10px 0; color: #111d21; font-size: 28px; font-weight: 700;">{{appName}}</h1>
              <p style="margin: 0 0 30px 0; color: #64748b; font-size: 16px;">{{tagline}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #111d21; font-size: 24px; font-weight: 600;">{{heading}}</h2>
              <p style="margin: 0 0 30px 0; color: #475569; font-size: 16px; line-height: 1.6;">{{body}}</p>
              <p style="margin: 30px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">{{footer}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">© {{year}} {{appName}}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

const OTP_EMAIL_TEXT = `{{appName}} - {{heading}}

{{body}}

{{otpCode}}

{{footer}}

© {{year}} {{appName}}. All rights reserved.`

const GENERIC_EMAIL_TEXT = `{{appName}} - {{heading}}

{{body}}

{{footer}}

© {{year}} {{appName}}. All rights reserved.`

export default class extends BaseSchema {
  async up() {
    const now = new Date()

    await db.table('notification_channels').insert([
      { name: 'Email', slug: 'email', created_at: now, updated_at: now },
      { name: 'In-app', slug: 'in_app', created_at: now, updated_at: now },
      { name: 'Push', slug: 'push', created_at: now, updated_at: now },
      { name: 'SMS', slug: 'sms', created_at: now, updated_at: now },
    ])

    await db.table('notification_categories').insert([
      { name: 'Authentication', slug: 'auth', created_at: now, updated_at: now },
      { name: 'Session', slug: 'session', created_at: now, updated_at: now },
      { name: 'Financial', slug: 'financial', created_at: now, updated_at: now },
      { name: 'Marketing', slug: 'marketing', created_at: now, updated_at: now },
      { name: 'System', slug: 'system', created_at: now, updated_at: now },
    ])

    const categories = await db.from('notification_categories').select('id', 'slug')
    const categoryById = Object.fromEntries((categories as { id: number; slug: string }[]).map((c) => [c.slug, c.id]))

    await db.table('notification_types').insert([
      {
        category_id: categoryById['auth'],
        name: 'OTP Verification',
        slug: 'otp_verification',
        description: 'Email OTP code for login or signup verification',
        created_at: now,
        updated_at: now,
      },
      {
        category_id: categoryById['session'],
        name: 'Session Booked',
        slug: 'session_booked',
        description: 'Notification when a session is booked',
        created_at: now,
        updated_at: now,
      },
      {
        category_id: categoryById['session'],
        name: 'Session Reminder',
        slug: 'session_reminder',
        description: 'Reminder before an upcoming session',
        created_at: now,
        updated_at: now,
      },
      {
        category_id: categoryById['session'],
        name: 'Session Cancelled',
        slug: 'session_cancelled',
        description: 'Notification when a session is cancelled',
        created_at: now,
        updated_at: now,
      },
      {
        category_id: categoryById['financial'],
        name: 'Payment Received',
        slug: 'payment_received',
        description: 'Payment or payout received',
        created_at: now,
        updated_at: now,
      },
      {
        category_id: categoryById['financial'],
        name: 'Withdrawal Requested',
        slug: 'withdrawal_requested',
        description: 'Withdrawal request submitted',
        created_at: now,
        updated_at: now,
      },
      {
        category_id: categoryById['financial'],
        name: 'Withdrawal Completed',
        slug: 'withdrawal_completed',
        description: 'Withdrawal has been processed',
        created_at: now,
        updated_at: now,
      },
      {
        category_id: categoryById['marketing'],
        name: 'Welcome',
        slug: 'welcome',
        description: 'Welcome email after signup',
        created_at: now,
        updated_at: now,
      },
      {
        category_id: categoryById['system'],
        name: 'General',
        slug: 'general',
        description: 'General in-app or system notification',
        created_at: now,
        updated_at: now,
      },
    ])

    const channels = await db.from('notification_channels').select('id', 'slug')
    const channelById = Object.fromEntries((channels as { id: number; slug: string }[]).map((c) => [c.slug, c.id]))
    const types = await db.from('notification_types').select('id', 'slug')
    const typeById = Object.fromEntries((types as { id: number; slug: string }[]).map((t) => [t.slug, t.id]))

    const emailChannelId = channelById['email']

    const templates: Array<Record<string, unknown>> = []

    // OTP Verification - user app
    templates.push({
      notification_type_id: typeById['otp_verification'],
      channel_id: emailChannelId,
      product_type: 'user',
      locale: 'en',
      subject: 'Your Haven Verification Code',
      body_html: OTP_EMAIL_HTML,
      body_text: OTP_EMAIL_TEXT,
      template_variables: JSON.stringify([
        'appName',
        'tagline',
        'title',
        'heading',
        'body',
        'otpCode',
        'footer',
        'year',
      ]),
      created_at: now,
      updated_at: now,
    })

    // OTP Verification - therapist app
    templates.push({
      notification_type_id: typeById['otp_verification'],
      channel_id: emailChannelId,
      product_type: 'therapist',
      locale: 'en',
      subject: 'Your Haven Therapist Verification Code',
      body_html: OTP_EMAIL_HTML,
      body_text: OTP_EMAIL_TEXT,
      template_variables: JSON.stringify([
        'appName',
        'tagline',
        'title',
        'heading',
        'body',
        'otpCode',
        'footer',
        'year',
      ]),
      created_at: now,
      updated_at: now,
    })

    // Session Booked - user & therapist (generic template)
    for (const productType of ['user', 'therapist']) {
      templates.push({
        notification_type_id: typeById['session_booked'],
        channel_id: emailChannelId,
        product_type: productType,
        locale: 'en',
        subject: productType === 'user' ? 'Your Haven session is confirmed' : 'New session booked',
        body_html: GENERIC_EMAIL_HTML,
        body_text: GENERIC_EMAIL_TEXT,
        template_variables: JSON.stringify(['appName', 'tagline', 'title', 'heading', 'body', 'footer', 'year']),
        created_at: now,
        updated_at: now,
      })
    }

    // Session Reminder
    for (const productType of ['user', 'therapist']) {
      templates.push({
        notification_type_id: typeById['session_reminder'],
        channel_id: emailChannelId,
        product_type: productType,
        locale: 'en',
        subject: 'Session reminder – Haven',
        body_html: GENERIC_EMAIL_HTML,
        body_text: GENERIC_EMAIL_TEXT,
        template_variables: JSON.stringify(['appName', 'tagline', 'title', 'heading', 'body', 'footer', 'year']),
        created_at: now,
        updated_at: now,
      })
    }

    // Session Cancelled
    for (const productType of ['user', 'therapist']) {
      templates.push({
        notification_type_id: typeById['session_cancelled'],
        channel_id: emailChannelId,
        product_type: productType,
        locale: 'en',
        subject: 'Session cancelled – Haven',
        body_html: GENERIC_EMAIL_HTML,
        body_text: GENERIC_EMAIL_TEXT,
        template_variables: JSON.stringify(['appName', 'tagline', 'title', 'heading', 'body', 'footer', 'year']),
        created_at: now,
        updated_at: now,
      })
    }

    // Financial: payment_received, withdrawal_requested, withdrawal_completed (therapist-focused)
    for (const slug of ['payment_received', 'withdrawal_requested', 'withdrawal_completed']) {
      templates.push({
        notification_type_id: typeById[slug],
        channel_id: emailChannelId,
        product_type: 'therapist',
        locale: 'en',
        subject: slug === 'payment_received' ? 'Payment received – Haven' : slug === 'withdrawal_requested' ? 'Withdrawal requested – Haven' : 'Withdrawal completed – Haven',
        body_html: GENERIC_EMAIL_HTML,
        body_text: GENERIC_EMAIL_TEXT,
        template_variables: JSON.stringify(['appName', 'tagline', 'title', 'heading', 'body', 'footer', 'year']),
        created_at: now,
        updated_at: now,
      })
    }

    // Welcome - user & therapist
    for (const productType of ['user', 'therapist']) {
      templates.push({
        notification_type_id: typeById['welcome'],
        channel_id: emailChannelId,
        product_type: productType,
        locale: 'en',
        subject: productType === 'user' ? 'Welcome to Haven' : 'Welcome to Haven Therapist',
        body_html: GENERIC_EMAIL_HTML,
        body_text: GENERIC_EMAIL_TEXT,
        template_variables: JSON.stringify(['appName', 'tagline', 'title', 'heading', 'body', 'footer', 'year']),
        created_at: now,
        updated_at: now,
      })
    }

    if (templates.length > 0) {
      await db.table('notification_templates').insert(templates)
    }
  }

  async down() {
    await db.rawQuery('TRUNCATE notification_deliveries CASCADE')
    await db.rawQuery('TRUNCATE notification_templates CASCADE')
    await db.rawQuery('TRUNCATE notification_types CASCADE')
    await db.rawQuery('TRUNCATE notification_categories CASCADE')
    await db.rawQuery('TRUNCATE notification_channels CASCADE')
  }
}
