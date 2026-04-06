import { Hono } from 'hono'
import { access } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { homedir } from 'node:os'
import type { EngineContext, IndicatorStatus } from '../../../core/types.js'
import { loadConfig, readAIProviderConfig, readMarketDataConfig } from '../../../core/config.js'
import { getTelegramHealth } from '../../telegram/health.js'

const execFileAsync = promisify(execFile)

interface IndicatorItem {
  id: string
  label: string
  status: IndicatorStatus
  detail: string
  meta?: Record<string, unknown>
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function isClaudeCliAvailable(): Promise<boolean> {
  try {
    await execFileAsync('claude', ['--version'], { timeout: 3_000 })
    return true
  } catch {
    return false
  }
}

async function buildAiProviderIndicator(): Promise<IndicatorItem> {
  const ai = await readAIProviderConfig()
  const backendLabel = ai.backend === 'agent-sdk'
    ? 'Claude Agent SDK'
    : ai.backend === 'vercel-ai-sdk'
      ? `Vercel AI SDK / ${ai.provider}`
      : ai.backend

  if (ai.backend === 'agent-sdk') {
    if (ai.loginMethod === 'api-key') {
      const ready = !!ai.apiKeys.anthropic
      return {
        id: 'ai-provider',
        label: 'AI 提供方',
        status: ready ? 'online' : 'warning',
        detail: ready ? `${backendLabel} 已配置 API Key` : `${backendLabel} 缺少 Anthropic API Key`,
      }
    }

    const cliAvailable = await isClaudeCliAvailable()
    const authMarker = await pathExists(`${homedir()}/.claude.json`) || await pathExists(`${homedir()}/.claude`)
    return {
      id: 'ai-provider',
      label: 'AI 提供方',
      status: cliAvailable && authMarker ? 'online' : cliAvailable ? 'warning' : 'offline',
      detail: cliAvailable
        ? authMarker
          ? `${backendLabel} 已检测到本地 Claude 登录痕迹`
          : `${backendLabel} 已安装，但未确认登录状态`
        : `${backendLabel} 未检测到 claude 命令`,
    }
  }

  const providerKeyMap: Record<string, string | undefined> = {
    anthropic: ai.apiKeys.anthropic,
    openai: ai.apiKeys.openai,
    google: ai.apiKeys.google,
  }
  const key = providerKeyMap[ai.provider]
  const ready = ai.baseUrl ? true : !!key
  return {
    id: 'ai-provider',
    label: 'AI 提供方',
    status: ready ? 'online' : 'warning',
    detail: ready
      ? `${backendLabel} 已配置`
      : `${backendLabel} 缺少 ${ai.provider} 凭证`,
  }
}

async function buildMarketDataIndicator(runtimeOpenbbPort?: number): Promise<IndicatorItem> {
  const marketData = await readMarketDataConfig()
  if (marketData.backend === 'typebb-sdk') {
    return {
      id: 'market-data',
      label: '市场数据',
      status: 'online',
      detail: runtimeOpenbbPort
        ? `内置 TypeBB 引擎，OpenBB API 映射运行在 ${runtimeOpenbbPort}`
        : '内置 TypeBB 引擎已启用',
    }
  }

  try {
    const res = await fetch(`${marketData.apiUrl}/api/v1/health`, { signal: AbortSignal.timeout(4_000) })
    return {
      id: 'market-data',
      label: '市场数据',
      status: res.ok ? 'online' : 'warning',
      detail: res.ok ? `外部 OpenBB API 可达: ${marketData.apiUrl}` : `外部 OpenBB API 返回 ${res.status}`,
    }
  } catch (err) {
    return {
      id: 'market-data',
      label: '市场数据',
      status: 'offline',
      detail: `外部 OpenBB API 不可达: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

function latestHeartbeatEvent(ctx: EngineContext) {
  return ctx.eventLog
    .recent({ limit: 100 })
    .filter((entry) => entry.type.startsWith('heartbeat.'))
    .sort((a, b) => b.seq - a.seq)[0]
}

function buildHeartbeatIndicator(ctx: EngineContext): IndicatorItem {
  const enabled = ctx.heartbeat.isEnabled()
  const latest = latestHeartbeatEvent(ctx)
  if (!enabled) {
    return {
      id: 'heartbeat',
      label: 'Heartbeat',
      status: 'disabled',
      detail: 'Heartbeat 已关闭',
    }
  }

  if (!latest) {
    return {
      id: 'heartbeat',
      label: 'Heartbeat',
      status: 'warning',
      detail: 'Heartbeat 已启用，尚无最近事件',
    }
  }

  if (latest.type === 'heartbeat.error') {
    const payload = latest.payload as { error?: string }
    return {
      id: 'heartbeat',
      label: 'Heartbeat',
      status: 'warning',
      detail: payload.error ? `最近一次报错: ${payload.error}` : '最近一次心跳执行失败',
    }
  }

  if (latest.type === 'heartbeat.skip') {
    const payload = latest.payload as { reason?: string }
    return {
      id: 'heartbeat',
      label: 'Heartbeat',
      status: 'online',
      detail: payload.reason ? `最近一次跳过: ${payload.reason}` : 'Heartbeat 正常运行',
    }
  }

  return {
    id: 'heartbeat',
    label: 'Heartbeat',
    status: 'online',
    detail: 'Heartbeat 最近一次执行成功',
  }
}

export function createSystemStatusRoutes(ctx: EngineContext) {
  const app = new Hono()

  app.get('/', async (c) => {
    const config = await loadConfig()
    const runtime = ctx.getRuntimeStatus()
    const accounts = ctx.accountManager.listAccounts()
    const [aiProvider, marketData, telegramHealth] = await Promise.all([
      buildAiProviderIndicator(),
      buildMarketDataIndicator(runtime.connectors.openbbServer.port),
      getTelegramHealth(ctx, config),
    ])

    const connectors: IndicatorItem[] = [
      {
        id: 'mcp',
        label: 'MCP Server',
        status: runtime.connectors.mcp.running ? 'online' : 'offline',
        detail: runtime.connectors.mcp.running
          ? `监听端口 ${runtime.connectors.mcp.port ?? config.connectors.mcp.port}`
          : 'MCP Server 未运行',
      },
      {
        id: 'mcp-ask',
        label: 'MCP Ask',
        status: config.connectors.mcpAsk.enabled
          ? runtime.connectors.mcpAsk.running ? 'online' : 'warning'
          : 'disabled',
        detail: !config.connectors.mcpAsk.enabled
          ? 'MCP Ask 已关闭'
          : runtime.connectors.mcpAsk.running
            ? `监听端口 ${runtime.connectors.mcpAsk.port ?? config.connectors.mcpAsk.port ?? '-'}`
            : 'MCP Ask 已配置但未运行',
      },
      {
        id: 'telegram',
        label: 'Telegram',
        status: telegramHealth.status,
        detail: telegramHealth.detail,
        meta: {
          botApiOk: telegramHealth.botApiOk,
          pendingUpdateCount: Number(telegramHealth.webhook?.pending_update_count ?? 0),
          webhookUrl: String(telegramHealth.webhook?.url ?? ''),
        },
      },
    ]

    const heartbeat = buildHeartbeatIndicator(ctx)
    const newsRuntime = runtime.news
    const failedFeeds = newsRuntime?.feeds.filter((feed) => feed.lastError) ?? []
    const newsFeeds: IndicatorItem[] = (newsRuntime?.feeds ?? config.news.feeds.map((feed) => ({
      name: feed.name,
      url: feed.url,
      source: feed.source,
      lastFetchedCount: 0,
      lastNewCount: 0,
    }))).map((feed) => ({
      id: `news-${feed.source}`,
      label: feed.name,
      status: feed.lastError
        ? 'warning'
        : feed.lastSuccessAt || feed.lastFetchedCount > 0
          ? 'online'
          : 'disabled',
      detail: feed.lastError
        ? feed.lastError
        : feed.lastFetchedCount > 0
          ? `最近抓取 ${feed.lastFetchedCount} 条，新增 ${feed.lastNewCount} 条`
          : '尚无抓取结果',
    }))
    const news: IndicatorItem = {
      id: 'news',
      label: 'News 源',
      status: !config.news.enabled
        ? 'disabled'
        : failedFeeds.length > 0
          ? 'warning'
          : newsRuntime?.running
            ? 'online'
            : 'offline',
      detail: !config.news.enabled
        ? 'News Collector 已关闭'
        : failedFeeds.length > 0
          ? `${failedFeeds.length}/${newsRuntime?.feeds.length ?? config.news.feeds.length} 个源最近拉取失败`
          : newsRuntime?.running
            ? `${newsRuntime.feeds.length} 个源正在轮询`
            : 'News Collector 未运行',
      meta: newsRuntime ? { feeds: newsRuntime.feeds } : { feeds: [] },
    }

    return c.json({
      aiProvider,
      marketData,
      tradingAccounts: accounts.map((account) => ({
        id: account.id,
        label: account.label,
        status: account.health.disabled
          ? 'disabled'
          : account.health.status === 'healthy'
            ? 'online'
            : account.health.recovering || account.health.status === 'degraded'
              ? 'warning'
              : 'offline',
        detail: account.health.disabled
          ? '账户已禁用'
          : account.health.lastError
            ? account.health.lastError
            : account.health.recovering
              ? '正在恢复连接'
              : account.health.status === 'healthy'
                ? '连接正常'
                : '账户离线',
      })),
      connectors,
      heartbeat,
      news,
      newsFeeds,
      meta: {
        connectorsReconnecting: runtime.connectorsReconnecting,
        webPort: config.connectors.web.port,
      },
    })
  })

  return app
}