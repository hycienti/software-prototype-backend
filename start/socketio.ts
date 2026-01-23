import { Server as SocketIOServer } from 'socket.io'
import type { Server as HTTPServer } from 'node:http'
import logger from '@adonisjs/core/services/logger'
import { setupSocketIOHandlers } from '#app/socketio/streaming_handler'

/**
 * Socket.IO Server Setup
 * Attaches Socket.IO to the AdonisJS HTTP server
 */
let io: SocketIOServer | null = null

/**
 * Initialize Socket.IO server
 */
export function initializeSocketIO(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    return io
  }

  logger.info('Initializing Socket.IO server...')

  // Create Socket.IO server with CORS configuration
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*', // In production, restrict this to your frontend domain
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true, // Allow Engine.IO v3 clients
  })

  // Setup event handlers
  setupSocketIOHandlers(io)

  logger.info('Socket.IO server initialized successfully')

  return io
}

/**
 * Get Socket.IO server instance
 */
export function getSocketIO(): SocketIOServer | null {
  return io
}

/**
 * Cleanup Socket.IO server
 */
export function cleanupSocketIO(): void {
  if (io) {
    io.close()
    io = null
    logger.info('Socket.IO server closed')
  }
}
