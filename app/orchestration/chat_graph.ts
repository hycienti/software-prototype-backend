import { StateGraph, Annotation } from '@langchain/langgraph'
import { DateTime } from 'luxon'
import type Conversation from '#models/conversation'
import type Message from '#models/message'
import ConversationRepository from '#repositories/conversation_repository'
import MessageRepository from '#repositories/message_repository'
import OpenAIService from '#services/openai_service'
import pusherService from '#services/pusher_service'
import { streamProgressStore } from '#services/stream_progress_store'
import type { ChatGraphState, SentimentResult } from '#orchestration/types'
import logger from '@adonisjs/core/services/logger'

const openaiService = new OpenAIService()
const conversationRepository = new ConversationRepository()
const messageRepository = new MessageRepository()

function mergeState(left: Partial<ChatGraphState>, right: Partial<ChatGraphState>): Partial<ChatGraphState> {
  return { ...left, ...right }
}

const StateAnnotation = Annotation.Root({
  chat: Annotation<Partial<ChatGraphState>>({
    reducer: (left: Partial<ChatGraphState>, right: Partial<ChatGraphState>) => mergeState(left ?? {}, right ?? {}),
    default: () => ({}),
  }),
})

type State = { chat: Partial<ChatGraphState> }

async function resolveConversation(state: State): Promise<Partial<State>> {
  const { userId, mode, conversationId } = state.chat as ChatGraphState
  let conversation: Conversation
  if (conversationId) {
    conversation = await conversationRepository.findByIdAndUserId(conversationId, userId)
  } else {
    conversation = await conversationRepository.create({
      userId,
      mode: mode || 'text',
      title: null,
    })
  }
  return { chat: { conversation } }
}

async function saveUserMessage(state: State): Promise<Partial<State>> {
  const { conversation, message, stream } = state.chat as ChatGraphState
  if (!conversation) throw new Error('Conversation required')
  const userMessage = await messageRepository.create({
    conversationId: conversation.id,
    role: 'user',
    content: message,
    metadata: null,
  })
  if (stream) {
    streamProgressStore.init(conversation.id, userMessage.id)
  }
  return { chat: { userMessage } }
}

async function loadHistory(state: State): Promise<Partial<State>> {
  const { conversation } = state.chat as ChatGraphState
  if (!conversation) throw new Error('Conversation required')
  const previousMessages = await messageRepository.listByConversationIdOrdered(
    conversation.id,
    20
  )
  const chatMessages = previousMessages.map((msg) => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content,
  }))
  return { chat: { chatMessages } }
}

async function analyzeSentiment(state: State): Promise<Partial<State>> {
  const { message } = state.chat as ChatGraphState
  const sentiment = await openaiService.analyzeSentiment(message)
  return { chat: { sentiment } }
}

