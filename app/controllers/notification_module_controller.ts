import type { HttpContext } from '@adonisjs/core/http'
import NotificationModuleService from '#services/notification_module_service'
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
import { successResponse } from '#utils/response_helper'

const notificationModuleService = new NotificationModuleService()

export default class NotificationModuleController {
  async channels(ctx: HttpContext) {
    const list = await notificationModuleService.listChannels()
    return successResponse(
      ctx,
      list.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))
    )
  }

  async showChannel(ctx: HttpContext) {
    const channel = await notificationModuleService.getChannelById(Number(ctx.params.id))
    return successResponse(ctx, { id: channel.id, name: channel.name, slug: channel.slug })
  }

  async storeChannel(ctx: HttpContext) {
    const body = await createChannelValidator.validate(ctx.request.all())
    const channel = await notificationModuleService.createChannel(body)
    return successResponse(ctx, { id: channel.id, name: channel.name, slug: channel.slug }, 201)
  }

  async updateChannel(ctx: HttpContext) {
    const body = await updateChannelValidator.validate(ctx.request.all())
    const channel = await notificationModuleService.updateChannel(Number(ctx.params.id), body)
    return successResponse(ctx, { id: channel.id, name: channel.name, slug: channel.slug })
  }

  async destroyChannel(ctx: HttpContext) {
    await notificationModuleService.deleteChannel(Number(ctx.params.id))
    return ctx.response.status(204).send(null)
  }

  async categories(ctx: HttpContext) {
    const list = await notificationModuleService.listCategories()
    return successResponse(
      ctx,
      list.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))
    )
  }

  async showCategory(ctx: HttpContext) {
    const category = await notificationModuleService.getCategoryById(Number(ctx.params.id))
    return successResponse(ctx, { id: category.id, name: category.name, slug: category.slug })
  }

  async storeCategory(ctx: HttpContext) {
    const body = await createCategoryValidator.validate(ctx.request.all())
    const category = await notificationModuleService.createCategory(body)
    return successResponse(ctx, { id: category.id, name: category.name, slug: category.slug }, 201)
  }

  async updateCategory(ctx: HttpContext) {
    const body = await updateCategoryValidator.validate(ctx.request.all())
    const category = await notificationModuleService.updateCategory(Number(ctx.params.id), body)
    return successResponse(ctx, { id: category.id, name: category.name, slug: category.slug })
  }

  async destroyCategory(ctx: HttpContext) {
    await notificationModuleService.deleteCategory(Number(ctx.params.id))
    return ctx.response.status(204).send(null)
  }

  async types(ctx: HttpContext) {
    const list = await notificationModuleService.listTypes()
    return successResponse(
      ctx,
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

  async showType(ctx: HttpContext) {
    const type = await notificationModuleService.getTypeById(Number(ctx.params.id))
    return successResponse(ctx, {
      id: type.id,
      categoryId: type.categoryId,
      categorySlug: type.category.slug,
      name: type.name,
      slug: type.slug,
      description: type.description,
    })
  }

  async storeType(ctx: HttpContext) {
    const body = await createTypeValidator.validate(ctx.request.all())
    const type = await notificationModuleService.createType(body)
    return successResponse(
      ctx,
      {
        id: type.id,
        categoryId: type.categoryId,
        categorySlug: type.category.slug,
        name: type.name,
        slug: type.slug,
        description: type.description,
      },
      201
    )
  }

  async updateType(ctx: HttpContext) {
    const body = await updateTypeValidator.validate(ctx.request.all())
    const type = await notificationModuleService.updateType(Number(ctx.params.id), body)
    return successResponse(ctx, {
      id: type.id,
      categoryId: type.categoryId,
      categorySlug: type.category.slug,
      name: type.name,
      slug: type.slug,
      description: type.description,
    })
  }

  async destroyType(ctx: HttpContext) {
    await notificationModuleService.deleteType(Number(ctx.params.id))
    return ctx.response.status(204).send(null)
  }

  async templates(ctx: HttpContext) {
    const raw = await notificationTemplatesListValidator.validate(ctx.request.qs())
    const page = raw.page ?? defaultListParams.page
    const limit = raw.limit ?? defaultListParams.limit
    const result = await notificationModuleService.listTemplates(page, limit, {
      notificationTypeId: raw.notificationTypeId,
      channelId: raw.channelId,
      productType: raw.productType,
    })
    return successResponse(ctx, {
      data: result.data.map((t) => ({
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
      meta: { page, limit, total: result.total },
    })
  }

  async showTemplate(ctx: HttpContext) {
    const template = await notificationModuleService.getTemplateById(Number(ctx.params.id))
    return successResponse(ctx, {
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

  async storeTemplate(ctx: HttpContext) {
    const body = await createTemplateValidator.validate(ctx.request.all())
    const template = await notificationModuleService.createTemplate({
      notificationTypeId: body.notificationTypeId,
      channelId: body.channelId,
      productType: body.productType,
      locale: body.locale,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      bodyText: body.bodyText,
      templateVariables: body.templateVariables,
    })
    return successResponse(
      ctx,
      {
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
      },
      201
    )
  }

  async updateTemplate(ctx: HttpContext) {
    const body = await updateTemplateValidator.validate(ctx.request.all())
    const updates: Record<string, any> = {}
    if (body.notificationTypeId !== undefined) updates.notificationTypeId = body.notificationTypeId
    if (body.channelId !== undefined) updates.channelId = body.channelId
    if (body.productType !== undefined) updates.productType = body.productType
    if (body.locale !== undefined) updates.locale = body.locale
    if (body.subject !== undefined) updates.subject = body.subject
    if (body.bodyHtml !== undefined) updates.bodyHtml = body.bodyHtml
    if (body.bodyText !== undefined) updates.bodyText = body.bodyText
    if (body.templateVariables !== undefined) updates.templateVariables = body.templateVariables
    const template = await notificationModuleService.updateTemplate(Number(ctx.params.id), updates)
    return successResponse(ctx, {
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

  async destroyTemplate(ctx: HttpContext) {
    await notificationModuleService.deleteTemplate(Number(ctx.params.id))
    return ctx.response.status(204).send(null)
  }

  async deliveries(ctx: HttpContext) {
    const raw = await notificationDeliveriesListValidator.validate(ctx.request.qs())
    const page = raw.page ?? defaultListParams.page
    const limit = raw.limit ?? defaultListParams.limit
    const result = await notificationModuleService.listDeliveries(page, limit, {
      status: raw.status,
      recipientType: raw.recipientType,
      notificationTypeSlug: raw.notificationTypeSlug,
    })
    return successResponse(ctx, {
      data: result.data.map((d) => ({
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
      meta: { page, limit, total: result.total },
    })
  }
}
