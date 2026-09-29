import { supabase } from './supabase';
import { logActivity } from './activityLog';

// Frequency is intentionally a single constant so it can be tuned later
// without touching the tracking logic itself (spec section 5).
export const TRACKING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

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
 * A work order's tracking window is computed from real Date objects
 * (scheduled_date + scheduled_time, plus duration_hrs), never from raw
 * "HH:MM" string comparison. This is what makes overnight shifts (e.g.
 * 22:00 -> 06:00 next day) work correctly without special-casing:
 * adding hours to a Date naturally rolls over midnight.
 */
function computeWindow(wo: any): { start: Date; end: Date } | null {
  if (!wo.scheduled_date || !wo.scheduled_time || !wo.duration_hrs) return null;
  const start = new Date(`${wo.scheduled_date}T${wo.scheduled_time}:00`);
  if (isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + wo.duration_hrs * 60 * 60 * 1000);
  return { start, end };
}

/** Cosmetic label only — the tracking window itself never depends on this. */
export function isNightShift(start: Date, end: Date): boolean {
  return start.getHours() >= 18 || start.getHours() < 6 || end.getDate() !== start.getDate();
}

export function computeStatus(start: Date, end: Date): 'PROGRAMADO' | 'ACTIVO' | 'FINALIZADO' {
  const now = new Date();
  if (now < start) return 'PROGRAMADO';
  if (now > end) return 'FINALIZADO';
  return 'ACTIVO';
}

async function getUserWorkOrders(userId: string): Promise<any[]> {
  const { data: primary } = await supabase
    .from('work_orders')
    .select('id, code, technician_id, scheduled_date, scheduled_time, duration_hrs, status')
    .eq('technician_id', userId)
    .neq('status', 'completed');

  const { data: assigneeRows } = await supabase.from('work_order_assignees').select('work_order_id').eq('user_id', userId);
  const ids = (assigneeRows ?? []).map((r: any) => r.work_order_id);
  const { data: viaAssignment } = ids.length > 0
    ? await supabase.from('work_orders').select('id, code, technician_id, scheduled_date, scheduled_time, duration_hrs, status').in('id', ids).neq('status', 'completed')
    : { data: [] as any[] };

  const merged = [...(primary ?? [])];
  (viaAssignment ?? []).forEach((w: any) => { if (!merged.find((m) => m.id === w.id)) merged.push(w); });
  return merged;
}

/** Work orders whose computed [start, end] window contains "now". */
async function getActiveWorkOrders(userId: string): Promise<{ wo: any; start: Date; end: Date }[]> {
  const orders = await getUserWorkOrders(userId);
  const now = new Date();
  const active: { wo: any; start: Date; end: Date }[] = [];
  for (const wo of orders) {
    const window = computeWindow(wo);
    if (!window) continue;
    if (now >= window.start && now <= window.end) active.push({ wo, start: window.start, end: window.end });
  }
  return active;
}

