import type { Plugin, EngineContext, MediaAttachment } from '../../core/types.js'
import type { TelegramConfig, ParsedMessage, Message, Update } from './types.js'
import { buildParsedMessage } from './helpers.js'
import { MediaGroupMerger } from './media-group.js'
import { askAgentSdk } from '../../ai-providers/agent-sdk/query.js'
import type { AgentSdkConfig } from '../../ai-providers/agent-sdk/query.js'
import { SessionStore } from '../../core/session'
import { forceCompact } from '../../core/compaction'
import { readAIBackend, writeAIBackend, type AIBackend } from '../../core/config'
import type { ConnectorCenter } from '../../core/connector-center.js'
import { TelegramConnector, splitMessage, MAX_MESSAGE_LENGTH } from './telegram-connector.js'
import { telegramCall, telegramGetUpdates, telegramSendPhoto } from './bot-api.js'

const BACKEND_LABELS: Record<AIBackend, string> = {
  'claude-code': 'Claude Code',
  'vercel-ai-sdk': 'Vercel AI SDK',
  'agent-sdk': 'Agent SDK',
}

async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    if (!signal) return
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new Error('Aborted delay'))
    }, { once: true })
  })
}

export class TelegramPlugin implements Plugin {
  name = 'telegram'
  private config: TelegramConfig
  private agentSdkConfig: AgentSdkConfig
  private connectorCenter: ConnectorCenter | null = null
  private merger: MediaGroupMerger | null = null
  private unregisterConnector?: () => void
  private pollingAbortController?: AbortController
  private pollingTask?: Promise<void>

  /** Per-user unified session stores (keyed by userId). */
  private sessions = new Map<number, SessionStore>()

  /** Throttle: last time we sent an auth-guidance reply per chatId. */
  private authReplyThrottle = new Map<number, number>()

  constructor(
    config: Omit<TelegramConfig, 'pollingTimeout'> & { pollingTimeout?: number },
    agentSdkConfig: AgentSdkConfig = {},
  ) {
    this.config = { pollingTimeout: 30, ...config }
    this.agentSdkConfig = agentSdkConfig
  }

  async start(engineCtx: EngineContext) {
    this.connectorCenter = engineCtx.connectorCenter
    console.log('telegram plugin: starting')

    // Inject agent config into Claude Code config (used by /compact command)
    this.agentSdkConfig = {
      disallowedTools: engineCtx.config.agent.claudeCode.disallowedTools,
      maxTurns: engineCtx.config.agent.claudeCode.maxTurns,
      ...this.agentSdkConfig,
    }

    // ── Set up media group merger ──
    this.merger = new MediaGroupMerger({
      onMerged: (message) => this.handleMessage(engineCtx, message),
    })

    void telegramCall(this.config.token, 'setMyCommands', {
      commands: [
        { command: 'status', description: 'Show engine status' },
        { command: 'settings', description: 'Choose default AI provider' },
        { command: 'heartbeat', description: 'Toggle heartbeat self-check' },
        { command: 'compact', description: 'Force compact session context' },
      ],
    }).catch((err) => {
      console.warn('telegram: failed to register commands:', err)
    })

    void telegramCall<{ username: string }>(this.config.token, 'getMe')
      .then(async (me) => {
        const aiConfig = await readAIBackend()
        console.log(`telegram plugin: connected as @${me.username} (backend: ${aiConfig.backend})`)
      })
      .catch((err) => {
        console.warn('telegram: getMe failed during startup:', err)
      })

    // ── Register connector for outbound delivery (heartbeat / cron responses) ──
    if (this.config.allowedChatIds.length > 0) {
      const deliveryChatId = this.config.allowedChatIds[0]
      this.unregisterConnector = this.connectorCenter!.register(new TelegramConnector(this.config.token, deliveryChatId))
    }

    this.pollingAbortController = new AbortController()
    this.pollingTask = this.startPolling(engineCtx, this.pollingAbortController.signal)
  }

  async stop() {
    this.merger?.flush()
    this.pollingAbortController?.abort()
    await this.pollingTask?.catch(() => {})
    this.unregisterConnector?.()
  }

