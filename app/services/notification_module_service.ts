import NotificationChannelRepository from '#repositories/notification_channel_repository'
import NotificationCategoryRepository from '#repositories/notification_category_repository'
import NotificationTypeRepository from '#repositories/notification_type_repository'
import NotificationTemplateRepository from '#repositories/notification_template_repository'
import NotificationDeliveryRepository from '#repositories/notification_delivery_repository'

const channelRepo = new NotificationChannelRepository()
const categoryRepo = new NotificationCategoryRepository()
const typeRepo = new NotificationTypeRepository()
const templateRepo = new NotificationTemplateRepository()
const deliveryRepo = new NotificationDeliveryRepository()

export default class NotificationModuleService {
  async listChannels() {
    return channelRepo.listAll()
  }

  async getChannelById(id: number) {
    return channelRepo.findById(id)
  }

  async createChannel(data: { name: string; slug: string }) {
    return channelRepo.create(data)
  }

  async updateChannel(id: number, data: { name?: string; slug?: string }) {
    const channel = await channelRepo.findById(id)
    return channelRepo.update(channel, data)
  }

  async deleteChannel(id: number) {
    const channel = await channelRepo.findById(id)
    await channelRepo.delete(channel)
  }

  async listCategories() {
    return categoryRepo.listAll()
  }

  async getCategoryById(id: number) {
    return categoryRepo.findById(id)
  }

  async createCategory(data: { name: string; slug: string }) {
    return categoryRepo.create(data)
  }

  async updateCategory(id: number, data: { name?: string; slug?: string }) {
    const cat = await categoryRepo.findById(id)
    return categoryRepo.update(cat, data)
  }

  async deleteCategory(id: number) {
    const cat = await categoryRepo.findById(id)
    await categoryRepo.delete(cat)
  }

  async listTypes() {
    return typeRepo.listAllWithCategory()
  }

  async getTypeById(id: number) {
    return typeRepo.findByIdWithCategory(id)
  }

  async createType(data: { categoryId: number; name: string; slug: string; description?: string | null }) {
    const type = await typeRepo.create(data)
    return typeRepo.findByIdWithCategory(type.id)
  }

  async updateType(id: number, data: { categoryId?: number; name?: string; slug?: string; description?: string | null }) {
    const type = await typeRepo.findById(id)
    await typeRepo.update(type, data)
    return typeRepo.findByIdWithCategory(id)
  }

  async deleteType(id: number) {
    const type = await typeRepo.findById(id)
    await typeRepo.delete(type)
  }

  async listTemplates(
    page: number,
    limit: number,
    filters?: { notificationTypeId?: number; channelId?: number; productType?: string }
  ) {
    return templateRepo.listPaginated(page, limit, filters)
  }

  async getTemplateById(id: number) {
    return templateRepo.findByIdWithRelations(id)
  }

  async createTemplate(data: {
    notificationTypeId: number
    channelId: number
    productType: string
    locale?: string
    subject?: string | null
    bodyHtml: string
    bodyText?: string | null
    templateVariables?: string[]
  }) {
    const template = await templateRepo.create({
      ...data,
      locale: data.locale ?? 'en',
      templateVariables: data.templateVariables ?? [],
    })
    return templateRepo.findByIdWithRelations(template.id)
  }

  async updateTemplate(id: number, data: Partial<{
    notificationTypeId: number
    channelId: number
    productType: string
    locale: string
    subject: string | null
    bodyHtml: string
    bodyText: string | null
    templateVariables: string[]
  }>) {
    const template = await templateRepo.findByIdWithRelations(id)
    await templateRepo.update(template, data)
    return templateRepo.findByIdWithRelations(id)
  }

  async deleteTemplate(id: number) {
    const template = await templateRepo.findByIdWithRelations(id)
    await templateRepo.delete(template)
  }

  async listDeliveries(
    page: number,
    limit: number,
    filters?: { status?: string; recipientType?: string; notificationTypeSlug?: string }
  ) {
    return deliveryRepo.listPaginated(page, limit, filters)
  }
}
