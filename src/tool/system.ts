import { tool } from 'ai'
import { z } from 'zod'
import type { EngineContext } from '@/core/types.js'
import { loadConfig, readAIProviderConfig, readMarketDataConfig } from '@/core/config.js'
import { getTelegramHealth } from '@/connectors/telegram/health.js'

export function createSystemTools(getCtx: () => EngineContext) {
  return {
    getSystemStatus: tool({
      description: `Read the current runtime status of Alice services and connectors.
Use this before answering questions like whether Telegram, MCP, market data, or trading connectivity is currently available.
This returns the actual live runtime state, not a guess.` ,
      inputSchema: z.object({}),
      execute: async () => {
        const ctx = getCtx()
        const [config, runtime, aiProvider, marketData] = await Promise.all([
          loadConfig(),
          Promise.resolve(ctx.getRuntimeStatus()),
          readAIProviderConfig(),
          readMarketDataConfig(),
        ])

        const accounts = ctx.accountManager.listAccounts().map((account) => ({
          id: account.id,
          label: account.label,
          health: account.health(),
        }))
        const telegramHealth = await getTelegramHealth(ctx, config, 10)

        return {
          aiProvider: {
            backend: aiProvider.backend,
            provider: aiProvider.provider,
            model: aiProvider.model,
            baseUrl: aiProvider.baseUrl,
          },
          marketData: {
            backend: marketData.backend,
            apiUrl: marketData.apiUrl,
            apiServer: marketData.apiServer,
          },
          connectors: {
            web: { configured: true, ...runtime.connectors.web },
            mcp: { configured: true, ...runtime.connectors.mcp },
            mcpAsk: { configured: config.connectors.mcpAsk.enabled, ...runtime.connectors.mcpAsk },
            telegram: {
              enabled: telegramHealth.enabled,
              configured: telegramHealth.configured,
              running: telegramHealth.runtimeRunning,
              status: telegramHealth.status,
              detail: telegramHealth.detail,
              botUsername: telegramHealth.botUsername,
              allowedChatIds: telegramHealth.allowedChatIds,
              botApiOk: telegramHealth.botApiOk,
              botApiError: telegramHealth.botApiError,
              webhookUrl: String(telegramHealth.webhook?.url ?? ''),
              pendingUpdateCount: Number(telegramHealth.webhook?.pending_update_count ?? 0),
              recentEventCount: telegramHealth.recentEvents.length,
              recentEvents: telegramHealth.recentEvents,
            },
            openbbServer: { configured: config.marketData.apiServer.enabled, ...runtime.connectors.openbbServer },
          },
          tradingAccounts: accounts,
          connectorsReconnecting: runtime.connectorsReconnecting,
          news: runtime.news,
        }
      },
    }),
  }
}