  private async startPolling(engineCtx: EngineContext, signal: AbortSignal) {
    let offset = 0
    console.log(`telegram: polling started${this.config.allowedChatIds.length > 0 ? ` for chats ${this.config.allowedChatIds.join(', ')}` : ''}`)

    while (!signal.aborted) {
      try {
        const updates = await telegramGetUpdates<Update>(this.config.token, {
          offset,
          timeout: this.config.pollingTimeout,
          allowed_updates: ['message', 'edited_message', 'channel_post', 'callback_query'],
        }, signal)

        for (const update of updates) {
          offset = update.update_id + 1
          await this.handleUpdate(engineCtx, update)
        }
      } catch (err) {
        if (signal.aborted) break
        console.error('telegram polling fatal error:', err)
        await delay(2_000, signal).catch(() => {})
      }
    }
  }

  private isAuthorized(chatId: number): boolean {
    return this.config.allowedChatIds.length === 0 || this.config.allowedChatIds.includes(chatId)
  }

  private async replyUnauthorized(chatId: number) {
    const now = Date.now()
    const last = this.authReplyThrottle.get(chatId) ?? 0
    if (now - last <= 60_000) return
    this.authReplyThrottle.set(chatId, now)
    console.log(`telegram: unauthorized chat ${chatId}, add it to allowed chat IDs to enable access`)
    await telegramCall(this.config.token, 'sendMessage', {
      chat_id: chatId,
      text: 'This chat is not authorized. Add this chat ID to the Telegram allowed chat list in your config.',
    }).catch(() => {})
  }

  private parseCommand(text: string | undefined): { command?: string; commandArgs?: string } {
    if (!text?.startsWith('/')) return {}
    const trimmed = text.trim()
    const space = trimmed.indexOf(' ')
    const head = space >= 0 ? trimmed.slice(0, space) : trimmed
    const command = head.slice(1).split('@')[0]
    const commandArgs = space >= 0 ? trimmed.slice(space + 1).trim() : undefined
    return { command: command || undefined, commandArgs }
  }

  private async handleUpdate(engineCtx: EngineContext, update: Update) {
    const callbackQuery = update.callback_query
    if (callbackQuery?.data) {
      await this.handleCallbackQuery(engineCtx, callbackQuery as Record<string, unknown>)
      return
    }

    const msg = update.message ?? update.edited_message ?? update.channel_post
    if (!msg) return

    const chatId = msg.chat.id
    if (!this.isAuthorized(chatId)) {
      await this.replyUnauthorized(chatId)
      return
    }

    const { command, commandArgs } = this.parseCommand(msg.text ?? msg.caption)
    if (command) {
      await this.handleCommand(engineCtx, msg, command, commandArgs)
      return
    }

    const parsed = buildParsedMessage(msg as Message)
    console.log(`telegram: [${parsed.chatId}] ${parsed.from.firstName}: ${parsed.text?.slice(0, 80) || '(media)'}`)
    this.merger!.push(parsed)
  }

  private async handleCommand(engineCtx: EngineContext, msg: Message, command: string, commandArgs?: string) {
    const chatId = msg.chat.id
    const userId = msg.from?.id
    switch (command) {
      case 'status': {
        const aiConfig = await readAIBackend()
        await this.sendReply(chatId, `Engine is running. Provider: ${BACKEND_LABELS[aiConfig.backend]}`)
        return
      }
      case 'settings':
        await this.sendSettingsMenu(chatId)
        return
      case 'heartbeat':
        await this.sendHeartbeatMenu(chatId, engineCtx)
        return
      case 'compact':
        if (userId) await this.handleCompactCommand(chatId, userId)
        return
      default: {
        const parsed = buildParsedMessage(msg, command, commandArgs)
        this.merger!.push(parsed)
      }
    }
  }

