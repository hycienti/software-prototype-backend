import { DateTime } from 'luxon'
import Mood from '#models/mood'

export default class MoodRepository {
  async findByUserIdAndEntryDate(
    userId: number,
    entryDateIso: string
  ): Promise<Mood[]> {
    return Mood.query()
      .where('user_id', userId)
      .where('entry_date', entryDateIso)
  }

  async create(data: {
    userId: number
    mood: string
    intensity: number
    notes: string | null
    photoUrl: string | null
    entryDate: DateTime
    tags: string[] | null
    metadata: Record<string, unknown> | null
  }): Promise<Mood> {
    return Mood.create(data)
  }

  async findByIdAndUserId(id: number, userId: number): Promise<Mood> {
    return Mood.query().where('id', id).where('user_id', userId).firstOrFail()
  }

  async listByUserIdPaginated(
    userId: number,
    page: number,
    limit: number,
    filters?: { startDate?: Date; endDate?: Date; mood?: string }
  ): Promise<{ data: Mood[]; total: number; page: number; perPage: number; lastPage: number }> {
    const query = Mood.query()
      .where('user_id', userId)
      .orderBy('entry_date', 'desc')
      .orderBy('created_at', 'desc')
    if (filters?.startDate) {
      query.where('entry_date', '>=', DateTime.fromJSDate(filters.startDate).toISODate()!)
    }
    if (filters?.endDate) {
      query.where('entry_date', '<=', DateTime.fromJSDate(filters.endDate).toISODate()!)
    }
    if (filters?.mood) {
      query.where('mood', filters.mood)
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

  async listRecentForUser(userId: number, limit: number = 365): Promise<Mood[]> {
    return Mood.query()
      .where('user_id', userId)
      .orderBy('entry_date', 'desc')
      .limit(limit)
  }

  async listAllByUserId(userId: number): Promise<Mood[]> {
    return Mood.query().where('user_id', userId)
  }

  async getLastEntryByUserId(userId: number): Promise<Mood | null> {
    return Mood.query()
      .where('user_id', userId)
      .orderBy('entry_date', 'desc')
      .first()
  }

  async countByUserId(userId: number): Promise<number> {
    const result = await Mood.query()
      .where('user_id', userId)
      .count('* as total')
      .first()
    return Number(result?.$extras?.total ?? 0)
  }

  async update(
    mood: Mood,
    payload: {
      mood?: string
      intensity?: number
      notes?: string | null
      photoUrl?: string | null
      tags?: string[] | null
      metadata?: Record<string, unknown> | null
    }
  ): Promise<Mood> {
    if (payload.mood !== undefined) mood.mood = payload.mood
    if (payload.intensity !== undefined) mood.intensity = payload.intensity
    if (payload.notes !== undefined) mood.notes = payload.notes
    if (payload.photoUrl !== undefined) mood.photoUrl = payload.photoUrl
    if (payload.tags !== undefined) mood.tags = payload.tags
    if (payload.metadata !== undefined) mood.metadata = payload.metadata
    await mood.save()
    return mood
  }

  async delete(mood: Mood): Promise<void> {
    await mood.delete()
  }
}
