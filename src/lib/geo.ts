export type Coords = { lat: number; lng: number; accuracy?: number };

// Reads the browser's current location permission WITHOUT asking for it.
export async function geolocationPermission(): Promise<'granted' | 'prompt' | 'denied' | 'unknown'> {
  try {
    if (!('permissions' in navigator)) return 'unknown';
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return status.state;
  } catch {
    return 'unknown';
  }
}

/**
 * Gets the current position ONLY if the person already allowed location.
 *
 * Background callers (the login record, work-order tracking) must never trigger a permission prompt:
 * asking without the person doing anything is what makes Chrome print the "permission prompt ignored
 * several times" warning and then block the site. The place that asks is the Asistencia page, where the
 * person opens it on purpose.
 *
 * Returns null, silently, when location is not available.
 */
export async function getPositionIfAllowed(): Promise<Coords | null> {
  if (!('geolocation' in navigator)) return null;

  const state = await geolocationPermission();
  if (state === 'denied' || state === 'prompt') return null;
  // 'granted', or 'unknown' on browsers that cannot report it (some older Safari versions).

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}
