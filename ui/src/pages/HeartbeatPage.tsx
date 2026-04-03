import { useState, useEffect, useCallback, useMemo } from 'react'
import { api, type AppConfig, type EventLogEntry } from '../api'
import { Toggle } from '../components/Toggle'
import { SaveIndicator } from '../components/SaveIndicator'
import { ConfigSection, Section, Field, inputClass } from '../components/form'
import { useAutoSave } from '../hooks/useAutoSave'
import { PageHeader } from '../components/PageHeader'
import { formatShortDateTime } from '../utils/locale'
import { useI18n } from '../i18n'

// ==================== Helpers ====================

function formatDateTime(ts: number): string {
  return formatShortDateTime(ts)
}

function eventTypeColor(type: string): string {
  if (type === 'heartbeat.done') return 'text-green'
  if (type === 'heartbeat.skip') return 'text-text-muted'
  if (type === 'heartbeat.error') return 'text-red'
  return 'text-purple'
}

// ==================== Status Bar ====================

function StatusBar() {
  const { text, translateError } = useI18n()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [triggering, setTriggering] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.heartbeat.status().then(({ enabled }) => setEnabled(enabled)).catch(console.warn)
  }, [])

  const handleToggle = async (v: boolean) => {
    try {
      const result = await api.heartbeat.setEnabled(v)
      setEnabled(result.enabled)
    } catch {
      setError(text('切换心跳失败', 'Failed to toggle heartbeat'))
      setTimeout(() => setError(null), 3000)
    }
  }

  const handleTrigger = async () => {
    setTriggering(true)
    setFeedback(null)
    try {
      await api.heartbeat.trigger()
      setFeedback(text('已触发心跳', 'Heartbeat triggered'))
      setTimeout(() => setFeedback(null), 3000)
    } catch (err) {
      setFeedback(err instanceof Error ? translateError(err.message) : text('触发失败', 'Trigger failed'))
      setTimeout(() => setFeedback(null), 5000)
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div className="bg-bg rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">💓</span>
          <div>
            <div className="text-sm font-medium text-text">{text('心跳', 'Heartbeat')}</div>
            <div className="text-xs text-text-muted">
              {text('定期自检与自主思考', 'Periodic self-checks and autonomous reflection')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {feedback && (
            <span className={`text-xs ${feedback.includes('failed') || feedback.includes('not found') ? 'text-red' : 'text-green'}`}>
              {feedback}
            </span>
          )}

          {error && <span className="text-xs text-red">{error}</span>}

          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="btn-secondary-sm"
          >
            {triggering ? text('触发中...', 'Triggering...') : text('立即触发', 'Trigger now')}
          </button>

          {enabled !== null && (
            <Toggle checked={enabled} onChange={handleToggle} />
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== Config Form ====================

function HeartbeatConfigForm({ config }: { config: AppConfig }) {
  const { text } = useI18n()
  const [every, setEvery] = useState(config.heartbeat?.every || '30m')
  const [ahEnabled, setAhEnabled] = useState(config.heartbeat?.activeHours != null)
  const [ahStart, setAhStart] = useState(config.heartbeat?.activeHours?.start || '09:00')
  const [ahEnd, setAhEnd] = useState(config.heartbeat?.activeHours?.end || '22:00')
  const [ahTimezone, setAhTimezone] = useState(config.heartbeat?.activeHours?.timezone || 'local')

  const configData = useMemo(() => ({
    ...config.heartbeat,
    every,
    activeHours: ahEnabled ? { start: ahStart, end: ahEnd, timezone: ahTimezone } : null,
  }), [config.heartbeat, every, ahEnabled, ahStart, ahEnd, ahTimezone])

  const save = useCallback(async (d: Record<string, unknown>) => {
    await api.config.updateSection('heartbeat', d)
  }, [])

  const { status, retry } = useAutoSave({ data: configData, save })

  return (
    <ConfigSection title={text('配置', 'Configuration')} description={text('设置心跳运行频率，并可选择仅在活跃时段内执行。', 'Set the heartbeat cadence and optionally restrict it to active hours.')}>
      <Field label={text('间隔', 'Interval')}>
        <input
          className={inputClass}
          value={every}
          onChange={(e) => setEvery(e.target.value)}
          placeholder="30m"
        />
      </Field>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[13px] text-text font-medium">{text('活跃时段', 'Active hours')}</label>
          <Toggle checked={ahEnabled} onChange={setAhEnabled} />
        </div>
        {ahEnabled && (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-[11px] text-text-muted mb-1">{text('开始', 'Start')}</label>
              <input
                className={inputClass}
                value={ahStart}
                onChange={(e) => setAhStart(e.target.value)}
                placeholder="09:00"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] text-text-muted mb-1">{text('结束', 'End')}</label>
              <input
                className={inputClass}
                value={ahEnd}
                onChange={(e) => setAhEnd(e.target.value)}
                placeholder="22:00"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] text-text-muted mb-1">{text('时区', 'Timezone')}</label>
              <select
                className={inputClass}
                value={ahTimezone}
                onChange={(e) => setAhTimezone(e.target.value)}
              >
                <option value="local">{text('本地', 'Local')}</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">{text('美国东部', 'US East')}</option>
                <option value="America/Chicago">{text('美国中部', 'US Central')}</option>
                <option value="America/Los_Angeles">{text('美国西部', 'US West')}</option>
                <option value="Europe/London">{text('伦敦', 'London')}</option>
                <option value="Europe/Berlin">{text('柏林', 'Berlin')}</option>
                <option value="Asia/Tokyo">{text('东京', 'Tokyo')}</option>
                <option value="Asia/Shanghai">{text('上海', 'Shanghai')}</option>
                <option value="Asia/Hong_Kong">{text('香港', 'Hong Kong')}</option>
                <option value="Asia/Singapore">{text('新加坡', 'Singapore')}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <SaveIndicator status={status} onRetry={retry} />
    </ConfigSection>
  )
}

// ==================== Prompt Editor ====================

function PromptEditor() {
  const { text } = useI18n()
  const [content, setContent] = useState('')
  const [filePath, setFilePath] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    api.heartbeat.getPromptFile()
      .then(({ content, path }) => {
        setContent(content)
        setFilePath(path)
      })
      .catch(() => setError(text('加载提示词文件失败', 'Failed to load prompt file')))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await api.heartbeat.updatePromptFile(content)
      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError(text('保存失败', 'Save failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ConfigSection title={text('提示词文件', 'Prompt file')} description={filePath || text('每次心跳循环使用的提示词模板。', 'Prompt template used for each heartbeat cycle.')}>
      {loading ? (
        <div className="text-sm text-text-muted">{text('加载中...', 'Loading...')}</div>
      ) : (
        <>
          <textarea
            className={`${inputClass} min-h-[200px] max-h-[400px] resize-y font-mono text-xs leading-relaxed`}
            value={content}
            onChange={(e) => { setContent(e.target.value); setDirty(true) }}
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="btn-primary-sm"
            >
              {saving ? text('保存中...', 'Saving...') : text('保存', 'Save')}
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-green" />
                <span className="text-text-muted">{text('已保存', 'Saved')}</span>
              </span>
            )}
            {error && (
              <span className="inline-flex items-center gap-1.5 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-red" />
                <span className="text-red">{error}</span>
              </span>
            )}
            {dirty && !saved && !error && (
              <span className="text-[11px] text-text-muted">{text('有未保存的更改', 'Unsaved changes')}</span>
            )}
          </div>
        </>
      )}
    </ConfigSection>
  )
}

// ==================== Recent Events ====================

function RecentEvents() {
  const { text } = useI18n()
  const [entries, setEntries] = useState<EventLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.events.recent({ limit: 500 })
      .then(({ entries }) => {
        const hbEntries = entries
          .filter((e) => e.type.startsWith('heartbeat.'))
          .slice(-20)
          .reverse()
        setEntries(hbEntries)
      })
      .catch(console.warn)
      .finally(() => setLoading(false))
  }, [])

  return (
    <Section title={text('最近事件', 'Recent events')}>
      <div className="bg-bg rounded-lg border border-border overflow-x-auto font-mono text-xs">
        {loading ? (
          <div className="px-4 py-6 text-center text-text-muted">{text('加载中...', 'Loading...')}</div>
        ) : entries.length === 0 ? (
          <div className="px-4 py-6 text-center text-text-muted">{text('暂无心跳事件', 'No heartbeat events')}</div>
        ) : (
          <table className="w-full">
            <thead className="bg-bg-secondary">
              <tr className="text-text-muted text-left">
                <th className="px-3 py-2 w-12">#</th>
                <th className="px-3 py-2 w-36">{text('时间', 'Time')}</th>
                <th className="px-3 py-2 w-32">{text('类型', 'Type')}</th>
                <th className="px-3 py-2">{text('载荷', 'Payload')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const payloadStr = JSON.stringify(entry.payload)
                return (
                  <tr key={entry.seq} className="border-t border-border/50 hover:bg-bg-tertiary/30 transition-colors">
                    <td className="px-3 py-1.5 text-text-muted">{entry.seq}</td>
                    <td className="px-3 py-1.5 text-text-muted whitespace-nowrap">{formatDateTime(entry.ts)}</td>
                    <td className={`px-3 py-1.5 ${eventTypeColor(entry.type)}`}>
                      {entry.type.replace('heartbeat.', '')}
                    </td>
                    <td className="px-3 py-1.5 text-text-muted truncate max-w-0">
                      {payloadStr.length > 120 ? payloadStr.slice(0, 120) + '...' : payloadStr}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </Section>
  )
}

// ==================== Main Page ====================

export function HeartbeatPage() {
  const { text } = useI18n()
  const [config, setConfig] = useState<AppConfig | null>(null)

  useEffect(() => {
    api.config.load().then(setConfig).catch(console.warn)
  }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader title={text('心跳', 'Heartbeat')} />

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5">
        <div className="max-w-[880px] mx-auto space-y-6">
          <StatusBar />
          {config && <HeartbeatConfigForm config={config} />}
          <PromptEditor />
          <RecentEvents />
        </div>
      </div>
    </div>
  )
}
