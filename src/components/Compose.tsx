'use client';

import { useState } from 'react';
import { PRECISIONS } from '@/lib/geo';
import { useAppStore } from '@/lib/store';
import { publishChat, publishNote } from '@/lib/nostr/publish';

/**
 * Compose sheet: post a kind-1 note (tagged with the geohash at the current
 * precision plus all shorter prefixes) or a kind-20000 chat message.
 */
export function Compose({ onClose }: { onClose: () => void }) {
  const geohash = useAppStore((s) => s.geohash);
  const precision = useAppStore((s) => s.precision);
  const nickname = useAppStore((s) => s.nickname);
  const setTab = useAppStore((s) => s.setTab);
  const [mode, setMode] = useState<'note' | 'chat'>('note');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const precisionLabel = PRECISIONS.find((p) => p.value === precision)?.label ?? '';

  async function submit() {
    const content = text.trim();
    if (!content || !geohash || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'note') {
        await publishNote(content, geohash);
        setTab('feed');
      } else {
        await publishChat(content, geohash, nickname || undefined);
        setTab('now');
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to publish');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-xl bg-white/5 p-1">
        {(
          [
            ['note', '📰 Note'],
            ['chat', '💬 Chat'],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium ${
              mode === m ? 'bg-accent-dim text-white' : 'text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={
          mode === 'note' ? "What's happening around here?" : `Say hi to #${geohash ?? '…'}`
        }
        className="w-full resize-none rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-[15px] outline-none focus:border-accent/60"
      />

      <p className="text-xs text-gray-500">
        {mode === 'note' ? (
          <>
            Posts to <span className="font-mono text-gray-400">#{geohash}</span> ({precisionLabel})
            and every coarser zoom level.
          </>
        ) : (
          <>
            Ephemeral chat in <span className="font-mono text-gray-400">#{geohash}</span> — visible
            to bitchat users too{nickname ? ` as “${nickname}”` : ''}.
          </>
        )}
      </p>

      {error && <div className="text-xs text-rose-400">{error}</div>}

      <button
        onClick={submit}
        disabled={busy || !text.trim() || !geohash}
        className="rounded-xl bg-accent-dim py-2.5 font-medium text-white disabled:opacity-40"
      >
        {busy ? 'Publishing…' : mode === 'note' ? 'Post note' : 'Send chat'}
      </button>
    </div>
  );
}
