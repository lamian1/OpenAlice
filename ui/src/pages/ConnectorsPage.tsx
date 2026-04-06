import { useEffect, useState } from 'react'
import { useConfigPage } from '../hooks/useConfigPage'
import { SaveIndicator } from '../components/SaveIndicator'
import { SDKSelector, CONNECTOR_OPTIONS } from '../components/SDKSelector'
import { ConfigSection, Field, inputClass } from '../components/form'
import { PageHeader } from '../components/PageHeader'
import { api, type AppConfig, type ConnectorsConfig, type TelegramDebugStatus } from '../api'
import { COPY, useI18n } from '../i18n'

export function ConnectorsPage() {
  const { phrase, text } = useI18n()
  const [telegramDebug, setTelegramDebug] = useState<TelegramDebugStatus | null>(null)
  const [telegramLoading, setTelegramLoading] = useState(false)
  const [telegramError, setTelegramError] = useState('')
  const [telegramTestText, setTelegramTestText] = useState('')
  const [telegramActionResult, setTelegramActionResult] = useState('')
  const { config, status, loadError, updateConfig, updateConfigImmediate, retry } =
    useConfigPage<ConnectorsConfig>({
      section: 'connectors',
      extract: (full: AppConfig) => full.connectors,
    })

  const loadTelegramDebug = async () => {
    if (!config?.telegram.enabled) return
    setTelegramLoading(true)
    setTelegramError('')
    try {
      const result = await api.connectorsDebug.getTelegramStatus()
      setTelegramDebug(result)
    } catch (err) {
      setTelegramError(err instanceof Error ? err.message : String(err))
    } finally {
      setTelegramLoading(false)
    }
  }

  const sendTelegramTest = async () => {
    setTelegramLoading(true)
    setTelegramError('')
    setTelegramActionResult('')
    try {
      const result = await api.connectorsDebug.sendTelegramTest({
        chatId: config?.telegram.chatIds[0],
        text: telegramTestText.trim() || undefined,
      })
      if (!result.ok) {
        setTelegramError(result.error || text('发送测试消息失败', 'Failed to send test message'))
      } else {
        setTelegramActionResult(text('测试消息已发送，请回到 Telegram 查看。', 'Test message sent. Check Telegram.'))
        const refreshed = await api.connectorsDebug.getTelegramStatus()
        setTelegramDebug(refreshed)
      }
    } catch (err) {
      setTelegramError(err instanceof Error ? err.message : String(err))
    } finally {
      setTelegramLoading(false)
    }
  }

  const reconnectTelegram = async () => {
    setTelegramLoading(true)
    setTelegramError('')
    setTelegramActionResult('')
    try {
      const result = await api.connectorsDebug.reconnectTelegram()
      if (!result.success) {
        setTelegramError(result.error || text('Telegram 重连失败', 'Telegram reconnect failed'))
      } else {
        setTelegramActionResult(result.message || text('Telegram 已触发重连。', 'Telegram reconnect triggered.'))
        const refreshed = await api.connectorsDebug.getTelegramStatus()
        setTelegramDebug(refreshed)
      }
    } catch (err) {
      setTelegramError(err instanceof Error ? err.message : String(err))
    } finally {
      setTelegramLoading(false)
    }
  }

  useEffect(() => {
    if (config?.telegram.enabled) {
      void loadTelegramDebug()
    } else {
      setTelegramDebug(null)
      setTelegramError('')
      setTelegramActionResult('')
    }
  }, [config?.telegram.enabled])

  // Derive selected connector IDs from enabled flags (web + mcp are always included)
  const selected = config
    ? [
        'web',
        'mcp',
        ...(config.mcpAsk.enabled ? ['mcpAsk'] : []),
        ...(config.telegram.enabled ? ['telegram'] : []),
      ]
    : ['web', 'mcp']

  const handleToggle = (id: string) => {
    if (!config) return
    if (id === 'mcpAsk') {
      updateConfigImmediate({ mcpAsk: { ...config.mcpAsk, enabled: !config.mcpAsk.enabled } })
    } else if (id === 'telegram') {
      updateConfigImmediate({ telegram: { ...config.telegram, enabled: !config.telegram.enabled } })
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title={phrase(COPY.connectors.title)}
        description={phrase(COPY.connectors.description)}
        right={<SaveIndicator status={status} onRetry={retry} />}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5">
        {config && (
          <div className="max-w-[880px] mx-auto">
            {/* Connector selector cards */}
            <ConfigSection
              title={phrase(COPY.connectors.active)}
              description={phrase(COPY.connectors.activeDescription)}
            >
              <SDKSelector
                options={CONNECTOR_OPTIONS}
                selected={selected}
                onToggle={handleToggle}
              />
            </ConfigSection>

            {/* Web UI config — always shown */}
            <ConfigSection
              title="Web UI"
              description={phrase(COPY.connectors.webDescription)}
            >
              <Field label={phrase(COPY.common.port)}>
                <input
                  className={inputClass}
                  type="number"
                  value={config.web.port}
                  onChange={(e) => updateConfig({ web: { port: Number(e.target.value) } })}
                />
              </Field>
            </ConfigSection>

            {/* MCP Server config — always shown */}
            <ConfigSection
              title="MCP Server"
              description={phrase(COPY.connectors.mcpDescription)}
            >
              <Field label={phrase(COPY.common.port)}>
                <input
                  className={inputClass}
                  type="number"
                  value={config.mcp.port}
                  onChange={(e) => updateConfig({ mcp: { port: Number(e.target.value) } })}
                />
              </Field>
            </ConfigSection>

            {/* MCP Ask config */}
            {config.mcpAsk.enabled && (
              <ConfigSection
                title="MCP Ask"
                description={phrase(COPY.connectors.mcpAskDescription)}
              >
                <Field label={phrase(COPY.common.port)}>
                  <input
                    className={inputClass}
                    type="number"
                    value={config.mcpAsk.port ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      updateConfig({ mcpAsk: { ...config.mcpAsk, port: v ? Number(v) : undefined } })
                    }}
                    placeholder={text('例如 3003', 'For example 3003')}
                  />
                </Field>
              </ConfigSection>
            )}

            {/* Telegram config */}
            {config.telegram.enabled && (
              <ConfigSection
                title="Telegram"
                description={phrase(COPY.connectors.telegramDescription)}
              >
                <Field label={phrase(COPY.connectors.telegramToken)}>
                  <input
                    className={inputClass}
                    type="password"
                    value={config.telegram.botToken ?? ''}
                    onChange={(e) =>
                      updateConfig({
                        telegram: { ...config.telegram, botToken: e.target.value || undefined },
                      })
                    }
                    placeholder="123456:ABC-DEF..."
                  />
                </Field>
                <Field label={phrase(COPY.connectors.telegramUsername)}>
                  <input
                    className={inputClass}
                    value={config.telegram.botUsername ?? ''}
                    onChange={(e) =>
                      updateConfig({
                        telegram: { ...config.telegram, botUsername: e.target.value || undefined },
                      })
                    }
                    placeholder={text('my_bot', 'my_bot')}
                  />
                </Field>
                <Field label={phrase(COPY.connectors.telegramChatIds)}>
                  <input
                    className={inputClass}
                    value={config.telegram.chatIds.join(', ')}
                    onChange={(e) =>
                      updateConfig({
                        telegram: {
                          ...config.telegram,
                          chatIds: e.target.value
                            ? e.target.value
                                .split(',')
                                .map((s) => Number(s.trim()))
                                .filter((n) => !isNaN(n))
                            : [],
                        },
                      })
                    }
                    placeholder={phrase(COPY.connectors.chatIdsPlaceholder)}
                  />
                </Field>

                <div className="mt-5 rounded-xl border border-border/60 bg-bg-secondary/35 p-4 space-y-4">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <div>
                      <h4 className="text-[13px] font-semibold text-text">{text('调试面板', 'Debug panel')}</h4>
                      <p className="text-[12px] text-text-muted/70 mt-1">
                        {text('检查 Telegram 实际运行状态、Webhook 状态，并发送测试消息。', 'Inspect live Telegram runtime state, webhook state, and send a test message.')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => void loadTelegramDebug()} disabled={telegramLoading} className="btn-secondary-sm">
                        {telegramLoading ? text('检查中…', 'Checking...') : text('检查状态', 'Check status')}
                      </button>
                      <button onClick={() => void reconnectTelegram()} disabled={telegramLoading} className="btn-secondary-sm">
                        {text('重新连接', 'Reconnect')}
                      </button>
                      <button onClick={() => void sendTelegramTest()} disabled={telegramLoading || !config.telegram.chatIds.length} className="btn-primary-sm">
                        {text('发送测试消息', 'Send test message')}
                      </button>
                    </div>
                  </div>

                  <Field label={text('测试消息内容', 'Test message text')}>
                    <input
                      className={inputClass}
                      value={telegramTestText}
                      onChange={(e) => setTelegramTestText(e.target.value)}
                      placeholder={text('留空则发送默认测试文案', 'Leave blank to send the default test message')}
                    />
                  </Field>

                  {telegramError && <p className="text-[12px] text-red">{telegramError}</p>}
                  {telegramActionResult && <p className="text-[12px] text-green">{telegramActionResult}</p>}

                  {telegramDebug && (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-border/60 px-3 py-2 bg-bg/60 text-[12px]">
                        <div className="text-text-muted/70">{text('总体健康度', 'Overall health')}</div>
                        <div className="mt-1 text-text font-medium">{telegramDebug.status === 'online'
                          ? text('在线', 'Online')
                          : telegramDebug.status === 'warning'
                            ? text('告警', 'Warning')
                            : telegramDebug.status === 'offline'
                              ? text('离线', 'Offline')
                              : text('关闭', 'Disabled')}</div>
                        <div className="mt-1 text-text-muted/80">{telegramDebug.detail}</div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
                        <div className="rounded-lg border border-border/60 px-3 py-2 bg-bg/60">
                          <div className="text-text-muted/70">{text('运行状态', 'Runtime')}</div>
                          <div className="mt-1 text-text font-medium">{telegramDebug.runtimeRunning ? text('已启动', 'Running') : text('未启动', 'Stopped')}</div>
                        </div>
                        <div className="rounded-lg border border-border/60 px-3 py-2 bg-bg/60">
                          <div className="text-text-muted/70">Telegram Bot API</div>
                          <div className="mt-1 text-text font-medium">{telegramDebug.botApiOk ? text('可达', 'Reachable') : text('不可达', 'Unreachable')}</div>
                        </div>
                      </div>

                      {telegramDebug.botApiError && (
                        <p className="text-[12px] text-red">{telegramDebug.botApiError}</p>
                      )}

                      {telegramDebug.bot && (
                        <div className="text-[12px] text-text-muted/80 leading-relaxed">
                          <div>{text('机器人', 'Bot')}: @{String(telegramDebug.bot.username ?? telegramDebug.botUsername ?? '-')}</div>
                          <div>{text('允许聊天 ID', 'Allowed chat IDs')}: {(telegramDebug.allowedChatIds ?? []).join(', ') || '-'}</div>
                        </div>
                      )}

                      {telegramDebug.webhook && (
                        <div className="rounded-lg border border-border/60 px-3 py-2 bg-bg/60 text-[12px] text-text-muted/80 leading-relaxed">
                          <div>Webhook URL: {String(telegramDebug.webhook.url ?? '') || text('未设置', 'Not set')}</div>
                          <div>{text('待处理更新数', 'Pending updates')}: {String(telegramDebug.webhook.pending_update_count ?? 0)}</div>
                          {Boolean(telegramDebug.webhook.last_error_message) && (
                            <div className="text-red mt-1">{text('最近一次 Webhook 错误', 'Latest webhook error')}: {String(telegramDebug.webhook.last_error_message)}</div>
                          )}
                        </div>
                      )}

                      {telegramDebug.webhook && String(telegramDebug.webhook.url ?? '') && (
                        <p className="text-[12px] text-yellow-400">
                          {text('检测到 Telegram 上仍存在 Webhook。当前连接器使用轮询模式，旧 Webhook 可能导致消息收不到；我已在启动时加入自动清理。', 'A Telegram webhook is still configured. This connector uses polling mode, and a stale webhook can block incoming messages. The startup flow now clears it automatically.')}
                        </p>
                      )}

                      <div>
                        <div className="text-[12px] font-medium text-text mb-2">{text('最近 Telegram 事件', 'Recent Telegram events')}</div>
                        {telegramDebug.recentEvents.length === 0 ? (
                          <p className="text-[12px] text-text-muted/70">
                            {text('最近没有看到任何 Telegram 收发事件。请先在 Telegram 里给 bot 发送 /start 或 hello。', 'No recent Telegram send/receive events were found. Send /start or hello to the bot in Telegram first.')}
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {telegramDebug.recentEvents.slice().reverse().slice(0, 6).map((entry) => (
                              <div key={entry.seq} className="rounded-lg border border-border/60 px-3 py-2 bg-bg/60 text-[12px] text-text-muted/80">
                                <div className="text-text font-medium">{entry.type}</div>
                                <div className="mt-1">{new Date(entry.ts).toLocaleString()}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </ConfigSection>
            )}
          </div>
        )}
        {loadError && <p className="text-[13px] text-red">{phrase(COPY.connectors.loadError)}</p>}
      </div>
    </div>
  )
}
