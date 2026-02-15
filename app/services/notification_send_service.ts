import NotificationTemplate from '#models/notification_template'
import NotificationType from '#models/notification_type'
import NotificationChannel from '#models/notification_channel'
import NotificationDelivery from '#models/notification_delivery'
import Notification from '#models/notification'
import User from '#models/user'
import Therapist from '#models/therapist'
import EmailService from '#services/email_service'
import pusherService from '#services/pusher_service'
import { DateTime } from 'luxon'

export type ProductType = 'user' | 'therapist'
export type RecipientType = 'user' | 'therapist'

export interface SendNotificationOptions {
  notificationTypeSlug: string
  channelSlug: string
  productType: ProductType
  recipientType: RecipientType
  recipientId: number
  variables: Record<string, string | number>
  /** When sending to email without a user/therapist id (e.g. OTP before login), pass recipient email here. */
  recipientEmail?: string
  /** Optional: in-app title/message when channel is in_app or when creating in-app alongside email */
  inAppTitle?: string
  inAppMessage?: string
  inAppData?: Record<string, unknown>
  maxRetries?: number
}

const DEFAULT_MAX_RETRIES = 3

/**
 * Renders a string template by replacing {{variableName}} with values from the variables map.
 */
function renderTemplate(template: string, variables: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = variables[key]
    return value !== undefined && value !== null ? String(value) : ''
  })
}

/**
 * Notification send service: resolves templates, creates delivery records, sends via channel (email/in_app),
 * and supports retries for failed deliveries.
 */
export class NotificationSendService {
  private emailService = new EmailService()

  /**
   * Resolve template by type slug, channel slug, and product type.
   */
  async resolveTemplate(
    notificationTypeSlug: string,
    channelSlug: string,
    productType: ProductType,
    locale: string = 'en'
  ): Promise<NotificationTemplate | null> {
    const type = await NotificationType.query().where('slug', notificationTypeSlug).first()
    if (!type) return null

    const channel = await NotificationChannel.query().where('slug', channelSlug).first()
    if (!channel) return null

    const template = await NotificationTemplate.query()
      .where('notification_type_id', type.id)
      .where('channel_id', channel.id)
      .where('product_type', productType)
      .where('locale', locale)
      .first()

    return template
  }

  /**
   * Get recipient email for a user or therapist.
   */
  async getRecipientEmail(recipientType: RecipientType, recipientId: number): Promise<string | null> {
    if (recipientType === 'user') {
      const user = await User.find(recipientId)
      return user?.email ?? null
    }
    if (recipientType === 'therapist') {
      const therapist = await Therapist.find(recipientId)
      return therapist?.email ?? null
    }
    return null
  }

  /**
   * Send a notification: creates delivery record, renders template, sends via channel, updates delivery status.
   * On email failure, delivery is marked failed and can be retried via processRetries or retryDelivery.
   */
  async send(options: SendNotificationOptions): Promise<{ delivery: NotificationDelivery; ok: boolean }> {
    const {
      notificationTypeSlug,
      channelSlug,
      productType,
      recipientType,
      recipientId,
      variables,
      recipientEmail,
      inAppTitle,
      inAppMessage,
      inAppData,
      maxRetries = DEFAULT_MAX_RETRIES,
    } = options

    const type = await NotificationType.query().where('slug', notificationTypeSlug).firstOrFail()
    const channel = await NotificationChannel.query().where('slug', channelSlug).firstOrFail()
    const template = await this.resolveTemplate(notificationTypeSlug, channelSlug, productType)

    if (!template && channelSlug !== 'in_app') {
      throw new Error(
        `No template found for type=${notificationTypeSlug}, channel=${channelSlug}, productType=${productType}`
      )
    }

    const delivery = await NotificationDelivery.create({
      recipientType,
      recipientId,
      channelId: channel.id,
      notificationTypeId: type.id,
      templateId: template?.id ?? null,
      status: 'pending',
      retryCount: 0,
      maxRetries,
      lastError: null,
      metadata: { variables, ...(recipientEmail ? { email: recipientEmail } : {}) },
      sentAt: null,
    })

    const result = await this.attemptSend(
      delivery,
      template,
      type,
      channel,
      productType,
      variables,
      { inAppTitle, inAppMessage, inAppData },
      recipientEmail
    )

    return { delivery, ok: result.ok }
  }

