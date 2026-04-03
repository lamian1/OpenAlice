import { useState, useEffect, useCallback } from 'react'
import { Section } from '../components/form'
import { PageHeader } from '../components/PageHeader'
import { Spinner, EmptyState } from '../components/StateViews'
import { useToast } from '../components/Toast'
import {
  devApi,
  type RegistryResponse,
  type SessionInfo,
} from '../api/dev'
import { useI18n } from '../i18n'

export function DevPage() {
  const { text } = useI18n()
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader title={text('开发', 'Dev')} />

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5">
        <div className="max-w-[640px] space-y-5">
          <RegistrySection />
          <SendSection />
          <SessionsSection />
        </div>
      </div>
    </div>
  )
}

// ==================== Registry ====================

function RegistrySection() {
  const { text } = useI18n()
  const [data, setData] = useState<RegistryResponse | null>(null)

  const refresh = useCallback(() => {
    devApi.registry().then(setData).catch(() => {})
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <Section title={text('连接器注册表', 'Connector registry')} description={text('当前活跃的连接器以及最近一次用户交互。', 'Active connectors and most recent user interaction.')}>
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={refresh}
          className="px-2.5 py-1 text-xs bg-bg-tertiary text-text-muted rounded hover:text-text transition-colors"
        >
          {text('刷新', 'Refresh')}
        </button>
      </div>

      {data && (
        <div className="space-y-2">
          {data.connectors.length === 0 ? (
            <p className="text-sm text-text-muted">{text('尚未注册任何连接器。', 'No connectors registered.')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted text-xs">
                  <th className="pb-1 pr-3">{text('频道', 'Channel')}</th>
                  <th className="pb-1 pr-3">{text('目标', 'Target')}</th>
                  <th className="pb-1 pr-3">{text('推送', 'Push')}</th>
                  <th className="pb-1">{text('媒体', 'Media')}</th>
                </tr>
              </thead>
              <tbody>
                {data.connectors.map((cn) => (
                  <tr key={cn.channel} className="text-text hover:bg-bg-tertiary/30 transition-colors">
                    <td className="py-0.5 pr-3 font-mono text-xs">{cn.channel}</td>
                    <td className="py-0.5 pr-3 font-mono text-xs">{cn.to}</td>
                    <td className="py-0.5 pr-3">{cn.capabilities.push ? text('是', 'Yes') : text('否', 'No')}</td>
                    <td className="py-0.5">{cn.capabilities.media ? text('是', 'Yes') : text('否', 'No')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="pt-2 text-xs text-text-muted">
            {text('最近交互：', 'Last interaction: ')}
            {data.lastInteraction ? (
              <span className="font-mono">
                {data.lastInteraction.channel}:{data.lastInteraction.to}{' '}
                ({new Date(data.lastInteraction.ts).toLocaleTimeString()})
              </span>
            ) : (
              text('无', 'None')
            )}
          </div>
        </div>
      )}
    </Section>
  )
}

// ==================== Test Send ====================

function SendSection() {
  const { text } = useI18n()
  const [channels, setChannels] = useState<string[]>([])
  const [channel, setChannel] = useState('')
  const [kind, setKind] = useState<'message' | 'notification'>('notification')
  const [messageText, setMessageText] = useState('')
  const [source, setSource] = useState<'manual' | 'heartbeat' | 'cron'>('manual')
  const [sending, setSending] = useState(false)
  const toast = useToast()

  useEffect(() => {
    devApi.registry().then((r) => {
      setChannels(r.connectors.map((cn) => cn.channel))
    }).catch(() => {})
  }, [])

  const handleSend = useCallback(async () => {
    if (!messageText.trim()) return
    setSending(true)
    try {
      const res = await devApi.send({
        channel: channel || undefined,
        kind,
        text: messageText.trim(),
        source,
      })
      toast.success(text(`已发送到 ${res.channel}:${res.to}`, `Sent to ${res.channel}:${res.to}`))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }, [channel, kind, messageText, source, text, toast])

  const selectClass = 'px-2.5 py-2 bg-bg text-text border border-border rounded-md text-sm outline-none focus:border-accent'

  return (
    <Section title={text('发送测试', 'Test send')} description={text('通过连接器管道发送测试消息或通知。', 'Send a test message or notification through the connector pipeline.')}>
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[13px] text-text-muted mb-1">{text('频道', 'Channel')}</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className={selectClass + ' w-full'}
            >
              <option value="">{text('自动（resolveDeliveryTarget）', 'Auto (resolveDeliveryTarget)')}</option>
              {channels.map((ch) => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[13px] text-text-muted mb-1">{text('类型', 'Kind')}</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className={selectClass}
            >
              <option value="notification">{text('通知', 'Notification')}</option>
              <option value="message">{text('消息', 'Message')}</option>
            </select>
          </div>
          <div>
            <label className="block text-[13px] text-text-muted mb-1">{text('来源', 'Source')}</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as typeof source)}
              className={selectClass}
            >
              <option value="manual">{text('手动', 'Manual')}</option>
              <option value="heartbeat">{text('心跳', 'Heartbeat')}</option>
              <option value="cron">{text('定时任务', 'Cron')}</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[13px] text-text-muted mb-1">{text('消息内容', 'Message')}</label>
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={text('测试消息...', 'Test message...')}
            rows={3}
            className="w-full px-2.5 py-2 bg-bg text-text border border-border rounded-md font-sans text-sm outline-none transition-colors focus:border-accent resize-y"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={sending || !messageText.trim()}
          className="btn-primary-sm"
        >
          {sending ? text('发送中...', 'Sending...') : text('发送', 'Send')}
        </button>

      </div>
    </Section>
  )
}

// ==================== Sessions ====================

function SessionsSection() {
  const { text } = useI18n()
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null)

  useEffect(() => {
    devApi.sessions().then(setSessions).catch(() => {})
  }, [])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Section title={text('会话', 'Sessions')} description={text('磁盘上的活动会话文件。', 'Active session files on disk.')}>
      {sessions === null ? (
        <div className="flex justify-center py-6"><Spinner size="sm" /></div>
      ) : sessions.length === 0 ? (
        <EmptyState title={text('未找到会话。', 'No sessions found.')} />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-muted text-xs">
              <th className="pb-1 pr-3">{text('会话 ID', 'Session ID')}</th>
              <th className="pb-1 text-right">{text('大小', 'Size')}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="text-text hover:bg-bg-tertiary/30 transition-colors">
                <td className="py-0.5 pr-3 font-mono text-xs">{s.id}</td>
                <td className="py-0.5 text-right text-xs text-text-muted">{formatSize(s.sizeBytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )
}
