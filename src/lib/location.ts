/** Browser geolocation + Nominatim place search (teleport / no-permission fallback). */

export interface Position {
  lat: number;
  lon: number;
}

export interface Place {
  name: string;
  lat: number;
  lon: number;
}

export function getCurrentPosition(timeoutMs = 12000): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not available'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 }
    );
  });
}

export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`Place search failed (${resp.status})`);
  const data: Array<{ display_name: string; lat: string; lon: string }> = await resp.json();
  return data.map((d) => ({
    name: d.display_name,
    lat: parseFloat(d.lat),
    lon: parseFloat(d.lon),
  }));
}

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14`;
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return null;
    const data = await resp.json();
    const a = data.address || {};
    return (
      a.suburb || a.neighbourhood || a.city_district || a.village || a.town || a.city || null
    );
  } catch {
    return null;
  }
}
