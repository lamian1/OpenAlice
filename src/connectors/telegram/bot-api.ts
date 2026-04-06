import { readFile } from 'node:fs/promises'

interface TelegramOk<T> {
  ok: true
  result: T
}

interface TelegramErr {
  ok: false
  description?: string
}

type TelegramResponse<T> = TelegramOk<T> | TelegramErr

async function parseTelegramResponse<T>(res: Response): Promise<T> {
  const data = await res.json() as TelegramResponse<T>
  if (!data.ok) {
    throw new Error(data.description ?? 'Telegram Bot API request failed')
  }
  return data.result
}

export async function telegramCall<T>(
  token: string,
  method: string,
  payload?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
    signal,
  })
  return parseTelegramResponse<T>(res)
}

export async function telegramSendPhoto(token: string, chatId: number, path: string, signal?: AbortSignal): Promise<void> {
  const buf = await readFile(path)
  const form = new FormData()
  form.set('chat_id', String(chatId))
  form.set('photo', new Blob([buf]), 'attachment.jpg')

  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    body: form,
    signal,
  })
  await parseTelegramResponse(res)
}

export async function telegramGetUpdates<T>(
  token: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T[]> {
  return telegramCall<T[]>(token, 'getUpdates', payload, signal)
}