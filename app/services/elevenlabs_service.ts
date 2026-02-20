import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

export interface TextToSpeechOptions {
  text: string
  voiceId?: string
  modelId?: string
  stability?: number
  similarityBoost?: number
}

export interface SpeechToTextOptions {
  audioData: Buffer
  language?: string
}

export default class ElevenLabsService {
  private client: ElevenLabsClient

  constructor() {
    const apiKey = env.get('ELEVENLABS_API_KEY')
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY environment variable is required')
    }

    this.client = new ElevenLabsClient({
      apiKey,
    })
  }

  /**
   * Convert text to speech
   */
  async textToSpeech(options: TextToSpeechOptions): Promise<Buffer> {
    try {
      const voiceId = options.voiceId || env.get('ELEVENLABS_VOICE_ID', '21m00Tcm4TlvDq8ikWAM') // Default warm voice
      const modelId = options.modelId || env.get('ELEVENLABS_MODEL_ID', 'eleven_turbo_v2_5')

      const audio = await this.client.textToSpeech.convert(voiceId, {
        text: options.text,
        modelId: modelId,
        voiceSettings: {
          stability: options.stability ?? 0.5,
          similarityBoost: options.similarityBoost ?? 0.75,
          style: 0.0,
          useSpeakerBoost: true,
        },
      })

      // Convert stream to buffer
      const chunks: Uint8Array[] = []
      for await (const chunk of audio) {
        chunks.push(chunk)
      }

      return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      logger.error(`ElevenLabs TTS error: ${message}`, { stack })
      throw error
    }
  }

  /**
   * Convert speech to text using ElevenLabs STT
   */
  async speechToText(options: SpeechToTextOptions): Promise<string> {
    try {
      const modelId = env.get('ELEVENLABS_STT_MODEL_ID', 'scribe_v1')

      const response = await this.client.speechToText.convert({
        file: options.audioData,
        modelId: modelId as 'scribe_v1' | 'scribe_v2',
        languageCode: options.language || undefined,
        enableLogging: true,
      })

      // The response can be different types, but typically contains a 'text' field
      // or a 'chunks' array with text content
      if ('text' in response && typeof response.text === 'string') {
        return response.text
      }

      // Handle chunked response
      if ('chunks' in response && Array.isArray(response.chunks)) {
        return response.chunks.map((chunk: any) => chunk.text || '').join(' ')
      }

      // Fallback: try to extract text from any response structure
      const responseAny = response as any
      if (responseAny.text) {
        return responseAny.text
      }

      logger.error('Unexpected STT response format', { response })
      throw new Error('Failed to extract text from STT response')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      logger.error(`ElevenLabs STT error: ${message}`, { stack })
      throw error
    }
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<any[]> {
    try {
      const voices = await this.client.voices.getAll()
      return voices.voices || []
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      logger.error(`Error fetching voices: ${message}`, { stack })
      return []
    }
  }
}
