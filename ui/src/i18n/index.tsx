import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Locale = 'zh-CN' | 'en-US'
export type Phrase = { zh: string; en: string }

const STORAGE_KEY = 'openalice.ui.locale'
const DEFAULT_LOCALE: Locale = 'zh-CN'

let currentLocale: Locale = DEFAULT_LOCALE

export const COPY = {
  common: {
    save: { zh: '保存', en: 'Save' },
    saving: { zh: '保存中...', en: 'Saving...' },
    cancel: { zh: '取消', en: 'Cancel' },
    retry: { zh: '重试', en: 'Retry' },
    loading: { zh: '加载中...', en: 'Loading...' },
    refresh: { zh: '刷新', en: 'Refresh' },
    port: { zh: '端口', en: 'Port' },
    enabled: { zh: '已启用', en: 'Enabled' },
    disabled: { zh: '已禁用', en: 'Disabled' },
    name: { zh: '名称', en: 'Name' },
    type: { zh: '类型', en: 'Type' },
    time: { zh: '时间', en: 'Time' },
    payload: { zh: '载荷', en: 'Payload' },
    create: { zh: '创建', en: 'Create' },
    remove: { zh: '移除', en: 'Remove' },
    model: { zh: '模型', en: 'Model' },
    provider: { zh: '提供方', en: 'Provider' },
    apiKey: { zh: 'API Key', en: 'API key' },
    baseUrl: { zh: 'Base URL', en: 'Base URL' },
    trading: { zh: '交易', en: 'Trading' },
    close: { zh: '关闭', en: 'Close' },
    history: { zh: '历史记录', en: 'History' },
    positions: { zh: '持仓', en: 'Positions' },
    instrument: { zh: '标的', en: 'Instrument' },
    quantity: { zh: '数量', en: 'Quantity' },
    avgCost: { zh: '平均成本', en: 'Avg cost' },
    marketPrice: { zh: '市场价', en: 'Market price' },
    marketValue: { zh: '市值', en: 'Market value' },
    pnl: { zh: '盈亏', en: 'PnL' },
    cash: { zh: '现金', en: 'Cash' },
    totalEquity: { zh: '总权益', en: 'Total equity' },
    unrealizedPnl: { zh: '未实现盈亏', en: 'Unrealized PnL' },
    realizedPnl: { zh: '已实现盈亏', en: 'Realized PnL' },
    scrollToBottom: { zh: '滚动到底部', en: 'Scroll to bottom' },
  },
  connectors: {
    title: { zh: '连接器', en: 'Connectors' },
    description: { zh: '服务端口与外部集成。更改后需要重启。', en: 'Service ports and external integrations. Restart required after changes.' },
    active: { zh: '启用的连接器', en: 'Active connectors' },
    activeDescription: { zh: '选择要启用的连接器。Web UI 与 MCP Server 始终启用。', en: 'Choose which connectors are enabled. Web UI and MCP Server stay enabled.' },
    webDescription: { zh: '基于浏览器的聊天与配置界面。', en: 'Browser-based chat and configuration interface.' },
    mcpDescription: { zh: '为 Claude Code 提供方和外部 AI 智能体提供工具桥接。', en: 'Tool bridge for Claude Code provider and external AI agents.' },
    mcpAskDescription: { zh: '供外部智能体使用的多轮对话端点。', en: 'Multi-turn conversation endpoint for external agents.' },
    telegramDescription: { zh: '通过 @BotFather 创建机器人，将 Token 粘贴到下方，并添加你的聊天 ID。', en: 'Create a bot with @BotFather, paste the token below, and add your chat IDs.' },
    telegramToken: { zh: '机器人 Token', en: 'Bot token' },
    telegramUsername: { zh: '机器人用户名', en: 'Bot username' },
    telegramChatIds: { zh: '允许的聊天 ID', en: 'Allowed chat IDs' },
    chatIdsPlaceholder: { zh: '逗号分隔，例如 123456, 789012', en: 'Comma-separated, for example 123456, 789012' },
    loadError: { zh: '加载配置失败。', en: 'Failed to load configuration.' },
  },
  news: {
    title: { zh: '新闻', en: 'News' },
    description: { zh: 'RSS 源采集与文章归档。', en: 'RSS feed collection and article archive.' },
    collectionSettings: { zh: '采集设置', en: 'Collection settings' },
    collectionDescription: { zh: '控制文章抓取频率以及在归档中的保留时长。', en: 'Control fetch frequency and archive retention length.' },
    intervalMinutes: { zh: '抓取间隔（分钟）', en: 'Fetch interval (min)' },
    retentionDays: { zh: '保留时长（天）', en: 'Retention (days)' },
    feeds: { zh: 'RSS 源', en: 'RSS feeds' },
    noFeeds: { zh: '尚未配置订阅源。添加后即可开始采集文章。', en: 'No feeds configured yet. Add feeds to start collecting articles.' },
    addFeed: { zh: '添加订阅源', en: 'Add feed' },
    sourceTag: { zh: '来源标签', en: 'Source tag' },
    feedUrl: { zh: '订阅 URL', en: 'Feed URL' },
    sourcePrefix: { zh: '来源标签：', en: 'Source: ' },
    removeFeed: { zh: '移除订阅源', en: 'Remove feed' },
    loadError: { zh: '加载配置失败。', en: 'Failed to load configuration.' },
  },
  tools: {
    title: { zh: '工具', en: 'Tools' },
    emptyTitle: { zh: '尚未注册任何工具。', en: 'No tools registered yet.' },
    emptyDescription: { zh: '引擎启动后，这里会显示可用工具。', en: 'Available tools will appear here after the engine starts.' },
  },
  aiProvider: {
    title: { zh: 'AI 提供方', en: 'AI provider' },
    description: { zh: '配置 AI 后端、模型与 API Key。', en: 'Configure the AI backend, model, and API keys.' },
    backend: { zh: '后端', en: 'Backend' },
    backendDescription: { zh: '更改会立即生效。', en: 'Changes take effect immediately.' },
    auth: { zh: '认证', en: 'Authentication' },
    authDescription: { zh: '选择 Alice 连接 Claude 的方式。', en: 'Choose how Alice connects to Claude.' },
    model: { zh: '模型', en: 'Model' },
  },
} as const

