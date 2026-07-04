import ngeohash from 'ngeohash';

/**
 * Zoom levels map to geohash precision. A radius circle never aligns with
 * geohash cells, so "nearby" is always defined as the user's cell plus its
 * 8 neighbors at the chosen precision (see cellSet).
 */
export const PRECISIONS = [
  { value: 6, label: 'Block', hint: '~0.6 km' },
  { value: 5, label: 'Hood', hint: '~5 km' },
  { value: 4, label: 'City', hint: '~20 km' },
  { value: 3, label: 'Region', hint: '~150 km' },
] as const;

export type Precision = (typeof PRECISIONS)[number]['value'];

export const DEFAULT_PRECISION: Precision = 5;

export function encodeGeohash(lat: number, lon: number, precision: number): string {
  return ngeohash.encode(lat, lon, precision);
}

export function decodeGeohash(hash: string): { lat: number; lon: number } {
  const { latitude, longitude } = ngeohash.decode(hash);
  return { lat: latitude, lon: longitude };
}

/** [minLat, minLon, maxLat, maxLon] */
export function geohashBbox(hash: string): [number, number, number, number] {
  return ngeohash.decode_bbox(hash) as [number, number, number, number];
}

/**
 * The query unit for "nearby": the cell containing the position plus its
 * 8 neighbors at the given precision. Deduplicated (at poles neighbors
 * can collide) and sorted for stable comparison.
 */
export function cellSet(lat: number, lon: number, precision: number): string[] {
  const center = ngeohash.encode(lat, lon, precision);
  const cells = new Set<string>([center, ...ngeohash.neighbors(center)]);
  return [...cells].sort();
}

export function cellSetForHash(hash: string): string[] {
  const cells = new Set<string>([hash, ...ngeohash.neighbors(hash)]);
  return [...cells].sort();
}

/**
 * All prefixes of a geohash, longest first (e.g. u0yjb → u0yjb, u0yj, u0y, u0, u).
 * Published notes carry a ["g", p] tag for every prefix so that coarser zoom
 * levels (shorter geohash filters) still match them relay-side.
 */
export function geohashPrefixes(hash: string): string[] {
  const out: string[] = [];
  for (let i = hash.length; i >= 1; i--) out.push(hash.slice(0, i));
  return out;
}

/** ["g", ...] tags for publishing: full geohash plus all shorter prefixes. */
export function geohashTags(hash: string): string[][] {
  return geohashPrefixes(hash).map((p) => ['g', p]);
}

/**
 * Client-side fallback predicate for relays that don't index the g tag.
 * An event matches the cell set if any of its g tags is one of our cells
 * or is a finer-precision hash inside one of our cells (prefix match).
 */
export function matchesCells(gTags: string[], cells: string[]): boolean {
  return gTags.some((t) => cells.some((c) => t.startsWith(c)));
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
