import type { Event } from 'nostr-tools';

/**
 * Extract the amount in millisats from a NIP-57 zap receipt (kind 9735).
 * Primary source: the bolt11 invoice's human-readable amount. Fallback:
 * the ["amount", msats] tag inside the embedded zap request (description).
 */
export function parseZapReceiptMsats(receipt: Event): number {
  const bolt11 = receipt.tags.find((t) => t[0] === 'bolt11')?.[1];
  if (bolt11) {
    const msats = bolt11AmountMsats(bolt11);
    if (msats > 0) return msats;
  }
  const desc = receipt.tags.find((t) => t[0] === 'description')?.[1];
  if (desc) {
    try {
      const zapRequest = JSON.parse(desc);
      const amount = zapRequest?.tags?.find?.((t: string[]) => t[0] === 'amount')?.[1];
      const n = parseInt(amount, 10);
      if (Number.isFinite(n) && n > 0) return n;
    } catch {
      // malformed description — ignore
    }
  }
  return 0;
}

/** Millisats per 1 unit of each bolt11 amount multiplier (base: 1 BTC = 1e11 msat). */
const MULTIPLIER_MSATS: Record<string, number> = {
  m: 1e8, // milli-BTC
  u: 1e5, // micro-BTC
  n: 1e2, // nano-BTC
  p: 0.1, // pico-BTC
};

export function bolt11AmountMsats(invoice: string): number {
  const m = /^ln(?:bc|tb|tbs|bcrt)(\d+)([munp]?)1/i.exec(invoice.trim());
  if (!m) return 0;
  const value = parseInt(m[1], 10);
  if (!Number.isFinite(value)) return 0;
  const mult = m[2] ? MULTIPLIER_MSATS[m[2].toLowerCase()] : 1e11;
  return Math.round(value * mult);
}

export function formatSats(msats: number): string {
  const sats = Math.floor(msats / 1000);
  if (sats >= 1_000_000) return `${(sats / 1_000_000).toFixed(1)}M`;
  if (sats >= 1_000) return `${(sats / 1_000).toFixed(1)}k`;
  return String(sats);
}
