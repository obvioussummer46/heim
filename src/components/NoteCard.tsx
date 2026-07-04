'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { timeAgo } from '@/lib/time';
import { displayName, useNostrStore, type Note, type NoteMeta } from '@/lib/nostr/nostrStore';
import { publishReaction, publishReply } from '@/lib/nostr/publish';
import { formatSats } from '@/lib/nostr/zapParse';
import { Avatar } from './Avatar';
import { RichText } from './RichText';

const EMPTY_META: NoteMeta = { reactions: 0, replies: 0, zapMsats: 0, reactedByMe: false };

export function NoteCard({ note, onZap }: { note: Note; onZap: (note: Note) => void }) {
  const profiles = useNostrStore((s) => s.profiles);
  const meta = useNostrStore((s) => s.meta.get(note.id)) ?? EMPTY_META;
  const geohash = useAppStore((s) => s.geohash);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = profiles.get(note.pubkey);
  const finestG = note.gTags.reduce((a, b) => (b.length > a.length ? b : a), '');

  async function react() {
    if (meta.reactedByMe || busy) return;
    setBusy(true);
    setError(null);
    try {
      await publishReaction(note);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to react');
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    const text = replyText.trim();
    if (!text || !geohash || busy) return;
    setBusy(true);
    setError(null);
    try {
      await publishReply(text, note, geohash);
      setReplyText('');
      setReplyOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reply');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="border-b border-white/5 px-4 py-3">
      <div className="flex gap-3">
        <Avatar pubkey={note.pubkey} picture={profile?.picture} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 text-sm">
            <span className="truncate font-semibold">{displayName(note.pubkey, profiles)}</span>
            <span className="shrink-0 text-gray-500">{timeAgo(note.created_at)}</span>
            {finestG && (
              <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
                #{finestG}
              </span>
            )}
          </div>
          {note.replyTo && (
            <div className="text-xs text-gray-500">↩ replying to {note.replyTo.slice(0, 8)}…</div>
          )}
          <div className="mt-1 text-[15px] leading-relaxed text-gray-100">
            <RichText content={note.content} />
          </div>

          <div className="mt-2 flex items-center gap-5 text-sm text-gray-400">
            <button
              onClick={() => setReplyOpen((v) => !v)}
              className="flex items-center gap-1.5 hover:text-gray-200"
              aria-label="Reply"
            >
              <span>💬</span>
              {meta.replies > 0 && <span>{meta.replies}</span>}
            </button>
            <button
              onClick={react}
              disabled={meta.reactedByMe || busy}
              className={`flex items-center gap-1.5 ${
                meta.reactedByMe ? 'text-rose-400' : 'hover:text-rose-300'
              }`}
              aria-label="React"
            >
              <span>{meta.reactedByMe ? '❤️' : '🤍'}</span>
              {meta.reactions > 0 && <span>{meta.reactions}</span>}
            </button>
            <button
              onClick={() => onZap(note)}
              className="flex items-center gap-1.5 hover:text-amber-300"
              aria-label="Zap"
            >
              <span>⚡</span>
              {meta.zapMsats > 0 && <span>{formatSats(meta.zapMsats)}</span>}
            </button>
          </div>

          {error && <div className="mt-1 text-xs text-rose-400">{error}</div>}

          {replyOpen && (
            <div className="mt-2 flex gap-2">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                placeholder="Write a reply…"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-surface-raised px-3 py-1.5 text-sm outline-none focus:border-accent/60"
              />
              <button
                onClick={sendReply}
                disabled={busy || !replyText.trim()}
                className="rounded-lg bg-accent-dim px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                Reply
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
