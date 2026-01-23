import type { Socket } from 'socket.io'
import User from '#models/user'
import logger from '@adonisjs/core/services/logger'
import jwt from 'jsonwebtoken'
import env from '#start/env'

/**
 * Socket.IO authentication middleware
 * Validates JWT token from Socket.IO connection
 */
export async function authenticateSocket(socket: Socket): Promise<boolean> {
  try {
    // Get token from handshake query, auth, or headers
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      (socket.handshake.headers.authorization?.replace('Bearer ', '') as string | undefined)

    if (!token || typeof token !== 'string') {
      logger.warn('Socket.IO connection rejected: No token provided', {
        socketId: socket.id,
      })
      return false
    }

    // Verify JWT token
    const appKey = env.get('APP_KEY')
    let decoded: any

    try {
      decoded = jwt.verify(token, appKey)
    } catch (error) {
      logger.warn('Socket.IO connection rejected: Invalid token', {
        socketId: socket.id,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }

    // Get user from database
    const user = await User.find(decoded.uid)

    if (!user) {
      logger.warn('Socket.IO connection rejected: User not found', {
        socketId: socket.id,
        userId: decoded.uid,
      })
      return false
    }

    // Attach user to socket data
    socket.data.user = user
    socket.data.userId = user.id

    logger.info('Socket.IO connection authenticated', {
      userId: user.id,
      socketId: socket.id,
    })

    return true
  } catch (error) {
    logger.error('Socket.IO authentication error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      socketId: socket.id,
    })
    return false
  }
}
