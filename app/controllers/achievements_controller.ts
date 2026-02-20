import type { HttpContext } from '@adonisjs/core/http'
import type Achievement from '#models/achievement'
import AchievementService from '#services/achievement_service'
import logger from '@adonisjs/core/services/logger'
import { successResponse } from '#utils/response_helper'

const achievementService = new AchievementService()

function serializeAchievement(a: Achievement) {
  return {
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
    completedAt: a.completedAt?.toISO() ?? null,
    createdAt: a.createdAt.toISO(),
  }
}

export default class AchievementsController {
  /**
   * @index
   * @summary Get user achievements
   */
  async index(ctx: HttpContext) {
    try {
      const user = ctx.auth.user!
      const { completed } = ctx.request.qs() as { completed?: string }

      const completedFilter =
        completed !== undefined ? completed === 'true' : undefined
      const achievements = await achievementService.listByUserId(user.id, {
        completed: completedFilter,
      })

      const stats = {
        total: achievements.length,
        completed: achievements.filter((a) => a.isCompleted).length,
        inProgress: achievements.filter((a) => !a.isCompleted).length,
      }

      return successResponse(ctx, {
        data: achievements.map(serializeAchievement),
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
   */
  async show(ctx: HttpContext) {
    try {
      const user = ctx.auth.user!
      const achievement = await achievementService.getById(user.id, Number(ctx.params.id))
      return successResponse(ctx, { achievement: serializeAchievement(achievement) })
    } catch (error) {
      logger.error('Error fetching achievement', { error })
      throw error
    }
  }
}
