'use client';

import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
  type Event,
  type EventTemplate,
} from 'nostr-tools';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { create } from 'zustand';

export type SignMethod = 'nip07' | 'local';

interface Nip07 {
  getPublicKey(): Promise<string>;
  signEvent(event: EventTemplate & { pubkey?: string }): Promise<Event>;
}

declare global {
  interface Window {
    nostr?: Nip07;
    webln?: { enable(): Promise<void>; sendPayment(pr: string): Promise<unknown> };
  }
}

const LOCAL_KEY = 'localstr-local-sk';

/** Load (or lazily create) the local ephemeral secret key. */
function localSecretKey(): Uint8Array {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_KEY) : null;
  if (stored) {
    try {
      return hexToBytes(stored);
    } catch {
      // corrupted — fall through and regenerate
    }
  }
  const sk = generateSecretKey();
  localStorage.setItem(LOCAL_KEY, bytesToHex(sk));
  return sk;
}

export function hasNip07(): boolean {
  return typeof window !== 'undefined' && !!window.nostr;
}

export function npubOf(pubkey: string): string {
  return nip19.npubEncode(pubkey);
}

export function shortNpub(pubkey: string): string {
  const npub = nip19.npubEncode(pubkey);
  return `${npub.slice(0, 10)}…${npub.slice(-4)}`;
}

interface IdentityState {
  pubkey: string | null;
  method: SignMethod;
  /** Initialize with the local key (called once on mount). */
  init: () => void;
  /** Try to upgrade to the NIP-07 extension. */
  loginNip07: () => Promise<boolean>;
  /** Drop back to the local ephemeral key. */
  useLocalKey: () => void;
  /** Sign an event template with the active method. */
  sign: (tmpl: EventTemplate) => Promise<Event>;
}

export const useIdentity = create<IdentityState>()((set, get) => ({
  pubkey: null,
  method: 'local',

  init: () => {
    if (get().pubkey) return;
    const sk = localSecretKey();
    set({ pubkey: getPublicKey(sk), method: 'local' });
  },

  loginNip07: async () => {
    if (!hasNip07()) return false;
    try {
      const pk = await window.nostr!.getPublicKey();
      if (!/^[0-9a-f]{64}$/i.test(pk)) return false;
      set({ pubkey: pk.toLowerCase(), method: 'nip07' });
      return true;
    } catch {
      return false;
    }
  },

  useLocalKey: () => {
    const sk = localSecretKey();
    set({ pubkey: getPublicKey(sk), method: 'local' });
  },

  sign: async (tmpl) => {
    if (get().method === 'nip07' && hasNip07()) {
      return window.nostr!.signEvent(tmpl);
    }
    return finalizeEvent(tmpl, localSecretKey());
  },
}));
