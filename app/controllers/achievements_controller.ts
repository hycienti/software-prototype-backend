import type { HttpContext } from '@adonisjs/core/http'
import Achievement from '#models/achievement'
import logger from '@adonisjs/core/services/logger'

export default class AchievementsController {
  /**
   * @index
   * @summary Get user achievements
   * @description Returns all achievements for the authenticated user
   * @queryParam completed - Filter by completion status (optional)
   * @responseBody 200 - {"data": [...], "stats": {"total": 10, "completed": 5, "inProgress": 5}}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async index({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      const { completed } = request.qs()

      const query = Achievement.query().where('user_id', user.id).orderBy('created_at', 'desc')

      if (completed !== undefined) {
        query.where('is_completed', completed === 'true')
      }

      const achievements = await query.exec()

      const stats = {
        total: achievements.length,
        completed: achievements.filter((a) => a.isCompleted).length,
        inProgress: achievements.filter((a) => !a.isCompleted).length,
      }

      return response.ok({
        data: achievements.map((a) => ({
          id: a.id,
          type: a.type,
          title: a.title,
          description: a.description,
          icon: a.icon,
          iconColor: a.iconColor,
          iconBgColor: a.iconBgColor,
          threshold: a.threshold,
          progress: a.progress,
          isCompleted: a.isCompleted,
          completedAt: a.completedAt?.toISO() || null,
          createdAt: a.createdAt.toISO(),
        })),
        stats,
      })
    } catch (error) {
      logger.error('Error fetching achievements', { error })
      throw error
    }
  }

  /**
   * @show
   * @summary Get a specific achievement
   * @description Returns a specific achievement by ID
   * @responseBody 200 - {"achievement": {...}}
   * @responseBody 404 - {"message": "Achievement not found"}
   * @responseBody 401 - {"message": "Unauthorized"}
   */
  async show({ auth, params, response }: HttpContext) {
    try {
      const user = auth.user!
      const achievement = await Achievement.query()
        .where('id', params.id)
        .where('user_id', user.id)
        .firstOrFail()

      return response.ok({
        achievement: {
          id: achievement.id,
          type: achievement.type,
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          iconColor: achievement.iconColor,
          iconBgColor: achievement.iconBgColor,
          threshold: achievement.threshold,
          progress: achievement.progress,
          isCompleted: achievement.isCompleted,
          completedAt: achievement.completedAt?.toISO() || null,
          createdAt: achievement.createdAt.toISO(),
        },
      })
    } catch (error) {
      logger.error('Error fetching achievement', { error })
      throw error
    }
  }
}
