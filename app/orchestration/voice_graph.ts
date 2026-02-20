import { StateGraph, Annotation } from '@langchain/langgraph'
import { DateTime } from 'luxon'
import type Conversation from '#models/conversation'
import type Message from '#models/message'
import ConversationRepository from '#repositories/conversation_repository'
import MessageRepository from '#repositories/message_repository'
import OpenAIService from '#services/openai_service'
import ElevenLabsService from '#services/elevenlabs_service'
import type { VoiceGraphState } from '#orchestration/types'
import { graphLogger, withGraphNodeLogger } from '#utils/graph_logger'
import type { GraphLogMeta } from '#utils/graph_logger'

const VOICE_GRAPH_NAME = 'voice_graph'

const openaiService = new OpenAIService()
const elevenlabsService = new ElevenLabsService()
const conversationRepository = new ConversationRepository()
const messageRepository = new MessageRepository()

function mergeState(
  left: Partial<VoiceGraphState>,
  right: Partial<VoiceGraphState>
): Partial<VoiceGraphState> {
  return { ...left, ...right }
}

const StateAnnotation = Annotation.Root({
  voice: Annotation<Partial<VoiceGraphState>>({
    reducer: (left: Partial<VoiceGraphState>, right: Partial<VoiceGraphState>) =>
      mergeState(left ?? {}, right ?? {}),
    default: () => ({}),
  }),
})

type State = { voice: Partial<VoiceGraphState> }

async function resolveConversation(state: State): Promise<Partial<State>> {
  const { userId, conversationId } = state.voice as VoiceGraphState
  let conversation: Conversation
  if (conversationId) {
    conversation = await conversationRepository.findByIdAndUserId(conversationId, userId)
  } else {
    conversation = await conversationRepository.create({
      userId,
      mode: 'voice',
      title: null,
    })
  }
  return { voice: { conversation } }
}

async function speechToText(state: State): Promise<Partial<State>> {
  const { audioData, language } = state.voice as VoiceGraphState
  const audioBuffer = Buffer.from(audioData, 'base64')
  const transcript = await elevenlabsService.speechToText({
    audioData: audioBuffer,
    language: language || 'en',
  })
  if (!transcript || transcript.trim().length === 0) {
    throw new Error('Could not transcribe audio. Please try again.')
  }
  return { voice: { transcript } }
}

async function saveUserMessage(state: State): Promise<Partial<State>> {
  const { conversation, transcript, audioFormat } = state.voice as VoiceGraphState
  if (!conversation || !transcript) throw new Error('Conversation and transcript required')
  await messageRepository.create({
    conversationId: conversation.id,
    role: 'user',
    content: transcript,
    metadata: {
      audioFormat: audioFormat ?? 'mp3',
      isVoice: true,
    },
  })
  return {}
}

async function loadHistory(state: State): Promise<Partial<State>> {
  const { conversation } = state.voice as VoiceGraphState
  if (!conversation) throw new Error('Conversation required')
  const previousMessages = await messageRepository.listByConversationIdOrdered(
    conversation.id,
    20
  )
  const chatMessages = previousMessages.map((msg) => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content,
  }))
  return { voice: { chatMessages } }
}

async function analyzeSentiment(state: State): Promise<Partial<State>> {
  const { transcript } = state.voice as VoiceGraphState
  if (!transcript) throw new Error('Transcript required')
  const sentiment = await openaiService.analyzeSentiment(transcript)
  return { voice: { sentiment } }
}

async function generateResponse(state: State): Promise<Partial<State>> {
  const { chatMessages } = state.voice as VoiceGraphState
  if (!chatMessages) throw new Error('chatMessages required')
  const aiResponse = await openaiService.generateResponse({
    messages: chatMessages,
    temperature: 1,
    maxTokens: 2048, // allow room for reasoning + reply (reasoning models can use most tokens on thinking)
  })
  return { voice: { aiResponse } }
}

async function saveAssistantMessage(state: State): Promise<Partial<State>> {
  const { conversation, aiResponse, sentiment } = state.voice as VoiceGraphState
  if (!conversation || aiResponse === undefined) throw new Error('Conversation and aiResponse required')
  const assistantMessage = await messageRepository.create({
    conversationId: conversation.id,
    role: 'assistant',
    content: aiResponse,
    metadata: {
      sentiment: sentiment?.sentiment ?? 'neutral',
      crisisIndicators: sentiment?.crisisIndicators ?? [],
      confidence: sentiment?.confidence ?? 0.5,
      isVoice: true,
    },
  })
  return { voice: { assistantMessage } }
}

async function textToSpeech(state: State): Promise<Partial<State>> {
  const { aiResponse } = state.voice as VoiceGraphState
  if (!aiResponse) throw new Error('aiResponse required')
  const responseAudioBuffer = await elevenlabsService.textToSpeech({
    text: aiResponse,
    stability: 0.5,
    similarityBoost: 0.75,
  })
  const audioBase64 = responseAudioBuffer.toString('base64')
  return { voice: { audioBase64 } }
}

