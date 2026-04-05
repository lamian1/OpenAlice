import type { AccountManager } from '../domain/trading/index.js'
import type { SnapshotService } from '../domain/trading/snapshot/index.js'
import type { CronEngine } from '../task/cron/engine.js'
import type { Heartbeat } from '../task/heartbeat/index.js'
import type { Config, WebChannel } from './config.js'
import type { ConnectorCenter } from './connector-center.js'
import type { AgentCenter } from './agent-center.js'
import type { EventLog } from './event-log.js'
import type { ToolCallLog } from './tool-call-log.js'
import type { ToolCenter } from './tool-center.js'

export type { Config, WebChannel }

export interface Plugin {
  name: string
  start(ctx: EngineContext): Promise<void>
  stop(): Promise<void>
}

export interface ReconnectResult {
  success: boolean
  error?: string
  message?: string
}

export type IndicatorStatus = 'online' | 'warning' | 'offline' | 'disabled'

export interface RuntimeConnectorStatus {
  running: boolean
  port?: number
}

export interface RuntimeNewsFeedStatus {
  name: string
  url: string
  source: string
  lastFetchAt?: number
  lastSuccessAt?: number
  lastFailureAt?: number
  lastError?: string
  lastFetchedCount: number
  lastNewCount: number
}

export interface RuntimeNewsCollectorStatus {
  running: boolean
  intervalMs: number
  lastRunAt?: number
  lastSuccessAt?: number
  lastFailureAt?: number
  lastError?: string
  lastTotalItems: number
  lastTotalNew: number
  feeds: RuntimeNewsFeedStatus[]
}

export interface EngineRuntimeStatus {
  connectors: {
    web: RuntimeConnectorStatus
    mcp: RuntimeConnectorStatus
    mcpAsk: RuntimeConnectorStatus
    telegram: RuntimeConnectorStatus
    openbbServer: RuntimeConnectorStatus
  }
  connectorsReconnecting: boolean
  news: RuntimeNewsCollectorStatus | null
}

export interface EngineContext {
  config: Config
  connectorCenter: ConnectorCenter
  agentCenter: AgentCenter
  eventLog: EventLog
  toolCallLog: ToolCallLog
  heartbeat: Heartbeat
  cronEngine: CronEngine
  toolCenter: ToolCenter

  // Trading (unified account model)
  accountManager: AccountManager
  snapshotService?: SnapshotService
  /** Reconnect connector plugins (Telegram, MCP-Ask, etc.). */
  reconnectConnectors: () => Promise<ReconnectResult>
  /** Current runtime status snapshot for plugins and background services. */
  getRuntimeStatus: () => EngineRuntimeStatus
}

/** A media attachment collected from tool results (e.g. browser screenshots). */
export interface MediaAttachment {
  type: 'image'
  /** Absolute path to the file on disk. */
  path: string
}
