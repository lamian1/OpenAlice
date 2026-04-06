import { Hono } from 'hono'
import type { EngineContext } from '../../../core/types.js'
import { loadConfig } from '../../../core/config.js'
import { getTelegramHealth } from '../../telegram/health.js'

interface TelegramApiResponse<T> {
  ok: boolean
  result?: T
  description?: string
}

async function telegramApi<T>(token: string, method: string, init?: RequestInit): Promise<TelegramApiResponse<T>> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    signal: AbortSignal.timeout(10_000),
    ...init,
  })
  return res.json() as Promise<TelegramApiResponse<T>>
}

export function createConnectorDebugRoutes(ctx: EngineContext) {
  const app = new Hono()

  app.get('/telegram', async (c) => {
    const config = await loadConfig()
    const health = await getTelegramHealth(ctx, config)
    return c.json({
      ...health,
      note: !health.enabled
        ? 'Telegram 未启用。'
        : !health.configured
          ? 'Telegram 已启用但缺少 Bot Token。'
          : undefined,
    })
  })

  app.post('/telegram/reconnect', async (c) => {
    const config = await loadConfig()
    if (!config.connectors.telegram.enabled || !config.connectors.telegram.botToken) {
      return c.json({ ok: false, error: 'Telegram 未启用或缺少 Bot Token。' }, 400)
    }

    const result = await ctx.reconnectConnectors({ restart: ['telegram'] })
    return c.json(result, result.success ? 200 : 409)
  })

  app.post('/telegram/send-test', async (c) => {
    const config = await loadConfig()
    const telegram = config.connectors.telegram
    if (!telegram.enabled || !telegram.botToken) {
      return c.json({ ok: false, error: 'Telegram 未启用或缺少 Bot Token。' }, 400)
    }

    const body = await c.req.json().catch(() => ({})) as { chatId?: number; text?: string }
    const chatId = body.chatId ?? telegram.chatIds[0]
    if (!chatId) {
      return c.json({ ok: false, error: '没有可用的聊天 ID。' }, 400)
    }

    const text = body.text?.trim() || 'OpenAlice Telegram 调试消息：如果你能看到这条，说明 Bot 出站发送正常。'

    try {
      const result = await telegramApi<Record<string, unknown>>(telegram.botToken, 'sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      })

      if (!result.ok) {
        return c.json({ ok: false, error: result.description ?? 'Telegram sendMessage failed' }, 502)
      }

      return c.json({ ok: true, result: result.result ?? null })
    } catch (err) {
      return c.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500)
    }
  })

  return app
}