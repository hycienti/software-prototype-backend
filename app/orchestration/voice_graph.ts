import { StateGraph, Annotation } from '@langchain/langgraph'
import { DateTime } from 'luxon'
import type Conversation from '#models/conversation'
import type Message from '#models/message'
import ConversationRepository from '#repositories/conversation_repository'
import MessageRepository from '#repositories/message_repository'
import OpenAIService from '#services/openai_service'
import ElevenLabsService from '#services/elevenlabs_service'
import type { VoiceGraphState } from '#orchestration/types'

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
    maxTokens: 500,
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

export function createVoiceGraph() {
  const builder = new StateGraph(StateAnnotation)
    .addNode('resolve_conversation', resolveConversation)
    .addNode('speech_to_text', speechToText)
    .addNode('save_user_message', saveUserMessage)
    .addNode('load_history', loadHistory)
    .addNode('analyze_sentiment', analyzeSentiment)
    .addNode('generate_response', generateResponse)
    .addNode('save_assistant_message', saveAssistantMessage)
    .addNode('text_to_speech', textToSpeech)
    .addNode('update_conversation', updateConversation)
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
  return {
    conversation: voice.conversation,
    transcript: voice.transcript,
    assistantMessage: voice.assistantMessage,
    audioBase64: voice.audioBase64,
    sentiment: voice.sentiment,
  }
}
