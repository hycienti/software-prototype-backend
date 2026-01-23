import type { HttpContext } from '@adonisjs/core/http'
import Mood from '#models/mood'
import MoodService from '#services/mood_service'
import {
  createMoodValidator,
  updateMoodValidator,
  getMoodHistoryValidator,
} from '#validators/mood_validator'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'

const moodService = new MoodService()

export default class MoodController {
  /**
   * @create
   * @summary Create a new mood entry
   * @description Creates a new mood journal entry for the authenticated user
   * @requestBody {"mood": "happy", "intensity": 7, "notes": "Feeling great today!", "entryDate": "2026-01-20"}
   * @responseBody 201 - {"mood": {"id": 1, "mood": "happy", "intensity": 7, ...}}
   * @responseBody 400 - {"errors": []}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async create({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const payload = await createMoodValidator.validate(request.all())

      // Use provided date or default to today
      const entryDate = payload.entryDate
        ? DateTime.fromJSDate(payload.entryDate)
        : DateTime.now()

      const mood = await Mood.create({
        userId: user.id,
        mood: payload.mood,
        intensity: payload.intensity,
        notes: payload.notes || null,
        photoUrl: payload.photoUrl || null,
        entryDate: entryDate.startOf('day'),
        tags: payload.tags || null,
        metadata: payload.metadata || null,
      })

      // Check and update achievements
      await moodService.checkAndUpdateAchievements(user.id)

      logger.info('Mood entry created', {
        userId: user.id,
        moodId: mood.id,
        mood: mood.mood,
        entryDate: entryDate.toISODate(),
      })

      return response.created({
        mood: {
          id: mood.id,
          mood: mood.mood,
          intensity: mood.intensity,
          notes: mood.notes,
          photoUrl: mood.photoUrl,
          entryDate: mood.entryDate.toISODate(),
          tags: mood.tags,
          metadata: mood.metadata,
          createdAt: mood.createdAt.toISO(),
          updatedAt: mood.updatedAt?.toISO(),
        },
      })
    } catch (error) {
      logger.error('Error creating mood entry', { error })
      throw error
    }
  }

  /**
   * @index
   * @summary Get user's mood entries
   * @description Returns paginated list of mood entries for the authenticated user
   * @queryParam page - Page number (optional)
   * @queryParam limit - Items per page (optional, max 100)
   * @queryParam startDate - Start date filter (optional)
   * @queryParam endDate - End date filter (optional)
   * @queryParam mood - Filter by mood type (optional)
   * @responseBody 200 - {"data": [...], "meta": {"total": 10, "page": 1, "limit": 20}}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async index({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const payload = await getMoodHistoryValidator.validate(request.qs())

      const page = payload.page || 1
      const limit = Math.min(payload.limit || 20, 100)

      const query = Mood.query()
        .where('user_id', user.id)
        .orderBy('entry_date', 'desc')
        .orderBy('created_at', 'desc')

      // Apply date filters if provided
      if (payload.startDate) {
        query.where('entry_date', '>=', DateTime.fromJSDate(payload.startDate).toISODate()!)
      }
      if (payload.endDate) {
        query.where('entry_date', '<=', DateTime.fromJSDate(payload.endDate).toISODate()!)
      }
      if (payload.mood) {
        query.where('mood', payload.mood)
      }

      const moods = await query.paginate(page, limit)

      return response.ok({
        data: moods.all().map((m) => ({
          id: m.id,
          mood: m.mood,
          intensity: m.intensity,
          notes: m.notes,
          photoUrl: m.photoUrl,
          entryDate: m.entryDate.toISODate(),
          tags: m.tags,
          metadata: m.metadata,
          createdAt: m.createdAt.toISO(),
          updatedAt: m.updatedAt?.toISO(),
        })),
        meta: {
          total: moods.total,
          page: moods.currentPage,
          limit: moods.perPage,
          lastPage: moods.lastPage,
        },
      })
    } catch (error) {
      logger.error('Error fetching mood entries', { error })
      throw error
    }
  }

  /**
   * @show
   * @summary Get a specific mood entry
   * @description Returns a specific mood entry by ID
   * @responseBody 200 - {"mood": {...}}
   * @responseBody 404 - {"message": "Mood entry not found"}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async show({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const mood = await Mood.query()
        .where('id', params.id)
        .where('user_id', user.id)
        .firstOrFail()

      return response.ok({
        mood: {
          id: mood.id,
          mood: mood.mood,
          intensity: mood.intensity,
          notes: mood.notes,
          photoUrl: mood.photoUrl,
          entryDate: mood.entryDate.toISODate(),
          tags: mood.tags,
          metadata: mood.metadata,
          createdAt: mood.createdAt.toISO(),
          updatedAt: mood.updatedAt?.toISO(),
        },
      })
    } catch (error) {
      logger.error('Error fetching mood entry', { error })
      throw error
    }
  }

  /**
   * @update
   * @summary Update a mood entry
   * @description Updates an existing mood entry
   * @requestBody {"mood": "calm", "intensity": 5, "notes": "Updated notes"}
   * @responseBody 200 - {"mood": {...}}
   * @responseBody 404 - {"message": "Mood entry not found"}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async update({ auth, params, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const payload = await updateMoodValidator.validate(request.all())

      const mood = await Mood.query()
        .where('id', params.id)
        .where('user_id', user.id)
        .firstOrFail()

      if (payload.mood) {
        mood.mood = payload.mood
      }
      if (payload.intensity !== undefined) {
        mood.intensity = payload.intensity
      }
      if (payload.notes !== undefined) {
        mood.notes = payload.notes
      }
      if (payload.photoUrl !== undefined) {
        mood.photoUrl = payload.photoUrl
      }
      if (payload.tags !== undefined) {
        mood.tags = payload.tags
      }
      if (payload.metadata !== undefined) {
        mood.metadata = payload.metadata
      }

      await mood.save()

      logger.info('Mood entry updated', {
        userId: user.id,
        moodId: mood.id,
      })

      return response.ok({
        mood: {
          id: mood.id,
          mood: mood.mood,
          intensity: mood.intensity,
          notes: mood.notes,
          photoUrl: mood.photoUrl,
          entryDate: mood.entryDate.toISODate(),
          tags: mood.tags,
          metadata: mood.metadata,
          createdAt: mood.createdAt.toISO(),
          updatedAt: mood.updatedAt?.toISO(),
        },
      })
    } catch (error) {
      logger.error('Error updating mood entry', { error })
      throw error
    }
  }

  /**
   * @destroy
   * @summary Delete a mood entry
   * @description Deletes a mood entry
   * @responseBody 200 - {"message": "Mood entry deleted successfully"}
   * @responseBody 404 - {"message": "Mood entry not found"}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async destroy({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const mood = await Mood.query()
        .where('id', params.id)
        .where('user_id', user.id)
        .firstOrFail()

      await mood.delete()

      // Recalculate achievements after deletion
      await moodService.checkAndUpdateAchievements(user.id)

      logger.info('Mood entry deleted', {
        userId: user.id,
        moodId: params.id,
      })

      return response.ok({ message: 'Mood entry deleted successfully' })
    } catch (error) {
      logger.error('Error deleting mood entry', { error })
      throw error
    }
  }

  /**
   * @streak
   * @summary Get current mood tracking streak
   * @description Returns the current consecutive days streak for mood tracking
   * @responseBody 200 - {"streak": 12, "lastEntryDate": "2026-01-20"}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async streak({ auth, response }: HttpContext) {
    try {
      const user = auth.user!
      const streak = await moodService.calculateStreak(user.id)

      // Get last entry date
      const lastEntry = await Mood.query()
        .where('user_id', user.id)
        .orderBy('entry_date', 'desc')
        .first()

      return response.ok({
        streak,
        lastEntryDate: lastEntry?.entryDate.toISODate() || null,
      })
    } catch (error) {
      logger.error('Error fetching mood streak', { error })
      throw error
    }
  }

  /**
   * @insights
   * @summary Get mood insights
   * @description Returns analytics and insights about user's mood patterns
   * @responseBody 200 - {"totalEntries": 50, "averageIntensity": 6.5, "moodDistribution": [...], ...}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async insights({ auth, response }: HttpContext) {
    try {
      const user = auth.user!
      const insights = await moodService.getMoodInsights(user.id)

      return response.ok(insights)
    } catch (error) {
      logger.error('Error fetching mood insights', { error })
      throw error
    }
  }
}
