import logger from '@adonisjs/core/services/logger'

export type GraphLogMeta = Record<string, unknown>

/**
 * Reusable logger for LangGraph flows. Use for consistent tracing of node and graph
 * success/error (e.g. voice_graph, chat_graph).
 */
export const graphLogger = {
  nodeStart(graphName: string, nodeName: string, meta?: GraphLogMeta): void {
    logger.info(`[${graphName}] node_start`, { node: nodeName, ...meta })
  },

  nodeSuccess(graphName: string, nodeName: string, meta?: GraphLogMeta): void {
    logger.info(`[${graphName}] node_success`, { node: nodeName, ...meta })
  },

  nodeError(
    graphName: string,
    nodeName: string,
    error: unknown,
    meta?: GraphLogMeta
  ): void {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    logger.error(`[${graphName}] node_error (${nodeName}): ${message}`, {
      node: nodeName,
      stack,
      ...meta,
    })
  },

  graphStart(graphName: string, meta?: GraphLogMeta): void {
    logger.info(`[${graphName}] graph_start`, meta ?? {})
  },

  graphComplete(graphName: string, meta?: GraphLogMeta): void {
    logger.info(`[${graphName}] graph_complete`, meta ?? {})
  },

  graphError(graphName: string, error: unknown, meta?: GraphLogMeta): void {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    logger.error(`[${graphName}] graph_error: ${message}`, {
      stack,
      ...meta,
    })
  },
}

/**
 * Wraps a graph node function with start/success/error logging.
 * Use when registering nodes so each invocation is traced.
 */
export function withGraphNodeLogger<TState, TReturn>(
  graphName: string,
  nodeName: string,
  fn: (state: TState) => Promise<TReturn>
): (state: TState) => Promise<TReturn> {
  return async (state: TState): Promise<TReturn> => {
    graphLogger.nodeStart(graphName, nodeName)
    try {
      const result = await fn(state)
      graphLogger.nodeSuccess(graphName, nodeName)
      return result
    } catch (error) {
      graphLogger.nodeError(graphName, nodeName, error)
      throw error
    }
  }
}
