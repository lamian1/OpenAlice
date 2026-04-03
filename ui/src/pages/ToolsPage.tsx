import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api'
import type { ToolInfo } from '../api/tools'
import { Toggle } from '../components/Toggle'
import { SaveIndicator } from '../components/SaveIndicator'
import { useAutoSave } from '../hooks/useAutoSave'
import { PageHeader } from '../components/PageHeader'
import { PageLoading, EmptyState } from '../components/StateViews'
import { COPY, useI18n } from '../i18n'

const GROUP_LABELS: Record<string, { zh: string; en: string }> = {
  thinking: { zh: '思考工具集', en: 'Thinking tools' },
  brain: { zh: '记忆', en: 'Memory' },
  browser: { zh: '浏览器', en: 'Browser' },
  cron: { zh: '定时任务', en: 'Cron' },
  equity: { zh: '股票数据', en: 'Equity data' },
  'crypto-data': { zh: '加密数据', en: 'Crypto data' },
  'currency-data': { zh: '汇率数据', en: 'FX data' },
  news: { zh: '新闻', en: 'News' },
  'news-archive': { zh: '新闻档案', en: 'News archive' },
  analysis: { zh: '分析工具集', en: 'Analysis tools' },
  'crypto-trading': { zh: '加密交易', en: 'Crypto trading' },
  'securities-trading': { zh: '证券交易', en: 'Securities trading' },
}

interface ToolGroup {
  key: string
  label: string
  tools: ToolInfo[]
}

export function ToolsPage() {
  const { phrase, text } = useI18n()
  const [inventory, setInventory] = useState<ToolInfo[]>([])
  const [disabled, setDisabled] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    api.tools.load().then((res) => {
      setInventory(res.inventory)
      setDisabled(new Set(res.disabled))
      setLoaded(true)
    }).catch(() => {})
  }, [])

  const groups = useMemo<ToolGroup[]>(() => {
    const map = new Map<string, ToolInfo[]>()
    for (const t of inventory) {
      if (!map.has(t.group)) map.set(t.group, [])
      map.get(t.group)!.push(t)
    }
    return Array.from(map.entries()).map(([key, tools]) => ({
      key,
      label: GROUP_LABELS[key] ? text(GROUP_LABELS[key].zh, GROUP_LABELS[key].en) : key,
      tools: tools.sort((a, b) => a.name.localeCompare(b.name)),
    }))
  }, [inventory, text])

  const configData = useMemo(
    () => ({ disabled: [...disabled].sort() }),
    [disabled],
  )

  const save = useCallback(async (d: { disabled: string[] }) => {
    await api.tools.update(d.disabled)
  }, [])

  const { status, retry } = useAutoSave({ data: configData, save, enabled: loaded })

  const toggleTool = useCallback((name: string) => {
    setDisabled((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const toggleGroup = useCallback((tools: ToolInfo[], enable: boolean) => {
    setDisabled((prev) => {
      const next = new Set(prev)
      for (const t of tools) {
        if (enable) next.delete(t.name)
        else next.add(t.name)
      }
      return next
    })
  }, [])

  const toggleExpanded = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title={phrase(COPY.tools.title)}
        description={<>{text(`${inventory.length} 个工具，分为 ${groups.length} 个分组，改动会在下一次 AI 请求时生效`, `${inventory.length} tools across ${groups.length} groups. Changes apply on the next AI request.`)}</>}
        right={<SaveIndicator status={status} onRetry={retry} />}
      />

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5">
        {!loaded ? (
          <PageLoading />
        ) : groups.length === 0 ? (
          <EmptyState title={phrase(COPY.tools.emptyTitle)} description={phrase(COPY.tools.emptyDescription)} />
        ) : (
          <div className="max-w-[880px] mx-auto space-y-2">
            {groups.map((g) => (
              <ToolGroupCard
                key={g.key}
                group={g}
                disabled={disabled}
                expanded={expanded.has(g.key)}
                onToggleExpanded={() => toggleExpanded(g.key)}
                onToggleTool={toggleTool}
                onToggleGroup={toggleGroup}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== ToolGroupCard ====================

interface ToolGroupCardProps {
  group: ToolGroup
  disabled: Set<string>
  expanded: boolean
  onToggleExpanded: () => void
  onToggleTool: (name: string) => void
  onToggleGroup: (tools: ToolInfo[], enable: boolean) => void
}

function ToolGroupCard({
  group,
  disabled,
  expanded,
  onToggleExpanded,
  onToggleTool,
  onToggleGroup,
}: ToolGroupCardProps) {
  const enabledCount = group.tools.filter((t) => !disabled.has(t.name)).length
  const allEnabled = enabledCount === group.tools.length
  const noneEnabled = enabledCount === 0

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Group header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-bg-secondary">
        <button
          onClick={onToggleExpanded}
          className="flex items-center gap-2 flex-1 text-left min-w-0"
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-sm font-medium text-text truncate">{group.label}</span>
          <span className="text-[11px] text-text-muted shrink-0">
            {enabledCount}/{group.tools.length}
          </span>
        </button>
        <Toggle
          size="sm"
          checked={!noneEnabled}
          onChange={(v) => onToggleGroup(group.tools, v)}
        />
      </div>

      {/* Tool list */}
      <div
        className={`transition-all duration-150 ${
          expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        } overflow-hidden`}
      >
        <div className="divide-y divide-border">
          {group.tools.map((t) => {
            const enabled = !disabled.has(t.name)
            return (
              <div
                key={t.name}
                className={`flex items-center gap-3 px-4 py-2 ${
                  enabled ? '' : 'opacity-50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] text-text font-mono">{t.name}</span>
                  {t.description && (
                    <p className="text-[11px] text-text-muted mt-0.5 line-clamp-1">
                      {t.description}
                    </p>
                  )}
                </div>
                <Toggle
                  size="sm"
                  checked={enabled}
                  onChange={() => onToggleTool(t.name)}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
