import { useState, useEffect, useRef, useCallback } from 'react'
import { api, type EventLogEntry, type CronJob, type CronSchedule } from '../api'
import { useSSE } from '../hooks/useSSE'
import { Toggle } from '../components/Toggle'
import { PageHeader } from '../components/PageHeader'
import { formatRelativeTime, formatShortDateTime } from '../utils/locale'
import { useI18n } from '../i18n'

// ==================== Helpers ====================

function formatDateTime(ts: number): string {
  return formatShortDateTime(ts)
}

function timeAgo(ts: number | null): string {
  return formatRelativeTime(ts)
}

function scheduleLabel(s: CronSchedule, text: (zh: string, en: string) => string): string {
  switch (s.kind) {
    case 'at': return text(`在 ${s.at}`, `At ${s.at}`)
    case 'every': return text(`每 ${s.every}`, `Every ${s.every}`)
    case 'cron': return `cron: ${s.cron}`
  }
}

// Map event types to color classes
function eventTypeColor(type: string): string {
  if (type.startsWith('heartbeat.')) return 'text-purple'
  if (type.startsWith('cron.')) return 'text-accent'
  if (type.startsWith('message.')) return 'text-green'
  return 'text-text-muted'
}

// ==================== EventLog Section ====================

const PAGE_SIZE = 100

