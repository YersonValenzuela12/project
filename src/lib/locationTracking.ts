import { supabase } from './supabase';

type Source = 'LOGIN' | 'ATTENDANCE' | 'OTHER';

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
      { headers: { 'Accept-Language': 'es' } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address ?? {};
    return addr.suburb || addr.city_district || addr.town || addr.city || addr.county || null;
  } catch {
    return null;
  }
}

function getCurrentPosition(): Promise<{ lat: number; lng: number; accuracy?: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Geolocation not supported')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

/**
 * Records the user's current location, silently, without disrupting whatever
 * flow called it (login, attendance, etc.). Reuses already-obtained
 * coordinates when passed in, to avoid asking the browser for GPS twice.
 */
export async function recordUserLocation(
  userId: string,
  source: Source,
  coords?: { lat: number; lng: number; accuracy?: number },
) {
  try {
    const position = coords ?? await getCurrentPosition();
    const district = await reverseGeocode(position.lat, position.lng);
    await supabase.from('user_locations').insert({
      user_id: userId,
      latitude: position.lat,
      longitude: position.lng,
      gps_accuracy: position.accuracy ?? null,
      district,
      source,
    });
  } catch (e) {
    // Never block the calling flow (login, check-in) just because location failed.
    console.error('No se pudo registrar la ubicación:', e);
  }
}
