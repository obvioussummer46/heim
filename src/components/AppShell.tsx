'use client';

import { useCallback, useEffect, useState } from 'react';
import { getCurrentPosition, reverseGeocode } from '@/lib/location';
import { useAppStore, type Tab } from '@/lib/store';
import { useNostrSync } from '@/lib/nostr/useNostrSync';
import { useNostrStore, type Note } from '@/lib/nostr/nostrStore';
import { FeedTab } from './FeedTab';
import { PrecisionSelector } from './PrecisionSelector';
import { TeleportSearch } from './TeleportSearch';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'now', label: 'Now', icon: '💬' },
  { id: 'feed', label: 'Feed', icon: '📰' },
  { id: 'events', label: 'Events', icon: '📅' },
];

export default function AppShell() {
  useNostrSync();

  const location = useAppStore((s) => s.location);
  const geohash = useAppStore((s) => s.geohash);
  const setPosition = useAppStore((s) => s.setPosition);
  const setGeoDenied = useAppStore((s) => s.setGeoDenied);
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);
  const setMapOpen = useAppStore((s) => s.setMapOpen);
  const setComposeOpen = useAppStore((s) => s.setComposeOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const connectedRelays = useNostrStore((s) => s.connectedRelays);

  const [teleportOpen, setTeleportOpen] = useState(false);
  const [zapTarget, setZapTarget] = useState<Note | null>(null);

  const locate = useCallback(async () => {
    try {
      const pos = await getCurrentPosition();
      setPosition(pos.lat, pos.lon, 'gps');
      setGeoDenied(false);
      const name = await reverseGeocode(pos.lat, pos.lon);
      if (name) setPosition(pos.lat, pos.lon, 'gps', name);
    } catch {
      setGeoDenied(true);
    }
  }, [setPosition, setGeoDenied]);

  useEffect(() => {
    if (location.source === 'none') locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasLocation = location.lat != null;

  const onZap = useCallback((note: Note) => setZapTarget(note), []);

  return (
    <div className="mx-auto flex h-dvh max-w-lg flex-col">
      {/* header */}
      <header className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
        <span className="text-lg font-bold tracking-tight text-accent">localstr</span>
        <button
          onClick={() => setTeleportOpen(true)}
          className="min-w-0 flex-1 truncate rounded-lg px-2 py-1 text-left text-sm text-gray-300 hover:bg-white/5"
          title="Teleport to another place"
        >
          {hasLocation ? (
            <>
              <span className="truncate">
                {location.placeName ?? (location.source === 'gps' ? 'Here' : 'Somewhere')}
              </span>{' '}
              {geohash && <span className="font-mono text-xs text-gray-500">#{geohash}</span>}
            </>
          ) : (
            <span className="text-gray-500">Set location…</span>
          )}
        </button>
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            connectedRelays > 0 ? 'bg-emerald-400' : 'bg-rose-500'
          }`}
          title={`${connectedRelays} relays connected`}
        />
        <button
          onClick={() => setMapOpen(true)}
          className="rounded-lg p-1.5 text-lg hover:bg-white/5"
          aria-label="Map"
        >
          🗺️
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="rounded-lg p-1.5 text-lg hover:bg-white/5"
          aria-label="Settings"
        >
          ⚙️
        </button>
      </header>

      <PrecisionSelector />

      {/* content */}
      <main className="relative min-h-0 flex-1">
        {!hasLocation ? (
          <div className="flex h-full flex-col justify-center gap-4 px-6">
            <div className="text-center">
              <div className="text-4xl">🌍</div>
              <h1 className="mt-2 text-lg font-semibold">What&apos;s happening around you?</h1>
              <p className="mt-1 text-sm text-gray-500">
                {location.geoDenied
                  ? 'Location unavailable — search a place to browse its feed instead.'
                  : 'Getting your location…'}
              </p>
            </div>
            {location.geoDenied && <TeleportSearch onDone={() => {}} showGpsRetry={locate} />}
          </div>
        ) : (
          <>
            {tab === 'feed' && <FeedTab onZap={onZap} />}
            {tab === 'now' && <ComingSoon label="Local chat" />}
            {tab === 'events' && <ComingSoon label="Nearby events" />}
          </>
        )}

        {/* compose FAB */}
        {hasLocation && (
          <button
            onClick={() => setComposeOpen(true)}
            className="absolute bottom-4 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-dim text-2xl text-white shadow-lg shadow-black/40 hover:bg-accent"
            aria-label="Compose"
          >
            ＋
          </button>
        )}
      </main>

      {/* bottom tabs */}
      <nav className="flex border-t border-white/5 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
              tab === t.id ? 'text-accent' : 'text-gray-500'
            }`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {/* teleport modal */}
      {teleportOpen && (
        <Modal onClose={() => setTeleportOpen(false)} title="Teleport">
          <TeleportSearch onDone={() => setTeleportOpen(false)} showGpsRetry={() => { locate(); setTeleportOpen(false); }} />
        </Modal>
      )}

      {/* zap modal placeholder — wired up in the zaps stage */}
      {zapTarget && (
        <Modal onClose={() => setZapTarget(null)} title="Zap">
          <p className="text-sm text-gray-400">Zaps coming in a later build step.</p>
        </Modal>
      )}
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-gray-600">
      {label} — under construction
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface-raised p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-white/5" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
