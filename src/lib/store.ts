'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_PRECISION, type Precision, cellSet, encodeGeohash } from './geo';

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://offchain.pub',
  'wss://nostr.wine',
];

export type Tab = 'now' | 'feed' | 'events';

export type LocationSource = 'gps' | 'teleport' | 'none';

interface LocationState {
  lat: number | null;
  lon: number | null;
  source: LocationSource;
  placeName: string | null;
  geoDenied: boolean;
}

interface AppState {
  // location
  location: LocationState;
  precision: Precision;
  setPosition: (lat: number, lon: number, source: LocationSource, placeName?: string | null) => void;
  setGeoDenied: (denied: boolean) => void;
  setPrecision: (p: Precision) => void;

  // derived (recomputed on every position/precision change)
  geohash: string | null; // user's cell at current precision
  cells: string[]; // cell + 8 neighbors — the query unit

  // ui
  tab: Tab;
  setTab: (t: Tab) => void;
  mapOpen: boolean;
  setMapOpen: (open: boolean) => void;
  composeOpen: boolean;
  setComposeOpen: (open: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;

  // settings (persisted)
  relays: string[];
  setRelays: (relays: string[]) => void;
  nickname: string;
  setNickname: (n: string) => void;
}

function derive(loc: { lat: number | null; lon: number | null }, precision: Precision) {
  if (loc.lat == null || loc.lon == null) return { geohash: null, cells: [] as string[] };
  return {
    geohash: encodeGeohash(loc.lat, loc.lon, precision),
    cells: cellSet(loc.lat, loc.lon, precision),
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      location: { lat: null, lon: null, source: 'none', placeName: null, geoDenied: false },
      precision: DEFAULT_PRECISION,
      geohash: null,
      cells: [],

      setPosition: (lat, lon, source, placeName = null) =>
        set((s) => ({
          location: { ...s.location, lat, lon, source, placeName },
          ...derive({ lat, lon }, s.precision),
        })),
      setGeoDenied: (denied) => set((s) => ({ location: { ...s.location, geoDenied: denied } })),
      setPrecision: (precision) =>
        set((s) => ({ precision, ...derive(s.location, precision) })),

      tab: 'feed',
      setTab: (tab) => set({ tab }),
      mapOpen: false,
      setMapOpen: (mapOpen) => set({ mapOpen }),
      composeOpen: false,
      setComposeOpen: (composeOpen) => set({ composeOpen }),
      settingsOpen: false,
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),

      relays: DEFAULT_RELAYS,
      setRelays: (relays) => set({ relays: relays.filter((r) => r.startsWith('wss://') || r.startsWith('ws://')) }),
      nickname: '',
      setNickname: (nickname) => set({ nickname }),
    }),
    {
      name: 'localstr-settings',
      // Only persist user settings — location/UI state is per-session.
      partialize: (s) => ({ relays: s.relays, nickname: s.nickname, precision: s.precision }),
    }
  )
);
