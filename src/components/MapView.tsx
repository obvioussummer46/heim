'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cellSetForHash, decodeGeohash, encodeGeohash, geohashBbox } from '@/lib/geo';
import { useAppStore } from '@/lib/store';
import { useNostrStore } from '@/lib/nostr/nostrStore';

/**
 * Full-screen map overlay: shows the current cell + its 8 neighbors as
 * rectangles with per-cell activity counts. Tapping a cell (or anywhere
 * on the map) teleports there.
 */
export function MapView({ onClose }: { onClose: () => void }) {
  const location = useAppStore((s) => s.location);
  const geohash = useAppStore((s) => s.geohash);
  const precision = useAppStore((s) => s.precision);
  const setPosition = useAppStore((s) => s.setPosition);
  const cellActivity = useNostrStore((s) => s.cellActivity);

  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // create the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => {
      const p = useAppStore.getState().precision;
      const hash = encodeGeohash(e.latlng.lat, e.latlng.lng, p);
      const center = decodeGeohash(hash);
      useAppStore.getState().setPosition(center.lat, center.lon, 'teleport', `#${hash}`);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // (re)draw cells whenever position / precision / activity changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geohash) return;

    layerRef.current?.remove();
    const group = L.layerGroup().addTo(map);
    layerRef.current = group;

    const cells = cellSetForHash(geohash);
    const bounds = L.latLngBounds([]);

    for (const cell of cells) {
      const [minLat, minLon, maxLat, maxLon] = geohashBbox(cell);
      const cellBounds = L.latLngBounds([minLat, minLon], [maxLat, maxLon]);
      bounds.extend(cellBounds);
      const isCenter = cell === geohash;
      const count = cellActivity.get(cell) ?? 0;
      const rect = L.rectangle(cellBounds, {
        color: isCenter ? '#a78bfa' : '#6b7280',
        weight: isCenter ? 2 : 1,
        fillColor: '#a78bfa',
        fillOpacity: Math.min(0.08 + count * 0.04, 0.45),
      }).addTo(group);
      rect.bindTooltip(
        `<div style="text-align:center"><b>#${cell}</b>${
          count ? `<br/>${count} event${count === 1 ? '' : 's'}` : ''
        }</div>`,
        { direction: 'center', permanent: count > 0, className: 'cell-tip' }
      );
      rect.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        const center = decodeGeohash(cell);
        setPosition(center.lat, center.lon, 'teleport', `#${cell}`);
      });
    }

    // marker for the actual position
    if (location.lat != null && location.lon != null) {
      L.circleMarker([location.lat, location.lon], {
        radius: 6,
        color: '#fff',
        weight: 2,
        fillColor: '#a78bfa',
        fillOpacity: 1,
      }).addTo(group);
    }

    map.fitBounds(bounds.pad(0.08));
  }, [geohash, precision, cellActivity, location.lat, location.lon, setPosition]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-surface">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
        <div className="text-sm">
          <span className="font-semibold">Map</span>{' '}
          {geohash && <span className="font-mono text-xs text-gray-500">#{geohash}</span>}
          <span className="ml-2 text-xs text-gray-500">tap a cell to teleport</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg px-3 py-1 text-sm text-gray-300 hover:bg-white/5"
        >
          Done
        </button>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1" />
    </div>
  );
}