function EventLogSection() {
  const { text, translateError } = useI18n()
  const [entries, setEntries] = useState<EventLogEntry[]>([])
  const [typeFilter, setTypeFilter] = useState('')
  const [paused, setPaused] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [types, setTypes] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch a page from disk
  const fetchPage = useCallback(async (p: number, type?: string) => {
    setLoading(true)
    try {
      const result = await api.events.query({
        page: p,
        pageSize: PAGE_SIZE,
        type: type || undefined,
      })
      setEntries(result.entries)
      setPage(result.page)
      setTotalPages(result.totalPages)
      setTotal(result.total)
    } catch (err) {
      console.warn('Failed to load events:', translateError(err instanceof Error ? err.message : 'Failed to load events'))
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => { fetchPage(1) }, [fetchPage])

  // Track all seen event types (persists across page changes)
  useEffect(() => {
    if (entries.length > 0) {
      setTypes((prev) => {
        const next = new Set(prev)
        for (const e of entries) next.add(e.type)
        return [...next].sort()
      })
    }
  }, [entries])

  // SSE for real-time events — only affects page 1
  useSSE({
    url: '/api/events/stream',
    onMessage: (entry: EventLogEntry) => {
      // Always track new types
      setTypes((prev) => {
        if (prev.includes(entry.type)) return prev
        return [...prev, entry.type].sort()
      })
      // Increment total
      setTotal((prev) => prev + 1)
      // Only prepend to visible list when on page 1 and matching filter
      if (page === 1) {
        const matchesFilter = !typeFilter || entry.type === typeFilter
        if (matchesFilter) {
          setEntries((prev) => [entry, ...prev].slice(0, PAGE_SIZE))
        }
      }
    },
    enabled: !paused,
  })

  // Type filter change → reset to page 1
  const handleTypeChange = useCallback((type: string) => {
    setTypeFilter(type)
    fetchPage(1, type)
  }, [fetchPage])

  // Page navigation
  const goToPage = useCallback((p: number) => {
    fetchPage(p, typeFilter || undefined)
    containerRef.current?.scrollTo(0, 0)
  }, [fetchPage, typeFilter])

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Controls */}
      <div className="flex items-center gap-3 shrink-0">
        <select
          value={typeFilter}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="bg-bg-tertiary text-text text-sm rounded-md border border-border px-2 py-1.5 outline-none focus:border-accent"
        >
          <option value="">{text('全部类型', 'All types')}</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <button
          onClick={() => setPaused(!paused)}
          className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
            paused
              ? 'border-notification-border text-notification-border hover:bg-notification-bg'
              : 'border-border text-text-muted hover:bg-bg-tertiary'
          }`}
        >
          {paused ? text('▶ 继续', '▶ Resume') : text('⏸ 暂停', '⏸ Pause')}
        </button>

        <span className="text-xs text-text-muted ml-auto">
          {total > 0
            ? text(`第 ${page} / ${totalPages} 页 · 共 ${total} 条事件`, `Page ${page} / ${totalPages} · ${total} events total`)
            : text('0 条事件', '0 events')
          }
          {typeFilter && text('（已筛选）', ' (filtered)')}
        </span>
      </div>

      {/* Event list — fills remaining space */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 bg-bg rounded-lg border border-border overflow-y-auto font-mono text-xs"
      >
        {loading && entries.length === 0 ? (
          <div className="px-4 py-8 text-center text-text-muted">{text('加载中...', 'Loading...')}</div>
        ) : entries.length === 0 ? (
          <div className="px-4 py-8 text-center text-text-muted">{text('暂无事件', 'No events')}</div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-bg-secondary">
              <tr className="text-text-muted text-left">
                <th className="px-3 py-2 w-12">#</th>
                <th className="px-3 py-2 w-36">{text('时间', 'Time')}</th>
                <th className="px-3 py-2 w-40">{text('类型', 'Type')}</th>
                <th className="px-3 py-2">{text('载荷', 'Payload')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <EventRow key={entry.seq} entry={entry} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 shrink-0">
          <button
            onClick={() => goToPage(1)}
            disabled={page <= 1 || loading}
            className="text-xs px-2 py-1 rounded border border-border text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ««
          </button>
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1 || loading}
            className="text-xs px-2 py-1 rounded border border-border text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            «
          </button>
          <span className="text-xs text-text-muted px-2">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages || loading}
            className="text-xs px-2 py-1 rounded border border-border text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            »
          </button>
          <button
            onClick={() => goToPage(totalPages)}
            disabled={page >= totalPages || loading}
            className="text-xs px-2 py-1 rounded border border-border text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            »»
          </button>
        </div>
      )}
    </div>
  )
}

function EventRow({ entry }: { entry: EventLogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const payloadStr = JSON.stringify(entry.payload)
  const isLong = payloadStr.length > 120

  return (
    <>
      <tr
        className="border-t border-border/50 hover:bg-bg-tertiary/30 transition-colors cursor-pointer"
        onClick={() => isLong && setExpanded(!expanded)}
      >
        <td className="px-3 py-1.5 text-text-muted">{entry.seq}</td>
        <td className="px-3 py-1.5 text-text-muted whitespace-nowrap">{formatDateTime(entry.ts)}</td>
        <td className={`px-3 py-1.5 ${eventTypeColor(entry.type)}`}>{entry.type}</td>
        <td className="px-3 py-1.5 text-text-muted truncate">
          {isLong ? payloadStr.slice(0, 120) + '...' : payloadStr}
          {isLong && (
            <span className="ml-1 text-accent">{expanded ? '▾' : '▸'}</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-border/30">
          <td colSpan={4} className="px-3 py-2">
            <pre className="text-text-muted whitespace-pre-wrap break-all bg-bg-tertiary rounded p-2 text-[11px]">
              {JSON.stringify(entry.payload, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  )
}

// ==================== Cron Section ====================

function CronSection() {
  const { text, translateError } = useI18n()
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const loadJobs = useCallback(async () => {
    try {
      const { jobs } = await api.cron.list()
      setJobs(jobs)
    } catch (err) {
      console.warn('Failed to load cron jobs:', translateError(err instanceof Error ? err.message : 'Failed to load cron jobs'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  // Refresh periodically to update next-run times
  useEffect(() => {
    const id = setInterval(loadJobs, 15_000)
    return () => clearInterval(id)
  }, [loadJobs])

  const [error, setError] = useState<string | null>(null)

  const showError = (msg: string) => {
    setError(msg)
    setTimeout(() => setError(null), 3000)
  }

  const handleToggle = async (job: CronJob) => {
    try {
      await api.cron.update(job.id, { enabled: !job.enabled })
      await loadJobs()
    } catch {
      showError(text('切换任务失败', 'Failed to toggle job'))
    }
  }

  const handleRunNow = async (job: CronJob) => {
    try {
      await api.cron.runNow(job.id)
      await loadJobs()
    } catch {
      showError(text('执行任务失败', 'Failed to run job'))
    }
  }

  const handleDelete = async (job: CronJob) => {
    if (job.name === '__heartbeat__') return
    try {
      await api.cron.remove(job.id)
      await loadJobs()
    } catch {
      showError(text('删除任务失败', 'Failed to delete job'))
    }
  }

  if (loading) {
    return <div className="text-text-muted text-sm py-4">{text('正在加载定时任务...', 'Loading cron jobs...')}</div>
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <div className="text-xs text-red">{error}</div>}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">{text(`${jobs.length} 个任务`, `${jobs.length} jobs`)}</span>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-secondary-sm"
        >
          {text('+ 添加任务', '+ Add job')}
        </button>
      </div>

      {showAdd && (
        <AddCronJobForm
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); loadJobs() }}
        />
      )}

      {jobs.length === 0 ? (
        <div className="text-text-muted text-sm text-center py-6">{text('暂无定时任务', 'No cron jobs')}</div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <CronJobCard
              key={job.id}
              job={job}
              onToggle={() => handleToggle(job)}
              onRunNow={() => handleRunNow(job)}
              onDelete={() => handleDelete(job)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CronJobCard({ job, onToggle, onRunNow, onDelete }: {
  job: CronJob
  onToggle: () => void
  onRunNow: () => void
  onDelete: () => void
}) {
  const { text } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const isHeartbeat = job.name === '__heartbeat__'

  return (
    <div className={`rounded-lg border ${job.enabled ? 'border-border' : 'border-border/50 opacity-60'} bg-bg`}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Toggle */}
        <Toggle size="sm" checked={job.enabled} onChange={() => onToggle()} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isHeartbeat ? 'text-purple' : 'text-text'}`}>
              {isHeartbeat ? text('💓 心跳', '💓 heartbeat') : job.name}
            </span>
            <span className="text-xs text-text-muted">{job.id}</span>
            {job.state.lastStatus === 'error' && (
              <span className="text-xs text-red">
                {text(`${job.state.consecutiveErrors} 次错误`, `${job.state.consecutiveErrors}x err`)}
              </span>
            )}
          </div>
          <div className="text-xs text-text-muted mt-0.5">
            {scheduleLabel(job.schedule, text)}
            {job.state.nextRunAtMs && (
              <span className="ml-2">{text('• 下次：', '• next: ')}{formatDateTime(job.state.nextRunAtMs)}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onRunNow}
            title={text('立即运行', 'Run now')}
            className="p-1.5 rounded text-text-muted hover:text-accent hover:bg-bg-tertiary transition-colors text-xs"
          >
            ▶
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            title={text('详情', 'Details')}
            className="p-1.5 rounded text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors text-xs"
          >
            {expanded ? '▾' : '▸'}
          </button>
          {!isHeartbeat && (
            <button
              onClick={onDelete}
              title={text('删除', 'Delete')}
              className="p-1.5 rounded text-text-muted hover:text-red hover:bg-bg-tertiary transition-colors text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/50 px-4 py-3 text-xs space-y-2">
          <div>
            <span className="text-text-muted">{text('载荷：', 'Payload: ')}</span>
            <pre className="inline text-text whitespace-pre-wrap break-all">{job.payload}</pre>
          </div>
          <div className="flex gap-4 text-text-muted">
            <span>{text('上次运行：', 'Last run: ')}{job.state.lastRunAtMs ? `${timeAgo(job.state.lastRunAtMs)} (${formatDateTime(job.state.lastRunAtMs)})` : text('从未', 'never')}</span>
            <span>{text('状态：', 'Status: ')}{job.state.lastStatus ?? 'n/a'}</span>
            <span>{text('创建于：', 'Created: ')}{formatDateTime(job.createdAt)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function AddCronJobForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { text, translateError } = useI18n()
  const [name, setName] = useState('')
  const [payload, setPayload] = useState('')
  const [schedKind, setSchedKind] = useState<'every' | 'cron' | 'at'>('every')
  const [schedValue, setSchedValue] = useState('1h')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !payload.trim()) {
      setError(text('名称和载荷必填', 'Name and payload are required'))
      return
    }

    let schedule: CronSchedule
    if (schedKind === 'every') schedule = { kind: 'every', every: schedValue }
    else if (schedKind === 'cron') schedule = { kind: 'cron', cron: schedValue }
    else schedule = { kind: 'at', at: schedValue }

    setSaving(true)
    setError('')
    try {
      await api.cron.add({ name: name.trim(), payload: payload.trim(), schedule })
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? translateError(err.message) : text('创建失败', 'Create failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-bg rounded-lg border border-accent/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text">{text('新建定时任务', 'New cron job')}</span>
        <button type="button" onClick={onClose} className="text-text-muted hover:text-text text-xs">✕</button>
      </div>

      <input
        type="text"
        placeholder={text('任务名称', 'Job name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-bg-tertiary border border-border rounded-md px-3 py-2 text-sm text-text outline-none focus:border-accent"
      />

      <textarea
        placeholder={text('载荷 / 指令文本', 'Payload / instruction text')}
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
        rows={2}
        className="w-full bg-bg-tertiary border border-border rounded-md px-3 py-2 text-sm text-text outline-none focus:border-accent resize-none"
      />

      <div className="flex gap-2">
        <select
          value={schedKind}
          onChange={(e) => {
            const k = e.target.value as 'every' | 'cron' | 'at'
            setSchedKind(k)
            if (k === 'every') setSchedValue('1h')
            else if (k === 'cron') setSchedValue('0 9 * * 1-5')
            else setSchedValue(new Date(Date.now() + 3600_000).toISOString())
          }}
          className="bg-bg-tertiary border border-border rounded-md px-2 py-2 text-sm text-text outline-none focus:border-accent"
        >
          <option value="every">{text('每隔', 'Every')}</option>
          <option value="cron">Cron</option>
          <option value="at">{text('在指定时间（单次）', 'At (one-shot)')}</option>
        </select>

        <input
          type="text"
          value={schedValue}
          onChange={(e) => setSchedValue(e.target.value)}
          placeholder={schedKind === 'every' ? '1h' : schedKind === 'cron' ? '0 9 * * 1-5' : text('ISO 时间戳', 'ISO timestamp')}
          className="flex-1 bg-bg-tertiary border border-border rounded-md px-3 py-2 text-sm text-text outline-none focus:border-accent font-mono"
        />
      </div>

      {error && <div className="text-xs text-red">{error}</div>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-sm rounded-md text-text-muted hover:text-text hover:bg-bg-tertiary transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="btn-primary-sm"
        >
          {saving ? 'Creating...' : 'Create'}
        </button>
      </div>
    </form>
  )
}

// ==================== Main Page ====================

type Tab = 'events' | 'cron'

export function EventsPage() {
  const { text } = useI18n()
  const [tab, setTab] = useState<Tab>('events')

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title={text('事件', 'Events')}
        right={
          <div className="flex gap-1 bg-bg-secondary rounded-lg p-1">
            <button
              onClick={() => setTab('events')}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                tab === 'events'
                  ? 'bg-bg-tertiary text-text'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {text('事件日志', 'Event log')}
            </button>
            <button
              onClick={() => setTab('cron')}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                tab === 'cron'
                  ? 'bg-bg-tertiary text-text'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {text('Cron 任务', 'Cron jobs')}
            </button>
          </div>
        }
      />

      {/* Content area */}
      <div className="flex-1 flex flex-col min-h-0 px-4 md:px-6 py-5">
        <div className="flex-1 min-h-0">
          {tab === 'events' ? <EventLogSection /> : <CronSection />}
        </div>
      </div>
    </div>
  )
}