async function ensureTrackingSession(userId: string, woId: string, start: Date, end: Date): Promise<string | null> {
  const { data: existing } = await supabase
    .from('tracking_sessions')
    .select('id, status')
    .eq('user_id', userId)
    .eq('work_order_id', woId)
    .maybeSingle();

  if (existing) {
    if (existing.status !== 'ACTIVO') {
      await supabase.from('tracking_sessions').update({ status: 'ACTIVO' }).eq('id', existing.id);
    }
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from('tracking_sessions')
    .insert({ user_id: userId, work_order_id: woId, start_at: start.toISOString(), end_at: end.toISOString(), status: 'ACTIVO' })
    .select('id')
    .single();
  if (error) { console.error('No se pudo crear la sesión de seguimiento:', error); return null; }
  return created.id;
}

/** Marks sessions whose window has already ended as FINALIZADA. Cheap to call often. */
async function closeExpiredSessions(userId: string) {
  await supabase
    .from('tracking_sessions')
    .update({ status: 'FINALIZADA' })
    .eq('user_id', userId)
    .eq('status', 'ACTIVO')
    .lt('end_at', new Date().toISOString());
}

async function getUserName(userId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
  return data?.full_name ?? 'Usuario';
}

/**
 * Runs one tracking tick: finds this user's currently-active work orders
 * (by real start/end datetime, overnight-safe) and, only if at least one
 * is active, requests GPS once and logs a point per active order. If no
 * order is active right now, this does nothing — no permission prompt,
 * no network call (spec: "no realizar seguimiento fuera de OT").
 */
export async function pingLocationForActiveOrders(userId: string) {
  try {
    await closeExpiredSessions(userId);
    const activeOrders = await getActiveWorkOrders(userId);
    if (activeOrders.length === 0) return;

    let position: { lat: number; lng: number; accuracy?: number } | null = null;
    let unavailable = false;
    try {
      position = await getCurrentPosition();
    } catch {
      unavailable = true;
    }

    const district = position ? await reverseGeocode(position.lat, position.lng) : null;

    for (const { wo, start, end } of activeOrders) {
      const sessionId = await ensureTrackingSession(userId, wo.id, start, end);
      await supabase.from('user_locations').insert({
        user_id: userId,
        work_order_id: wo.id,
        tracking_session_id: sessionId,
        latitude: position?.lat ?? null,
        longitude: position?.lng ?? null,
        gps_accuracy: position?.accuracy ?? null,
        district,
        source: 'OT_TRACKING',
        tracking_status: unavailable ? 'LOCATION_UNAVAILABLE' : 'OK',
      });

      if (unavailable) {
        const actorName = await getUserName(userId);
        await logActivity({
          actorName,
          action: 'SYSTEM_GPS_UNAVAILABLE',
          target: 'work_order',
          detail: `${wo.code} · el sistema no pudo obtener la ubicación durante el seguimiento`,
        });
      }
    }
  } catch (e) {
    console.error('Error en el ciclo de seguimiento de OT:', e);
  }
}

/**
 * Starts the periodic tracking loop for the given user. Call once (e.g. in
 * App.tsx) while a technician/supervisor/coordinador session is active, and
 * call the returned cleanup function on unmount. Ticks every
 * TRACKING_INTERVAL_MS, but only actually does anything (GPS prompt, writes)
 * when the user has a work order active right now.
 */
export function startOtTrackingLoop(userId: string): () => void {
  pingLocationForActiveOrders(userId);
  const intervalId = setInterval(() => pingLocationForActiveOrders(userId), TRACKING_INTERVAL_MS);
  return () => clearInterval(intervalId);
}

/**
 * Eagerly creates/updates the tracking_sessions row(s) for a work order as
 * soon as it's created, edited, or rescheduled — instead of waiting for the
 * technician's browser to be open and ticking. This lets the admin see a
 * PROGRAMADO session ahead of time for any upcoming shift, day or night,
 * and keeps start_at/end_at in sync if the order gets rescheduled.
 * Only technicians and supervisors get a tracking session (per spec §1).
 */
export async function syncTrackingSessionsForWorkOrder(workOrderId: string) {
  const { data: wo } = await supabase
    .from('work_orders')
    .select('id, code, technician_id, scheduled_date, scheduled_time, duration_hrs')
    .eq('id', workOrderId)
    .single();
  if (!wo) return;
  const window = computeWindow(wo);
  if (!window) return;

  const { data: assigneeRows } = await supabase
    .from('work_order_assignees')
    .select('user_id')
    .eq('work_order_id', workOrderId);
  const assigneeIds = (assigneeRows ?? []).map((r: any) => r.user_id);

  const candidateIds = Array.from(new Set([wo.technician_id, ...assigneeIds].filter(Boolean)));
  if (candidateIds.length === 0) return;

  const { data: profs } = await supabase.from('profiles').select('id, full_name, role').in('id', candidateIds);
  const trackedProfiles = (profs ?? []).filter((p: any) => p.role === 'technician' || p.role === 'supervisor');

  const status = computeStatus(window.start, window.end);
  const night = isNightShift(window.start, window.end);

  for (const person of trackedProfiles) {
    const { data: existing } = await supabase
      .from('tracking_sessions')
      .select('id, status')
      .eq('user_id', person.id)
      .eq('work_order_id', workOrderId)
      .maybeSingle();

    if (existing) {
      await supabase.from('tracking_sessions').update({
        start_at: window.start.toISOString(),
        end_at: window.end.toISOString(),
        status: existing.status === 'ACTIVO' ? 'ACTIVO' : status,
      }).eq('id', existing.id);
    } else {
      await supabase.from('tracking_sessions').insert({
        user_id: person.id,
        work_order_id: workOrderId,
        start_at: window.start.toISOString(),
        end_at: window.end.toISOString(),
        status,
      });

      await logActivity({
        actorName: person.full_name,
        action: 'SYSTEM_TRACKING_SESSION_CREATED',
        target: 'work_order',
        detail: `${wo.code} · ${night ? 'Turno noche' : 'Turno día'} · ${window.start.toLocaleString('es-PE')} – ${window.end.toLocaleString('es-PE')}`,
      });
    }
  }
}