type ErrorRule = {
  pattern: RegExp
  zh: string | ((match: RegExpExecArray) => string)
  en?: string | ((match: RegExpExecArray) => string)
}

const ERROR_RULES: ErrorRule[] = [
  { pattern: /^Failed to load history$/i, zh: '加载历史记录失败', en: 'Failed to load history' },
  { pattern: /^Failed to get heartbeat status$/i, zh: '获取心跳状态失败', en: 'Failed to get heartbeat status' },
  { pattern: /^Failed to load prompt file$/i, zh: '加载提示词文件失败', en: 'Failed to load prompt file' },
  { pattern: /^Failed to save prompt file$/i, zh: '保存提示词文件失败', en: 'Failed to save prompt file' },
  { pattern: /^Trigger failed$/i, zh: '触发失败', en: 'Trigger failed' },
  { pattern: /^Update failed$/i, zh: '更新失败', en: 'Update failed' },
  { pattern: /^Reject failed(?: \((\d+)\))?$/i, zh: (m) => `拒绝失败${m[1] ? `（${m[1]}）` : ''}`, en: (m) => `Reject failed${m[1] ? ` (${m[1]})` : ''}` },
  { pattern: /^Push failed(?: \((\d+)\))?$/i, zh: (m) => `推送失败${m[1] ? `（${m[1]}）` : ''}`, en: (m) => `Push failed${m[1] ? ` (${m[1]})` : ''}` },
  { pattern: /^Failed to save account(?: \((\d+)\))?$/i, zh: (m) => `保存账户失败${m[1] ? `（${m[1]}）` : ''}`, en: (m) => `Failed to save account${m[1] ? ` (${m[1]})` : ''}` },
  { pattern: /^Failed to delete account(?: \((\d+)\))?$/i, zh: (m) => `删除账户失败${m[1] ? `（${m[1]}）` : ''}`, en: (m) => `Failed to delete account${m[1] ? ` (${m[1]})` : ''}` },
  { pattern: /^Connected$/i, zh: '已连接', en: 'Connected' },
  { pattern: /^Connection failed$/i, zh: '连接失败', en: 'Connection failed' },
  { pattern: /^Not connected$/i, zh: '未连接', en: 'Not connected' },
  { pattern: /^Loading\.\.\.$/i, zh: '加载中...', en: 'Loading...' },
  { pattern: /^Save failed$/i, zh: '保存失败', en: 'Save failed' },
  { pattern: /^Failed to create channel$/i, zh: '创建频道失败', en: 'Failed to create channel' },
  { pattern: /^Failed to save$/i, zh: '保存失败', en: 'Failed to save' },
  { pattern: /^Unauthorized$/i, zh: '未授权', en: 'Unauthorized' },
  { pattern: /^Forbidden$/i, zh: '已被禁止', en: 'Forbidden' },
  { pattern: /^Not Found$/i, zh: '未找到资源', en: 'Not Found' },
  { pattern: /not found/i, zh: '未找到相关资源', en: 'Not found' },
  { pattern: /already exists/i, zh: '资源已存在', en: 'Already exists' },
  { pattern: /permission denied/i, zh: '权限不足', en: 'Permission denied' },
  { pattern: /timeout/i, zh: '请求超时', en: 'Request timed out' },
  { pattern: /ECONNREFUSED|connection refused/i, zh: '连接被拒绝', en: 'Connection refused' },
]

