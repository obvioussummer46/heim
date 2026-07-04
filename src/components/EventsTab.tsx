'use client';

import { useMemo } from 'react';
import { eventDate } from '@/lib/time';
import { KIND_CALENDAR_TIME } from '@/lib/nostr/kinds';
import { displayName, useNostrStore } from '@/lib/nostr/nostrStore';
import { Avatar } from './Avatar';
import { RichText } from './RichText';

/** NIP-52 calendar events (31922/31923) nearby, upcoming first. */
export function EventsTab() {
  const calendar = useNostrStore((s) => s.calendar);

  const { upcoming, past } = useMemo(() => {
    const all = [...calendar.values()].sort((a, b) => a.start - b.start);
    const now = Date.now() / 1000;
    return {
      upcoming: all.filter((e) => (e.end ?? e.start + 86400) >= now),
      past: all.filter((e) => (e.end ?? e.start + 86400) < now).reverse(),
    };
  }, [calendar]);

  if (upcoming.length === 0 && past.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center text-gray-500">
        <span className="text-3xl">📅</span>
        <p className="text-sm">
          No calendar events tagged to this area yet. Events published with NIP-52 + geohash tags
          will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto px-4 pb-24 pt-2">
      {upcoming.length > 0 && (
        <>
          <h3 className="px-1 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Upcoming nearby
          </h3>
          {upcoming.map((e) => (
            <EventCard key={e.id} evId={e.id} />
          ))}
        </>
      )}
      {past.length > 0 && (
        <>
          <h3 className="px-1 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
            Past
          </h3>
          {past.map((e) => (
            <EventCard key={e.id} evId={e.id} dim />
          ))}
        </>
      )}
    </div>
  );
}

function EventCard({ evId, dim }: { evId: string; dim?: boolean }) {
  const e = useNostrStore((s) => s.calendar.get(evId));
  const profiles = useNostrStore((s) => s.profiles);
  if (!e) return null;
  const withTime = e.kind === KIND_CALENDAR_TIME;
  return (
    <div
      className={`mb-2 rounded-xl border border-white/5 bg-surface-raised p-3 ${
        dim ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold leading-snug">{e.title}</h4>
        <span className="shrink-0 rounded bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
          {eventDate(e.start, withTime)}
        </span>
      </div>
      {e.location && <div className="mt-1 text-xs text-gray-400">📍 {e.location}</div>}
      {e.content && (
        <div className="mt-1.5 line-clamp-4 text-sm text-gray-300">
          <RichText content={e.content} />
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
        <Avatar pubkey={e.pubkey} picture={profiles.get(e.pubkey)?.picture} size={18} />
        {displayName(e.pubkey, profiles)}
        {e.end && <span>· until {eventDate(e.end, withTime)}</span>}
      </div>
    </div>
  );
}
