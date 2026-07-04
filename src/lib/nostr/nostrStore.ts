'use client';

import { create } from 'zustand';
import type { Event } from 'nostr-tools';

/** Parsed kind-0 profile metadata. */
export interface Profile {
  name?: string;
  display_name?: string;
  picture?: string;
  about?: string;
  nip05?: string;
  lud16?: string;
  lud06?: string;
}

export interface ChatMessage {
  id: string;
  pubkey: string;
  content: string;
  created_at: number;
  nick: string | null;
  geohash: string | null;
}

export interface Note {
  id: string;
  pubkey: string;
  content: string;
  created_at: number;
  gTags: string[];
  /** id of the note this replies to (last e tag), if any */
  replyTo: string | null;
}

export interface CalendarEvent {
  id: string;
  pubkey: string;
  kind: number;
  d: string;
  created_at: number;
  title: string;
  content: string;
  /** unix seconds (31923) or YYYY-MM-DD parsed to unix seconds (31922) */
  start: number;
  end: number | null;
  location: string | null;
  gTags: string[];
}

export interface NoteMeta {
  reactions: number;
  replies: number;
  zapMsats: number;
  reactedByMe: boolean;
}

interface NostrState {
  /** identifies the current geo scope; stores are cleared when it changes */
  scopeKey: string;
  connectedRelays: number;

  chat: Map<string, ChatMessage>;
  notes: Map<string, Note>;
  calendar: Map<string, CalendarEvent>;
  meta: Map<string, NoteMeta>;
  profiles: Map<string, Profile>;
  /** events per cell (current scope) for the map activity indicators */
  cellActivity: Map<string, number>;

  resetScope: (scopeKey: string) => void;
  addChat: (m: ChatMessage, cell: string | null) => void;
  addNote: (n: Note, cell: string | null) => void;
  addCalendar: (e: CalendarEvent) => void;
  bumpMeta: (noteId: string, patch: Partial<NoteMeta>) => void;
  setProfile: (pubkey: string, p: Profile) => void;
  setConnectedRelays: (n: number) => void;
}

const EMPTY_META: NoteMeta = { reactions: 0, replies: 0, zapMsats: 0, reactedByMe: false };

function bumpCell(activity: Map<string, number>, cell: string | null): Map<string, number> {
  if (!cell) return activity;
  const next = new Map(activity);
  next.set(cell, (next.get(cell) ?? 0) + 1);
  return next;
}

export const useNostrStore = create<NostrState>()((set) => ({
  scopeKey: '',
  connectedRelays: 0,
  chat: new Map(),
  notes: new Map(),
  calendar: new Map(),
  meta: new Map(),
  profiles: new Map(),
  cellActivity: new Map(),

  resetScope: (scopeKey) =>
    set({
      scopeKey,
      chat: new Map(),
      notes: new Map(),
      calendar: new Map(),
      meta: new Map(),
      cellActivity: new Map(),
    }),

  addChat: (m, cell) =>
    set((s) => {
      if (s.chat.has(m.id)) return s;
      const chat = new Map(s.chat);
      chat.set(m.id, m);
      return { chat, cellActivity: bumpCell(s.cellActivity, cell) };
    }),

  addNote: (n, cell) =>
    set((s) => {
      if (s.notes.has(n.id)) return s;
      const notes = new Map(s.notes);
      notes.set(n.id, n);
      return { notes, cellActivity: bumpCell(s.cellActivity, cell) };
    }),

  addCalendar: (e) =>
    set((s) => {
      if (s.calendar.has(e.id)) return s;
      // addressable events: keep only the newest per (kind, pubkey, d)
      const addr = `${e.kind}:${e.pubkey}:${e.d}`;
      const existing = [...s.calendar.values()].find(
        (c) => `${c.kind}:${c.pubkey}:${c.d}` === addr
      );
      if (existing && existing.created_at >= e.created_at) return s;
      const calendar = new Map(s.calendar);
      if (existing) calendar.delete(existing.id);
      calendar.set(e.id, e);
      return { calendar };
    }),

  bumpMeta: (noteId, patch) =>
    set((s) => {
      const meta = new Map(s.meta);
      const cur = meta.get(noteId) ?? EMPTY_META;
      meta.set(noteId, {
        reactions: cur.reactions + (patch.reactions ?? 0),
        replies: cur.replies + (patch.replies ?? 0),
        zapMsats: cur.zapMsats + (patch.zapMsats ?? 0),
        reactedByMe: patch.reactedByMe ?? cur.reactedByMe,
      });
      return { meta };
    }),

  setProfile: (pubkey, p) =>
    set((s) => {
      const profiles = new Map(s.profiles);
      profiles.set(pubkey, p);
      return { profiles };
    }),

  setConnectedRelays: (connectedRelays) => set({ connectedRelays }),
}));

export function displayName(pubkey: string, profiles: Map<string, Profile>, fallback?: string | null): string {
  const p = profiles.get(pubkey);
  return p?.display_name || p?.name || fallback || `${pubkey.slice(0, 8)}…`;
}

export { type Event };
