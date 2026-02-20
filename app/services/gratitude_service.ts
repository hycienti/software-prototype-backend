import type Gratitude from '#models/gratitude'
import type Achievement from '#models/achievement'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import GratitudeRepository from '#repositories/gratitude_repository'
import AchievementRepository from '#repositories/achievement_repository'
import AIInsightsService from '#services/ai_insights_service'

const gratitudeRepository = new GratitudeRepository()
const achievementRepository = new AchievementRepository()

export default class GratitudeService {
  /**
   * Create a gratitude entry (checks duplicate by date, then creates and updates achievements/cache).
   */
  async create(
    userId: number,
    payload: {
      entries: string[]
      photoUrl?: string | null
      entryDate?: Date
      metadata?: Record<string, unknown> | null
    }
  ): Promise<{ gratitude: Gratitude; existing?: Gratitude }> {
    const entryDate = payload.entryDate
      ? DateTime.fromJSDate(payload.entryDate)
      : DateTime.now()
    const entryDateIso = entryDate.startOf('day').toISODate()!

    const existingEntry = await gratitudeRepository.findByUserIdAndEntryDate(userId, entryDateIso)
    if (existingEntry) {
      return { gratitude: existingEntry, existing: existingEntry }
    }

    const gratitude = await gratitudeRepository.create({
      userId,
      entries: payload.entries,
      photoUrl: payload.photoUrl ?? null,
      entryDate: entryDate.startOf('day'),
      metadata: payload.metadata ?? null,
    })

    await this.checkAndUpdateAchievements(userId)
    const aiInsightsService = new AIInsightsService()
    await aiInsightsService.invalidateCache(userId, 'gratitude')

    return { gratitude }
  }

  /**
   * List gratitude entries with pagination and optional date filters.
   */
  async listForUser(
    userId: number,
    params: { page?: number; limit?: number; startDate?: Date; endDate?: Date }
  ) {
    const page = params.page ?? 1
    const limit = Math.min(params.limit ?? 20, 100)
    return gratitudeRepository.listByUserIdPaginated(userId, page, limit, {
      startDate: params.startDate,
      endDate: params.endDate,
    })
  }

  /**
   * Get a single gratitude by id and userId.
   */
  async getById(userId: number, id: number): Promise<Gratitude> {
    return gratitudeRepository.findByIdAndUserId(id, userId)
  }

  /**
   * Update a gratitude entry.
   */
  async update(
    userId: number,
    id: number,
    payload: { entries?: string[]; photoUrl?: string | null; metadata?: Record<string, unknown> | null }
  ): Promise<Gratitude> {
    const gratitude = await gratitudeRepository.findByIdAndUserId(id, userId)
    return gratitudeRepository.update(gratitude, payload)
  }

  /**
   * Delete a gratitude entry and recalculate achievements.
   */
  async destroy(userId: number, id: number): Promise<void> {
    const gratitude = await gratitudeRepository.findByIdAndUserId(id, userId)
    await gratitudeRepository.delete(gratitude)
    await this.checkAndUpdateAchievements(userId)
  }

  /**
   * Get streak and last entry date.
   */
  async getStreak(userId: number): Promise<{ streak: number; lastEntryDate: string | null }> {
    const streak = await this.calculateStreak(userId)
    const lastEntry = await gratitudeRepository.getLastEntryByUserId(userId)
    return {
      streak,
      lastEntryDate: lastEntry?.entryDate.toISODate() ?? null,
    }
  }

  /**
   * Calculate current gratitude streak for a user.
   */
  async calculateStreak(userId: number): Promise<number> {
    try {
      const gratitudes = await gratitudeRepository.listRecentForUser(userId, 365)
      if (gratitudes.length === 0) return 0

      let streak = 0
      let currentDate = DateTime.now().startOf('day')
      const todayEntry = gratitudes.find((g) => g.entryDate.toISODate() === currentDate.toISODate())
      if (!todayEntry) currentDate = currentDate.minus({ days: 1 })

      for (const gratitude of gratitudes) {
        const entryDate = gratitude.entryDate.startOf('day')
        const expectedDate = currentDate.minus({ days: streak })
        if (entryDate.toISODate() === expectedDate.toISODate()) {
          streak++
        } else if (entryDate < expectedDate) {
          break
        }
      }
      return streak
    } catch (error) {
      logger.error('Error calculating gratitude streak', { userId, error })
      return 0
    }
  }

