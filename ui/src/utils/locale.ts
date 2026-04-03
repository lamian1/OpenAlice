import { getCurrentLocale } from '../i18n'

export function getUiLocale(): string {
  return getCurrentLocale()
}

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value)
}

export function formatDateTime(value: string | number | Date): string {
  return toDate(value).toLocaleString(getUiLocale(), { hour12: false })
}

export function formatShortDateTime(value: string | number | Date): string {
  const date = toDate(value)
  return `${date.toLocaleDateString(getUiLocale(), { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString(getUiLocale(), { hour12: false })}`
}

export function formatTimeOnly(value: string | number | Date): string {
  return toDate(value).toLocaleTimeString(getUiLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function formatAxisTime(value: string | number | Date): string {
  const date = toDate(value)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(getUiLocale(), { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return `${date.toLocaleDateString(getUiLocale(), { month: 'numeric', day: 'numeric' })} ${date.toLocaleTimeString(getUiLocale(), { hour: '2-digit', minute: '2-digit', hour12: false })}`
}

export function formatUsd(value: number, digits = 2): string {
  return `$${value.toLocaleString(getUiLocale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

export function formatSignedUsd(value: number, digits = 2): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${formatUsd(value, digits)}`
}

export function formatNumber(value: number): string {
  if (Math.abs(value) >= 1) {
    return value.toLocaleString(getUiLocale(), { maximumFractionDigits: 4 })
  }
  return value.toPrecision(4)
}

export function formatCompactUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toLocaleString(getUiLocale(), { maximumFractionDigits: 1 })}M`
  if (value >= 1_000) return `$${(value / 1_000).toLocaleString(getUiLocale(), { maximumFractionDigits: 1 })}K`
  return `$${value.toFixed(0)}`
}

export function formatRelativeTime(value: string | number | Date | null): string {
  if (!value) return '-'
  const diff = Date.now() - toDate(value).getTime()
  if (diff < 60_000) return `${Math.floor(diff / 1000)} 秒前`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return `${Math.floor(diff / 86_400_000)} 天前`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} 毫秒`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} 秒`
  return `${(ms / 60_000).toFixed(1)} 分钟`
}