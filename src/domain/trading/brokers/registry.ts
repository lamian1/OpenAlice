/**
 * Broker Registry — maps type strings to broker classes.
 *
 * Each broker self-registers via static configSchema + configFields + fromConfig.
 * Adding a new broker: import it here and add one entry to the registry.
 */

import type { z } from 'zod'
import type { IBroker, BrokerConfigField } from './types.js'
import type { AccountConfig } from '../../../core/config.js'
import { CcxtBroker } from './ccxt/CcxtBroker.js'
import { AlpacaBroker } from './alpaca/AlpacaBroker.js'
import { IbkrBroker } from './ibkr/IbkrBroker.js'

export interface BrokerRegistryEntry {
  /** Zod schema for validating brokerConfig fields */
  configSchema: z.ZodType
  /** UI field descriptors for dynamic form rendering */
  configFields: BrokerConfigField[]
  /** Construct a broker instance from AccountConfig */
  fromConfig: (config: AccountConfig) => IBroker
  /** Display name */
  name: string
  /** Short description */
  description: string
  /** Badge text (2-3 chars) */
  badge: string
  /** Tailwind badge color class */
  badgeColor: string
}

export const BROKER_REGISTRY: Record<string, BrokerRegistryEntry> = {
  ccxt: {
    ...CcxtBroker,
    name: 'CCXT (Crypto)',
    description: 'Unified API for 100+ crypto exchanges. Supports Binance, Bybit, OKX, Coinbase, and more.',
    badge: 'CC',
    badgeColor: 'text-accent',
  },
  alpaca: {
    ...AlpacaBroker,
    name: 'Alpaca (Securities)',
    description: 'Commission-free US equities and ETFs with fractional share support.',
    badge: 'AL',
    badgeColor: 'text-green',
  },
  ibkr: {
    ...IbkrBroker,
    name: 'IBKR (Interactive Brokers)',
    description: 'Professional-grade trading via TWS or IB Gateway. Stocks, options, futures, bonds.',
    badge: 'IB',
    badgeColor: 'text-orange-400',
  },
}
