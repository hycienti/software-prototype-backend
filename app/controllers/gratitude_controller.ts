import type { HttpContext } from '@adonisjs/core/http'
import drive from '@adonisjs/drive/services/main'
import type Gratitude from '#models/gratitude'
import GratitudeService from '#services/gratitude_service'
import QuotesService from '#services/quotes_service'
import {
  createGratitudeValidator,
  updateGratitudeValidator,
  getGratitudeHistoryValidator,
} from '#validators/gratitude_validator'
import logger from '@adonisjs/core/services/logger'
import { successResponse, errorResponse, ErrorCodes } from '#utils/response_helper'
import { randomUUID } from 'node:crypto'

const gratitudeService = new GratitudeService()
const quotesService = new QuotesService()

function serializeGratitude(g: Gratitude) {
  return {
    id: g.id,
    entries: g.entries,
    photoUrl: g.photoUrl,
    entryDate: g.entryDate.toISODate(),
    metadata: g.metadata,
    createdAt: g.createdAt.toISO(),
    updatedAt: g.updatedAt?.toISO(),
  }
}

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
  async create(ctx: HttpContext) {
    try {
      const user = ctx.auth.user!
      const payload = await createGratitudeValidator.validate(ctx.request.all())

      const result = await gratitudeService.create(user.id, {
        entries: payload.entries,
        photoUrl: payload.photoUrl,
        entryDate: payload.entryDate,
        metadata: payload.metadata,
      })

      logger.info('Gratitude entry created', {
        userId: user.id,
        gratitudeId: result.gratitude.id,
        entryDate: result.gratitude.entryDate.toISODate(),
      })

      return successResponse(ctx, { gratitude: serializeGratitude(result.gratitude) }, 201)
    } catch (error) {
      logger.error('Error creating gratitude entry', { error })
      throw error
    }
  }

  /**
   * @uploadPhoto
   * @summary Upload a photo for gratitude entry
   * @description Multipart upload; returns URL to use as photoUrl when creating a gratitude entry.
   * @responseBody 200 - {"url": "https://..."}
   * @responseBody 400 - Invalid or missing file
   * @responseBody 401 - Unauthorized
   */
  async uploadPhoto(ctx: HttpContext) {
    const user = ctx.auth.user!
    const request = ctx.request

    const file = request.file('file', {
      size: '5mb',
      extnames: ['jpg', 'jpeg', 'png'],
    })

    if (!file || !file.isValid) {
      const message =
        file?.errors?.[0]?.message ??
        'No file provided or invalid file. Allowed: JPG, JPEG, PNG; max 5MB.'
      return errorResponse(ctx, ErrorCodes.BAD_REQUEST, message, 400)
    }

    const ext = file.extname || (file.type && file.type.split('/')[1]) || 'jpg'
    const key = `users/${user.id}/gratitude/${randomUUID()}.${ext}`

    try {
      const disk = drive.use()
      await disk.copyFromFs(file.tmpPath!, key, {
        visibility: 'public',
        contentType: file.type ?? 'image/jpeg',
      })

      let url: string
      try {
        url = await disk.getUrl(key)
      } catch {
        url = await disk.getSignedUrl(key, { expiresIn: '1y' })
      }

      logger.info('Gratitude photo uploaded', { userId: user.id, key })
      return successResponse(ctx, { url })
    } catch (err) {
      logger.error('Gratitude photo upload failed', { userId: user.id, error: err })
      return errorResponse(
        ctx,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        err instanceof Error ? err.message : 'Upload failed',
        500
      )
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
  async index(ctx: HttpContext) {
    try {
      const user = ctx.auth.user!
      const payload = await getGratitudeHistoryValidator.validate(ctx.request.qs())

      const result = await gratitudeService.listForUser(user.id, {
        page: payload.page,
        limit: payload.limit,
        startDate: payload.startDate,
        endDate: payload.endDate,
      })

      return successResponse(ctx, {
        data: result.data.map(serializeGratitude),
        meta: {
          total: result.total,
          page: result.page,
          limit: result.perPage,
          lastPage: result.lastPage,
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
  async show(ctx: HttpContext) {
    try {
      const user = ctx.auth.user!
      const gratitude = await gratitudeService.getById(user.id, Number(ctx.params.id))
      return successResponse(ctx, { gratitude: serializeGratitude(gratitude) })
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
  async update(ctx: HttpContext) {
    try {
      const user = ctx.auth.user!
      const payload = await updateGratitudeValidator.validate(ctx.request.all())

      const gratitude = await gratitudeService.update(user.id, Number(ctx.params.id), {
        entries: payload.entries,
        photoUrl: payload.photoUrl,
        metadata: payload.metadata,
      })

      logger.info('Gratitude entry updated', { userId: user.id, gratitudeId: gratitude.id })
      return successResponse(ctx, { gratitude: serializeGratitude(gratitude) })
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
  async destroy(ctx: HttpContext) {
    try {
      const user = ctx.auth.user!
      await gratitudeService.destroy(user.id, Number(ctx.params.id))
      logger.info('Gratitude entry deleted', { userId: user.id, gratitudeId: ctx.params.id })
      return successResponse(ctx, { message: 'Gratitude entry deleted successfully' })
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
  async streak(ctx: HttpContext) {
    try {
      const user = ctx.auth.user!
      const result = await gratitudeService.getStreak(user.id)
      return successResponse(ctx, result)
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
  async insights(ctx: HttpContext) {
    try {
      const user = ctx.auth.user!
      const insights = await gratitudeService.getGrowthInsights(user.id)
      return successResponse(ctx, insights)
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
  async randomQuote(ctx: HttpContext) {
    try {
      const quote = await quotesService.getRandomQuote()
      return successResponse(ctx, quote)
    } catch (error) {
      logger.error('Error fetching random quote', { error })
      const fallbackQuote = quotesService.getQuoteByIndex(0)
      return successResponse(ctx, fallbackQuote)
    }
  }
}
