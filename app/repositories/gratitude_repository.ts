import { DateTime } from 'luxon'
import Gratitude from '#models/gratitude'

export default class GratitudeRepository {
  async findByUserIdAndEntryDate(userId: number, entryDateIso: string): Promise<Gratitude | null> {
    return Gratitude.query()
      .where('user_id', userId)
      .where('entry_date', entryDateIso)
      .first()
  }

  async create(data: {
    userId: number
    entries: string[]
    photoUrl: string | null
    entryDate: DateTime
    metadata: Record<string, unknown> | null
  }): Promise<Gratitude> {
    return Gratitude.create(data)
  }

  async findByIdAndUserId(id: number, userId: number): Promise<Gratitude> {
    return Gratitude.query().where('id', id).where('user_id', userId).firstOrFail()
  }

  async listByUserIdPaginated(
    userId: number,
    page: number,
    limit: number,
    filters?: { startDate?: Date; endDate?: Date }
  ): Promise<{ data: Gratitude[]; total: number; page: number; perPage: number; lastPage: number }> {
    const query = Gratitude.query().where('user_id', userId).orderBy('entry_date', 'desc')
    if (filters?.startDate) {
      query.where('entry_date', '>=', DateTime.fromJSDate(filters.startDate).toISODate()!)
    }
    if (filters?.endDate) {
      query.where('entry_date', '<=', DateTime.fromJSDate(filters.endDate).toISODate()!)
    }
    const paginated = await query.paginate(page, limit)
    return {
      data: paginated.all(),
      total: paginated.total,
      page: paginated.currentPage,
      perPage: paginated.perPage,
      lastPage: paginated.lastPage,
    }
  }

  async listRecentForUser(userId: number, limit: number = 365): Promise<Gratitude[]> {
    return Gratitude.query()
      .where('user_id', userId)
      .orderBy('entry_date', 'desc')
      .limit(limit)
  }

  async listAllByUserId(userId: number): Promise<Gratitude[]> {
    return Gratitude.query().where('user_id', userId)
  }

  async getLastEntryByUserId(userId: number): Promise<Gratitude | null> {
    return Gratitude.query()
      .where('user_id', userId)
      .orderBy('entry_date', 'desc')
      .first()
  }

  async countByUserId(userId: number): Promise<number> {
    const result = await Gratitude.query()
      .where('user_id', userId)
      .count('* as total')
      .first()
    return Number(result?.$extras?.total ?? 0)
  }

  async update(gratitude: Gratitude, payload: { entries?: string[]; photoUrl?: string | null; metadata?: Record<string, unknown> | null }): Promise<Gratitude> {
    if (payload.entries !== undefined) gratitude.entries = payload.entries
    if (payload.photoUrl !== undefined) gratitude.photoUrl = payload.photoUrl
    if (payload.metadata !== undefined) gratitude.metadata = payload.metadata
    await gratitude.save()
    return gratitude
  }

  async delete(gratitude: Gratitude): Promise<void> {
    await gratitude.delete()
  }
}
