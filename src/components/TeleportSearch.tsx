'use client';

import { useEffect, useRef, useState } from 'react';
import { searchPlaces, type Place } from '@/lib/location';
import { useAppStore } from '@/lib/store';

/**
 * Place search — used both as the no-geolocation fallback and as the
 * "teleport" feature: browse any place's feed without being there.
 */
export function TeleportSearch({ onDone, showGpsRetry }: { onDone: () => void; showGpsRetry?: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setPosition = useAppStore((s) => s.setPosition);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        setResults(await searchPlaces(q));
      } catch {
        setError('Search failed — check your connection.');
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  function pick(place: Place) {
    const shortName = place.name.split(',')[0];
    setPosition(place.lat, place.lon, 'teleport', shortName);
    onDone();
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a city, neighborhood, place…"
        className="w-full rounded-xl border border-white/10 bg-surface-raised px-4 py-3 text-sm outline-none focus:border-accent/60"
      />
      {searching && <div className="px-1 text-xs text-gray-500">Searching…</div>}
      {error && <div className="px-1 text-xs text-rose-400">{error}</div>}
      <ul className="flex flex-col gap-1">
        {results.map((r, i) => (
          <li key={i}>
            <button
              onClick={() => pick(r)}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/5"
            >
              📍 {r.name}
            </button>
          </li>
        ))}
      </ul>
      {showGpsRetry && (
        <button onClick={showGpsRetry} className="text-left text-xs text-accent underline">
          Try my location again
        </button>
      )}
    </div>
  );
}
