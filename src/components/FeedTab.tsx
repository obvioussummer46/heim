'use client';

import { useMemo } from 'react';
import { useNostrStore, type Note } from '@/lib/nostr/nostrStore';
import { NoteCard } from './NoteCard';

export function FeedTab({ onZap }: { onZap: (note: Note) => void }) {
  const notes = useNostrStore((s) => s.notes);

  const sorted = useMemo(
    () => [...notes.values()].sort((a, b) => b.created_at - a.created_at),
    [notes]
  );

  if (sorted.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center text-gray-500">
        <span className="text-3xl">📡</span>
        <p className="text-sm">
          No notes around here yet. Be the first — tap <span className="text-accent">＋</span> to
          post to this area.
        </p>
      </div>
    );
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto pb-24">
      {sorted.map((n) => (
        <NoteCard key={n.id} note={n} onZap={onZap} />
      ))}
    </div>
  );
}
