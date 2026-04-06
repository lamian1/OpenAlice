import { fetchJson, headers } from './client'
import type { ReconnectResult, TelegramDebugStatus, TelegramSendTestResult } from './types'

export const connectorsDebugApi = {
  async getTelegramStatus(): Promise<TelegramDebugStatus> {
    return fetchJson('/api/connectors/debug/telegram')
  },

  async sendTelegramTest(body: { chatId?: number; text?: string } = {}): Promise<TelegramSendTestResult> {
    return fetchJson('/api/connectors/debug/telegram/send-test', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
  },

  async reconnectTelegram(): Promise<ReconnectResult> {
    return fetchJson('/api/connectors/debug/telegram/reconnect', {
      method: 'POST',
      headers,
    })
  },
}