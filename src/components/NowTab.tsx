'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { clockTime } from '@/lib/time';
import { displayName, useNostrStore } from '@/lib/nostr/nostrStore';
import { publishChat } from '@/lib/nostr/publish';
import { pubkeyHue } from './Avatar';
import { RichText } from './RichText';

/**
 * IRC-style live chat for the current geohash. Kind 20000 ephemeral events,
 * compatible with bitchat / Nymchat: ["g", geohash] + optional ["n", nick].
 */
export function NowTab() {
  const chat = useNostrStore((s) => s.chat);
  const profiles = useNostrStore((s) => s.profiles);
  const geohash = useAppStore((s) => s.geohash);
  const nickname = useAppStore((s) => s.nickname);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const messages = useMemo(
    () => [...chat.values()].sort((a, b) => a.created_at - b.created_at),
    [chat]
  );

  useEffect(() => {
    if (stickToBottom.current) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  async function send() {
    const content = text.trim();
    if (!content || !geohash || busy) return;
    setBusy(true);
    setError(null);
    try {
      await publishChat(content, geohash, nickname || undefined);
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-2"
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-gray-500">
            <span className="text-3xl">👋</span>
            <p className="text-sm">
              Nobody&apos;s chatting in <span className="font-mono">#{geohash}</span> right now.
              <br />
              Say something — anyone nearby (incl. bitchat users) will see it.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="py-1 text-[14px] leading-snug">
              <span className="mr-2 font-mono text-[11px] text-gray-600">
                {clockTime(m.created_at)}
              </span>
              <span
                className="mr-2 font-semibold"
                style={{ color: `hsl(${pubkeyHue(m.pubkey)} 65% 70%)` }}
              >
                {displayName(m.pubkey, profiles, m.nick)}
              </span>
              <RichText content={m.content} />
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div className="px-4 pb-1 text-xs text-rose-400">{error}</div>}

      <div className="flex gap-2 border-t border-white/5 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={geohash ? `Message #${geohash}` : 'Locating…'}
          disabled={!geohash}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent/60"
        />
        <button
          onClick={send}
          disabled={busy || !text.trim() || !geohash}
          className="rounded-xl bg-accent-dim px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
