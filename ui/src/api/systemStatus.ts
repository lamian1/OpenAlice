import type { SystemStatusResponse } from './types'

export const systemStatusApi = {
  async load(): Promise<SystemStatusResponse> {
    const res = await fetch('/api/system-status')
    if (!res.ok) throw new Error('Failed to load system status')
    return res.json()
  },
}