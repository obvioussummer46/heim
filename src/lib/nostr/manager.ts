'use client';

import { SimplePool, type Event, type Filter } from 'nostr-tools';
import type { SubCloser } from 'nostr-tools/abstract-pool';
import { matchesCells } from '../geo';
import {
  KIND_CALENDAR_DATE,
  KIND_CALENDAR_TIME,
  KIND_GEO_CHAT,
  KIND_NOTE,
  KIND_PROFILE,
  KIND_REACTION,
  KIND_ZAP_RECEIPT,
} from './kinds';
import {
  useNostrStore,
  type CalendarEvent,
  type ChatMessage,
  type Note,
} from './nostrStore';
import { parseZapReceiptMsats } from './zapParse';

const GEO_DEBOUNCE_MS = 500; // merge rapid pan/zoom/precision changes into one re-subscribe
const META_DEBOUNCE_MS = 800; // batch #e meta lookups as notes stream in
const PROFILE_DEBOUNCE_MS = 600;
const META_MAX_IDS = 100; // meta filter covers the most recent N notes
const CHAT_LOOKBACK_S = 6 * 3600; // kind 20000 is ephemeral; only ask for the recent window

function tagValues(ev: Event, name: string): string[] {
  return ev.tags.filter((t) => t[0] === name && typeof t[1] === 'string').map((t) => t[1]);
}

function firstTag(ev: Event, name: string): string | null {
  return tagValues(ev, name)[0] ?? null;
}

/** Which of the scope's cells an event falls into (via its g tags), if any. */
function cellOf(gTags: string[], cells: string[]): string | null {
  for (const c of cells) if (gTags.some((t) => t.startsWith(c))) return c;
  return null;
}

/** Parse NIP-52 start: unix seconds (31923) or YYYY-MM-DD (31922). */
function parseCalStart(kind: number, value: string | null): number | null {
  if (!value) return null;
  if (kind === KIND_CALENDAR_TIME) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) ? ms / 1000 : null;
}

/**
 * The single subscription manager for the app.
 *
 * - one SimplePool (verifies signatures on every incoming event; invalid
 *   events never reach our handlers)
 * - geo-scoped subscriptions (chat / notes / calendar) are re-created,
 *   debounced, whenever the cell set or relay list changes
 * - all geo handlers apply a client-side g-tag check as a fallback for
 *   relays that don't index the #g filter and just return everything
 * - a secondary "meta" subscription follows the visible notes and pulls
 *   reactions (kind 7), replies (kind 1 with #e) and zap receipts (9735)
 * - kind-0 profiles are batch-fetched for any pubkey we encounter
 */
class NostrManager {
  private pool = new SimplePool();

  private relays: string[] = [];
  private cells: string[] = [];
  private myPubkey: string | null = null;

  private geoSubs: SubCloser[] = [];
  private geoTimer: ReturnType<typeof setTimeout> | null = null;

  private metaSub: SubCloser | null = null;
  private metaTimer: ReturnType<typeof setTimeout> | null = null;
  private metaIds: string[] = []; // newest-first note ids currently covered
  private seenMeta = new Set<string>(); // meta event ids already counted

  private profileSub: SubCloser | null = null;
  private profileTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingProfiles = new Set<string>();
  private knownProfiles = new Set<string>();

  private statusTimer: ReturnType<typeof setInterval> | null = null;

  // ── scope control ──────────────────────────────────────────────

  setMyPubkey(pk: string | null) {
    this.myPubkey = pk;
  }

  setScope(relays: string[], cells: string[]) {
    const relaysChanged = relays.join() !== this.relays.join();
    const cellsChanged = cells.join() !== this.cells.join();
    if (!relaysChanged && !cellsChanged) return;
    this.relays = [...relays];
    this.cells = [...cells];
    if (this.geoTimer) clearTimeout(this.geoTimer);
    this.geoTimer = setTimeout(() => this.resubscribeGeo(), GEO_DEBOUNCE_MS);
    if (!this.statusTimer && typeof window !== 'undefined') {
      this.statusTimer = setInterval(() => this.reportStatus(), 3000);
    }
  }

