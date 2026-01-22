import OpenAI from 'openai'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

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
   * Generate AI response for therapy conversation
   */
  async generateResponse(options: ChatCompletionOptions): Promise<string> {
    try {
      const systemPrompt = `You are a compassionate, empathetic AI therapist assistant named Haven. Your role is to:
- Provide supportive, non-judgmental responses
- Use active listening techniques
- Offer evidence-based therapeutic guidance
- Detect crisis situations and escalate appropriately
- Maintain professional boundaries
- Use warm, natural language
- Support users through difficult emotions

Remember:
- Never provide medical diagnoses
- Always encourage professional help for serious issues
- Be patient and understanding
- Validate user feelings
- Ask thoughtful follow-up questions`

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...options.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      ]

      const completion = await this.client.chat.completions.create({
        model: env.get('OPENAI_MODEL', 'gpt-4o-mini'),
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
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
      const systemPrompt = `You are a compassionate, empathetic AI therapist assistant named Haven. Your role is to:
- Provide supportive, non-judgmental responses
- Use active listening techniques
- Offer evidence-based therapeutic guidance
- Detect crisis situations and escalate appropriately
- Maintain professional boundaries
- Use warm, natural language
- Support users through difficult emotions

Remember:
- Never provide medical diagnoses
- Always encourage professional help for serious issues
- Be patient and understanding
- Validate user feelings
- Ask thoughtful follow-up questions`

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...options.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      ]

      const stream = await this.client.chat.completions.create({
        model: env.get('OPENAI_MODEL', 'gpt-4o-mini'),
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
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
        model: env.get('OPENAI_MODEL', 'gpt-4o-mini'),
        messages: [
          {
            role: 'system',
            content: `Analyze the following message for sentiment and crisis indicators. 
Return a JSON object with:
- sentiment: "positive", "neutral", or "negative"
- crisisIndicators: array of detected crisis keywords/phrases (e.g., ["suicidal ideation", "self-harm"])
- confidence: number between 0 and 1

Be conservative - only flag clear crisis indicators.`,
          },
          {
            role: 'user',
            content,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 200,
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