  private async handleCallbackQuery(engineCtx: EngineContext, callbackQuery: Record<string, unknown>) {
    try {
      const data = String(callbackQuery.data ?? '')
      const queryId = String(callbackQuery.id ?? '')
      const message = callbackQuery.message as Record<string, unknown> | undefined
      const chat = message?.chat as Record<string, unknown> | undefined
      const chatId = Number(chat?.id)
      const messageId = Number(message?.message_id)
      if (!chatId || !messageId) return

      if (!this.isAuthorized(chatId)) {
        await this.replyUnauthorized(chatId)
        return
      }

      if (data.startsWith('provider:')) {
        const backend = data.slice('provider:'.length) as AIBackend
        await writeAIBackend(backend)
        await telegramCall(this.config.token, 'answerCallbackQuery', {
          callback_query_id: queryId,
          text: `Switched to ${BACKEND_LABELS[backend]}`,
        }).catch(() => {})
        await this.editMessageText(chatId, messageId, `Current provider: ${BACKEND_LABELS[backend]}\n\nChoose default AI provider:`, this.buildProviderKeyboard(backend))
      } else if (data.startsWith('heartbeat:')) {
        const newEnabled = data === 'heartbeat:on'
        await engineCtx.heartbeat.setEnabled(newEnabled)
        await telegramCall(this.config.token, 'answerCallbackQuery', {
          callback_query_id: queryId,
          text: `Heartbeat ${newEnabled ? 'ON' : 'OFF'}`,
        }).catch(() => {})
        await this.editMessageText(chatId, messageId, `Heartbeat: ${newEnabled ? 'ON' : 'OFF'}\n\nToggle heartbeat self-check:`, this.buildHeartbeatKeyboard(newEnabled))
      } else {
        await telegramCall(this.config.token, 'answerCallbackQuery', {
          callback_query_id: queryId,
        }).catch(() => {})
      }
    } catch (err) {
      console.error('telegram callback query error:', err)
    }
  }

  private async getSession(userId: number): Promise<SessionStore> {
    let session = this.sessions.get(userId)
    if (!session) {
      session = new SessionStore(`telegram/${userId}`)
      await session.restore()
      this.sessions.set(userId, session)
      console.log(`telegram: session telegram/${userId} ready`)
    }
    return session
  }

