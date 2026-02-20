import type Conversation from '#models/conversation'
import type Message from '#models/message'

export interface ChatGraphInput {
  userId: number
  message: string
  stream: boolean
  mode: 'text' | 'voice'
  conversationId?: number
}

export interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative'
  crisisIndicators: string[]
  confidence: number
}

export interface ChatGraphState {
  userId: number
  message: string
  stream: boolean
  mode: 'text' | 'voice'
  conversationId?: number
  conversation?: Conversation
  userMessage?: Message
  chatMessages?: { role: 'user' | 'assistant' | 'system'; content: string }[]
  sentiment?: SentimentResult
  aiResponse?: string
  assistantMessage?: Message
  error?: string
}

export interface VoiceGraphInput {
  userId: number
  audioData: string
  audioFormat: string
  language?: string
  conversationId?: number
}

export interface VoiceGraphState {
  userId: number
  audioData: string
  audioFormat: string
  language: string
  conversationId?: number
  transcript?: string
  conversation?: Conversation
  chatMessages?: { role: 'user' | 'assistant' | 'system'; content: string }[]
  sentiment?: SentimentResult
  aiResponse?: string
  assistantMessage?: Message
  audioBase64?: string
  error?: string
}