  /**
   * Get growth insights (optionally with AI insights).
   */
  async getGrowthInsights(
    userId: number,
    includeAIInsights: boolean = true
  ): Promise<{
    totalEntries: number
    currentStreak: number
    longestStreak: number
    entriesThisMonth: number
    entriesLastMonth: number
    mostCommonThemes: Array<{ theme: string; count: number }>
    monthlyTrend: Array<{ month: string; count: number }>
    aiInsights?: {
      weeklySummary: string
      keyPatterns: string[]
      growthObservations: string[]
      gentleSuggestions: string[]
    }
  }> {
    const now = DateTime.now()
    const startOfMonth = now.startOf('month')
    const startOfLastMonth = startOfMonth.minus({ months: 1 })
    const endOfLastMonth = startOfMonth.minus({ days: 1 })

    const allGratitudes = await gratitudeRepository.listAllByUserId(userId)
    const thisMonthGratitudes = allGratitudes.filter((g) => g.entryDate >= startOfMonth)
    const lastMonthGratitudes = allGratitudes.filter(
      (g) => g.entryDate >= startOfLastMonth && g.entryDate <= endOfLastMonth
    )

    const longestStreak = await this.calculateLongestStreak(allGratitudes)
    const monthlyTrend = this.calculateMonthlyTrend(allGratitudes, 6)
    const mostCommonThemes = this.extractCommonThemes(allGratitudes)
    const currentStreak = await this.calculateStreak(userId)

    const baseInsights = {
      totalEntries: allGratitudes.length,
      currentStreak,
      longestStreak,
      entriesThisMonth: thisMonthGratitudes.length,
      entriesLastMonth: lastMonthGratitudes.length,
      mostCommonThemes,
      monthlyTrend,
    }

    if (includeAIInsights) {
      try {
        const aiInsightsService = new AIInsightsService()
        const recentEntries = await aiInsightsService.getRecentGratitudeEntries(userId, 7)
        const aiInsights = await aiInsightsService.getGratitudeInsights(userId, {
          ...baseInsights,
          recentEntries,
        })
        return {
          ...baseInsights,
          aiInsights: {
            weeklySummary: aiInsights.weeklySummary,
            keyPatterns: aiInsights.keyPatterns,
            growthObservations: aiInsights.growthObservations || [],
            gentleSuggestions: aiInsights.gentleSuggestions || [],
          },
        }
      } catch (error) {
        logger.warn('Failed to get AI insights, returning base insights only', { userId, error })
      }
    }
    return baseInsights
  }

  private async calculateLongestStreak(allGratitudes: Gratitude[]): Promise<number> {
    if (allGratitudes.length === 0) return 0
    const sorted = allGratitudes.sort((a, b) => a.entryDate.toMillis() - b.entryDate.toMillis())
    let longestStreak = 1
    let currentStreak = 1
    for (let i = 1; i < sorted.length; i++) {
      const prevDate = sorted[i - 1].entryDate.startOf('day')
      const currDate = sorted[i].entryDate.startOf('day')
      const daysDiff = currDate.diff(prevDate, 'days').days
      if (daysDiff === 1) {
        currentStreak++
        longestStreak = Math.max(longestStreak, currentStreak)
      } else {
        currentStreak = 1
      }
    }
    return longestStreak
  }

