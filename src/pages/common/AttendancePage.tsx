import { useEffect, useState } from 'react';
import { LogIn, LogOut, Loader2, CheckCircle2, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, SectionHeader, Avatar, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

function getShiftDate(d = new Date()) {
  const boundary = new Date(d);
  boundary.setHours(7, 0, 0, 0);
  const shiftDay = new Date(d);
  if (d < boundary) shiftDay.setDate(shiftDay.getDate() - 1);
  return shiftDay.toISOString().slice(0, 10);
}

const ROLE_LABELS_ES: Record<string, string> = { supervisor: 'Supervisor', technician: 'Técnico', coordinador: 'Coordinador' };

// ============================================================
// Employee check-in / check-out screen (everyone except admin)
// ============================================================
export function AttendancePage() {
  const { profile } = useAuth();
  const [now, setNow] = useState(new Date());
  const [mode, setMode] = useState<'entrada' | 'salida'>('entrada');
  const [record, setRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const shiftDate = getShiftDate(now);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', profile.id)
        .eq('attendance_date', shiftDate)
        .maybeSingle();
      setRecord(data ?? null);
      setMode(data?.check_in_at ? 'salida' : 'entrada');
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, shiftDate]);

  useEffect(() => {
    if (!navigator.geolocation) { setGeoError('Tu dispositivo no soporta geolocalización.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError('No se pudo obtener tu ubicación. Activa el GPS y los permisos de ubicación.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  const alreadyIn = !!record?.check_in_at;
  const alreadyOut = !!record?.check_out_at;
  const canSubmit = !!coords && !submitting && ((mode === 'entrada' && !alreadyIn) || (mode === 'salida' && alreadyIn && !alreadyOut));

  const submit = async () => {
    if (!profile || !coords) return;
    setSubmitting(true);
    if (mode === 'entrada') {
      const { data, error } = await supabase.from('attendance').upsert({
        user_id: profile.id,
        attendance_date: shiftDate,
        check_in_at: new Date().toISOString(),
        check_in_lat: coords.lat,
        check_in_lng: coords.lng,
      }, { onConflict: 'user_id,attendance_date' }).select().single();
      if (!error) { setRecord(data); setMode('salida'); }
    } else if (record) {
      const { data, error } = await supabase.from('attendance').update({
        check_out_at: new Date().toISOString(),
        check_out_lat: coords.lat,
        check_out_lng: coords.lng,
      }).eq('id', record.id).select().single();
      if (!error) setRecord(data);
    }
    setSubmitting(false);
  };

  if (loading) return <div className="p-8 text-center text-sm text-ink-500">Cargando…</div>;

  return (
    <div>
      <PageHeader
        title="Control de Asistencia"
        subtitle="Registro de entrada y salida"
        breadcrumbs={['Inicio', 'Asistencia']}
      />

      <div className="flex justify-center pt-16">
        <Card className="w-full max-w-md">
          <div className="mb-5 flex flex-col items-center rounded-lg border border-ink-200 bg-ink-50 py-3">
            <span className="font-mono text-2xl font-semibold text-ink-900 tabular-nums">{now.toLocaleTimeString('es-PE', { hour12: false })}</span>
            <span className="text-xs text-ink-500 mt-0.5 capitalize">{now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>

          <div className="mb-5">
            <label className="label">Tipo de marcación</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('entrada')}
                disabled={alreadyIn}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg border-2 py-3 text-sm font-semibold transition',
                  mode === 'entrada' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-ink-200 text-ink-500',
                  alreadyIn && 'opacity-50 cursor-not-allowed',
                )}
              >
                <LogIn size={16} /> Entrada
              </button>
              <button
                onClick={() => setMode('salida')}
                disabled={!alreadyIn || alreadyOut}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg border-2 py-3 text-sm font-semibold transition',
                  mode === 'salida' ? 'border-red-500 bg-red-50 text-red-700' : 'border-ink-200 text-ink-500',
                  (!alreadyIn || alreadyOut) && 'opacity-50 cursor-not-allowed',
                )}
              >
                <LogOut size={16} /> Salida
              </button>
            </div>
          </div>

          <div className="mb-5">
            <label className="label">Trabajador</label>
            <div className="rounded-lg bg-ink-50 border border-ink-200 px-3.5 py-3 text-sm font-medium text-ink-800">
              {profile?.full_name}
            </div>
          </div>

          <div className="mb-5">
            <label className="label">Ubicación GPS</label>
            <div className="rounded-lg bg-ink-50 border border-ink-200 px-3.5 py-3 flex items-center gap-2 text-sm">
              {coords ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-ink-700">Ubicación obtenida ✓ <span className="text-ink-400 font-mono text-xs">{coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</span></span>
                </>
              ) : geoError ? (
                <span className="text-red-600">{geoError}</span>
              ) : (
                <><Loader2 size={14} className="animate-spin text-ink-400" /><span className="text-ink-500">Obteniendo ubicación…</span></>
              )}
            </div>
          </div>

          {alreadyIn && alreadyOut ? (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-center text-sm text-emerald-700 flex items-center justify-center gap-2">
              <CheckCircle2 size={16} /> Ya registraste tu entrada y salida de hoy. Vuelve a las 7:00 a.m.
            </div>
          ) : (
            <button
              onClick={submit}
              disabled={!canSubmit}
              className={cn(
                'w-full rounded-lg py-3 text-sm font-semibold text-white transition',
                mode === 'entrada' ? 'bg-primary-600 hover:bg-primary-700' : 'bg-red-600 hover:bg-red-700',
                !canSubmit && 'opacity-50 cursor-not-allowed',
              )}
            >
              {submitting ? 'Enviando…' : `Marcar ${mode === 'entrada' ? 'Entrada' : 'Salida'}`}
            </button>
          )}
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// Admin oversight: today's attendance summary + manual reset
// ============================================================
export function AdminAttendancePage() {
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<any[]>([]);
  const [records, setRecords] = useState<Map<string, any>>(new Map());
  const [resettingId, setResettingId] = useState<string | null>(null);
  const shiftDate = getShiftDate();

  const fetchData = async () => {
    setLoading(true);
    const [peopleRes, attRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role, initials, avatar_color').neq('role', 'admin').order('full_name'),
      supabase.from('attendance').select('*').eq('attendance_date', shiftDate),
    ]);
    setPeople(peopleRes.data ?? []);
    setRecords(new Map((attRes.data ?? []).map((r: any) => [r.user_id, r])));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleReset = async (userId: string) => {
    setResettingId(userId);
    await supabase.from('attendance').delete().eq('user_id', userId).eq('attendance_date', shiftDate);
    setResettingId(null);
    fetchData();
  };

  const markedIn = people.filter((p) => records.get(p.id)?.check_in_at).length;
  const markedOut = people.filter((p) => records.get(p.id)?.check_out_at).length;

  return (
    <div>
      <PageHeader
        title="Control de Asistencia"
        subtitle="Asistencia diaria del equipo — reinicia a las 7:00 a.m."
        breadcrumbs={['Inicio', 'Administrador', 'Asistencia']}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Card><div className="text-xs text-ink-500 mb-1">Personal total</div><div className="text-2xl font-bold text-ink-900">{people.length}</div></Card>
        <Card><div className="text-xs text-ink-500 mb-1">Marcaron entrada</div><div className="text-2xl font-bold text-emerald-600">{markedIn}</div></Card>
        <Card><div className="text-xs text-ink-500 mb-1">Marcaron salida</div><div className="text-2xl font-bold text-primary-600">{markedOut}</div></Card>
      </div>

      <Card pad={false} className="overflow-hidden">
        <div className="p-5 pb-3"><SectionHeader title="Asistencia de hoy" /></div>
        {loading ? (
          <div className="p-8 text-center text-sm text-ink-500">Cargando…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-ink-50/50 border-y border-ink-100">
                <tr><th className="th">Persona</th><th className="th">Entrada</th><th className="th">Salida</th><th className="th w-40"></th></tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {people.map((p) => {
                  const r = records.get(p.id);
                  return (
                    <tr key={p.id} className="hover:bg-ink-50/40">
                      <td className="td">
                        <div className="flex items-center gap-2.5">
                          <Avatar initials={p.initials} color={p.avatar_color} size="sm" />
                          <div><div className="font-medium text-ink-900">{p.full_name}</div><div className="text-xs text-ink-500">{ROLE_LABELS_ES[p.role] ?? p.role}</div></div>
                        </div>
                      </td>
                      <td className="td">
                        {r?.check_in_at ? <Badge className="bg-emerald-50 text-emerald-700">{new Date(r.check_in_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</Badge> : <span className="text-xs text-ink-400 italic">Sin marcar</span>}
                      </td>
                      <td className="td">
                        {r?.check_out_at ? <Badge className="bg-primary-50 text-primary-700">{new Date(r.check_out_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</Badge> : <span className="text-xs text-ink-400 italic">—</span>}
                      </td>
                      <td className="td">
                        {r && (
                          <button onClick={() => handleReset(p.id)} disabled={resettingId === p.id} className="btn-secondary h-8 text-xs">
                            <RotateCcw size={13} /> {resettingId === p.id ? 'Reiniciando…' : 'Reiniciar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