  private reportStatus() {
    let connected = 0;
    for (const [, ok] of this.pool.listConnectionStatus()) if (ok) connected++;
    useNostrStore.getState().setConnectedRelays(connected);
  }

  private resubscribeGeo() {
    for (const s of this.geoSubs) s.close();
    this.geoSubs = [];
    this.metaSub?.close();
    this.metaSub = null;
    this.metaIds = [];
    this.seenMeta = new Set();

    const { relays, cells } = this;
    const store = useNostrStore.getState();
    store.resetScope(cells.join(','));
    if (!relays.length || !cells.length) return;

    const now = Math.floor(Date.now() / 1000);

    const filters: Array<{ filter: Filter; onevent: (ev: Event) => void }> = [
      {
        filter: { kinds: [KIND_GEO_CHAT], '#g': cells, since: now - CHAT_LOOKBACK_S, limit: 200 },
        onevent: (ev) => this.onChat(ev),
      },
      {
        filter: { kinds: [KIND_NOTE], '#g': cells, limit: 100 },
        onevent: (ev) => this.onNote(ev),
      },
      {
        filter: { kinds: [KIND_CALENDAR_DATE, KIND_CALENDAR_TIME], '#g': cells, limit: 100 },
        onevent: (ev) => this.onCalendar(ev),
      },
    ];

    for (const { filter, onevent } of filters) {
      this.geoSubs.push(this.pool.subscribeMany(relays, filter, { onevent }));
    }
  }

  // ── geo event handlers (all include the client-side g fallback) ─

  private inScope(ev: Event): string[] | null {
    const g = tagValues(ev, 'g');
    // Fallback for relays that ignore #g: drop anything outside our cells.
    if (!matchesCells(g, this.cells)) return null;
    return g;
  }

  private onChat(ev: Event) {
    const g = this.inScope(ev);
    if (!g) return;
    const msg: ChatMessage = {
      id: ev.id,
      pubkey: ev.pubkey,
      content: ev.content,
      created_at: ev.created_at,
      nick: firstTag(ev, 'n'),
      geohash: g[g.length - 1] ?? null,
    };
    useNostrStore.getState().addChat(msg, cellOf(g, this.cells));
    this.wantProfile(ev.pubkey);
  }

  private onNote(ev: Event) {
    const g = this.inScope(ev);
    if (!g) return;
    const eTags = tagValues(ev, 'e');
    const note: Note = {
      id: ev.id,
      pubkey: ev.pubkey,
      content: ev.content,
      created_at: ev.created_at,
      gTags: g,
      replyTo: eTags.length ? eTags[eTags.length - 1] : null,
    };
    useNostrStore.getState().addNote(note, cellOf(g, this.cells));
    this.wantProfile(ev.pubkey);
    this.trackNoteForMeta(ev.id);
  }

  private onCalendar(ev: Event) {
    const g = this.inScope(ev);
    if (!g) return;
    const start = parseCalStart(ev.kind, firstTag(ev, 'start'));
    if (start == null) return;
    const end = parseCalStart(ev.kind, firstTag(ev, 'end'));
    const cal: CalendarEvent = {
      id: ev.id,
      pubkey: ev.pubkey,
      kind: ev.kind,
      d: firstTag(ev, 'd') ?? '',
      created_at: ev.created_at,
      title: firstTag(ev, 'title') ?? firstTag(ev, 'name') ?? 'Untitled event',
      content: ev.content,
      start,
      end,
      location: firstTag(ev, 'location'),
      gTags: g,
    };
    useNostrStore.getState().addCalendar(cal);
    this.wantProfile(ev.pubkey);
  }

  // ── meta (reactions / replies / zaps) for visible notes ────────

  private trackNoteForMeta(id: string) {
    if (this.metaIds.includes(id)) return;
    this.metaIds.unshift(id);
    if (this.metaIds.length > META_MAX_IDS) this.metaIds.length = META_MAX_IDS;
    if (this.metaTimer) clearTimeout(this.metaTimer);
    this.metaTimer = setTimeout(() => this.resubscribeMeta(), META_DEBOUNCE_MS);
  }

