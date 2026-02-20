import type { HttpContext } from '@adonisjs/core/http'
import type Mood from '#models/mood'
import MoodService from '#services/mood_service'
import {
  createMoodValidator,
  updateMoodValidator,
  getMoodHistoryValidator,
} from '#validators/mood_validator'
import logger from '@adonisjs/core/services/logger'
import { successResponse } from '#utils/response_helper'

const moodService = new MoodService()

function serializeMood(m: Mood) {
  return {
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
  }
}

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
  async create(ctx: HttpContext) {
    try {
      const user = ctx.auth.user!
      const payload = await createMoodValidator.validate(ctx.request.all())

      const mood = await moodService.create(user.id, {
        mood: payload.mood,
        intensity: payload.intensity,
        notes: payload.notes,
        photoUrl: payload.photoUrl,
        entryDate: payload.entryDate,
        tags: payload.tags,
        metadata: payload.metadata,
      })

      logger.info('Mood entry created', {
        userId: user.id,
        moodId: mood.id,
        mood: mood.mood,
        entryDate: mood.entryDate.toISODate(),
      })

      return successResponse(ctx, { mood: serializeMood(mood) }, 201)
    } catch (error) {
      logger.error('Error creating mood entry', { error })
      throw error
    }
  }

  /**
   * @index
   * @summary Get user's mood entries
   * @description Returns paginated list of mood entries for the authenticated user
   */
  async index(ctx: HttpContext) {
    try {
      const user = ctx.auth.user!
      const payload = await getMoodHistoryValidator.validate(ctx.request.qs())

      const result = await moodService.listForUser(user.id, {
        page: payload.page,
        limit: payload.limit,
        startDate: payload.startDate,
        endDate: payload.endDate,
        mood: payload.mood,
      })

      return successResponse(ctx, {
        data: result.data.map(serializeMood),
        meta: {
          total: result.total,
          page: result.page,
          limit: result.perPage,
          lastPage: result.lastPage,
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
   */
  async show(ctx: HttpContext) {
    try {
      const user = ctx.auth.user!
      const mood = await moodService.getById(user.id, Number(ctx.params.id))
      return successResponse(ctx, { mood: serializeMood(mood) })
    } catch (error) {
      logger.error('Error fetching mood entry', { error })
      throw error
    }
  }

  /**
   * @update
   * @summary Update a mood entry
   */
  async update(ctx: HttpContext) {
    try {
      const user = ctx.auth.user!
      const payload = await updateMoodValidator.validate(ctx.request.all())

      const mood = await moodService.update(user.id, Number(ctx.params.id), {
        mood: payload.mood,
        intensity: payload.intensity,
        notes: payload.notes,
        photoUrl: payload.photoUrl,
        tags: payload.tags,
        metadata: payload.metadata,
      })

      logger.info('Mood entry updated', { userId: user.id, moodId: mood.id })
      return successResponse(ctx, { mood: serializeMood(mood) })
    } catch (error) {
      logger.error('Error updating mood entry', { error })
      throw error
    }
  }

  /**
   * @destroy
   * @summary Delete a mood entry
   */
  async destroy(ctx: HttpContext) {
    try {
      const user = ctx.auth.user!
      await moodService.destroy(user.id, Number(ctx.params.id))
      logger.info('Mood entry deleted', { userId: user.id, moodId: ctx.params.id })
      return successResponse(ctx, { message: 'Mood entry deleted successfully' })
    } catch (error) {
      logger.error('Error deleting mood entry', { error })
      throw error
    }
  }

  /**
   * @streak
   * @summary Get current mood tracking streak
   */
  async streak(ctx: HttpContext) {
    try {
      const user = ctx.auth.user!
      const result = await moodService.getStreak(user.id)
      return successResponse(ctx, result)
    } catch (error) {
      logger.error('Error fetching mood streak', { error })
      throw error
    }
  }

  /**
   * @insights
   * @summary Get mood insights
   */
  async insights(ctx: HttpContext) {
    try {
      const user = ctx.auth.user!
      const insights = await moodService.getMoodInsights(user.id)
      return successResponse(ctx, insights)
    } catch (error) {
      logger.error('Error fetching mood insights', { error })
      throw error
    }
  }
}
