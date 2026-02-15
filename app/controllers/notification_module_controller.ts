import type { HttpContext } from '@adonisjs/core/http'
import NotificationChannel from '#models/notification_channel'
import NotificationCategory from '#models/notification_category'
import NotificationType from '#models/notification_type'
import NotificationTemplate from '#models/notification_template'
import NotificationDelivery from '#models/notification_delivery'
import {
  notificationTemplatesListValidator,
  notificationDeliveriesListValidator,
  defaultListParams,
} from '#validators/list_validator'
import {
  createChannelValidator,
  updateChannelValidator,
  createCategoryValidator,
  updateCategoryValidator,
  createTypeValidator,
  updateTypeValidator,
  createTemplateValidator,
  updateTemplateValidator,
} from '#validators/notification_validator'

/**
 * APIs for the notification module: CRUD for channels, categories, types, templates; list deliveries.
 * Sending is done via notificationSendService in the backend. Retries run via background job (Ace command).
 */
export default class NotificationModuleController {
  // ---------- Channels ----------
  async channels({ response }: HttpContext) {
    const list = await NotificationChannel.query().orderBy('id', 'asc')
    return response.ok(list.map((c) => ({ id: c.id, name: c.name, slug: c.slug })))
  }

  async showChannel({ params, response }: HttpContext) {
    const channel = await NotificationChannel.findOrFail(params.id)
    return response.ok({ id: channel.id, name: channel.name, slug: channel.slug })
  }

  async storeChannel({ request, response }: HttpContext) {
    const body = await createChannelValidator.validate(request.all())
    const channel = await NotificationChannel.create(body)
    return response.created({ id: channel.id, name: channel.name, slug: channel.slug })
  }

  async updateChannel({ params, request, response }: HttpContext) {
    const channel = await NotificationChannel.findOrFail(params.id)
    const body = await updateChannelValidator.validate(request.all())
    channel.merge(body)
    await channel.save()
    return response.ok({ id: channel.id, name: channel.name, slug: channel.slug })
  }

  async destroyChannel({ params, response }: HttpContext) {
    const channel = await NotificationChannel.findOrFail(params.id)
    await channel.delete()
    return response.noContent()
  }

  // ---------- Categories ----------
  async categories({ response }: HttpContext) {
    const list = await NotificationCategory.query().orderBy('id', 'asc')
    return response.ok(list.map((c) => ({ id: c.id, name: c.name, slug: c.slug })))
  }

  async showCategory({ params, response }: HttpContext) {
    const category = await NotificationCategory.findOrFail(params.id)
    return response.ok({ id: category.id, name: category.name, slug: category.slug })
  }

  async storeCategory({ request, response }: HttpContext) {
    const body = await createCategoryValidator.validate(request.all())
    const category = await NotificationCategory.create(body)
    return response.created({ id: category.id, name: category.name, slug: category.slug })
  }

  async updateCategory({ params, request, response }: HttpContext) {
    const category = await NotificationCategory.findOrFail(params.id)
    const body = await updateCategoryValidator.validate(request.all())
    category.merge(body)
    await category.save()
    return response.ok({ id: category.id, name: category.name, slug: category.slug })
  }

  async destroyCategory({ params, response }: HttpContext) {
    const category = await NotificationCategory.findOrFail(params.id)
    await category.delete()
    return response.noContent()
  }

  // ---------- Types ----------
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

  async showType({ params, response }: HttpContext) {
    const type = await NotificationType.query().where('id', params.id).preload('category').firstOrFail()
    return response.ok({
      id: type.id,
      categoryId: type.categoryId,
      categorySlug: type.category.slug,
      name: type.name,
      slug: type.slug,
      description: type.description,
    })
  }

  async storeType({ request, response }: HttpContext) {
    const body = await createTypeValidator.validate(request.all())
    const type = await NotificationType.create(body)
    await type.load('category')
    return response.created({
      id: type.id,
      categoryId: type.categoryId,
      categorySlug: type.category.slug,
      name: type.name,
      slug: type.slug,
      description: type.description,
    })
  }

