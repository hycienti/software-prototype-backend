import OpenAI from 'openai'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import AiInsight from '#models/ai_insight'
import { GRATITUDE_INSIGHTS_PROMPT, MOOD_INSIGHTS_PROMPT } from '../prompts/index.js'
import Gratitude from '#models/gratitude'
import Mood from '#models/mood'

export interface GratitudeInsightsData {
  totalEntries: number
  currentStreak: number
  longestStreak: number
  entriesThisMonth: number
  entriesLastMonth: number
  mostCommonThemes: Array<{ theme: string; count: number }>
  monthlyTrend: Array<{ month: string; count: number }>
  recentEntries: Array<{ date: string; entries: string[] }>
}

export interface MoodInsightsData {
  totalEntries: number
  currentStreak: number
  averageIntensity: number
  moodDistribution: Array<{ mood: string; count: number; percentage: number }>
  weeklyTrend: Array<{ week: string; averageIntensity: number; dominantMood: string }>
  monthlyTrend: Array<{ month: string; averageIntensity: number; dominantMood: string }>
  patterns: Array<{ pattern: string; description: string; confidence: number }>
  recentEntries: Array<{ date: string; mood: string; intensity: number; notes: string | null }>
}

export interface AIInsightsResponse {
  weeklySummary: string
  keyPatterns: string[]
  growthObservations?: string[]
  emotionalInsights?: string[]
  gentleSuggestions?: string[]
  supportiveSuggestions?: string[]
}

export default class AIInsightsService {
  private client: OpenAI

  constructor() {
    const apiKey = env.get('OPENAI_API_KEY')
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required')
    }