async function generateResponse(state: State): Promise<Partial<State>> {
  const { conversation, chatMessages, stream, userMessage } = state.chat as ChatGraphState
  if (!conversation || !chatMessages) throw new Error('Conversation and chatMessages required')
  let aiResponse = ''
  if (stream) {
    await pusherService.stream(conversation.id, 'start', {
      messageId: userMessage!.id,
    })
    await pusherService.stream(conversation.id, 'typing', { isTyping: true })
    try {
      for await (const chunk of openaiService.generateStreamingResponse({
        messages: chatMessages,
        temperature: 0.7,
        maxTokens: 1000,
      })) {
        aiResponse += chunk
        await pusherService.stream(conversation.id, 'chunk', { content: chunk })
        streamProgressStore.appendChunk(conversation.id, userMessage!.id, chunk)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      streamProgressStore.setError(conversation.id, userMessage!.id, msg)
      throw err
    }
    await pusherService.stream(conversation.id, 'typing', { isTyping: false })
  } else {
    await pusherService.stream(conversation.id, 'typing', { isTyping: true })
    aiResponse = await openaiService.generateResponse({
      messages: chatMessages,
      temperature: 0.7,
      maxTokens: 1000,
    })
    await pusherService.stream(conversation.id, 'typing', { isTyping: false })
  }
  return { chat: { aiResponse } }
}

async function saveAssistantMessage(state: State): Promise<Partial<State>> {
  const { conversation, aiResponse, sentiment, stream, userMessage } = state.chat as ChatGraphState
  if (!conversation || aiResponse === undefined) throw new Error('Conversation and aiResponse required')
  const assistantMessage = await messageRepository.create({
    conversationId: conversation.id,
    role: 'assistant',
    content: aiResponse,
    metadata: {
      sentiment: sentiment?.sentiment ?? 'neutral',
      crisisIndicators: sentiment?.crisisIndicators ?? [],
      confidence: sentiment?.confidence ?? 0.5,
    },
  })
  if (stream) {
    await pusherService.stream(conversation.id, 'complete', {
      messageId: assistantMessage.id,
      conversationId: conversation.id,
    })
    if (userMessage) {
      streamProgressStore.setComplete(
        conversation.id,
        userMessage.id,
        aiResponse,
        assistantMessage.id,
        sentiment
          ? {
              sentiment: sentiment.sentiment,
              crisisIndicators: sentiment.crisisIndicators,
              confidence: sentiment.confidence,
            }
          : undefined
      )
    }
  }
  return { chat: { assistantMessage } }
}

async function updateConversation(state: State): Promise<Partial<State>> {
  const { conversation, sentiment } = state.chat as ChatGraphState
  if (!conversation) return {}
  await conversationRepository.update(conversation, {
    lastMessageAt: DateTime.now(),
    metadata: {
      ...(conversation.metadata || {}),
      lastSentiment: sentiment?.sentiment ?? 'neutral',
      hasCrisisIndicators: (sentiment?.crisisIndicators?.length ?? 0) > 0,
    },
  })
  return {}
}

async function generateTitle(state: State): Promise<Partial<State>> {
  const { conversation, message, chatMessages } = state.chat as ChatGraphState
  if (!conversation || conversation.title || !chatMessages || chatMessages.length > 2) return {}
  try {
    const { getConversationTitlePrompt } = await import('../prompts/index.js')
    const titlePrompt = getConversationTitlePrompt(message)
    const titleResponse = await openaiService.generateResponse({
      messages: [{ role: 'user', content: titlePrompt }],
      temperature: 0.5,
      maxTokens: 50,
    })
    await conversationRepository.update(conversation, {
      title: titleResponse.trim().slice(0, 50),
    })
  } catch (error) {
    logger.warn('Failed to generate conversation title', { error })
  }
  return {}
}

export function createChatGraph() {
  const builder = new StateGraph(StateAnnotation)
    .addNode('resolve_conversation', resolveConversation)
    .addNode('save_user_message', saveUserMessage)
    .addNode('load_history', loadHistory)
    .addNode('analyze_sentiment', analyzeSentiment)
    .addNode('generate_response', generateResponse)
    .addNode('save_assistant_message', saveAssistantMessage)
    .addNode('update_conversation', updateConversation)
    .addNode('generate_title', generateTitle)
    .addEdge('__start__', 'resolve_conversation')
    .addEdge('resolve_conversation', 'save_user_message')
    .addEdge('save_user_message', 'load_history')
    .addEdge('load_history', 'analyze_sentiment')
    .addEdge('analyze_sentiment', 'generate_response')
    .addEdge('generate_response', 'save_assistant_message')
    .addEdge('save_assistant_message', 'update_conversation')
    .addEdge('update_conversation', 'generate_title')
    .addEdge('generate_title', '__end__')
  return builder.compile()
}

export interface ChatGraphResult {
  conversation: Conversation
  userMessage: Message
  assistantMessage: Message
  sentiment: SentimentResult
}

export async function runChatGraph(input: ChatGraphState): Promise<ChatGraphResult> {
  const graph = createChatGraph()
  const final = await graph.invoke({ chat: input })
  const chat = final.chat as ChatGraphState
  if (chat.error) throw new Error(chat.error)
  if (!chat.conversation || !chat.userMessage || !chat.assistantMessage || !chat.sentiment) {
    throw new Error('Chat graph did not produce required outputs')
  }
  return {
    conversation: chat.conversation,
    userMessage: chat.userMessage,
    assistantMessage: chat.assistantMessage,
    sentiment: chat.sentiment,
  }
}
