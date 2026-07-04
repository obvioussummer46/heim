'use client';

import { useEffect } from 'react';
import { useAppStore } from '../store';
import { useIdentity } from './identity';
import { nostr } from './manager';

/**
 * Wires the app store to the subscription manager: whenever the relay list,
 * the cell set (position/precision), or the identity changes, the manager
 * re-scopes its subscriptions (debounced internally).
 */
export function useNostrSync() {
  const relays = useAppStore((s) => s.relays);
  const cells = useAppStore((s) => s.cells);
  const pubkey = useIdentity((s) => s.pubkey);
  const initIdentity = useIdentity((s) => s.init);

  useEffect(() => {
    initIdentity();
  }, [initIdentity]);

  useEffect(() => {
    nostr.setMyPubkey(pubkey);
  }, [pubkey]);

  useEffect(() => {
    nostr.setScope(relays, cells);
  }, [relays, cells]);
}