  async updateType({ params, request, response }: HttpContext) {
    const type = await NotificationType.findOrFail(params.id)
    const body = await updateTypeValidator.validate(request.all())
    type.merge(body)
    await type.save()
    await type.load('category')
    return response.ok({
      id: type.id,
      categoryId: type.categoryId,
      categorySlug: type.category.slug,
      name: type.name,
      slug: type.slug,
      description: type.description,
    })
  }

  async destroyType({ params, response }: HttpContext) {
    const type = await NotificationType.findOrFail(params.id)
    await type.delete()
    return response.noContent()
  }

  // ---------- Templates ----------
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
        bodyHtml: t.bodyHtml,
        bodyText: t.bodyText,
        templateVariables: t.templateVariables,
      })),
      meta: { page, limit, total: totalCount },
    })
  }

  async showTemplate({ params, response }: HttpContext) {
    const template = await NotificationTemplate.query()
      .where('id', params.id)
      .preload('notificationType')
      .preload('channel')
      .firstOrFail()
    return response.ok({
      id: template.id,
      notificationTypeId: template.notificationTypeId,
      notificationTypeSlug: template.notificationType.slug,
      channelId: template.channelId,
      channelSlug: template.channel.slug,
      productType: template.productType,
      locale: template.locale,
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText,
      templateVariables: template.templateVariables,
    })
  }

  async storeTemplate({ request, response }: HttpContext) {
    const body = await createTemplateValidator.validate(request.all())
    const template = await NotificationTemplate.create({
      notificationTypeId: body.notificationTypeId,
      channelId: body.channelId,
      productType: body.productType,
      locale: body.locale ?? 'en',
      subject: body.subject ?? null,
      bodyHtml: body.bodyHtml,
      bodyText: body.bodyText ?? null,
      templateVariables: body.templateVariables ?? [],
    })
    await template.load('notificationType')
    await template.load('channel')
    return response.created({
      id: template.id,
      notificationTypeId: template.notificationTypeId,
      notificationTypeSlug: template.notificationType.slug,
      channelId: template.channelId,
      channelSlug: template.channel.slug,
      productType: template.productType,
      locale: template.locale,
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText,
      templateVariables: template.templateVariables,
    })
  }

  async updateTemplate({ params, request, response }: HttpContext) {
    const template = await NotificationTemplate.findOrFail(params.id)
    const body = await updateTemplateValidator.validate(request.all())
    const updates: Partial<{
      notificationTypeId: number
      channelId: number
      productType: string
      locale: string
      subject: string | null
      bodyHtml: string
      bodyText: string | null
      templateVariables: string[]
    }> = {}
    if (body.notificationTypeId !== undefined) updates.notificationTypeId = body.notificationTypeId
    if (body.channelId !== undefined) updates.channelId = body.channelId
    if (body.productType !== undefined) updates.productType = body.productType
    if (body.locale !== undefined) updates.locale = body.locale
    if (body.subject !== undefined) updates.subject = body.subject
    if (body.bodyHtml !== undefined) updates.bodyHtml = body.bodyHtml
    if (body.bodyText !== undefined) updates.bodyText = body.bodyText
    if (body.templateVariables !== undefined) updates.templateVariables = body.templateVariables
    template.merge(updates)
    await template.save()
    await template.load('notificationType')
    await template.load('channel')
    return response.ok({
      id: template.id,
      notificationTypeId: template.notificationTypeId,
      notificationTypeSlug: template.notificationType.slug,
      channelId: template.channelId,
      channelSlug: template.channel.slug,
      productType: template.productType,
      locale: template.locale,
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText,
      templateVariables: template.templateVariables,
    })
  }

  async destroyTemplate({ params, response }: HttpContext) {
    const template = await NotificationTemplate.findOrFail(params.id)
    await template.delete()
    return response.noContent()
  }

  // ---------- Deliveries (read-only list) ----------
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
}
