import OpenAI from 'openai'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { THERAPY_SYSTEM_PROMPT, SENTIMENT_ANALYSIS_PROMPT } from '../prompts/index.js'

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'
const LOG_CONTEXT = { service: 'OpenAI' }

function logStart(method: string, meta: Record<string, unknown>) {
  logger.info({ ...LOG_CONTEXT, method, ...meta }, 'OpenAI request start')
}

function logSuccess(method: string, durationMs: number, usage?: unknown, meta?: Record<string, unknown>) {
  logger.info(
    { ...LOG_CONTEXT, method, durationMs, usage, ...meta },
    'OpenAI request completed'
  )
}

function logError(method: string, error: unknown, meta?: Record<string, unknown>) {
  const err = error instanceof Error ? error : new Error(String(error))
  logger.error(
    {
      ...LOG_CONTEXT,
      method,
      errorMessage: err.message,
      errorName: err.name,
      stack: err.stack,
      ...meta,
    },
    'OpenAI request failed'
  )
}

/** Extract plain text from API message content (string or array of content parts). */
function extractMessageContent(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (!Array.isArray(raw)) return ''
  return (raw as Array<{ type?: string; text?: string }>)
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text!)
    .join('')
}

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
    const method = 'generateResponse'
    const start = Date.now()
    logStart(method, {
      model: this.model,
      messageCount: options.messages.length,
      maxTokens: options.maxTokens ?? 1000,
      stream: false,
    })

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

      const rawContent = completion.choices[0]?.message?.content
      const content = extractMessageContent(rawContent)

      if (!content || !content.trim()) {
        const choice = completion.choices[0]
        const finishReason = choice?.finish_reason
        const msg = choice?.message as { refusal?: string } | undefined
        if (finishReason === 'length') {
          logger.warn(
            {
              ...LOG_CONTEXT,
              method,
              model: this.model,
              finishReason,
              choiceIndex: choice?.index,
              usage: completion.usage,
            },
            'Empty response (token limit); returning fallback message'
          )
          return "I wasn't able to finish that thought. Please try again or rephrase."
        }
        logError(method, new Error('Empty response'), {
          model: this.model,
          finishReason,
          choiceIndex: choice?.index,
          usage: completion.usage,
          rawContentType: typeof rawContent,
          isArray: Array.isArray(rawContent),
          refusal: msg?.refusal,
        })
        throw new Error(msg?.refusal || 'Failed to generate AI response')
      }

      logSuccess(method, Date.now() - start, completion.usage, {
        model: this.model,
        responseLength: content.length,
      })
      return content
    } catch (error) {
      logError(method, error, { model: this.model, durationMs: Date.now() - start })
      throw error
    }
  }

  /**
   * Generate streaming AI response for real-time chat
   */
  async *generateStreamingResponse(
    options: ChatCompletionOptions
  ): AsyncGenerator<string, void, unknown> {
    const method = 'generateStreamingResponse'
    const start = Date.now()
    logStart(method, {
      model: this.model,
      messageCount: options.messages.length,
      maxTokens: options.maxTokens ?? 1000,
      stream: true,
    })

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

      let chunkCount = 0
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content
        if (content) {
          chunkCount++
          yield content
        }
      }
      logSuccess(method, Date.now() - start, undefined, {
        model: this.model,
        chunkCount,
      })
    } catch (error) {
      logError(method, error, { model: this.model, durationMs: Date.now() - start })
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
    const method = 'analyzeSentiment'
    const start = Date.now()
    logStart(method, {
      model: this.model,
      inputLength: content.length,
      maxTokens: 200,
    })

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

      const rawContent = completion.choices[0]?.message?.content
      const responseText = extractMessageContent(rawContent)
      const result = JSON.parse(responseText || '{}')

      const out = {
        sentiment: result.sentiment || 'neutral',
        crisisIndicators: result.crisisIndicators || [],
        confidence: result.confidence || 0.5,
      }
      logSuccess(method, Date.now() - start, completion.usage, {
        model: this.model,
        sentiment: out.sentiment,
        crisisCount: out.crisisIndicators.length,
      })
      return out
    } catch (error) {
      logError(method, error, { model: this.model, durationMs: Date.now() - start })
      return {
        sentiment: 'neutral',
        crisisIndicators: [],
        confidence: 0.5,
      }
    }
  }
}