  private calculateMonthlyTrend(
    gratitudes: Gratitude[],
    months: number
  ): Array<{ month: string; count: number }> {
    const now = DateTime.now()
    const trend: Array<{ month: string; count: number }> = []
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = now.minus({ months: i }).startOf('month')
      const monthEnd = monthStart.endOf('month')
      const count = gratitudes.filter(
        (g) => g.entryDate >= monthStart && g.entryDate <= monthEnd
      ).length
      trend.push({ month: monthStart.toFormat('MMM yyyy'), count })
    }
    return trend
  }

  private extractCommonThemes(gratitudes: Gratitude[]): Array<{ theme: string; count: number }> {
    const themeKeywords: Record<string, string[]> = {
      family: ['family', 'mom', 'dad', 'parent', 'sibling', 'brother', 'sister', 'child'],
      friends: ['friend', 'buddy', 'pal', 'companion'],
      nature: ['nature', 'sunset', 'sunrise', 'weather', 'outdoor', 'park', 'tree', 'flower'],
      health: ['health', 'body', 'exercise', 'workout', 'fitness', 'wellness'],
      work: ['work', 'colleague', 'job', 'career', 'office', 'project'],
      learning: ['learn', 'education', 'book', 'course', 'skill', 'knowledge'],
      food: ['food', 'meal', 'cooking', 'restaurant', 'coffee', 'tea'],
      home: ['home', 'house', 'apartment', 'room', 'comfort'],
    }
    const themeCounts: Record<string, number> = {}
    gratitudes.forEach((gratitude) => {
      const allText = gratitude.entries.join(' ').toLowerCase()
      Object.entries(themeKeywords).forEach(([theme, keywords]) => {
        if (keywords.some((keyword) => allText.includes(keyword))) {
          themeCounts[theme] = (themeCounts[theme] || 0) + 1
        }
      })
    })
    return Object.entries(themeCounts)
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }

  /**
   * Check and update achievements for a user.
   */
  async checkAndUpdateAchievements(userId: number): Promise<Achievement[]> {
    try {
      const streak = await this.calculateStreak(userId)
      const entryCount = await gratitudeRepository.countByUserId(userId)
      const achievements: Achievement[] = []

      const streakMilestones = [3, 7, 14, 30, 60, 100]
      for (const milestone of streakMilestones) {
        const achievementType = `gratitude_streak_${milestone}`
        let achievement = await achievementRepository.findByUserIdAndType(userId, achievementType)
        if (!achievement) {
          achievement = await achievementRepository.create({
            userId,
            type: achievementType,
            title: `${milestone}-Day Gratitude Streak`,
            description: `Maintained a ${milestone}-day gratitude practice streak`,
            icon: 'local_fire_department',
            iconColor: '#f59e0b',
            iconBgColor: 'rgba(245, 158, 11, 0.2)',
            threshold: milestone,
            progress: Math.min(streak, milestone),
            isCompleted: streak >= milestone,
            completedAt: streak >= milestone ? DateTime.now() : null,
          })
        } else {
          if (!achievement.isCompleted && streak >= milestone) {
            achievement.isCompleted = true
            achievement.completedAt = DateTime.now()
            achievement.progress = milestone
          } else if (achievement.progress < streak) {
            achievement.progress = Math.min(streak, milestone)
          }
          await achievementRepository.save(achievement)
        }
        achievements.push(achievement)
      }

      const countMilestones = [10, 25, 50, 100, 250, 500]
      for (const milestone of countMilestones) {
        const achievementType = `gratitude_count_${milestone}`
        let achievement = await achievementRepository.findByUserIdAndType(userId, achievementType)
        if (!achievement) {
          achievement = await achievementRepository.create({
            userId,
            type: achievementType,
            title: `${milestone} Gratitude Entries`,
            description: `Completed ${milestone} gratitude journal entries`,
            icon: 'emoji_events',
            iconColor: '#19b3e6',
            iconBgColor: 'rgba(25, 179, 230, 0.2)',
            threshold: milestone,
            progress: Math.min(entryCount, milestone),
            isCompleted: entryCount >= milestone,
            completedAt: entryCount >= milestone ? DateTime.now() : null,
          })
        } else {
          if (!achievement.isCompleted && entryCount >= milestone) {
            achievement.isCompleted = true
            achievement.completedAt = DateTime.now()
            achievement.progress = milestone
          } else if (achievement.progress < entryCount) {
            achievement.progress = Math.min(entryCount, milestone)
          }
          await achievementRepository.save(achievement)
        }
        achievements.push(achievement)
      }
      return achievements
    } catch (error) {
      logger.error('Error checking achievements', { userId, error })
      throw error
    }
  }
}
