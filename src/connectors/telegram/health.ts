import type { EventLogEntry } from '../../core/event-log.js'
import type { Config } from '../../core/config.js'
import type { EngineContext, IndicatorStatus } from '../../core/types.js'

interface TelegramApiResponse<T> {
  ok: boolean
  result?: T
  description?: string
}

export interface TelegramHealthSnapshot {
  enabled: boolean
  configured: boolean
  runtimeRunning: boolean
  botUsername?: string
  allowedChatIds: number[]
  botApiOk?: boolean
  botApiError?: string
  webhookError?: string
  bot: Record<string, unknown> | null
  webhook: Record<string, unknown> | null
  recentEvents: EventLogEntry[]
  status: IndicatorStatus
  detail: string
}

async function telegramApi<T>(token: string, method: string, init?: RequestInit): Promise<TelegramApiResponse<T>> {
  const body = init?.body
  const requestInit: RequestInit = {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(10_000),
  }
  if (body && typeof body !== 'string') {
    requestInit.body = JSON.stringify(body)
    requestInit.headers = {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    }
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, requestInit)
  return res.json() as Promise<TelegramApiResponse<T>>
}

function filterRecentTelegramEvents(ctx: EngineContext, limit: number): EventLogEntry[] {
  return ctx.eventLog
    .recent({ limit: 200 })
    .filter((entry) => (entry.payload as Record<string, unknown> | undefined)?.channel === 'telegram')
    .slice(-limit)
}

function deriveTelegramIndicator(snapshot: Omit<TelegramHealthSnapshot, 'status' | 'detail'>): Pick<TelegramHealthSnapshot, 'status' | 'detail'> {
  if (!snapshot.enabled) {
    return { status: 'disabled', detail: 'Telegram 已关闭' }
  }

  if (!snapshot.configured) {
    return { status: 'warning', detail: 'Telegram 已启用但缺少 Bot Token' }
  }

  if (!snapshot.runtimeRunning) {
    return { status: 'warning', detail: 'Telegram 已配置但连接器未启动' }
  }

  if (snapshot.botApiOk === false) {
    return {
      status: 'offline',
      detail: snapshot.botApiError ? `Telegram Bot API 不可达: ${snapshot.botApiError}` : 'Telegram Bot API 不可达',
    }
  }

  const webhookUrl = String(snapshot.webhook?.url ?? '').trim()
  if (webhookUrl) {
    return {
      status: 'warning',
      detail: `检测到旧 Webhook，可能与轮询模式冲突: ${webhookUrl}`,
    }
  }

  const pendingUpdates = Number(snapshot.webhook?.pending_update_count ?? 0)
  if (pendingUpdates > 0) {
    return {
      status: 'warning',
      detail: `Telegram 轮询已启动，但仍有 ${pendingUpdates} 条待处理更新`,
    }
  }

  if (snapshot.recentEvents.length > 0) {
    return {
      status: 'online',
      detail: 'Telegram 轮询运行中，最近有消息收发事件',
    }
  }

  return {
    status: 'online',
    detail: 'Telegram 轮询运行中，Bot API 可达',
  }
}

export async function getTelegramHealth(ctx: EngineContext, config: Config, recentLimit = 20): Promise<TelegramHealthSnapshot> {
  const runtime = ctx.getRuntimeStatus()
  const telegram = config.connectors.telegram
  const enabled = telegram.enabled
  const configured = enabled && !!telegram.botToken
  const base = {
    enabled,
    configured,
    runtimeRunning: runtime.connectors.telegram.running,
    botUsername: telegram.botUsername,
    allowedChatIds: telegram.chatIds,
    bot: null,
    webhook: null,
    recentEvents: filterRecentTelegramEvents(ctx, recentLimit),
  }

  if (!enabled || !telegram.botToken) {
    return {
      ...base,
      ...deriveTelegramIndicator(base),
    }
  }

  try {
    const [botInfo, webhookInfo] = await Promise.all([
      telegramApi<Record<string, unknown>>(telegram.botToken, 'getMe'),
      telegramApi<Record<string, unknown>>(telegram.botToken, 'getWebhookInfo'),
    ])

    const snapshot = {
      ...base,
      bot: botInfo.ok ? botInfo.result ?? null : null,
      webhook: webhookInfo.ok ? webhookInfo.result ?? null : null,
      botApiOk: botInfo.ok,
      botApiError: botInfo.ok ? undefined : (botInfo.description ?? 'Telegram Bot API getMe failed'),
      webhookError: webhookInfo.ok ? undefined : (webhookInfo.description ?? 'Telegram Bot API getWebhookInfo failed'),
    }

    return {
      ...snapshot,
      ...deriveTelegramIndicator(snapshot),
    }
  } catch (err) {
    const snapshot = {
      ...base,
      botApiOk: false,
      botApiError: err instanceof Error ? err.message : String(err),
      webhookError: undefined,
    }

    return {
      ...snapshot,
      ...deriveTelegramIndicator(snapshot),
    }
  }
}