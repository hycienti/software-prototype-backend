import type { HttpContext } from '@adonisjs/core/http'
import NotificationChannel from '#models/notification_channel'
import NotificationCategory from '#models/notification_category'
import NotificationType from '#models/notification_type'
import NotificationTemplate from '#models/notification_template'
import NotificationDelivery from '#models/notification_delivery'
import notificationSendService from '#services/notification_send_service'
import {
  notificationTemplatesListValidator,
  notificationDeliveriesListValidator,
  defaultListParams,
} from '#validators/list_validator'
import { sendNotificationValidator } from '#validators/notification_validator'

/**
 * APIs for the notification module: channels, categories, types, templates, deliveries, send, retry.
 */
export default class NotificationModuleController {
  /**
   * GET /notification-channels
   */
  async channels({ response }: HttpContext) {
    const list = await NotificationChannel.query().orderBy('id', 'asc')
    return response.ok(list.map((c) => ({ id: c.id, name: c.name, slug: c.slug })))
  }

  /**
   * GET /notification-categories
   */
  async categories({ response }: HttpContext) {
    const list = await NotificationCategory.query().orderBy('id', 'asc')
    return response.ok(list.map((c) => ({ id: c.id, name: c.name, slug: c.slug })))
  }

  /**
   * GET /notification-types
   */
  async types({ response }: HttpContext) {
    const list = await NotificationType.query()
      .preload('category')
      .orderBy('id', 'asc')
    return response.ok(
      list.map((t) => ({
        id: t.id,
        categoryId: t.categoryId,
        categorySlug: t.category.slug,
        name: t.name,
        slug: t.slug,
        description: t.description,
      }))
    )
  }

  /**
   * GET /notification-templates?notificationTypeId=&channelId=&productType=
   */
  async templates({ request, response }: HttpContext) {
    const raw = await notificationTemplatesListValidator.validate(request.qs())
    const page = raw.page ?? defaultListParams.page
    const limit = raw.limit ?? defaultListParams.limit

    let baseQuery = NotificationTemplate.query()

    if (raw.notificationTypeId) baseQuery = baseQuery.where('notification_type_id', raw.notificationTypeId)
    if (raw.channelId) baseQuery = baseQuery.where('channel_id', raw.channelId)
    if (raw.productType) baseQuery = baseQuery.where('product_type', raw.productType)

    const total = await baseQuery.clone().count('* as total').first()
    const totalCount = Number(total?.$extras?.total ?? 0)
    const items = await baseQuery
      .preload('notificationType')
      .preload('channel')
      .orderBy('id', 'asc')
      .offset((page - 1) * limit)
      .limit(limit)

    return response.ok({
      data: items.map((t) => ({
        id: t.id,
        notificationTypeId: t.notificationTypeId,
        notificationTypeSlug: t.notificationType.slug,
        channelId: t.channelId,
        channelSlug: t.channel.slug,
        productType: t.productType,
        locale: t.locale,
        subject: t.subject,
        templateVariables: t.templateVariables,
      })),
      meta: { page, limit, total: totalCount },
    })
  }

  /**
   * GET /notification-deliveries?status=&recipientType=&notificationTypeSlug=&page=&limit=
   */
  async deliveries({ request, response }: HttpContext) {
    const raw = await notificationDeliveriesListValidator.validate(request.qs())
    const page = raw.page ?? defaultListParams.page
    const limit = raw.limit ?? defaultListParams.limit

    let baseQuery = NotificationDelivery.query()

    if (raw.status) baseQuery = baseQuery.where('status', raw.status)
    if (raw.recipientType) baseQuery = baseQuery.where('recipient_type', raw.recipientType)
    if (raw.notificationTypeSlug) {
      baseQuery = baseQuery.whereHas('notificationType', (q) =>
        q.where('slug', raw.notificationTypeSlug!)
      )
    }

    const total = await baseQuery.clone().count('* as total').first()
    const totalCount = Number(total?.$extras?.total ?? 0)
    const items = await baseQuery
      .preload('channel')
      .preload('notificationType')
      .orderBy('created_at', 'desc')
      .offset((page - 1) * limit)
      .limit(limit)

    return response.ok({
      data: items.map((d) => ({
        id: d.id,
        recipientType: d.recipientType,
        recipientId: d.recipientId,
        channelSlug: d.channel.slug,
        notificationTypeSlug: d.notificationType.slug,
        status: d.status,
        retryCount: d.retryCount,
        maxRetries: d.maxRetries,
        lastError: d.lastError,
        sentAt: d.sentAt?.toISO() ?? null,
        createdAt: d.createdAt.toISO(),
      })),
      meta: { page, limit, total: totalCount },
    })
  }

  /**
   * POST /notifications/send - send a notification using a template (internal/admin).
   */
  async send({ request, response }: HttpContext) {
    const body = await sendNotificationValidator.validate(request.all())

    const variables: Record<string, string | number> = {}
    for (const [k, v] of Object.entries(body.variables || {})) {
      if (v !== undefined && v !== null) variables[k] = typeof v === 'number' ? v : String(v)
    }

    try {
      const { delivery, ok } = await notificationSendService.send({
        notificationTypeSlug: body.notificationTypeSlug,
        channelSlug: body.channelSlug,
        productType: body.productType,
        recipientType: body.recipientType,
        recipientId: body.recipientId,
        recipientEmail: body.recipientEmail,
        variables,
        inAppTitle: body.inAppTitle,
        inAppMessage: body.inAppMessage,
        inAppData: body.inAppData as Record<string, unknown> | undefined,
        maxRetries: body.maxRetries,
      })

      return response.ok({
        deliveryId: delivery.id,
        status: delivery.status,
        ok,
      })
    } catch (err: any) {
      return response.badRequest({ message: err.message ?? 'Failed to send notification' })
    }
  }

  /**
   * POST /notification-deliveries/:id/retry - retry a single failed delivery.
   */
  async retry({ params, response }: HttpContext) {
    try {
      const result = await notificationSendService.retryDelivery(Number(params.id))
      return response.ok({ ok: result.ok, error: result.error })
    } catch (_) {
      return response.notFound({ message: 'Delivery not found or not retryable' })
    }
  }

  /**
   * POST /notification-deliveries/retry-failed - process all failed deliveries with retries left.
   */
  async retryFailed({ request, response }: HttpContext) {
    const limit = Math.min(Number(request.input('limit', 50)), 100)
    const { processed, succeeded } = await notificationSendService.processRetries(limit)
    return response.ok({ processed, succeeded })
  }
}
