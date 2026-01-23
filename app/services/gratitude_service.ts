import Gratitude from '#models/gratitude'
import Achievement from '#models/achievement'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'

export default class GratitudeService {
  /**
   * Calculate current gratitude streak for a user
   */
  async calculateStreak(userId: number): Promise<number> {
    try {
      const gratitudes = await Gratitude.query()
        .where('user_id', userId)
        .orderBy('entry_date', 'desc')
        .limit(365) // Check last year

      if (gratitudes.length === 0) {
        return 0
      }

      let streak = 0
      let currentDate = DateTime.now().startOf('day')

      // Check if there's an entry for today
      const todayEntry = gratitudes.find(
        (g) => g.entryDate.toISODate() === currentDate.toISODate()
      )

      if (!todayEntry) {
        // If no entry today, start from yesterday
        currentDate = currentDate.minus({ days: 1 })
      }

      // Count consecutive days with entries
      for (const gratitude of gratitudes) {
        const entryDate = gratitude.entryDate.startOf('day')
        const expectedDate = currentDate.minus({ days: streak })

        if (entryDate.toISODate() === expectedDate.toISODate()) {
          streak++
        } else if (entryDate < expectedDate) {
          // Gap found, streak is broken
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
   * Get growth insights for a user
   */
  async getGrowthInsights(userId: number): Promise<{
    totalEntries: number
    currentStreak: number
    longestStreak: number
    entriesThisMonth: number
    entriesLastMonth: number
    mostCommonThemes: Array<{ theme: string; count: number }>
    monthlyTrend: Array<{ month: string; count: number }>
  }> {
    try {
      const now = DateTime.now()
      const startOfMonth = now.startOf('month')
      const startOfLastMonth = startOfMonth.minus({ months: 1 })
      const endOfLastMonth = startOfMonth.minus({ days: 1 })

      // Get all gratitudes
      const allGratitudes = await Gratitude.query().where('user_id', userId)

      // Get gratitudes for this month
      const thisMonthGratitudes = allGratitudes.filter(
        (g) => g.entryDate >= startOfMonth
      )

      // Get gratitudes for last month
      const lastMonthGratitudes = allGratitudes.filter(
        (g) => g.entryDate >= startOfLastMonth && g.entryDate <= endOfLastMonth
      )

      // Calculate longest streak
      const longestStreak = await this.calculateLongestStreak(allGratitudes)

      // Calculate monthly trend (last 6 months)
      const monthlyTrend = this.calculateMonthlyTrend(allGratitudes, 6)

      // Analyze common themes (simple keyword extraction)
      const mostCommonThemes = this.extractCommonThemes(allGratitudes)

      const currentStreak = await this.calculateStreak(userId)

      return {
        totalEntries: allGratitudes.length,
        currentStreak,
        longestStreak,
        entriesThisMonth: thisMonthGratitudes.length,
        entriesLastMonth: lastMonthGratitudes.length,
        mostCommonThemes,
        monthlyTrend,
      }
    } catch (error) {
      logger.error('Error getting growth insights', { userId, error })
      throw error
    }
  }

  /**
   * Calculate longest streak from all entries
   */
  private async calculateLongestStreak(
    allGratitudes: Gratitude[]
  ): Promise<number> {
    if (allGratitudes.length === 0) return 0

    // Sort by date ascending
    const sorted = allGratitudes.sort(
      (a, b) => a.entryDate.toMillis() - b.entryDate.toMillis()
    )

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

  /**
   * Calculate monthly trend
   */
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

      trend.push({
        month: monthStart.toFormat('MMM yyyy'),
        count,
      })
    }

    return trend
  }

  /**
   * Extract common themes from gratitude entries
   */
  private extractCommonThemes(
    gratitudes: Gratitude[]
  ): Array<{ theme: string; count: number }> {
    // Simple keyword-based theme extraction
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
      .slice(0, 5) // Top 5 themes
  }

  /**
   * Check and update achievements for a user
   */
  async checkAndUpdateAchievements(userId: number): Promise<Achievement[]> {
    try {
      const streak = await this.calculateStreak(userId)
      const totalEntries = await Gratitude.query()
        .where('user_id', userId)
        .count('* as total')
        .first()

      const entryCount = Number(totalEntries?.$extras.total || 0)

      const achievements: Achievement[] = []

      // Check streak achievements
      const streakMilestones = [3, 7, 14, 30, 60, 100]
      for (const milestone of streakMilestones) {
        const achievementType = `gratitude_streak_${milestone}`
        let achievement = await Achievement.query()
          .where('user_id', userId)
          .where('type', achievementType)
          .first()

        if (!achievement) {
          achievement = await Achievement.create({
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
        } else if (!achievement.isCompleted && streak >= milestone) {
          achievement.isCompleted = true
          achievement.completedAt = DateTime.now()
          achievement.progress = milestone
          await achievement.save()
        } else if (achievement.progress < streak) {
          achievement.progress = Math.min(streak, milestone)
          await achievement.save()
        }

        achievements.push(achievement)
      }

      // Check entry count achievements
      const countMilestones = [10, 25, 50, 100, 250, 500]
      for (const milestone of countMilestones) {
        const achievementType = `gratitude_count_${milestone}`
        let achievement = await Achievement.query()
          .where('user_id', userId)
          .where('type', achievementType)
          .first()

        if (!achievement) {
          achievement = await Achievement.create({
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
        } else if (!achievement.isCompleted && entryCount >= milestone) {
          achievement.isCompleted = true
          achievement.completedAt = DateTime.now()
          achievement.progress = milestone
          await achievement.save()
        } else if (achievement.progress < entryCount) {
          achievement.progress = Math.min(entryCount, milestone)
          await achievement.save()
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
