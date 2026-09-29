import { useEffect, useState } from 'react';
import { MapPin, Navigation, Clock, X, AlertTriangle, Moon, Sun } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, SectionHeader, Avatar, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { isNightShift, computeStatus } from '@/lib/otTracking';

const ROLE_LABELS_ES: Record<string, string> = {
  admin: 'Administrador', supervisor: 'Supervisor', coordinador: 'Coordinador', technician: 'Técnico',
};

const SESSION_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PROGRAMADO: { label: '⚪ Programado', className: 'bg-ink-100 text-ink-600' },
  ACTIVO: { label: '🟢 Activo', className: 'bg-emerald-50 text-emerald-700' },
  FINALIZADO: { label: '🔴 Finalizado', className: 'bg-ink-100 text-ink-500' },
  FINALIZADA: { label: '🔴 Finalizado', className: 'bg-ink-100 text-ink-500' },
};

function statusFor(recordedAt: string | null) {
  if (!recordedAt) return { label: 'Sin ubicación registrada', dot: 'bg-ink-300' };
  const hours = (Date.now() - new Date(recordedAt).getTime()) / (1000 * 60 * 60);
  if (hours <= 2) return { label: 'Actualizado recientemente', dot: 'bg-emerald-500' };
  return { label: 'Actualización antigua', dot: 'bg-amber-500' };
}

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function routeUrl(points: { latitude: number; longitude: number }[]) {
  let pts = points;
  if (pts.length > 20) {
    const step = pts.length / 20;
    pts = Array.from({ length: 20 }, (_, i) => points[Math.floor(i * step)]);
  }
  const path = pts.map((p) => `${p.latitude},${p.longitude}`).join('/');
  return `https://www.google.com/maps/dir/${path}`;
}

const SOURCE_LABELS_ES: Record<string, string> = {
  LOGIN: 'Inicio de sesión', ATTENDANCE: 'Asistencia', OTHER: 'Otro', OT_TRACKING: 'Seguimiento de OT',
};

