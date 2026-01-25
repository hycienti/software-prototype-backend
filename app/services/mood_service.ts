import Mood from '#models/mood'
import Achievement from '#models/achievement'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import AIInsightsService from '#services/ai_insights_service'

export default class MoodService {
  /**
   * Get mood insights and analytics for a user
   */
  async getMoodInsights(
    userId: number,
    includeAIInsights: boolean = true
  ): Promise<{
    totalEntries: number
    averageIntensity: number
    moodDistribution: Array<{ mood: string; count: number; percentage: number }>
    weeklyTrend: Array<{ week: string; averageIntensity: number; dominantMood: string }>
    monthlyTrend: Array<{ month: string; averageIntensity: number; dominantMood: string }>
    patterns: Array<{ pattern: string; description: string; confidence: number }>
    streak: number
    aiInsights?: {
      weeklySummary: string
      keyPatterns: string[]
      emotionalInsights: string[]
      supportiveSuggestions: string[]
    }
  }> {
    try {
      const allMoods = await Mood.query().where('user_id', userId)

      if (allMoods.length === 0) {
        return {
          totalEntries: 0,
          averageIntensity: 0,
          moodDistribution: [],
          weeklyTrend: [],
          monthlyTrend: [],
          patterns: [],
          streak: 0,
        }
      }

      // Calculate average intensity
      const totalIntensity = allMoods.reduce((sum, m) => sum + m.intensity, 0)
      const averageIntensity = totalIntensity / allMoods.length

      // Mood distribution
      const moodCounts: Record<string, number> = {}
      allMoods.forEach((m) => {
        moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1
      })

      const moodDistribution = Object.entries(moodCounts)
        .map(([mood, count]) => ({
          mood,
          count,
          percentage: Math.round((count / allMoods.length) * 100),
        }))
        .sort((a, b) => b.count - a.count)

      // Weekly trend (last 8 weeks)
      const weeklyTrend = this.calculateWeeklyTrend(allMoods, 8)

      // Monthly trend (last 6 months)
      const monthlyTrend = this.calculateMonthlyTrend(allMoods, 6)

      // Pattern detection
      const patterns = this.detectPatterns(allMoods)

      // Calculate streak
      const streak = await this.calculateStreak(userId)

      const baseInsights = {
        totalEntries: allMoods.length,
        averageIntensity: Math.round(averageIntensity * 10) / 10,
        moodDistribution,
        weeklyTrend,
        monthlyTrend,
        patterns,
        streak,
      }

      // Get AI insights if requested
      if (includeAIInsights) {
        try {
          const aiInsightsService = new AIInsightsService()
          const recentEntries = await aiInsightsService.getRecentMoodEntries(userId, 7)

          const aiInsights = await aiInsightsService.getMoodInsights(userId, {
            totalEntries: baseInsights.totalEntries,
            currentStreak: streak,
            averageIntensity: baseInsights.averageIntensity,
            moodDistribution: baseInsights.moodDistribution,
            weeklyTrend: baseInsights.weeklyTrend,
            monthlyTrend: baseInsights.monthlyTrend,
            patterns: baseInsights.patterns,
            recentEntries,
          })

          return {
            ...baseInsights,
            aiInsights: {
              weeklySummary: aiInsights.weeklySummary,
              keyPatterns: aiInsights.keyPatterns,
              emotionalInsights: aiInsights.emotionalInsights || [],
              supportiveSuggestions: aiInsights.supportiveSuggestions || [],
            },
          }
        } catch (error) {
          logger.warn('Failed to get AI insights, returning base insights only', {
            userId,
            error,
          })
          // Return base insights even if AI fails
        }
      }

      return baseInsights
    } catch (error) {
      logger.error('Error getting mood insights', { userId, error })
      throw error
    }
  }

  /**
   * Calculate weekly trend
   */
  private calculateWeeklyTrend(
    moods: Mood[],
    weeks: number
  ): Array<{ week: string; averageIntensity: number; dominantMood: string }> {
    const now = DateTime.now()
    const trend: Array<{ week: string; averageIntensity: number; dominantMood: string }> = []

    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = now.minus({ weeks: i }).startOf('week')
      const weekEnd = weekStart.endOf('week')

      const weekMoods = moods.filter((m) => m.entryDate >= weekStart && m.entryDate <= weekEnd)

      if (weekMoods.length > 0) {
        const avgIntensity = weekMoods.reduce((sum, m) => sum + m.intensity, 0) / weekMoods.length

        const moodCounts: Record<string, number> = {}
        weekMoods.forEach((m) => {
          moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1
        })

        const dominantMood =
          Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown'

        trend.push({
          week: weekStart.toFormat('MMM d'),
          averageIntensity: Math.round(avgIntensity * 10) / 10,
          dominantMood,
        })
      } else {
        trend.push({
          week: weekStart.toFormat('MMM d'),
          averageIntensity: 0,
          dominantMood: 'none',
        })
      }
    }

