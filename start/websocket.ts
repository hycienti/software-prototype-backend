import { StreamingChannel } from '../app/websockets/streaming_channel.js'
import app from '@adonisjs/core/services/app'

/**
 * WebSocket routes
 * Note: Ws service is registered by the WsProvider
 * Access it via the container after provider registration
 */
// @ts-ignore - Ws is registered by WsProvider and available at runtime
const Ws = app.container.resolveBinding('Adonis/Addons/Ws')
Ws.channel('/streaming', StreamingChannel)