  /**
   * Single send attempt: render, send via channel, update delivery and optionally create in-app notification.
   */
  private async attemptSend(
    delivery: NotificationDelivery,
    template: NotificationTemplate | null,
    type: NotificationType,
    channel: NotificationChannel,
    productType: ProductType,
    variables: Record<string, string | number>,
    inApp?: { inAppTitle?: string; inAppMessage?: string; inAppData?: Record<string, unknown> },
    recipientEmailOverride?: string
  ): Promise<{ ok: boolean }> {
    const appName = productType === 'therapist' ? 'Haven Therapist' : 'Haven'
    const tagline = 'Your safe space for mental health'
    const year = new Date().getFullYear()
    const defaultVariables = { ...variables, appName, tagline, year }

    if (channel.slug === 'email' && template) {
      const email =
        recipientEmailOverride ??
        (delivery.metadata && typeof delivery.metadata === 'object' && 'email' in delivery.metadata
          ? (delivery.metadata.email as string)
          : null) ??
        (await this.getRecipientEmail(delivery.recipientType as RecipientType, delivery.recipientId))
      if (!email) {
        await delivery.merge({ status: 'failed', lastError: 'Recipient email not found' }).save()
        return { ok: false }
      }

      const subject = template.subject ? renderTemplate(template.subject, defaultVariables) : 'Notification'
      const html = renderTemplate(template.bodyHtml, defaultVariables)
      const text = template.bodyText ? renderTemplate(template.bodyText, defaultVariables) : undefined

      const resolved = await this.emailService.sendWithContent(email, subject, html, text)
      if (resolved.success) {
        const meta = { ...(delivery.metadata || {}), email }
        if (resolved.id) (meta as Record<string, unknown>)['resendId'] = resolved.id
        await delivery
          .merge({
            status: 'sent',
            sentAt: DateTime.now(),
            metadata: meta,
          })
          .save()
        return { ok: true }
      }

      await delivery
        .merge({
          status: 'failed',
          retryCount: delivery.retryCount + 1,
          lastError: resolved.error,
          metadata: { ...(delivery.metadata || {}), variables },
        })
        .save()
      return { ok: false }
    }

    if (channel.slug === 'in_app') {
      const title = inApp?.inAppTitle ?? type.name
      const message = inApp?.inAppMessage ?? type.description ?? ''
      const userId = delivery.recipientType === 'user' ? delivery.recipientId : null
      const therapistId = delivery.recipientType === 'therapist' ? delivery.recipientId : null

      const notification = await Notification.create({
        userId,
        therapistId,
        notificationTypeId: type.id,
        categoryId: type.categoryId,
        deliveryId: delivery.id,
        title,
        message,
        type: type.slug,
        isRead: false,
        data: inApp?.inAppData ?? null,
      })

      await delivery
        .merge({
          status: 'sent',
          sentAt: DateTime.now(),
          metadata: { notificationId: notification.id },
        })
        .save()

      const channelName = therapistId ? `therapist-${therapistId}` : `user-${userId}`
      if (channelName) {
        await pusherService.trigger(channelName, 'notification:received', notification.toJSON())
      }

      return { ok: true }
    }

    // push/sms not implemented yet
    await delivery.merge({ status: 'failed', lastError: `Channel ${channel.slug} not implemented` }).save()
    return { ok: false }
  }

  /**
   * Retry a single failed delivery (re-run send attempt).
   */
  async retryDelivery(deliveryId: number): Promise<{ ok: boolean; error?: string }> {
    const delivery = await NotificationDelivery.query()
      .where('id', deliveryId)
      .where('status', 'failed')
      .whereRaw('retry_count < max_retries')
      .preload('channel')
      .preload('notificationType')
      .preload('template')
      .firstOrFail()

    const template = delivery.template
    const type = delivery.notificationType
    const channel = delivery.channel

    const variables: Record<string, string | number> =
      (delivery.metadata && typeof delivery.metadata === 'object' && 'variables' in delivery.metadata &&
        (delivery.metadata.variables as Record<string, string | number>)) ||
      {}

    const productType = (['user', 'therapist'].includes(delivery.recipientType)
      ? delivery.recipientType
      : 'user') as ProductType

    const emailOverride =
      delivery.metadata && typeof delivery.metadata === 'object' && 'email' in delivery.metadata
        ? (delivery.metadata.email as string)
        : undefined

    const result = await this.attemptSend(
      delivery,
      template,
      type,
      channel,
      productType,
      variables,
      undefined,
      emailOverride
    )

    if (!result.ok && delivery.lastError) {
      return { ok: false, error: delivery.lastError }
    }
    return { ok: result.ok }
  }

  /**
   * Process all failed deliveries that have retries left. Call from a cron or manually.
   */
  async processRetries(limit: number = 50): Promise<{ processed: number; succeeded: number }> {
    const deliveries = await NotificationDelivery.query()
      .where('status', 'failed')
      .whereRaw('retry_count < max_retries')
      .orderBy('updated_at', 'asc')
      .limit(limit)
      .preload('channel')
      .preload('notificationType')
      .preload('template')

    let succeeded = 0
    for (const d of deliveries) {
      const result = await this.retryDelivery(d.id)
      if (result.ok) succeeded++
    }
    return { processed: deliveries.length, succeeded }
  }
}

export default new NotificationSendService()
