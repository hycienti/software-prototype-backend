/**
 * Service for providing gratitude-related quotes
 * Uses Quotable API (https://api.quotable.io) - free, no authentication required
 */

import logger from '@adonisjs/core/services/logger'

// Fallback quotes in case API fails or is unavailable
const FALLBACK_QUOTES = [
  {
    text: 'Gratitude turns what we have into enough.',
    author: 'Anonymous',
  },
  {
    text: 'The unthankful heart discovers no mercies; but the thankful heart will find, in every hour, some heavenly blessings.',
    author: 'Henry Ward Beecher',
  },
  {
    text: 'Gratitude is not only the greatest of virtues, but the parent of all others.',
    author: 'Cicero',
  },
  {
    text: 'Be thankful for what you have; you\'ll end up having more. If you concentrate on what you don\'t have, you will never, ever have enough.',
    author: 'Oprah Winfrey',
  },
  {
    text: 'Gratitude makes sense of our past, brings peace for today, and creates a vision for tomorrow.',
    author: 'Melody Beattie',
  },
  {
    text: 'When we focus on our gratitude, the tide of disappointment goes out and the tide of love rushes in.',
    author: 'Kristin Armstrong',
  },
  {
    text: 'Gratitude is the fairest blossom which springs from the soul.',
    author: 'Henry Ward Beecher',
  },
  {
    text: 'The roots of all goodness lie in the soil of appreciation for goodness.',
    author: 'Dalai Lama',
  },
  {
    text: 'Gratitude is a powerful catalyst for happiness. It\'s the spark that lights a fire of joy in your soul.',
    author: 'Amy Collette',
  },
  {
    text: 'In ordinary life, we hardly realize that we receive a great deal more than we give, and that it is only with gratitude that life becomes rich.',
    author: 'Dietrich Bonhoeffer',
  },
  {
    text: 'Gratitude is the healthiest of all human emotions. The more you express gratitude for what you have, the more likely you will have even more to express gratitude for.',
    author: 'Zig Ziglar',
  },
  {
    text: 'When you are grateful, fear disappears and abundance appears.',
    author: 'Tony Robbins',
  },
  {
    text: 'Gratitude unlocks the fullness of life. It turns what we have into enough, and more.',
    author: 'Melody Beattie',
  },
  {
    text: 'The way to develop the best that is in a person is by appreciation and encouragement.',
    author: 'Charles Schwab',
  },
  {
    text: 'Gratitude is the sign of noble souls.',
    author: 'Aesop',
  },
  {
    text: 'We must find time to stop and thank the people who make a difference in our lives.',
    author: 'John F. Kennedy',
  },
  {
    text: 'Gratitude is when memory is stored in the heart and not in the mind.',
    author: 'Lionel Hampton',
  },
  {
    text: 'The more you practice the art of thankfulness, the more you have to be thankful for.',
    author: 'Norman Vincent Peale',
  },
  {
    text: 'Gratitude is the wine for the soul. Go on. Get drunk.',
    author: 'Rumi',
  },
  {
    text: 'Appreciation is a wonderful thing. It makes what is excellent in others belong to us as well.',
    author: 'Voltaire',
  },
]

interface QuoteResponse {
  _id: string
  content: string
  author: string
  tags: string[]
  authorSlug: string
  length: number
  dateAdded: string
  dateModified: string
}

export default class QuotesService {
  private readonly QUOTABLE_API_BASE = 'https://api.quotable.io'
  private quoteCache: Array<{ text: string; author: string }> = []
  private cacheTimestamp: number = 0
  private readonly CACHE_DURATION = 1000 * 60 * 60 // 1 hour

  /**
   * Get a random gratitude/inspirational quote from Quotable API
   * Falls back to cached quotes or hardcoded fallbacks if API fails
   */
  async getRandomQuote(): Promise<{ text: string; author: string }> {
    try {
      // Try to fetch from API with inspirational/gratitude-related tags
      const tags = ['gratitude', 'inspirational', 'wisdom', 'happiness', 'motivational']
      const randomTag = tags[Math.floor(Math.random() * tags.length)]
      
      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      const response = await fetch(
        `${this.QUOTABLE_API_BASE}/random?tags=${randomTag}&maxLength=200`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal,
        }
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Quotable API returned ${response.status}`)
      }

      const data = (await response.json()) as QuoteResponse

      const quote = {
        text: data.content,
        author: data.author || 'Unknown',
      }

      // Update cache with successful fetch
      this.updateCache(quote)

      logger.debug('Fetched quote from Quotable API', { tag: randomTag, author: quote.author })

      return quote
    } catch (error) {
      logger.warn('Failed to fetch quote from API, using fallback', { 
        error: error instanceof Error ? error.message : String(error) 
      })

      // Try to return from cache if available and recent
      if (this.quoteCache.length > 0 && Date.now() - this.cacheTimestamp < this.CACHE_DURATION) {
        const randomIndex = Math.floor(Math.random() * this.quoteCache.length)
        logger.debug('Returning quote from cache', { cacheSize: this.quoteCache.length })
        return this.quoteCache[randomIndex]
      }

      // Fall back to hardcoded quotes when API is unavailable
      const randomIndex = Math.floor(Math.random() * FALLBACK_QUOTES.length)
      logger.debug('Returning hardcoded fallback quote', { fallbackIndex: randomIndex })
      return FALLBACK_QUOTES[randomIndex]
    }
  }

  /**
   * Get a quote by index (for consistent daily quotes)
   * Uses cache or fallback quotes
   */
  getQuoteByIndex(index: number): { text: string; author: string } {
    const quotes = this.quoteCache.length > 0 ? this.quoteCache : FALLBACK_QUOTES
    const normalizedIndex = index % quotes.length
    return quotes[normalizedIndex]
  }

  /**
   * Update the quote cache
   */
  private updateCache(quote: { text: string; author: string }): void {
    // Add to cache if not already present
    const exists = this.quoteCache.some(
      (q) => q.text === quote.text && q.author === quote.author
    )

    if (!exists) {
      this.quoteCache.push(quote)
      // Keep cache size manageable (last 50 quotes)
      if (this.quoteCache.length > 50) {
        this.quoteCache.shift()
      }
    }

    this.cacheTimestamp = Date.now()
  }

  /**
   * Preload quotes into cache (optional, can be called on service initialization)
   */
  async preloadQuotes(count: number = 10): Promise<void> {
    try {
      const quotes: Array<{ text: string; author: string }> = []
      const tags = ['gratitude', 'inspirational', 'wisdom', 'happiness']

      for (let i = 0; i < count; i++) {
        const tag = tags[i % tags.length]
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(
          `${this.QUOTABLE_API_BASE}/random?tags=${tag}&maxLength=200`,
          {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal,
          }
        )

        clearTimeout(timeoutId)

        if (response.ok) {
          const data = (await response.json()) as unknown as QuoteResponse
          quotes.push({
            text: data.content,
            author: data.author || 'Unknown',
          })
        }
      }

      if (quotes.length > 0) {
        this.quoteCache = quotes
        this.cacheTimestamp = Date.now()
        logger.info(`Preloaded ${quotes.length} quotes into cache`)
      }
    } catch (error) {
      logger.warn('Failed to preload quotes', { error })
    }
  }
}