  /**
   * Sends "typing..." chat action and refreshes it every 4 seconds.
   * Returns a function to stop the indicator.
   */
  private startTypingIndicator(chatId: number): () => void {
    const send = () => {
      void telegramCall(this.config.token, 'sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {})
    }
    send()
    const interval = setInterval(send, 4000)
    return () => clearInterval(interval)
  }

  private async handleMessage(engineCtx: EngineContext, message: ParsedMessage) {
    try {
      // Build prompt from message content
      const prompt = this.buildPrompt(message)
      if (!prompt) return

      // Log: message received
      const receivedEntry = await engineCtx.eventLog.append('message.received', {
        channel: 'telegram',
        to: String(message.chatId),
        prompt,
      })

      // Send placeholder + typing indicator while generating
      const placeholder = await telegramCall<{ message_id: number }>(this.config.token, 'sendMessage', {
        chat_id: message.chatId,
        text: '...',
      }).catch(() => null)
      const stopTyping = this.startTypingIndicator(message.chatId)

      try {
        // Route through AgentCenter → GenerateRouter → active provider
        const session = await this.getSession(message.from.id)
        const result = await engineCtx.agentCenter.askWithSession(prompt, session, {
          historyPreamble: 'The following is the recent conversation from this Telegram chat. Use it as context if the user references earlier messages.',
        })
        stopTyping()
        await this.sendReplyWithPlaceholder(message.chatId, result.text, result.media, placeholder?.message_id)

        // Log: message sent
        await engineCtx.eventLog.append('message.sent', {
          channel: 'telegram',
          to: String(message.chatId),
          prompt,
          reply: result.text,
          durationMs: Date.now() - receivedEntry.ts,
        })
      } catch (err) {
        stopTyping()
        // Edit placeholder to show error instead of leaving "..."
        if (placeholder) {
          await this.editMessageText(message.chatId, placeholder.message_id, 'Sorry, something went wrong processing your message.').catch(() => {})
        }
        throw err
      }
    } catch (err) {
      console.error('telegram message handling error:', err)
    }
  }

  private async handleCompactCommand(chatId: number, userId: number) {
    const session = await this.getSession(userId)
    await this.sendReply(chatId, '> Compacting session...')

    const result = await forceCompact(
      session,
      async (summarizePrompt) => {
        const r = await askAgentSdk(summarizePrompt, { ...this.agentSdkConfig, maxTurns: 1 })
        return r.text
      },
    )

    if (!result) {
      await this.sendReply(chatId, 'Session is empty, nothing to compact.')
    } else {
      await this.sendReply(chatId, `Compacted. Pre-compaction: ~${result.preTokens} tokens.`)
    }
  }

  private async sendSettingsMenu(chatId: number) {
    const aiConfig = await readAIBackend()
    await telegramCall(this.config.token, 'sendMessage', {
      chat_id: chatId,
      text: `Current provider: ${BACKEND_LABELS[aiConfig.backend]}\n\nChoose default AI provider:`,
      reply_markup: this.buildProviderKeyboard(aiConfig.backend),
    })
  }

  private async sendHeartbeatMenu(chatId: number, engineCtx: EngineContext) {
    const enabled = engineCtx.heartbeat.isEnabled()
    await telegramCall(this.config.token, 'sendMessage', {
      chat_id: chatId,
      text: `Heartbeat: ${enabled ? 'ON' : 'OFF'}\n\nToggle heartbeat self-check:`,
      reply_markup: this.buildHeartbeatKeyboard(enabled),
    })
  }

  private buildProviderKeyboard(backend: AIBackend) {
    const ccLabel = backend === 'claude-code' ? '> Claude Code' : 'Claude Code'
    const aiLabel = backend === 'vercel-ai-sdk' ? '> Vercel AI SDK' : 'Vercel AI SDK'
    const sdkLabel = backend === 'agent-sdk' ? '> Agent SDK' : 'Agent SDK'
    return {
      inline_keyboard: [[
        { text: ccLabel, callback_data: 'provider:claude-code' },
        { text: aiLabel, callback_data: 'provider:vercel-ai-sdk' },
        { text: sdkLabel, callback_data: 'provider:agent-sdk' },
      ]],
    }
  }

  private buildHeartbeatKeyboard(enabled: boolean) {
    const onLabel = enabled ? '> ON' : 'ON'
    const offLabel = !enabled ? '> OFF' : 'OFF'
    return {
      inline_keyboard: [[
        { text: onLabel, callback_data: 'heartbeat:on' },
        { text: offLabel, callback_data: 'heartbeat:off' },
      ]],
    }
  }

  private async editMessageText(chatId: number, messageId: number, text: string, replyMarkup?: Record<string, unknown>) {
    await telegramCall(this.config.token, 'editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    })
  }

  private buildPrompt(message: ParsedMessage): string | null {
    const parts: string[] = []

    if (message.from.firstName) {
      parts.push(`[From: ${message.from.firstName}${message.from.username ? ` (@${message.from.username})` : ''}]`)
    }

    if (message.text) {
      parts.push(message.text)
    }

    if (message.media.length > 0) {
      const mediaDesc = message.media
        .map((m) => {
          const details: string[] = [m.type]
          if (m.fileName) details.push(m.fileName)
          if (m.mimeType) details.push(m.mimeType)
          return `[${details.join(': ')}]`
        })
        .join(' ')
      parts.push(mediaDesc)
    }

    const prompt = parts.join('\n')
    return prompt || null
  }

  /**
   * Send a reply, optionally editing a placeholder "..." message into the first text chunk.
   */
  private async sendReplyWithPlaceholder(chatId: number, text: string, media?: MediaAttachment[], placeholderMsgId?: number) {
    console.log(`telegram: sendReply chatId=${chatId} textLen=${text.length} media=${media?.length ?? 0}`)

    // Send images first (if any)
    if (media && media.length > 0) {
      for (let i = 0; i < media.length; i++) {
        const attachment = media[i]
        console.log(`telegram: sending photo ${i + 1}/${media.length} path=${attachment.path}`)
        try {
          await telegramSendPhoto(this.config.token, chatId, attachment.path)
          console.log(`telegram: photo ${i + 1} sent ok`)
        } catch (err) {
          console.error(`telegram: failed to send photo ${i + 1}:`, err)
        }
      }
    }

    // Send text — edit placeholder for first chunk, send the rest as new messages
    if (text) {
      const chunks = splitMessage(text, MAX_MESSAGE_LENGTH)
      let startIdx = 0

      if (placeholderMsgId && chunks.length > 0) {
        const edited = await this.editMessageText(chatId, placeholderMsgId, chunks[0]).then(() => true).catch(() => false)
        if (edited) startIdx = 1
      }

      for (let i = startIdx; i < chunks.length; i++) {
        await telegramCall(this.config.token, 'sendMessage', { chat_id: chatId, text: chunks[i] })
      }

      // Placeholder was edited — done
      if (startIdx > 0) return
    }

    // No text or edit failed — clean up the placeholder
    if (placeholderMsgId) {
      await telegramCall(this.config.token, 'deleteMessage', { chat_id: chatId, message_id: placeholderMsgId }).catch(() => {})
    }
  }

  private async sendReply(chatId: number, text: string) {
    if (text) {
      const chunks = splitMessage(text, MAX_MESSAGE_LENGTH)
      for (const chunk of chunks) {
        await telegramCall(this.config.token, 'sendMessage', { chat_id: chatId, text: chunk })
      }
    }
  }
}
