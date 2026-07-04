'use client';

import type { EventTemplate } from 'nostr-tools';
import { geohashTags } from '../geo';
import { useIdentity } from './identity';
import { KIND_GEO_CHAT, KIND_NOTE, KIND_REACTION } from './kinds';
import { nostr } from './manager';

function now(): number {
  return Math.floor(Date.now() / 1000);
}

async function signAndPublish(tmpl: EventTemplate): Promise<void> {
  const signed = await useIdentity.getState().sign(tmpl);
  await nostr.publish(signed);
}

/**
 * Post a kind-1 note tagged with the full geohash AND every shorter prefix,
 * so filters at coarser precisions still match relay-side.
 */
export async function publishNote(content: string, geohash: string): Promise<void> {
  await signAndPublish({
    kind: KIND_NOTE,
    content,
    tags: geohashTags(geohash),
    created_at: now(),
  });
}

/** Reply to a note: kind 1 with NIP-10 e/p tags plus our geo tags. */
export async function publishReply(
  content: string,
  parent: { id: string; pubkey: string },
  geohash: string
): Promise<void> {
  await signAndPublish({
    kind: KIND_NOTE,
    content,
    tags: [
      ['e', parent.id, '', 'root'],
      ['p', parent.pubkey],
      ...geohashTags(geohash),
    ],
    created_at: now(),
  });
}

/**
 * Send an ephemeral geo chat message (kind 20000, bitchat-compatible):
 * single ["g", geohash] tag at the current precision, optional ["n", nick].
 */
export async function publishChat(content: string, geohash: string, nick?: string): Promise<void> {
  const tags: string[][] = [['g', geohash]];
  if (nick) tags.push(['n', nick]);
  await signAndPublish({ kind: KIND_GEO_CHAT, content, tags, created_at: now() });
}

/** NIP-25 reaction ("+") to a note. */
export async function publishReaction(target: { id: string; pubkey: string }): Promise<void> {
  await signAndPublish({
    kind: KIND_REACTION,
    content: '+',
    tags: [
      ['e', target.id],
      ['p', target.pubkey],
    ],
    created_at: now(),
  });
}
