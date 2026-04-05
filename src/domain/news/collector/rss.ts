/**
 * News Collector — RSS fetch service
 *
 * A code-level setInterval service (not AI-driven cron) that periodically
 * fetches configured RSS feeds and ingests new items into the store.
 */

import { fetchAndParseFeed } from './rss-parser.js'
import { computeDedupKey, type NewsCollectorStore } from '../store.js'
import type { RSSFeedConfig } from '../types.js'
import type { RuntimeNewsCollectorStatus, RuntimeNewsFeedStatus } from '../../../core/types.js'

export interface CollectorOpts {
  store: NewsCollectorStore
  feeds: RSSFeedConfig[]
  intervalMs: number
}

export class NewsCollector {
  private timer: ReturnType<typeof setInterval> | null = null
  private store: NewsCollectorStore
  private feeds: RSSFeedConfig[]
  private intervalMs: number
  private feedStatus = new Map<string, RuntimeNewsFeedStatus>()
  private running = false
  private fetching = false
  private lastRunAt?: number
  private lastSuccessAt?: number
  private lastFailureAt?: number
  private lastError?: string
  private lastTotalItems = 0
  private lastTotalNew = 0

  constructor(opts: CollectorOpts) {
    this.store = opts.store
    this.feeds = opts.feeds
    this.intervalMs = opts.intervalMs
    for (const feed of this.feeds) {
      this.feedStatus.set(feed.name, {
        name: feed.name,
        url: feed.url,
        source: feed.source,
        lastFetchedCount: 0,
        lastNewCount: 0,
      })
    }
  }

  /** Start periodic collection. Fetches immediately, then at interval. */
  start(): void {
    this.running = true
    this.fetchAll().catch((err) =>
      console.warn(`news-collector: initial fetch failed: ${err instanceof Error ? err.message : err}`),
    )
    this.timer = setInterval(
      () => this.fetchAll().catch((err) =>
        console.warn(`news-collector: periodic fetch failed: ${err instanceof Error ? err.message : err}`),
      ),
      this.intervalMs,
    )
  }

  /** Stop periodic collection. */
  stop(): void {
    this.running = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  status(): RuntimeNewsCollectorStatus {
    return {
      running: this.running,
      intervalMs: this.intervalMs,
      lastRunAt: this.lastRunAt,
      lastSuccessAt: this.lastSuccessAt,
      lastFailureAt: this.lastFailureAt,
      lastError: this.lastError,
      lastTotalItems: this.lastTotalItems,
      lastTotalNew: this.lastTotalNew,
      feeds: Array.from(this.feedStatus.values()),
    }
  }

  /** Fetch all configured feeds once. Returns counts. */
  async fetchAll(): Promise<{ total: number; new: number }> {
    this.fetching = true
    this.lastRunAt = Date.now()
    let totalItems = 0
    let totalNew = 0
    let sawFailure = false

    for (const feed of this.feeds) {
      try {
        const { fetched, ingested } = await this.fetchFeed(feed)
        totalItems += fetched
        totalNew += ingested
        this.feedStatus.set(feed.name, {
          ...this.feedStatus.get(feed.name)!,
          lastFetchAt: Date.now(),
          lastSuccessAt: Date.now(),
          lastError: undefined,
          lastFetchedCount: fetched,
          lastNewCount: ingested,
        })
      } catch (err) {
        sawFailure = true
        const message = err instanceof Error ? err.message : String(err)
        this.feedStatus.set(feed.name, {
          ...this.feedStatus.get(feed.name)!,
          lastFetchAt: Date.now(),
          lastFailureAt: Date.now(),
          lastError: message,
          lastFetchedCount: 0,
          lastNewCount: 0,
        })
        console.warn(
          `news-collector: failed to fetch ${feed.name} (${feed.url}): ${message}`,
        )
      }
    }

    this.lastTotalItems = totalItems
    this.lastTotalNew = totalNew
    this.fetching = false

    if (sawFailure) {
      this.lastFailureAt = Date.now()
      const failures = Array.from(this.feedStatus.values()).filter((feed) => feed.lastError)
      this.lastError = failures.length > 0 ? failures.map((feed) => `${feed.name}: ${feed.lastError}`).join('; ') : undefined
    }

    if (!sawFailure || totalItems > 0) {
      this.lastSuccessAt = Date.now()
      if (!sawFailure) this.lastError = undefined
    }

    if (totalNew > 0) {
      console.log(
        `news-collector: fetched ${totalItems} items from ${this.feeds.length} feeds, ${totalNew} new`,
      )
    }

    return { total: totalItems, new: totalNew }
  }

  /** Fetch a single feed and ingest its items. */
  private async fetchFeed(feed: RSSFeedConfig): Promise<{ fetched: number; ingested: number }> {
    const items = await fetchAndParseFeed(feed.url)
    let ingested = 0

    for (const item of items) {
      const dedupKey = computeDedupKey({
        guid: item.guid ?? undefined,
        link: item.link ?? undefined,
        title: item.title,
        content: item.content,
      })

      const isNew = await this.store.ingest({
        title: item.title,
        content: item.content,
        pubTime: item.pubDate ?? new Date(),
        dedupKey,
        metadata: {
          source: feed.source,
          link: item.link,
          guid: item.guid,
          ingestSource: 'rss',
          dedupKey,
          ...(feed.categories ? { categories: feed.categories.join(',') } : {}),
        },
      })

      if (isNew) ingested++
    }

    return { fetched: items.length, ingested }
  }
}