  private resubscribeMeta() {
    this.metaSub?.close();
    this.metaSub = null;
    if (!this.relays.length || !this.metaIds.length) return;
    const filter: Filter = {
      kinds: [KIND_NOTE, KIND_REACTION, KIND_ZAP_RECEIPT],
      '#e': [...this.metaIds],
    };
    this.metaSub = this.pool.subscribeMany(this.relays, filter, {
      onevent: (ev) => this.onMeta(ev),
    });
  }

  private onMeta(ev: Event) {
    if (this.seenMeta.has(ev.id)) return;
    this.seenMeta.add(ev.id);
    const store = useNostrStore.getState();
    const eTags = tagValues(ev, 'e');
    const target = eTags.length ? eTags[eTags.length - 1] : null;
    if (!target || !this.metaIds.includes(target)) return;
    if (ev.kind === KIND_REACTION) {
      if (ev.content === '-') return; // downvotes: ignore for MVP
      store.bumpMeta(target, {
        reactions: 1,
        reactedByMe: ev.pubkey === this.myPubkey ? true : undefined,
      });
    } else if (ev.kind === KIND_NOTE) {
      store.bumpMeta(target, { replies: 1 });
    } else if (ev.kind === KIND_ZAP_RECEIPT) {
      const msats = parseZapReceiptMsats(ev);
      if (msats > 0) store.bumpMeta(target, { zapMsats: msats });
    }
  }

  // ── profiles ────────────────────────────────────────────────────

  wantProfile(pubkey: string) {
    if (this.knownProfiles.has(pubkey) || this.pendingProfiles.has(pubkey)) return;
    this.pendingProfiles.add(pubkey);
    if (this.profileTimer) clearTimeout(this.profileTimer);
    this.profileTimer = setTimeout(() => this.flushProfiles(), PROFILE_DEBOUNCE_MS);
  }

  private flushProfiles() {
    if (!this.relays.length || !this.pendingProfiles.size) return;
    const authors = [...this.pendingProfiles].slice(0, 200);
    for (const a of authors) {
      this.pendingProfiles.delete(a);
      this.knownProfiles.add(a);
    }
    this.profileSub?.close();
    this.profileSub = this.pool.subscribeManyEose(
      this.relays,
      { kinds: [KIND_PROFILE], authors },
      {
        onevent: (ev: Event) => {
          try {
            const p = JSON.parse(ev.content);
            if (p && typeof p === 'object') {
              useNostrStore.getState().setProfile(ev.pubkey, {
                name: typeof p.name === 'string' ? p.name : undefined,
                display_name: typeof p.display_name === 'string' ? p.display_name : undefined,
                picture: typeof p.picture === 'string' ? p.picture : undefined,
                about: typeof p.about === 'string' ? p.about : undefined,
                nip05: typeof p.nip05 === 'string' ? p.nip05 : undefined,
                lud16: typeof p.lud16 === 'string' ? p.lud16 : undefined,
                lud06: typeof p.lud06 === 'string' ? p.lud06 : undefined,
              });
            }
          } catch {
            // unparseable profile — skip
          }
        },
      }
    );
  }

  /** Fetch a single profile and wait for it (used by the zap flow). */
  async fetchProfile(pubkey: string): Promise<Event | null> {
    return this.pool.get(this.relays, { kinds: [KIND_PROFILE], authors: [pubkey] });
  }

  // ── publishing ───────────────────────────────────────────────────

  /** Publish to all configured relays; resolves when any relay accepts. */
  async publish(event: Event): Promise<void> {
    if (!this.relays.length) throw new Error('No relays configured');
    const results = this.pool.publish(this.relays, event);
    try {
      await Promise.any(results);
    } catch {
      throw new Error('No relay accepted the event');
    }
  }
}

/** Singleton — the one NostrManager (and one SimplePool) for the app. */
export const nostr = new NostrManager();
