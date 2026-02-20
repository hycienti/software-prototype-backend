/**
 * Short-lived store for streaming chat progress so clients can poll when Pusher is unavailable.
 * Key: `conversationId:userMessageId`. TTL 5 minutes.
 */

const TTL_MS = 5 * 60 * 1000

export type StreamStatus = 'pending' | 'complete' | 'error'

export interface StreamProgressState {
  status: StreamStatus
  chunks: string[]
  fullContent?: string
  messageId?: number
  sentiment?: { sentiment: string; crisisIndicators: string[]; confidence: number }
  error?: string
  updatedAt: number
}

const store = new Map<string, StreamProgressState>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function key(conversationId: number, userMessageId: number): string {
  return `${conversationId}:${userMessageId}`
}

function clearExpiry(k: string) {
  const t = timers.get(k)
  if (t) {
    clearTimeout(t)
    timers.delete(k)
  }
}

function setExpiry(k: string) {
  clearExpiry(k)
  timers.set(
    k,
    setTimeout(() => {
      store.delete(k)
      timers.delete(k)
    }, TTL_MS)
  )
}

export const streamProgressStore = {
  init(conversationId: number, userMessageId: number): void {
    const k = key(conversationId, userMessageId)
    store.set(k, {
      status: 'pending',
      chunks: [],
      updatedAt: Date.now(),
    })
    setExpiry(k)
  },

  appendChunk(conversationId: number, userMessageId: number, chunk: string): void {
    const k = key(conversationId, userMessageId)
    const existing = store.get(k)
    if (!existing) return
    existing.chunks.push(chunk)
    existing.updatedAt = Date.now()
    setExpiry(k)
  },

  setComplete(
    conversationId: number,
    userMessageId: number,
    fullContent: string,
    messageId: number,
    sentiment?: StreamProgressState['sentiment']
  ): void {
    const k = key(conversationId, userMessageId)
    const existing = store.get(k)
    if (!existing) return
    existing.status = 'complete'
    existing.fullContent = fullContent
    existing.messageId = messageId
    existing.sentiment = sentiment
    existing.updatedAt = Date.now()
    setExpiry(k)
  },

  setError(conversationId: number, userMessageId: number, errorMessage: string): void {
    const k = key(conversationId, userMessageId)
    const existing = store.get(k)
    if (!existing) {
      store.set(k, {
        status: 'error',
        chunks: [],
        error: errorMessage,
        updatedAt: Date.now(),
      })
    } else {
      existing.status = 'error'
      existing.error = errorMessage
      existing.updatedAt = Date.now()
    }
    setExpiry(k)
  },

  get(conversationId: number, userMessageId: number): StreamProgressState | null {
    const k = key(conversationId, userMessageId)
    return store.get(k) ?? null
  },
}
