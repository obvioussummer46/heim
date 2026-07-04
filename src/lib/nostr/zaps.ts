'use client';

import { nip57, type Event } from 'nostr-tools';
import { useAppStore } from '../store';
import { useIdentity } from './identity';
import { nostr } from './manager';

export interface ZapInvoice {
  pr: string;
}

/**
 * NIP-57 zap flow up to the invoice:
 * 1. fetch the recipient's kind-0 profile
 * 2. resolve the LNURL pay endpoint from lud16/lud06 and verify it
 *    supports Nostr zaps (allowsNostr + nostrPubkey)
 * 3. build + sign a kind-9734 zap request
 * 4. request an invoice for the amount with the zap request attached
 *
 * Payment is then done by the caller via WebLN or by showing the invoice QR.
 */
export async function requestZapInvoice(
  target: Event | { id: string; pubkey: string; kind?: number; content?: string; tags?: string[][]; created_at?: number },
  amountSats: number,
  comment: string
): Promise<ZapInvoice> {
  const metadata = await nostr.fetchProfile(target.pubkey);
  if (!metadata) throw new Error("Couldn't load the author's profile");

  const callback = await nip57.getZapEndpoint(metadata);
  if (!callback) throw new Error("This user can't receive zaps (no lightning address)");

  const amountMsats = Math.round(amountSats * 1000);
  const relays = useAppStore.getState().relays;

  const zapRequestTmpl = nip57.makeZapRequest({
    event: {
      id: target.id,
      pubkey: target.pubkey,
      kind: target.kind ?? 1,
      content: target.content ?? '',
      tags: target.tags ?? [],
      created_at: target.created_at ?? Math.floor(Date.now() / 1000),
      sig: '',
    } as Event,
    amount: amountMsats,
    comment,
    relays,
  });
  const signed = await useIdentity.getState().sign(zapRequestTmpl);

  const url = `${callback}${callback.includes('?') ? '&' : '?'}amount=${amountMsats}&nostr=${encodeURIComponent(
    JSON.stringify(signed)
  )}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Invoice request failed (${resp.status})`);
  const data = await resp.json();
  if (data.status === 'ERROR' || !data.pr) {
    throw new Error(data.reason || 'The lightning service returned no invoice');
  }
  return { pr: data.pr as string };
}

/** Try paying with WebLN. Returns true if the payment went through. */
export async function payWithWebln(pr: string): Promise<boolean> {
  if (typeof window === 'undefined' || !window.webln) return false;
  try {
    await window.webln.enable();
    await window.webln.sendPayment(pr);
    return true;
  } catch {
    return false;
  }
}
