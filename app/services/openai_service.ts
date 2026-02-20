import OpenAI from 'openai'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { THERAPY_SYSTEM_PROMPT, SENTIMENT_ANALYSIS_PROMPT } from '../prompts/index.js'

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'

/** Valid OpenAI model IDs start with gpt- (lowercase). Use default if env value is missing or invalid. */
function getOpenAIModel(): string {
  const configured = env.get('OPENAI_MODEL', '').trim()
  if (configured && configured.toLowerCase().startsWith('gpt-')) {
    return configured
  }
  if (configured) {
    logger.warn('Invalid OPENAI_MODEL "%s", using default %s', configured, DEFAULT_OPENAI_MODEL)
  }
  return DEFAULT_OPENAI_MODEL
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatCompletionOptions {
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export default class OpenAIService {
  private client: OpenAI
  private model: string

  constructor() {
    const apiKey = env.get('OPENAI_API_KEY')
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required')
    }

    this.client = new OpenAI({
      apiKey,
    })
    this.model = getOpenAIModel()
  }

  /**
   * Generate AI response for therapy conversation
   */
  async generateResponse(options: ChatCompletionOptions): Promise<string> {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: THERAPY_SYSTEM_PROMPT,
        },
        ...options.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      ]

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: options.temperature ?? 1,
        max_completion_tokens: options.maxTokens ?? 1000,
        stream: false, // Explicitly set to false for non-streaming response
      })

      const content = completion.choices[0]?.message?.content

      if (!content) {
        logger.error('OpenAI returned empty response', { completion })
        throw new Error('Failed to generate AI response')
      }

      return content
    } catch (error) {
      logger.error('OpenAI service error', { error })
      throw error
    }
  }

  /**
   * Generate streaming AI response for real-time chat
   */
  async *generateStreamingResponse(
    options: ChatCompletionOptions
  ): AsyncGenerator<string, void, unknown> {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: THERAPY_SYSTEM_PROMPT,
        },
        ...options.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      ]

      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: options.temperature ?? 1,
        max_completion_tokens: options.maxTokens ?? 1000,
        stream: true,
      })

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content
        if (content) {
          yield content
        }
      }
    } catch (error) {
      logger.error('OpenAI streaming error', { error })
      throw error
    }
  }

  /**
   * Analyze sentiment and detect crisis indicators
   */
  async analyzeSentiment(content: string): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative'
    crisisIndicators: string[]
    confidence: number
  }> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: SENTIMENT_ANALYSIS_PROMPT,
          },
          {
            role: 'user',
            content,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 1,
        max_completion_tokens: 200,
      })

      const result = JSON.parse(completion.choices[0]?.message?.content || '{}')

      return {
        sentiment: result.sentiment || 'neutral',
        crisisIndicators: result.crisisIndicators || [],
        confidence: result.confidence || 0.5,
      }
    } catch (error) {
      logger.error('Sentiment analysis error', { error })
      return {
        sentiment: 'neutral',
        crisisIndicators: [],
        confidence: 0.5,
      }
    }
  }
}
