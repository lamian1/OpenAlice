import { type ReactNode, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { type Page, ROUTES } from '../App'
import { useI18n } from '../i18n'
import type { StatusIndicatorItem, SystemStatusResponse } from '../api'

interface SidebarProps {
  systemStatus: SystemStatusResponse | null
  open: boolean
  onClose: () => void
}

function dotClass(status: StatusIndicatorItem['status']): string {
  switch (status) {
    case 'online':
      return 'bg-green'
    case 'warning':
      return 'bg-yellow-400'
    case 'offline':
      return 'bg-red'
    case 'disabled':
      return 'bg-text-muted/40'
  }
}

function statusPriority(status: StatusIndicatorItem['status']): number {
  switch (status) {
    case 'offline':
      return 0
    case 'warning':
      return 1
    case 'online':
      return 2
    case 'disabled':
      return 3
  }
}

function statusText(status: StatusIndicatorItem['status'], text: (zh: string, en: string) => string): string {
  switch (status) {
    case 'online':
      return text('正常', 'Online')
    case 'warning':
      return text('告警', 'Warning')
    case 'offline':
      return text('离线', 'Offline')
    case 'disabled':
      return text('关闭', 'Disabled')
  }
}

function IndicatorRow({ item, compact = false }: { item: StatusIndicatorItem; compact?: boolean }) {
  const { text } = useI18n()
  return (
    <div className={`flex items-start gap-2 ${compact ? 'py-0.5' : ''}`}>
      <span className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${dotClass(item.status)}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-text truncate">{item.label}</span>
          <span className="text-[10px] text-text-muted/70 shrink-0">{statusText(item.status, text)}</span>
        </div>
        {!compact && <p className="text-[11px] leading-snug text-text-muted truncate">{item.detail}</p>}
      </div>
    </div>
  )
}

function SummaryChip({ label, value, tone }: { label: string; value: number; tone: 'green' | 'yellow' | 'red' | 'muted' }) {
  const toneClass = tone === 'green'
    ? 'border-green/25 text-green bg-green/8'
    : tone === 'yellow'
      ? 'border-yellow-400/25 text-yellow-400 bg-yellow-400/8'
      : tone === 'red'
        ? 'border-red/25 text-red bg-red/8'
        : 'border-border text-text-muted bg-bg'

  return (
    <div className={`rounded-md border px-2 py-1 ${toneClass}`}>
      <div className="text-[9px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-[12px] font-semibold leading-none mt-1">{value}</div>
    </div>
  )
}

function IndicatorGroup({ title, items, defaultOpen = false }: { title: string; items: StatusIndicatorItem[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const { text } = useI18n()
  const sorted = useMemo(() => [...items].sort((a, b) => statusPriority(a.status) - statusPriority(b.status) || a.label.localeCompare(b.label)), [items])
  const offlineCount = sorted.filter((item) => item.status === 'offline').length
  const warningCount = sorted.filter((item) => item.status === 'warning').length
  const onlineCount = sorted.filter((item) => item.status === 'online').length

  return (
    <div className="rounded-lg border border-border/70 bg-bg/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full px-2.5 py-2 text-left hover:bg-bg-tertiary/35 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          >
            <path d="M4 2.5L8 6L4 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-text-muted/80 uppercase tracking-wider truncate">{title}</p>
              <span className="text-[10px] text-text-muted/60 shrink-0">{sorted.length}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-text-muted/70">
              <span>{text(`${onlineCount} 正常`, `${onlineCount} online`)}</span>
              {(warningCount > 0 || offlineCount > 0) && <span>·</span>}
              {warningCount > 0 && <span className="text-yellow-400">{text(`${warningCount} 告警`, `${warningCount} warning`)}</span>}
              {offlineCount > 0 && <span className="text-red">{text(`${offlineCount} 离线`, `${offlineCount} offline`)}</span>}
            </div>
          </div>
        </div>
      </button>
      <div className={`${open ? 'block' : 'hidden'} border-t border-border/60 px-2.5 py-2 space-y-2`}>
        {sorted.map((item) => <IndicatorRow key={item.id} item={item} compact={sorted.length > 4} />)}
      </div>
    </div>
  )
}

// ==================== Nav item definitions ====================

interface NavLeaf {
  page: Page
  label: string
  icon: (active: boolean) => ReactNode
}

interface NavSection {
  sectionLabel: string
  items: NavLeaf[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    sectionLabel: '',
    items: [
      {
        page: 'chat',
        label: '聊天',
        icon: (active) => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ),
      },
      {
        page: 'portfolio',
        label: '投资组合',
        icon: (active) => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <path d="M8 21h8" />
            <path d="M12 17v4" />
            <path d="M7 10l3-3 2 2 5-5" />
          </svg>
        ),
      },
      {
        page: 'events',
        label: '事件',
        icon: (active) => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        ),
      },
    ],
  },
  {
    sectionLabel: '智能体',
    items: [
      {
        page: 'agent-status',
        label: '智能体状态',
        icon: (active) => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M4 12h4l2-4 4 8 2-4h4" />
          </svg>
        ),
      },
      {
        page: 'heartbeat',
        label: '心跳',
        icon: (active) => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        ),
      },
    ],
  },
  {
    sectionLabel: '数据',
    items: [
      {
        page: 'market-data',
        label: '行情数据',
        icon: (active) => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
        ),
      },
      {
        page: 'news',
        label: '新闻',
        icon: (active) => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9h4" />
            <path d="M10 7h8" />
            <path d="M10 11h8" />
            <path d="M10 15h4" />
          </svg>
        ),
      },
    ],
  },
  {
    sectionLabel: '系统',
    items: [
      {
        page: 'connectors',
        label: '连接器',
        icon: (active) => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        ),
      },
      {
        page: 'tools',
        label: '工具',
        icon: (active) => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        ),
      },
      {
        page: 'trading' as const,
        label: '交易',
        icon: (active: boolean) => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 20h20" />
            <path d="M5 17V10" /><path d="M5 7V4" /><path d="M3 10h4" /><path d="M3 7h4" />
            <path d="M10 17V13" /><path d="M10 10V6" /><path d="M8 13h4" /><path d="M8 10h4" />
            <path d="M15 17V11" /><path d="M15 8V4" /><path d="M13 11h4" /><path d="M13 8h4" />
            <path d="M20 17V14" /><path d="M20 11V8" /><path d="M18 14h4" /><path d="M18 11h4" />
          </svg>
        ),
      },
      {
        page: 'ai-provider',
        label: 'AI 提供方',
        icon: (active) => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73v1.27h1a7 7 0 0 1 7 7h1.27c.34-.6.99-1 1.73-1a2 2 0 1 1 0 4c-.74 0-1.39-.4-1.73-1H21a7 7 0 0 1-7 7v1.27c.6.34 1 .99 1 1.73a2 2 0 1 1-4 0c0-.74.4-1.39 1-1.73V21a7 7 0 0 1-7-7H2.73c-.34.6-.99 1-1.73 1a2 2 0 1 1 0-4c.74 0 1.39.4 1.73 1H4a7 7 0 0 1 7-7V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
            <circle cx="12" cy="14" r="3" />
          </svg>
        ),
      },
      {
        page: 'settings',
        label: '设置',
        icon: (active) => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        ),
      },
      {
        page: 'dev' as const,
        label: '开发',
        icon: (active: boolean) => (
          <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        ),
      },
    ],
  },
]