export function PersonnelLocationPage() {
  const { profile } = useAuth();

  // --- V1: last known location per person ---
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<any[]>([]);
  const [latestByUser, setLatestByUser] = useState<Map<string, any>>(new Map());
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // --- V2: tracking sessions by work order ---
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [sessionPoints, setSessionPoints] = useState<any[]>([]);
  const [sessionPointsLoading, setSessionPointsLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [peopleRes, locRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role, initials, avatar_color').neq('role', 'admin').order('full_name'),
      supabase.from('user_locations').select('*').order('recorded_at', { ascending: false }).limit(1000),
    ]);
    setPeople(peopleRes.data ?? []);
    const map = new Map<string, any>();
    (locRes.data ?? []).forEach((r: any) => {
      if (!map.has(r.user_id)) map.set(r.user_id, r);
    });
    setLatestByUser(map);
    setLoading(false);
  };

  const fetchSessions = async () => {
    setSessionsLoading(true);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows } = await supabase
      .from('tracking_sessions')
      .select('id, user_id, work_order_id, start_at, end_at, status')
      .gte('start_at', sevenDaysAgo)
      .order('start_at', { ascending: false })
      .limit(200);

    const sessionRows = rows ?? [];
    const userIds = Array.from(new Set(sessionRows.map((s: any) => s.user_id)));
    const woIds = Array.from(new Set(sessionRows.map((s: any) => s.work_order_id)));

    const [profsRes, wosRes] = await Promise.all([
      userIds.length > 0 ? supabase.from('profiles').select('id, full_name, initials, avatar_color, role').in('id', userIds) : Promise.resolve({ data: [] as any[] }),
      woIds.length > 0 ? supabase.from('work_orders').select('id, code, client, site').in('id', woIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const profMap = new Map((profsRes.data ?? []).map((p: any) => [p.id, p]));
    const woMap = new Map((wosRes.data ?? []).map((w: any) => [w.id, w]));

    const enriched = sessionRows.map((s: any) => ({
      ...s,
      user: profMap.get(s.user_id),
      wo: woMap.get(s.work_order_id),
      liveStatus: computeStatus(new Date(s.start_at), new Date(s.end_at)),
      night: isNightShift(new Date(s.start_at), new Date(s.end_at)),
    }));

    // Overlap detection (spec §8): flag sessions of the same user whose windows overlap.
    const byUser = new Map<string, any[]>();
    enriched.forEach((s) => {
      if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
      byUser.get(s.user_id)!.push(s);
    });
    byUser.forEach((list) => {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i]; const b = list[j];
          const overlap = new Date(a.start_at) < new Date(b.end_at) && new Date(a.end_at) > new Date(b.start_at);
          if (overlap) { a.overlapping = true; b.overlapping = true; }
        }
      }
    });

    setSessions(enriched);
    setSessionsLoading(false);
  };

  useEffect(() => { fetchData(); fetchSessions(); }, []);

  const openHistory = async (person: any, from = dateFrom, to = dateTo) => {
    setSelectedUser(person);
    setHistoryLoading(true);
    let query = supabase.from('user_locations').select('*').eq('user_id', person.id).order('recorded_at', { ascending: false });
    if (from) query = query.gte('recorded_at', `${from}T00:00:00`);
    if (to) query = query.lte('recorded_at', `${to}T23:59:59`);
    const { data } = await query.limit(200);
    setHistory(data ?? []);
    setHistoryLoading(false);
  };

  const openSession = async (session: any) => {
    setSelectedSession(session);
    setSessionPointsLoading(true);
    const { data } = await supabase
      .from('user_locations')
      .select('*')
      .eq('tracking_session_id', session.id)
      .order('recorded_at', { ascending: true });
    setSessionPoints(data ?? []);
    setSessionPointsLoading(false);
  };

  if (profile?.role !== 'admin') return null;

  const validPoints = sessionPoints.filter((p) => p.latitude != null && p.longitude != null);

  return (
    <div>
      <PageHeader
        title="Ubicación del Personal"
        subtitle="Última ubicación registrada y seguimiento durante órdenes de trabajo activas"
        breadcrumbs={['Inicio', 'Administrador', 'Ubicación del Personal']}
      />

      <Card pad={false} className="overflow-hidden mb-6">
        <div className="p-5 pb-3"><SectionHeader title="Seguimiento por Orden de Trabajo" subtitle="Últimos 7 días · turno día/noche detectado automáticamente" /></div>
        {sessionsLoading ? (
          <div className="p-8 text-center text-sm text-ink-500">Cargando…</div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-500">Aún no hay sesiones de seguimiento registradas.</div>
        ) : (
          <div className="divide-y divide-ink-50">
            {sessions.map((s) => {
              const badge = SESSION_STATUS_BADGE[s.liveStatus] ?? SESSION_STATUS_BADGE.PROGRAMADO;
              return (
                <button
                  key={s.id}
                  onClick={() => openSession(s)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-ink-50/50 text-left"
                >
                  {s.user ? <Avatar initials={s.user.initials} color={s.user.avatar_color} size="sm" /> : <span className="h-9 w-9 rounded-full bg-ink-200" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink-900 flex items-center gap-1.5">
                      {s.user?.full_name ?? 'Desconocido'}
                      {s.night ? <Moon size={12} className="text-primary-500" /> : <Sun size={12} className="text-amber-500" />}
                      {s.overlapping && <span title="Esta persona tiene otra OT con horario superpuesto"><AlertTriangle size={13} className="text-red-500" /></span>}
                    </div>
                    <div className="text-xs text-ink-500">
                      {s.wo?.code ?? 'OT'} · {s.wo?.client ?? '—'} · {new Date(s.start_at).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} – {new Date(s.end_at).toLocaleString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <Badge className={badge.className}>{badge.label}</Badge>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <SectionHeader title="Última Ubicación por Persona" subtitle="Registrada al iniciar sesión o marcar asistencia" />
      {loading ? (
        <Card><div className="p-8 text-center text-sm text-ink-500">Cargando…</div></Card>
      ) : people.length === 0 ? (
        <Card><div className="p-8 text-center text-sm text-ink-500">No hay personal registrado.</div></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
          {people.map((p) => {
            const loc = latestByUser.get(p.id);
            const status = statusFor(loc?.recorded_at ?? null);
            return (
              <Card key={p.id} className="hover:shadow-card-md transition cursor-pointer" onClick={() => { setDateFrom(''); setDateTo(''); openHistory(p, '', ''); }}>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar initials={p.initials} color={p.avatar_color} size="md" />
                  <div className="min-w-0">
                    <div className="font-semibold text-ink-900 truncate">{p.full_name}</div>
                    <div className="text-xs text-ink-500">{ROLE_LABELS_ES[p.role] ?? p.role}</div>
                  </div>
                  <span className={`ml-auto h-2.5 w-2.5 rounded-full shrink-0 ${status.dot}`} title={status.label} />
                </div>
                {loc ? (
                  <div className="text-sm space-y-1">
                    <div className="flex items-center gap-1.5 text-ink-800"><MapPin size={13} className="text-ink-400 shrink-0" /> {loc.district ?? 'Ubicación no determinada'}</div>
                    <div className="text-xs text-ink-500 font-mono">{loc.latitude != null ? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}` : 'Sin coordenadas'}</div>
                    <div className="flex items-center gap-1.5 text-xs text-ink-500"><Clock size={12} /> {new Date(loc.recorded_at).toLocaleString('es-PE')}</div>
                    {loc.gps_accuracy != null && <div className="text-xs text-ink-400">Precisión: {Math.round(loc.gps_accuracy)} m</div>}
                  </div>
                ) : (
                  <div className="text-sm text-ink-400">Sin ubicación registrada</div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-ink-900/50" onClick={() => setSelectedUser(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Avatar initials={selectedUser.initials} color={selectedUser.avatar_color} size="sm" />
                <div>
                  <div className="font-semibold text-ink-900">{selectedUser.full_name}</div>
                  <div className="text-xs text-ink-500">Historial de ubicación</div>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-ink-400 hover:text-ink-700"><X size={18} /></button>
            </div>

            <div className="flex items-end gap-2 mb-4 flex-wrap">
              <div><label className="label">Desde</label><input type="date" className="input h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
              <div><label className="label">Hasta</label><input type="date" className="input h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
              <button className="btn-secondary h-9" onClick={() => openHistory(selectedUser)}>Buscar</button>
            </div>

            {historyLoading ? (
              <div className="p-6 text-center text-sm text-ink-500">Cargando historial…</div>
            ) : history.length === 0 ? (
              <div className="p-6 text-center text-sm text-ink-500">No hay registros en este rango.</div>
            ) : (
              <div className="divide-y divide-ink-50">
                {history.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 py-2.5">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${r.tracking_status === 'LOCATION_UNAVAILABLE' ? 'bg-amber-400' : 'bg-primary-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink-800">{r.tracking_status === 'LOCATION_UNAVAILABLE' ? 'GPS no disponible' : (r.district ?? 'Ubicación no determinada')}</div>
                      <div className="text-xs text-ink-500">{new Date(r.recorded_at).toLocaleString('es-PE')} · {SOURCE_LABELS_ES[r.source] ?? r.source}</div>
                    </div>
                    {r.latitude != null && (
                      <a href={mapsUrl(r.latitude, r.longitude)} target="_blank" rel="noreferrer" className="btn-secondary h-8 text-xs shrink-0"><Navigation size={13} /> Ver en mapa</a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-ink-900/50" onClick={() => setSelectedSession(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                {selectedSession.user ? <Avatar initials={selectedSession.user.initials} color={selectedSession.user.avatar_color} size="sm" /> : null}
                <div>
                  <div className="font-semibold text-ink-900">{selectedSession.user?.full_name ?? 'Desconocido'}</div>
                  <div className="text-xs text-ink-500">{selectedSession.wo?.code} · {selectedSession.wo?.client}{selectedSession.wo?.site ? ` — ${selectedSession.wo.site}` : ''}</div>
                </div>
              </div>
              <button onClick={() => setSelectedSession(null)} className="text-ink-400 hover:text-ink-700"><X size={18} /></button>
            </div>
            <div className="flex items-center gap-2 mt-3 mb-4 flex-wrap">
              <Badge className={(SESSION_STATUS_BADGE[selectedSession.liveStatus] ?? SESSION_STATUS_BADGE.PROGRAMADO).className}>
                {(SESSION_STATUS_BADGE[selectedSession.liveStatus] ?? SESSION_STATUS_BADGE.PROGRAMADO).label}
              </Badge>
              <Badge className="bg-ink-100 text-ink-600">{selectedSession.night ? '🌙 Turno noche' : '☀️ Turno día'}</Badge>
              {selectedSession.overlapping && <Badge className="bg-red-50 text-red-700"><AlertTriangle size={11} className="inline mr-1" />Horario superpuesto con otra OT</Badge>}
              {validPoints.length > 1 && (
                <a href={routeUrl(validPoints)} target="_blank" rel="noreferrer" className="btn-primary h-8 text-xs ml-auto">
                  <Navigation size={13} /> Ver recorrido
                </a>
              )}
            </div>
            <p className="text-xs text-ink-500 mb-4">
              {new Date(selectedSession.start_at).toLocaleString('es-PE')} → {new Date(selectedSession.end_at).toLocaleString('es-PE')}
              <br /><span className="text-ink-400">El recorrido muestra los puntos registrados cada ~10 min, no una ruta GPS continua.</span>
            </p>

            {sessionPointsLoading ? (
              <div className="p-6 text-center text-sm text-ink-500">Cargando puntos…</div>
            ) : sessionPoints.length === 0 ? (
              <div className="p-6 text-center text-sm text-ink-500">Aún no hay puntos registrados para esta sesión.</div>
            ) : (
              <div className="divide-y divide-ink-50">
                {sessionPoints.map((pt) => (
                  <div key={pt.id} className="flex items-center gap-3 py-2.5">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${pt.tracking_status === 'LOCATION_UNAVAILABLE' ? 'bg-amber-400' : 'bg-primary-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink-800">{pt.tracking_status === 'LOCATION_UNAVAILABLE' ? 'GPS no disponible en este intervalo' : (pt.district ?? 'Ubicación no determinada')}</div>
                      <div className="text-xs text-ink-500">{new Date(pt.recorded_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    {pt.latitude != null && (
                      <a href={mapsUrl(pt.latitude, pt.longitude)} target="_blank" rel="noreferrer" className="btn-secondary h-8 text-xs shrink-0"><MapPin size={13} /></a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
