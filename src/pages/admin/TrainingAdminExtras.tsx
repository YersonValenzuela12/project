import { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Card, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';
import { parseDriveUrl, openUrl } from '@/lib/drive';
import {
  REASON_LABEL, REQUEST_STATUS_LABEL, REQUEST_STATUS_BADGE,
  type AccessRequest, type TrainingContent,
} from '@/lib/trainingConfig';

type Person = { id: string; full_name: string; email: string | null };

async function loadPeople(ids: string[]): Promise<Map<string, Person>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', unique);
  return new Map((data ?? []).map((p: any) => [p.id, p as Person]));
}

async function loadContents(ids: string[]): Promise<Map<string, TrainingContent>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { data } = await supabase.from('training_contents').select('*').in('id', unique);
  return new Map((data ?? []).map((c: any) => [c.id, c as TrainingContent]));
}

// ---------------------------------------------------------------------------
// Access requests. Approving only records the decision: the administrator shares the file outside
// Selecom on their own, if they decide to. The technician is told the result either way.
// ---------------------------------------------------------------------------
export function AccessRequestsView({ onChanged }: { onChanged: () => void }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<AccessRequest[]>([]);
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [contents, setContents] = useState<Map<string, TrainingContent>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const { data, error: err } = await supabase
      .from('training_access_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (err) { console.error('Solicitudes de acceso:', err); setError('No se pudieron cargar las solicitudes. ¿Ya corriste la migración SQL de la Fase 1?'); setLoading(false); return; }
    const list = (data ?? []) as AccessRequest[];
    const [pm, cm] = await Promise.all([loadPeople(list.map((r) => r.user_id)), loadContents(list.map((r) => r.content_id))]);
    setError(null);
    setRows(list);
    setPeople(pm);
    setContents(cm);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resolve = async (row: AccessRequest, status: 'GRANTED' | 'DENIED') => {
    if (!profile) return;
    const content = contents.get(row.content_id);
    const who = people.get(row.user_id)?.full_name ?? 'el técnico';
    const note = window.prompt(
      status === 'GRANTED'
        ? `Aprobar la solicitud de ${who}.\n\nMensaje para el técnico (opcional). Recuerda compartirle el archivo por fuera de Selecom:`
        : `Rechazar la solicitud de ${who}.\n\nMotivo (opcional):`,
    );
    if (note === null) return; // cancelled

    setBusyId(row.id);
    const cleanNote = note.trim().slice(0, 300);
    const { data, error: err } = await supabase
      .from('training_access_requests')
      .update({ status, admin_note: cleanNote, resolved_at: new Date().toISOString(), resolved_by: profile.id })
      .eq('id', row.id)
      .eq('status', 'PENDING')
      .select('id');
    setBusyId(null);
    if (err || !data || data.length === 0) { alert(`No se pudo guardar la respuesta: ${err?.message ?? 'la solicitud ya fue resuelta'}`); load(); return; }

    try {
      await supabase.from('notifications').insert({
        user_id: row.user_id,
        type: 'training_access_resolved',
        title: status === 'GRANTED' ? 'Tu solicitud de acceso fue aprobada' : 'Tu solicitud de acceso no fue aprobada',
        body: `«${content?.title ?? 'Contenido'}»${cleanNote ? ` — ${cleanNote}` : ''}`.slice(0, 300),
        color: status === 'GRANTED' ? 'bg-emerald-500' : 'bg-red-500',
        unread: true,
        actor_id: profile.id,
      });
      await logActivity({
        actorName: profile.full_name,
        action: status === 'GRANTED' ? 'aprobó un acceso externo de capacitación' : 'rechazó un acceso externo de capacitación',
        target: 'training',
        detail: `${content?.title ?? 'Contenido'} — ${who}`,
      });
    } catch (e) {
      console.debug('Respuesta guardada, pero no se pudo avisar al técnico:', e);
    }
    load();
    onChanged();
  };

  if (loading) return <Card><div className="p-8 text-center text-sm text-ink-500">Cargando…</div></Card>;
  if (error) return <Card><div className="p-8 text-center text-sm text-red-600">{error}</div></Card>;
  if (rows.length === 0) return <Card><div className="p-8 text-center text-sm text-ink-400">Nadie ha solicitado acceso externo. Es lo esperado: los contenidos se ven dentro de Selecom.</div></Card>;

  const ordered = [...rows].sort((a, b) => Number(b.status === 'PENDING') - Number(a.status === 'PENDING') || b.created_at.localeCompare(a.created_at));

  return (
    <div className="space-y-3">
      {ordered.map((r) => {
        const person = people.get(r.user_id);
        const content = contents.get(r.content_id);
        const drive = content?.drive_url ? parseDriveUrl(content.drive_url) : null;
        return (
          <Card key={r.id}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-[220px]">
                <div className="font-semibold text-ink-900">{content?.title ?? 'Contenido eliminado'}</div>
                <div className="text-xs text-ink-500 mt-0.5">
                  {person?.full_name ?? 'Usuario'}{person?.email ? ` · ${person.email}` : ''} · {new Date(r.created_at).toLocaleString('es-PE')}
                </div>
                <div className="text-sm text-ink-700 mt-2"><b>Motivo:</b> {REASON_LABEL[r.reason]}</div>
                {r.note && <div className="text-sm text-ink-600 mt-0.5" style={{ whiteSpace: 'pre-wrap' }}>{r.note}</div>}
                {r.status !== 'PENDING' && (
                  <div className="text-xs text-ink-500 mt-2">
                    {r.resolved_at ? `Resuelta el ${new Date(r.resolved_at).toLocaleString('es-PE')}` : 'Resuelta'}{r.admin_note ? ` — ${r.admin_note}` : ''}
                  </div>
                )}
              </div>
              <Badge className={REQUEST_STATUS_BADGE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Badge>
            </div>

            {r.status === 'PENDING' && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-ink-100">
                <button className="btn-primary h-8 text-xs" disabled={busyId === r.id} onClick={() => resolve(r, 'GRANTED')}>Aprobar</button>
                <button className="h-8 px-3 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50" disabled={busyId === r.id} onClick={() => resolve(r, 'DENIED')}>Rechazar</button>
                {drive && (
                  <a href={openUrl(drive)} target="_blank" rel="noopener noreferrer" className="btn-secondary h-8 text-xs">
                    <ExternalLink size={13} /> Abrir en Drive para compartirlo
                  </a>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity: who opened what, last 30 days
// ---------------------------------------------------------------------------
type View = { id: number; content_id: string; user_id: string; viewed_at: string };

export function ActivityView() {
  const [views, setViews] = useState<View[]>([]);
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [contents, setContents] = useState<Map<string, TrainingContent>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState('all');

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data, error: err } = await supabase
        .from('training_views')
        .select('id, content_id, user_id, viewed_at')
        .gte('viewed_at', since)
        .order('viewed_at', { ascending: false })
        .limit(2000);
      if (err) { console.error('Actividad de capacitación:', err); setError('No se pudo cargar la actividad. ¿Ya corriste la migración SQL de la Fase 1?'); setLoading(false); return; }
      const list = (data ?? []) as View[];
      const [pm, cm] = await Promise.all([loadPeople(list.map((v) => v.user_id)), loadContents(list.map((v) => v.content_id))]);
      setViews(list);
      setPeople(pm);
      setContents(cm);
      setLoading(false);
    })();
  }, []);

  const perContent = useMemo(() => {
    const map = new Map<string, { views: number; users: Set<string>; last: string }>();
    for (const v of views) {
      const cur = map.get(v.content_id) ?? { views: 0, users: new Set<string>(), last: v.viewed_at };
      cur.views += 1;
      cur.users.add(v.user_id);
      if (v.viewed_at > cur.last) cur.last = v.viewed_at;
      map.set(v.content_id, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].views - a[1].views);
  }, [views]);

  const uniqueUsers = new Set(views.map((v) => v.user_id)).size;
  const recent = views.filter((v) => userFilter === 'all' || v.user_id === userFilter).slice(0, 50);
  const userOptions = [...new Set(views.map((v) => v.user_id))];

  if (loading) return <Card><div className="p-8 text-center text-sm text-ink-500">Cargando…</div></Card>;
  if (error) return <Card><div className="p-8 text-center text-sm text-red-600">{error}</div></Card>;
  if (views.length === 0) return <Card><div className="p-8 text-center text-sm text-ink-400">Todavía no hay visualizaciones en los últimos 30 días.</div></Card>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><div className="text-2xl font-bold text-ink-900">{views.length}</div><div className="text-xs text-ink-500">Visualizaciones (30 días)</div></Card>
        <Card><div className="text-2xl font-bold text-ink-900">{uniqueUsers}</div><div className="text-xs text-ink-500">Técnicos que entraron</div></Card>
        <Card><div className="text-2xl font-bold text-ink-900">{perContent.length}</div><div className="text-xs text-ink-500">Contenidos vistos</div></Card>
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-ink-900 mb-3">Por contenido</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-400">
                <th className="py-1.5 pr-3 font-semibold">Contenido</th>
                <th className="py-1.5 pr-3 font-semibold text-right">Vistas</th>
                <th className="py-1.5 pr-3 font-semibold text-right">Personas</th>
                <th className="py-1.5 font-semibold text-right">Última vez</th>
              </tr>
            </thead>
            <tbody>
              {perContent.map(([id, s]) => (
                <tr key={id} className="border-t border-ink-100">
                  <td className="py-2 pr-3 text-ink-800">{contents.get(id)?.title ?? 'Contenido eliminado'}</td>
                  <td className="py-2 pr-3 text-right text-ink-800">{s.views}</td>
                  <td className="py-2 pr-3 text-right text-ink-800">{s.users.size}</td>
                  <td className="py-2 text-right text-ink-500">{new Date(s.last).toLocaleString('es-PE')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-ink-900">Últimas visualizaciones</h3>
          <select className="input h-8 w-auto text-xs" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="all">Todas las personas</option>
            {userOptions.map((id) => <option key={id} value={id}>{people.get(id)?.full_name ?? 'Usuario'}</option>)}
          </select>
        </div>
        <div className="divide-y divide-ink-100">
          {recent.map((v) => (
            <div key={v.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium text-ink-900">{people.get(v.user_id)?.full_name ?? 'Usuario'}</span>
                <span className="text-ink-500"> vio </span>
                <span className="text-ink-800">{contents.get(v.content_id)?.title ?? 'Contenido eliminado'}</span>
              </div>
              <span className="text-xs text-ink-400">{new Date(v.viewed_at).toLocaleString('es-PE')}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-ink-400 mt-3">Se registra cada vez que alguien abre un contenido. No mide cuánto tiempo lo vio.</p>
      </Card>
    </div>
  );
}