    return trend
  }

  /**
   * Calculate monthly trend
   */
  private calculateMonthlyTrend(
    moods: Mood[],
    months: number
  ): Array<{ month: string; averageIntensity: number; dominantMood: string }> {
    const now = DateTime.now()
    const trend: Array<{ month: string; averageIntensity: number; dominantMood: string }> = []

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = now.minus({ months: i }).startOf('month')
      const monthEnd = monthStart.endOf('month')

      const monthMoods = moods.filter((m) => m.entryDate >= monthStart && m.entryDate <= monthEnd)

      if (monthMoods.length > 0) {
        const avgIntensity = monthMoods.reduce((sum, m) => sum + m.intensity, 0) / monthMoods.length

        const moodCounts: Record<string, number> = {}
        monthMoods.forEach((m) => {
          moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1
        })

        const dominantMood =
          Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown'

        trend.push({
          month: monthStart.toFormat('MMM yyyy'),
          averageIntensity: Math.round(avgIntensity * 10) / 10,
          dominantMood,
        })
      } else {
        trend.push({
          month: monthStart.toFormat('MMM yyyy'),
          averageIntensity: 0,
          dominantMood: 'none',
        })
      }
    }

    return trend
  }

  /**
   * Detect patterns in mood entries
   */
  private detectPatterns(
    moods: Mood[]
  ): Array<{ pattern: string; description: string; confidence: number }> {
    const patterns: Array<{ pattern: string; description: string; confidence: number }> = []

    if (moods.length < 7) {
      return patterns // Need at least a week of data
    }

    // Pattern 1: Day of week patterns
    const dayOfWeekCounts: Record<string, Record<string, number>> = {}
    moods.forEach((m) => {
      const dayName = m.entryDate.toFormat('cccc') // Full day name
      if (!dayOfWeekCounts[dayName]) {
        dayOfWeekCounts[dayName] = {}
      }
      dayOfWeekCounts[dayName][m.mood] = (dayOfWeekCounts[dayName][m.mood] || 0) + 1
    })

    Object.entries(dayOfWeekCounts).forEach(([day, moodCounts]) => {
      const total = Object.values(moodCounts).reduce((sum, count) => sum + count, 0)
      if (total >= 3) {
        const dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]
        if (dominantMood && dominantMood[1] / total >= 0.6) {
          patterns.push({
            pattern: 'day_of_week',
            description: `You tend to feel ${dominantMood[0]} on ${day}s`,
            confidence: Math.round((dominantMood[1] / total) * 100) / 100,
          })
        }
      }
    })

    // Pattern 2: Intensity trends
    const recentMoods = moods.slice(-14) // Last 14 entries
    if (recentMoods.length >= 7) {
      const firstHalf = recentMoods.slice(0, Math.floor(recentMoods.length / 2))
      const secondHalf = recentMoods.slice(Math.floor(recentMoods.length / 2))

      const firstAvg = firstHalf.reduce((sum, m) => sum + m.intensity, 0) / firstHalf.length
      const secondAvg = secondHalf.reduce((sum, m) => sum + m.intensity, 0) / secondHalf.length

      if (secondAvg > firstAvg + 1) {
        patterns.push({
          pattern: 'intensity_increase',
          description: 'Your mood intensity has been increasing recently',
          confidence: 0.7,
        })
      } else if (secondAvg < firstAvg - 1) {
        patterns.push({
          pattern: 'intensity_decrease',
          description: 'Your mood intensity has been decreasing recently',
          confidence: 0.7,
        })
      }
    }

    return patterns.slice(0, 5) // Return top 5 patterns
  }

  /**
   * Calculate current mood tracking streak
   */
  async calculateStreak(userId: number): Promise<number> {
    try {
      const moods = await Mood.query()
        .where('user_id', userId)
        .orderBy('entry_date', 'desc')
        .limit(365) // Check last year

      if (moods.length === 0) {
        return 0
      }

      let streak = 0
      let currentDate = DateTime.now().startOf('day')

      // Check if there's an entry for today
      const todayEntry = moods.find((m) => m.entryDate.toISODate() === currentDate.toISODate())

      if (!todayEntry) {
        // If no entry today, start from yesterday
        currentDate = currentDate.minus({ days: 1 })
      }

      // Count consecutive days with entries
      for (const mood of moods) {
        const entryDate = mood.entryDate.startOf('day')
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
      logger.error('Error calculating mood streak', { userId, error })
      return 0
    }
  }

  /**
   * Check and update mood-related achievements
   */
  async checkAndUpdateAchievements(userId: number): Promise<Achievement[]> {
    try {
      const streak = await this.calculateStreak(userId)
      const totalEntries = await Mood.query().where('user_id', userId).count('* as total').first()

      const entryCount = Number(totalEntries?.$extras.total || 0)

      const achievements: Achievement[] = []

      // Check streak achievements
      const streakMilestones = [3, 7, 14, 30, 60, 100]
      for (const milestone of streakMilestones) {
        const achievementType = `mood_streak_${milestone}`
        let achievement = await Achievement.query()
          .where('user_id', userId)
          .where('type', achievementType)
          .first()

        if (!achievement) {
          achievement = await Achievement.create({
            userId,
            type: achievementType,
            title: `${milestone}-Day Mood Tracking Streak`,
            description: `Tracked your mood for ${milestone} consecutive days`,
            icon: 'track_changes',
            iconColor: '#a78bfa',
            iconBgColor: 'rgba(167, 139, 250, 0.2)',
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
        const achievementType = `mood_count_${milestone}`
        let achievement = await Achievement.query()
          .where('user_id', userId)
          .where('type', achievementType)
          .first()

        if (!achievement) {
          achievement = await Achievement.create({
            userId,
            type: achievementType,
            title: `${milestone} Mood Entries`,
            description: `Recorded ${milestone} mood journal entries`,
            icon: 'mood',
            iconColor: '#34d399',
            iconBgColor: 'rgba(52, 211, 153, 0.2)',
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
      logger.error('Error checking mood achievements', { userId, error })
      throw error
    }
  }
}
