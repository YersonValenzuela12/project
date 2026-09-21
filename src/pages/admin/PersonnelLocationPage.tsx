import { useEffect, useState } from 'react';
import { MapPin, Navigation, Clock, X } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, Avatar } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

const ROLE_LABELS_ES: Record<string, string> = {
  admin: 'Administrador', supervisor: 'Supervisor', coordinador: 'Coordinador', technician: 'Técnico',
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

const SOURCE_LABELS_ES: Record<string, string> = {
  LOGIN: 'Inicio de sesión', ATTENDANCE: 'Asistencia', OTHER: 'Otro',
};

export function PersonnelLocationPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<any[]>([]);
  const [latestByUser, setLatestByUser] = useState<Map<string, any>>(new Map());
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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

  useEffect(() => { fetchData(); }, []);

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

  if (profile?.role !== 'admin') return null;

  return (
    <div>
      <PageHeader
        title="Ubicación del Personal"
        subtitle="Última ubicación laboral registrada por cada usuario — no es rastreo en tiempo real"
        breadcrumbs={['Inicio', 'Administrador', 'Ubicación del Personal']}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-ink-500">Cargando…</div></Card>
      ) : people.length === 0 ? (
        <Card><div className="p-8 text-center text-sm text-ink-500">No hay personal registrado.</div></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                    <div className="text-xs text-ink-500 font-mono">{loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}</div>
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
                    <span className="h-2 w-2 rounded-full bg-primary-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink-800">{r.district ?? 'Ubicación no determinada'}</div>
                      <div className="text-xs text-ink-500">{new Date(r.recorded_at).toLocaleString('es-PE')} · {SOURCE_LABELS_ES[r.source] ?? r.source}</div>
                    </div>
                    <a href={mapsUrl(r.latitude, r.longitude)} target="_blank" rel="noreferrer" className="btn-secondary h-8 text-xs shrink-0"><Navigation size={13} /> Ver en mapa</a>
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