// ==================== Helpers ====================

/** Derive active page from current URL path */
function pathToPage(pathname: string): Page | null {
  for (const [page, path] of Object.entries(ROUTES) as [Page, string][]) {
    if (path === pathname) return page
    // Match root path for chat
    if (page === 'chat' && pathname === '/') return 'chat'
  }
  return null
}

/** Style for active indicator */
const INDICATOR_STYLE = { background: '#58a6ff' }

// ==================== Sidebar ====================

export function Sidebar({ systemStatus, open, onClose }: SidebarProps) {
  const { locale, setLocale, text } = useI18n()
  const location = useLocation()
  const currentPage = pathToPage(location.pathname)
  const [indicatorsOpen, setIndicatorsOpen] = useState(true)
  const systemIndicators = systemStatus
    ? [systemStatus.aiProvider, systemStatus.marketData, systemStatus.heartbeat, systemStatus.news]
    : []
  const connectorIndicators = systemStatus?.connectors ?? []
  const tradingIndicators = systemStatus?.tradingAccounts ?? []
  const newsFeedIndicators = systemStatus?.newsFeeds ?? []
  const counts = useMemo(() => {
    const all = systemStatus
      ? [...systemIndicators, ...connectorIndicators, ...tradingIndicators, ...newsFeedIndicators]
      : []
    return {
      online: all.filter((item) => item.status === 'online').length,
      warning: all.filter((item) => item.status === 'warning').length,
      offline: all.filter((item) => item.status === 'offline').length,
      disabled: all.filter((item) => item.status === 'disabled').length,
    }
  }, [systemStatus, systemIndicators, connectorIndicators, tradingIndicators, newsFeedIndicators])

  return (
    <>
      {/* Backdrop — mobile only */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside
        className={`
          w-[220px] h-full flex flex-col bg-bg-secondary border-r border-border shrink-0
          fixed z-50 top-0 left-0 transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full'}
          md:static md:translate-x-0 md:z-auto md:transition-none
        `}
      >
        {/* Branding */}
        <div className="px-5 py-4 flex items-center gap-2.5">
          <img
            src="/alice.ico"
            alt="Alice"
            className="w-7 h-7 rounded-lg ring-1 ring-accent/25 shadow-[0_0_8px_rgba(88,166,255,0.15)]"
            draggable={false}
          />
          <h1 className="text-[15px] font-semibold text-text">Open Alice</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col px-2 overflow-y-auto">
          {NAV_SECTIONS.map((section, si) => (
            <div key={si} className={si > 0 ? 'mt-4' : ''}>
              {section.sectionLabel && (
                <p className="px-3 mb-1 text-[11px] font-medium text-text-muted/50 uppercase tracking-wider">
                  {section.sectionLabel}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const isActive = currentPage === item.page
                  return (
                    <Link
                      key={item.page}
                      to={ROUTES[item.page]}
                      onClick={onClose}
                      className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                        isActive
                          ? 'bg-bg-tertiary/60 text-text'
                          : 'text-text-muted hover:text-text hover:bg-bg-tertiary/40'
                      }`}
                    >
                      <span
                        className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full transition-all duration-200 ${
                          isActive ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-50'
                        }`}
                        style={INDICATOR_STYLE}
                      />
                      <span className="flex items-center justify-center w-5 h-5">{item.icon(isActive)}</span>
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto px-4 py-3 border-t border-border space-y-3">
          <div className="rounded-xl border border-border bg-bg/70 px-3 py-2.5 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium text-text-muted/60 uppercase tracking-wider">{text('运行状态', 'Runtime status')}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {systemStatus?.meta.connectorsReconnecting && <span className="text-[10px] text-yellow-400">{text('重载中', 'Reloading')}</span>}
                <button
                  type="button"
                  onClick={() => setIndicatorsOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-bg/70 px-2 py-1 text-[10px] text-text-muted hover:text-text hover:bg-bg-tertiary/40 transition-colors"
                  aria-label={indicatorsOpen ? text('折叠状态灯', 'Collapse indicators') : text('展开状态灯', 'Expand indicators')}
                >
                  <span>{indicatorsOpen ? text('折叠', 'Hide') : text('展开', 'Show')}</span>
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill="none"
                    className={`transition-transform ${indicatorsOpen ? 'rotate-90' : ''}`}
                  >
                    <path d="M4 2.5L8 6L4 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <SummaryChip label={text('正常', 'Online')} value={counts.online} tone="green" />
              <SummaryChip label={text('告警', 'Warn')} value={counts.warning} tone="yellow" />
              <SummaryChip label={text('离线', 'Off')} value={counts.offline} tone="red" />
              <SummaryChip label={text('关闭', 'Off')} value={counts.disabled} tone="muted" />
            </div>
          </div>
          <div className={`${indicatorsOpen ? 'block' : 'hidden'} space-y-2 max-h-[28vh] overflow-y-auto pr-1`}>
            {systemStatus ? (
              <>
                <IndicatorGroup title={text('系统状态', 'System status')} items={systemIndicators} defaultOpen />
                <IndicatorGroup title={text('连接器', 'Connectors')} items={connectorIndicators} defaultOpen={connectorIndicators.some((item) => item.status !== 'online' && item.status !== 'disabled')} />
                <IndicatorGroup title={text('News 源', 'News feeds')} items={newsFeedIndicators.length > 0 ? newsFeedIndicators : [systemStatus.news]} defaultOpen={newsFeedIndicators.some((item) => item.status !== 'online' && item.status !== 'disabled')} />
                <IndicatorGroup
                  title={text('交易账户', 'Trading accounts')}
                  defaultOpen={tradingIndicators.some((item) => item.status !== 'online' && item.status !== 'disabled')}
                  items={tradingIndicators.length > 0 ? tradingIndicators : [{ id: 'no-accounts', label: text('交易账户', 'Trading accounts'), status: 'disabled', detail: text('尚未配置任何账户', 'No accounts configured') }]}
                />
              </>
            ) : (
              <div className="text-[12px] text-text-muted rounded-lg border border-border bg-bg/60 px-3 py-2">{text('状态加载中…', 'Loading status...')}</div>
            )}
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-text-muted/60 uppercase tracking-wider">
              {text('界面语言', 'Language')}
            </p>
            <div className="flex rounded-lg border border-border overflow-hidden bg-bg">
              <button
                type="button"
                onClick={() => setLocale('zh-CN')}
                className={`flex-1 px-3 py-1.5 text-xs transition-colors ${locale === 'zh-CN' ? 'bg-accent/15 text-accent font-medium' : 'text-text-muted hover:text-text hover:bg-bg-tertiary'}`}
              >
                中文
              </button>
              <button
                type="button"
                onClick={() => setLocale('en-US')}
                className={`flex-1 px-3 py-1.5 text-xs border-l border-border transition-colors ${locale === 'en-US' ? 'bg-accent/15 text-accent font-medium' : 'text-text-muted hover:text-text hover:bg-bg-tertiary'}`}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