    this.client = new OpenAI({
      apiKey,
    })
  }

  /**
   * Get or generate AI insights for gratitude journaling
   */
  async getGratitudeInsights(
    userId: number,
    insightsData: GratitudeInsightsData,
    forceRegenerate: boolean = false
  ): Promise<AIInsightsResponse> {
    try {
      // Check cache first unless forcing regeneration
      if (!forceRegenerate) {
        const cached = await this.getCachedInsights(userId, 'gratitude', 'weekly')
        if (cached) {
          logger.debug('Returning cached gratitude insights', { userId })
          return cached.insights as AIInsightsResponse
        }
      }

      // Generate new insights
      logger.info('Generating new gratitude insights', { userId })
      const insights = await this.generateGratitudeInsights(insightsData)

      // Cache the insights
      await this.cacheInsights(userId, 'gratitude', 'weekly', insights)

      return insights
    } catch (error) {
      logger.error('Error getting gratitude insights', { userId, error })
      // Return fallback insights if AI generation fails
      return this.getFallbackGratitudeInsights(insightsData)
    }
  }

  /**
   * Get or generate AI insights for mood journaling
   */
  async getMoodInsights(
    userId: number,
    insightsData: MoodInsightsData,
    forceRegenerate: boolean = false
  ): Promise<AIInsightsResponse> {
    try {
      // Check cache first unless forcing regeneration
      if (!forceRegenerate) {
        const cached = await this.getCachedInsights(userId, 'mood', 'weekly')
        if (cached) {
          logger.debug('Returning cached mood insights', { userId })
          return cached.insights as AIInsightsResponse
        }
      }

      // Generate new insights
      logger.info('Generating new mood insights', { userId })
      const insights = await this.generateMoodInsights(insightsData)

      // Cache the insights
      await this.cacheInsights(userId, 'mood', 'weekly', insights)

      return insights
    } catch (error) {
      logger.error('Error getting mood insights', { userId, error })
      // Return fallback insights if AI generation fails
      return this.getFallbackMoodInsights(insightsData)
    }
  }

  /**
   * Generate gratitude insights using OpenAI
   */
  private async generateGratitudeInsights(
    data: GratitudeInsightsData
  ): Promise<AIInsightsResponse> {
    // Format recent entries
    const recentEntriesText = data.recentEntries
      .map((entry, idx) => {
        const entryText = entry.entries.map((e, i) => `${i + 1}. ${e}`).join('\n')
        return `Entry ${idx + 1} (${entry.date}):\n${entryText}`
      })
      .join('\n\n')

    // Format themes
    const themesText = data.mostCommonThemes.map((t) => `${t.theme} (${t.count} times)`).join(', ')

    // Format monthly trend
    const trendText = data.monthlyTrend.map((t) => `${t.month}: ${t.count} entries`).join(', ')

    // Build prompt
    const prompt = GRATITUDE_INSIGHTS_PROMPT.replace('{totalEntries}', String(data.totalEntries))
      .replace('{currentStreak}', String(data.currentStreak))
      .replace('{longestStreak}', String(data.longestStreak))
      .replace('{entriesThisMonth}', String(data.entriesThisMonth))
      .replace('{entriesLastMonth}', String(data.entriesLastMonth))
      .replace('{mostCommonThemes}', themesText || 'None yet')
      .replace('{monthlyTrend}', trendText || 'No trend data')
      .replace('{recentEntries}', recentEntriesText || 'No recent entries')

    const completion = await this.client.chat.completions.create({
      model: env.get('OPENAI_MODEL', 'gpt-4o-mini'),
      messages: [
        {
          role: 'system',
          content:
            'You are a compassionate mental health AI assistant. Always respond with valid JSON only, no additional text.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 1,
      max_completion_tokens: 800,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('OpenAI returned empty response')
    }

    const insights = JSON.parse(content) as AIInsightsResponse

    // Validate response structure
    if (!insights.weeklySummary || !Array.isArray(insights.keyPatterns)) {
      throw new Error('Invalid insights response structure')
    }

    return insights
  }

  /**
   * Generate mood insights using OpenAI
   */
  private async generateMoodInsights(data: MoodInsightsData): Promise<AIInsightsResponse> {
    // Format recent entries
    const recentEntriesText = data.recentEntries
      .map((entry, idx) => {
        const notes = entry.notes ? `\nNotes: ${entry.notes}` : ''
        return `Entry ${idx + 1} (${entry.date}): ${entry.mood} (intensity: ${entry.intensity}/10)${notes}`
      })
      .join('\n\n')

    // Format mood distribution
    const distributionText = data.moodDistribution
      .map((m) => `${m.mood}: ${m.percentage}%`)
      .join(', ')

    // Format weekly trend
    const weeklyTrendText = data.weeklyTrend
      .map((w) => `${w.week}: ${w.dominantMood} (avg intensity: ${w.averageIntensity})`)
      .join(', ')

    // Format patterns
    const patternsText = data.patterns
      .map((p) => `${p.description} (confidence: ${Math.round(p.confidence * 100)}%)`)
      .join('; ')

    // Build prompt
    const prompt = MOOD_INSIGHTS_PROMPT.replace('{totalEntries}', String(data.totalEntries))
      .replace('{currentStreak}', String(data.currentStreak))
      .replace('{averageIntensity}', String(data.averageIntensity))
      .replace('{moodDistribution}', distributionText || 'No data')
      .replace('{weeklyTrend}', weeklyTrendText || 'No trend data')
      .replace('{monthlyTrend}', 'See weekly trend')
      .replace('{patterns}', patternsText || 'No patterns detected yet')
      .replace('{recentEntries}', recentEntriesText || 'No recent entries')

    const completion = await this.client.chat.completions.create({
      model: env.get('OPENAI_MODEL', 'gpt-4o-mini'),
      messages: [
        {
          role: 'system',
          content:
            'You are a compassionate mental health AI assistant. Always respond with valid JSON only, no additional text.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 1,
      max_completion_tokens: 800,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('OpenAI returned empty response')
    }

    const insights = JSON.parse(content) as AIInsightsResponse

    // Validate response structure
    if (!insights.weeklySummary || !Array.isArray(insights.keyPatterns)) {
      throw new Error('Invalid insights response structure')
    }

    return insights
  }

  /**
   * Get cached insights if they exist and haven't expired
   */
  private async getCachedInsights(
    userId: number,
    type: 'gratitude' | 'mood',
    period: 'weekly' | 'monthly'
  ): Promise<AiInsight | null> {
    const cached = await AiInsight.query()
      .where('user_id', userId)
      .where('type', type)
      .where('period', period)
      .where('expires_at', '>', DateTime.now().toISO()!)
      .first()

    return cached || null
  }

  /**
   * Cache insights for 24 hours
   */
  private async cacheInsights(
    userId: number,
    type: 'gratitude' | 'mood',
    period: 'weekly' | 'monthly',
    insights: AIInsightsResponse
  ): Promise<void> {
    const now = DateTime.now()
    const expiresAt = now.plus({ hours: 24 })

    // Upsert: update existing or create new
    await AiInsight.updateOrCreate(
      {
        userId,
        type,
        period,
      },
      {
        insights,
        generatedAt: now,
        expiresAt,
      }
    )

    logger.debug('Cached AI insights', { userId, type, period, expiresAt: expiresAt.toISO() })
  }

  /**
   * Invalidate cache for a user and type
   */
  async invalidateCache(userId: number, type: 'gratitude' | 'mood'): Promise<void> {
    await AiInsight.query().where('user_id', userId).where('type', type).delete()

    logger.debug('Invalidated AI insights cache', { userId, type })
  }

  /**
   * Fallback insights if AI generation fails
   */
  private getFallbackGratitudeInsights(data: GratitudeInsightsData): AIInsightsResponse {
    return {
      weeklySummary: `You have been maintaining your gratitude practice with ${data.totalEntries} total entries. Keep up the great work!`,
      keyPatterns: [
        data.currentStreak > 0
          ? `You are on a ${data.currentStreak}-day streak - consistency is key!`
          : 'Starting your gratitude journey is the first step.',
        data.mostCommonThemes.length > 0
          ? `You often reflect on: ${data.mostCommonThemes[0]?.theme || 'various themes'}`
          : 'Explore different aspects of your life to write about.',
      ],
      growthObservations: [
        data.entriesThisMonth > data.entriesLastMonth
          ? 'Your practice has been more consistent this month.'
          : 'Every entry counts - keep going!',
      ],
      gentleSuggestions: [
        'Try writing about small moments of joy from your day.',
        'Consider reflecting on challenges you have overcome.',
      ],
    }
  }

  /**
   * Fallback insights if AI generation fails
   */
  private getFallbackMoodInsights(data: MoodInsightsData): AIInsightsResponse {
    const dominantMood = data.moodDistribution[0]?.mood || 'varied'
    return {
      weeklySummary: `You have been tracking your mood with ${data.totalEntries} entries. Self-awareness is a powerful tool for emotional well-being.`,
      keyPatterns: [
        data.currentStreak > 0
          ? `You are on a ${data.currentStreak}-day tracking streak - great consistency!`
          : 'Regular mood tracking helps identify patterns.',
        data.moodDistribution.length > 0
          ? `Your most common mood is ${dominantMood} (${data.moodDistribution[0]?.percentage || 0}% of entries)`
          : 'Continue tracking to discover patterns.',
      ],
      emotionalInsights: [
        data.averageIntensity > 7
          ? 'You have been experiencing higher intensity emotions recently.'
          : 'Your emotional intensity has been relatively moderate.',
      ],
      supportiveSuggestions: [
        'Consider practicing mindfulness on days when intensity is high.',
        'Notice what activities or routines correlate with positive moods.',
      ],
    }
  }

  /**
   * Get recent gratitude entries for insights
   */
  async getRecentGratitudeEntries(
    userId: number,
    days: number = 7
  ): Promise<Array<{ date: string; entries: string[] }>> {
    const startDate = DateTime.now().minus({ days }).startOf('day')
    const entries = await Gratitude.query()
      .where('user_id', userId)
      .where('entry_date', '>=', startDate.toISODate()!)
      .orderBy('entry_date', 'desc')
      .limit(10)

    return entries.map((e) => ({
      date: e.entryDate.toISODate() || '',
      entries: e.entries,
    }))
  }

  /**
   * Get recent mood entries for insights
   */
  async getRecentMoodEntries(
    userId: number,
    days: number = 7
  ): Promise<Array<{ date: string; mood: string; intensity: number; notes: string | null }>> {
    const startDate = DateTime.now().minus({ days }).startOf('day')
    const entries = await Mood.query()
      .where('user_id', userId)
      .where('entry_date', '>=', startDate.toISODate()!)
      .orderBy('entry_date', 'desc')
      .limit(10)

    return entries.map((e) => ({
      date: e.entryDate.toISODate() || '',
      mood: e.mood,
      intensity: e.intensity,
      notes: e.notes,
    }))
  }
}