function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'en-US' ? 'en-US' : DEFAULT_LOCALE
}

function applyRule(message: string, locale: Locale): string {
  for (const rule of ERROR_RULES) {
    const match = rule.pattern.exec(message)
    if (!match) continue
    const target = locale === 'zh-CN' ? rule.zh : (rule.en ?? message)
    return typeof target === 'function' ? target(match) : target
  }
  return message
}

export function getCurrentLocale(): Locale {
  return currentLocale
}

export function setCurrentLocale(locale: Locale): void {
  currentLocale = locale
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, locale)
    document.documentElement.lang = locale
  }
}

export function pickText(zh: string, en: string, locale: Locale = getCurrentLocale()): string {
  return locale === 'zh-CN' ? zh : en
}

export function pickPhrase(entry: Phrase, locale: Locale = getCurrentLocale()): string {
  return locale === 'zh-CN' ? entry.zh : entry.en
}

export function translateErrorMessage(message: string, locale: Locale = getCurrentLocale()): string {
  return applyRule(message, locale)
}

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  text: (zh: string, en: string) => string
  phrase: (entry: Phrase) => string
  translateError: (message: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const initial = getStoredLocale()
    currentLocale = initial
    return initial
  })

  const setLocale = useCallback((next: Locale) => {
    setCurrentLocale(next)
    setLocaleState(next)
  }, [])

  useEffect(() => {
    setCurrentLocale(locale)
  }, [locale])

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    text: (zh: string, en: string) => pickText(zh, en, locale),
    phrase: (entry: Phrase) => pickPhrase(entry, locale),
    translateError: (message: string) => translateErrorMessage(message, locale),
  }), [locale, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    return {
      locale: getCurrentLocale(),
      setLocale: setCurrentLocale,
      text: (zh: string, en: string) => pickText(zh, en),
      phrase: (entry: Phrase) => pickPhrase(entry),
      translateError: (message: string) => translateErrorMessage(message),
    }
  }
  return ctx
}