async function updateConversation(state: State): Promise<Partial<State>> {
  const { conversation, sentiment } = state.voice as VoiceGraphState
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

function getResolveConversationMeta(result: Partial<State>): GraphLogMeta {
  const id = (result.voice as VoiceGraphState)?.conversation?.id
  return id !== undefined ? { conversationId: id } : {}
}

function getSpeechToTextMeta(result: Partial<State>): GraphLogMeta {
  const transcript = (result.voice as VoiceGraphState)?.transcript
  return transcript !== undefined
    ? { transcriptLength: transcript.length, transcriptPreview: transcript.slice(0, 80) }
    : {}
}

function getSaveUserMessageMeta(_result: Partial<State>): GraphLogMeta {
  return { saved: true }
}

function getLoadHistoryMeta(result: Partial<State>): GraphLogMeta {
  const messages = (result.voice as VoiceGraphState)?.chatMessages
  return messages !== undefined ? { messageCount: messages.length } : {}
}

function getAnalyzeSentimentMeta(result: Partial<State>): GraphLogMeta {
  const sentiment = (result.voice as VoiceGraphState)?.sentiment
  return sentiment
    ? {
        sentiment: sentiment.sentiment,
        crisisCount: sentiment.crisisIndicators?.length ?? 0,
        confidence: sentiment.confidence,
      }
    : {}
}

function getGenerateResponseMeta(result: Partial<State>): GraphLogMeta {
  const text = (result.voice as VoiceGraphState)?.aiResponse
  return text !== undefined ? { responseLength: text.length, preview: text.slice(0, 80) } : {}
}

function getSaveAssistantMessageMeta(result: Partial<State>): GraphLogMeta {
  const msg = (result.voice as VoiceGraphState)?.assistantMessage
  return msg?.id !== undefined ? { assistantMessageId: msg.id } : {}
}

function getTextToSpeechMeta(result: Partial<State>): GraphLogMeta {
  const audio = (result.voice as VoiceGraphState)?.audioBase64
  return audio !== undefined ? { audioBase64Length: audio.length } : {}
}

function getUpdateConversationMeta(_result: Partial<State>): GraphLogMeta {
  return { updated: true }
}

export function createVoiceGraph() {
  const builder = new StateGraph(StateAnnotation)
    .addNode(
      'resolve_conversation',
      withGraphNodeLogger(
        VOICE_GRAPH_NAME,
        'resolve_conversation',
        resolveConversation,
        getResolveConversationMeta
      )
    )
    .addNode(
      'speech_to_text',
      withGraphNodeLogger(
        VOICE_GRAPH_NAME,
        'speech_to_text',
        speechToText,
        getSpeechToTextMeta
      )
    )
    .addNode(
      'save_user_message',
      withGraphNodeLogger(
        VOICE_GRAPH_NAME,
        'save_user_message',
        saveUserMessage,
        getSaveUserMessageMeta
      )
    )
    .addNode(
      'load_history',
      withGraphNodeLogger(
        VOICE_GRAPH_NAME,
        'load_history',
        loadHistory,
        getLoadHistoryMeta
      )
    )
    .addNode(
      'analyze_sentiment',
      withGraphNodeLogger(
        VOICE_GRAPH_NAME,
        'analyze_sentiment',
        analyzeSentiment,
        getAnalyzeSentimentMeta
      )
    )
    .addNode(
      'generate_response',
      withGraphNodeLogger(
        VOICE_GRAPH_NAME,
        'generate_response',
        generateResponse,
        getGenerateResponseMeta
      )
    )
    .addNode(
      'save_assistant_message',
      withGraphNodeLogger(
        VOICE_GRAPH_NAME,
        'save_assistant_message',
        saveAssistantMessage,
        getSaveAssistantMessageMeta
      )
    )
    .addNode(
      'text_to_speech',
      withGraphNodeLogger(
        VOICE_GRAPH_NAME,
        'text_to_speech',
        textToSpeech,
        getTextToSpeechMeta
      )
    )
    .addNode(
      'update_conversation',
      withGraphNodeLogger(
        VOICE_GRAPH_NAME,
        'update_conversation',
        updateConversation,
        getUpdateConversationMeta
      )
    )
    .addEdge('__start__', 'resolve_conversation')
    .addEdge('resolve_conversation', 'speech_to_text')
    .addEdge('speech_to_text', 'save_user_message')
    .addEdge('save_user_message', 'load_history')
    .addEdge('load_history', 'analyze_sentiment')
    .addEdge('analyze_sentiment', 'generate_response')
    .addEdge('generate_response', 'save_assistant_message')
    .addEdge('save_assistant_message', 'text_to_speech')
    .addEdge('text_to_speech', 'update_conversation')
    .addEdge('update_conversation', '__end__')
  return builder.compile()
}

export interface VoiceGraphResult {
  conversation: Conversation
  transcript: string
  assistantMessage: Message
  audioBase64: string
  sentiment: NonNullable<VoiceGraphState['sentiment']>
}

export async function runVoiceGraph(input: VoiceGraphState): Promise<VoiceGraphResult> {
  graphLogger.graphStart(VOICE_GRAPH_NAME, {
    userId: input.userId,
    conversationId: input.conversationId,
    audioFormat: input.audioFormat,
  })
  try {
    const graph = createVoiceGraph()
    const final = await graph.invoke({ voice: input })
    const voice = final.voice as VoiceGraphState
    if (voice.error) throw new Error(voice.error)
    if (
      !voice.conversation ||
      !voice.transcript ||
      !voice.assistantMessage ||
      voice.audioBase64 === undefined ||
      !voice.sentiment
    ) {
      throw new Error('Voice graph did not produce required outputs')
    }
    graphLogger.graphComplete(VOICE_GRAPH_NAME, {
      conversationId: voice.conversation.id,
      transcriptLength: voice.transcript.length,
      assistantMessageId: voice.assistantMessage.id,
      sentiment: voice.sentiment.sentiment,
      hasCrisisIndicators: (voice.sentiment.crisisIndicators?.length ?? 0) > 0,
    })
    return {
      conversation: voice.conversation,
      transcript: voice.transcript,
      assistantMessage: voice.assistantMessage,
      audioBase64: voice.audioBase64,
      sentiment: voice.sentiment,
    }
  } catch (error) {
    graphLogger.graphError(VOICE_GRAPH_NAME, error, {
      userId: input.userId,
      conversationId: input.conversationId,
    })
    throw error
  }
}
