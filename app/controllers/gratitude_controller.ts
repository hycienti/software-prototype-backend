import type { HttpContext } from '@adonisjs/core/http'
import Gratitude from '#models/gratitude'
import GratitudeService from '#services/gratitude_service'
import QuotesService from '#services/quotes_service'
import {
  createGratitudeValidator,
  updateGratitudeValidator,
  getGratitudeHistoryValidator,
} from '#validators/gratitude_validator'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'

const gratitudeService = new GratitudeService()
const quotesService = new QuotesService()

export default class GratitudeController {
  /**
   * @create
   * @summary Create a new gratitude entry
   * @description Creates a new gratitude journal entry for the authenticated user
   * @requestBody {"entries": ["I'm grateful for...", "Another thing..."], "photoUrl": "https://...", "entryDate": "2026-01-20"}
   * @responseBody 201 - {"gratitude": {"id": 1, "entries": [...], "entryDate": "2026-01-20", ...}}
   * @responseBody 400 - {"errors": []}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async create({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const payload = await createGratitudeValidator.validate(request.all())

      // Use provided date or default to today
      const entryDate = payload.entryDate
        ? DateTime.fromJSDate(payload.entryDate)
        : DateTime.now()

      // Check if entry already exists for this date
      const existingEntry = await Gratitude.query()
        .where('user_id', user.id)
        .where('entry_date', entryDate.toISODate()!)
        .first()

      if (existingEntry) {
        return response.conflict({
          message: 'A gratitude entry already exists for this date',
          gratitude: existingEntry,
        })
      }

      const gratitude = await Gratitude.create({
        userId: user.id,
        entries: payload.entries,
        photoUrl: payload.photoUrl || null,
        entryDate: entryDate.startOf('day'),
        metadata: payload.metadata || null,
      })

      // Check and update achievements
      await gratitudeService.checkAndUpdateAchievements(user.id)

      logger.info('Gratitude entry created', {
        userId: user.id,
        gratitudeId: gratitude.id,
        entryDate: entryDate.toISODate(),
      })

      return response.created({
        gratitude: {
          id: gratitude.id,
          entries: gratitude.entries,
          photoUrl: gratitude.photoUrl,
          entryDate: gratitude.entryDate.toISODate(),
          metadata: gratitude.metadata,
          createdAt: gratitude.createdAt.toISO(),
          updatedAt: gratitude.updatedAt?.toISO(),
        },
      })
    } catch (error) {
      logger.error('Error creating gratitude entry', { error })
      throw error
    }
  }

  /**
   * @index
   * @summary Get user's gratitude entries
   * @description Returns paginated list of gratitude entries for the authenticated user
   * @queryParam page - Page number (optional)
   * @queryParam limit - Items per page (optional, max 100)
   * @queryParam startDate - Start date filter (optional)
   * @queryParam endDate - End date filter (optional)
   * @responseBody 200 - {"data": [...], "meta": {"total": 10, "page": 1, "limit": 20}}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async index({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const payload = await getGratitudeHistoryValidator.validate(request.qs())

      const page = payload.page || 1
      const limit = Math.min(payload.limit || 20, 100)

      const query = Gratitude.query()
        .where('user_id', user.id)
        .orderBy('entry_date', 'desc')

      // Apply date filters if provided
      if (payload.startDate) {
        query.where('entry_date', '>=', DateTime.fromJSDate(payload.startDate).toISODate()!)
      }
      if (payload.endDate) {
        query.where('entry_date', '<=', DateTime.fromJSDate(payload.endDate).toISODate()!)
      }

      const gratitudes = await query.paginate(page, limit)

      return response.ok({
        data: gratitudes.all().map((g) => ({
          id: g.id,
          entries: g.entries,
          photoUrl: g.photoUrl,
          entryDate: g.entryDate.toISODate(),
          metadata: g.metadata,
          createdAt: g.createdAt.toISO(),
          updatedAt: g.updatedAt?.toISO(),
        })),
        meta: {
          total: gratitudes.total,
          page: gratitudes.currentPage,
          limit: gratitudes.perPage,
          lastPage: gratitudes.lastPage,
        },
      })
    } catch (error) {
      logger.error('Error fetching gratitude entries', { error })
      throw error
    }
  }

  /**
   * @show
   * @summary Get a specific gratitude entry
   * @description Returns a specific gratitude entry by ID
   * @responseBody 200 - {"gratitude": {...}}
   * @responseBody 404 - {"message": "Gratitude entry not found"}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async show({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const gratitude = await Gratitude.query()
        .where('id', params.id)
        .where('user_id', user.id)
        .firstOrFail()

      return response.ok({
        gratitude: {
          id: gratitude.id,
          entries: gratitude.entries,
          photoUrl: gratitude.photoUrl,
          entryDate: gratitude.entryDate.toISODate(),
          metadata: gratitude.metadata,
          createdAt: gratitude.createdAt.toISO(),
          updatedAt: gratitude.updatedAt?.toISO(),
        },
      })
    } catch (error) {
      logger.error('Error fetching gratitude entry', { error })
      throw error
    }
  }

  /**
   * @update
   * @summary Update a gratitude entry
   * @description Updates an existing gratitude entry
   * @requestBody {"entries": [...], "photoUrl": "https://..."}
   * @responseBody 200 - {"gratitude": {...}}
   * @responseBody 404 - {"message": "Gratitude entry not found"}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async update({ auth, params, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const payload = await updateGratitudeValidator.validate(request.all())

      const gratitude = await Gratitude.query()
        .where('id', params.id)
        .where('user_id', user.id)
        .firstOrFail()

      if (payload.entries) {
        gratitude.entries = payload.entries
      }
      if (payload.photoUrl !== undefined) {
        gratitude.photoUrl = payload.photoUrl
      }
      if (payload.metadata !== undefined) {
        gratitude.metadata = payload.metadata
      }

      await gratitude.save()

      logger.info('Gratitude entry updated', {
        userId: user.id,
        gratitudeId: gratitude.id,
      })

      return response.ok({
        gratitude: {
          id: gratitude.id,
          entries: gratitude.entries,
          photoUrl: gratitude.photoUrl,
          entryDate: gratitude.entryDate.toISODate(),
          metadata: gratitude.metadata,
          createdAt: gratitude.createdAt.toISO(),
          updatedAt: gratitude.updatedAt?.toISO(),
        },
      })
    } catch (error) {
      logger.error('Error updating gratitude entry', { error })
      throw error
    }
  }

  /**
   * @destroy
   * @summary Delete a gratitude entry
   * @description Deletes a gratitude entry
   * @responseBody 200 - {"message": "Gratitude entry deleted successfully"}
   * @responseBody 404 - {"message": "Gratitude entry not found"}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async destroy({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const gratitude = await Gratitude.query()
        .where('id', params.id)
        .where('user_id', user.id)
        .firstOrFail()

      await gratitude.delete()

      // Recalculate achievements after deletion
      await gratitudeService.checkAndUpdateAchievements(user.id)

      logger.info('Gratitude entry deleted', {
        userId: user.id,
        gratitudeId: params.id,
      })

      return response.ok({ message: 'Gratitude entry deleted successfully' })
    } catch (error) {
      logger.error('Error deleting gratitude entry', { error })
      throw error
    }
  }

  /**
   * @streak
   * @summary Get current gratitude streak
   * @description Returns the current consecutive days streak for gratitude practice
   * @responseBody 200 - {"streak": 12, "lastEntryDate": "2026-01-20"}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async streak({ auth, response }: HttpContext) {
    try {
      const user = auth.user!
      const streak = await gratitudeService.calculateStreak(user.id)

      // Get last entry date
      const lastEntry = await Gratitude.query()
        .where('user_id', user.id)
        .orderBy('entry_date', 'desc')
        .first()

      return response.ok({
        streak,
        lastEntryDate: lastEntry?.entryDate.toISODate() || null,
      })
    } catch (error) {
      logger.error('Error fetching gratitude streak', { error })
      throw error
    }
  }

  /**
   * @insights
   * @summary Get growth insights
   * @description Returns analytics and insights about user's gratitude practice
   * @responseBody 200 - {"totalEntries": 50, "currentStreak": 12, "longestStreak": 30, ...}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async insights({ auth, response }: HttpContext) {
    try {
      const user = auth.user!
      const insights = await gratitudeService.getGrowthInsights(user.id)

      return response.ok(insights)
    } catch (error) {
      logger.error('Error fetching gratitude insights', { error })
      throw error
    }
  }

  /**
   * @randomQuote
   * @summary Get a random gratitude quote
   * @description Returns a random inspirational gratitude quote from Quotable API
   * @responseBody 200 - {"text": "Gratitude quote...", "author": "Author Name"}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async randomQuote({ response }: HttpContext) {
    try {
      const quote = await quotesService.getRandomQuote()
      return response.ok(quote)
    } catch (error) {
      logger.error('Error fetching random quote', { error })
      // Return fallback quote even if there's an error
      const fallbackQuote = quotesService.getQuoteByIndex(0)
      return response.ok(fallbackQuote)
    }
  }
}
