// @ts-ignore - WsContext is available from the websocket package
import WsContext from '@adonisjs/websocket/src/Context'
import User from '#models/user'
import logger from '@adonisjs/core/services/logger'
import jwt from 'jsonwebtoken'
import env from '#start/env'

/**
 * WebSocket authentication middleware
 * Validates JWT token from WebSocket connection
 */
export async function websocketAuth(ctx: WsContext): Promise<boolean> {
  try {
    const token =
      ctx.socket.handshake.auth?.token ||
      ctx.socket.handshake.query?.token ||
      ctx.socket.handshake.headers?.authorization?.replace('Bearer ', '')

    if (!token || typeof token !== 'string') {
      logger.warn('WebSocket connection rejected: No token provided', {
        socketId: ctx.socket.id,
      })
      ctx.socket.disconnect()
      return false
    }

    // Verify JWT token
    const appKey = env.get('APP_KEY')
    let decoded: any

    try {
      decoded = jwt.verify(token, appKey)
    } catch (error) {
      logger.warn('WebSocket connection rejected: Invalid token', {
        socketId: ctx.socket.id,
        error: error instanceof Error ? error.message : String(error),
      })
      ctx.socket.disconnect()
      return false
    }

    // Get user from database
    const user = await User.find(decoded.uid)

    if (!user) {
      logger.warn('WebSocket connection rejected: User not found', {
        socketId: ctx.socket.id,
        userId: decoded.uid,
      })
      ctx.socket.disconnect()
      return false
    }

    // Attach user to socket context
    ctx.socket.data.user = user
    ctx.socket.data.userId = user.id

    logger.info('WebSocket connection authenticated', {
      userId: user.id,
      socketId: ctx.socket.id,
    })

    return true
  } catch (error) {
    logger.error('WebSocket authentication error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      socketId: ctx.socket.id,
    })
    ctx.socket.disconnect()
    return false
  }
}
