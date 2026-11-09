import { useEffect, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Card, SectionHeader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

// Limits so the card never grows out of its space. Change them here if you need more room.
const MAX_SKILLS = 8;
const MAX_LEN = 30;

// Optional shortcuts. Each role starts with ideas that fit its work, but everyone can write their own.
const SUGGESTIONS: Record<string, string[]> = {
  technician: ['CCTV', 'Control de acceso', 'Alarma contra incendios', 'Fibra óptica', 'BMS', 'Seguridad electrónica', 'Cableado estructurado', 'Trabajo en altura'],
  supervisor: ['Supervisión de obra', 'Gestión de equipos', 'Seguridad y salud (SST)', 'Control de calidad', 'Planificación de trabajos', 'Atención al cliente', 'CCTV', 'Control de acceso'],
  coordinador: ['Planificación', 'Coordinación de equipos', 'Gestión documental', 'Programación de turnos', 'Control de materiales', 'Logística', 'Atención al cliente'],
  admin: ['Gestión de usuarios', 'Administración del sistema', 'Gestión de personal', 'Control de documentos', 'Reportes y análisis', 'Contratos'],
};

const clean = (v: string) => v.replace(/\s+/g, ' ').trim();

function Chip({ text, onRemove }: { text: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 max-w-full rounded-full bg-primary-50 text-primary-700 text-xs font-medium pl-2.5 pr-2.5 py-1">
      <span className="truncate">{text}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} className="shrink-0 -mr-1 h-4 w-4 rounded-full hover:bg-primary-100 flex items-center justify-center" title="Quitar">
          <X size={11} />
        </button>
      )}
    </span>
  );
}

export function SkillsCard() {
  const { profile } = useAuth();
  const [skills, setSkills] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read straight from the database so the list is always current, not the copy kept at login.
  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase.from('user_skills').select('skills').eq('user_id', profile.id).maybeSingle();
      setSkills(Array.isArray(data?.skills) ? data.skills : []);
      setLoading(false);
    })();
  }, [profile?.id]);

  if (!profile) return null;

  const startEdit = () => { setDraft(skills); setInput(''); setError(null); setSaved(false); setEditing(true); };
  const cancel = () => { setEditing(false); setError(null); };

  const add = (raw: string) => {
    const value = clean(raw).slice(0, MAX_LEN);
    if (!value) return;
    if (draft.length >= MAX_SKILLS) { setError(`Puedes agregar hasta ${MAX_SKILLS} habilidades.`); return; }
    if (draft.some((s) => s.toLowerCase() === value.toLowerCase())) { setError('Esa habilidad ya está en tu lista.'); return; }
    setDraft([...draft, value]);
    setInput('');
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('user_skills')
      .upsert({ user_id: profile.id, skills: draft, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    setSaving(false);
    if (err) { setError(`No se pudo guardar: ${err.message}`); return; }
    setSkills(draft);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const suggestions = (SUGGESTIONS[profile.role] ?? [])
    .filter((s) => !draft.some((d) => d.toLowerCase() === s.toLowerCase()))
    .slice(0, 6);
  const full = draft.length >= MAX_SKILLS;

  return (
    <Card>
      <SectionHeader
        title="Habilidades & Certificaciones"
        subtitle={editing ? `Agrega hasta ${MAX_SKILLS}. Escribe lo que te represente: una habilidad, un curso o una certificación.` : undefined}
        action={
          editing ? (
            <div className="flex gap-2">
              <button className="btn-secondary h-8 text-xs" onClick={cancel} disabled={saving}>Cancelar</button>
              <button className="btn-primary h-8 text-xs" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          ) : (
            <button className="btn-secondary h-8 text-xs" onClick={startEdit} disabled={loading}>{skills.length === 0 ? 'Agregar' : 'Editar'}</button>
          )
        }
      />

      {saved && <div className="mb-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">Habilidades guardadas ✓</div>}
      {error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>}

      {loading ? (
        <p className="text-sm text-ink-400">Cargando…</p>
      ) : !editing ? (
        skills.length === 0 ? (
          <p className="text-sm text-ink-400">Aún no agregaste habilidades. Toca «Agregar» para contar qué sabes hacer.</p>
        ) : (
          <div className="flex flex-wrap gap-2">{skills.map((s) => <Chip key={s} text={s} />)}</div>
        )
      ) : (
        <div>
          <div className="flex flex-wrap gap-2 min-h-[28px] mb-3">
            {draft.length === 0 && <span className="text-xs text-ink-400">Todavía no hay ninguna. Escribe una abajo o elige una sugerencia.</span>}
            {draft.map((s) => <Chip key={s} text={s} onRemove={() => setDraft(draft.filter((d) => d !== s))} />)}
          </div>

          <div className="flex gap-2">
            <input
              className="input h-9 flex-1"
              value={input}
              maxLength={MAX_LEN}
              placeholder={full ? 'Llegaste al máximo' : 'Ej. CCTV, Curso de altura, OSHA 30…'}
              disabled={full}
              onChange={(e) => { setInput(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(input); } }}
            />
            <button type="button" className="btn-secondary h-9 text-xs" onClick={() => add(input)} disabled={full || !clean(input)}>
              <Plus size={14} /> Agregar
            </button>
          </div>
          <div className="flex justify-between text-[11px] text-ink-400 mt-1">
            <span>Pulsa Enter para agregar · hasta {MAX_LEN} letras cada una</span>
            <span>{draft.length}/{MAX_SKILLS}</span>
          </div>

          {suggestions.length > 0 && !full && (
            <div className="mt-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400 mb-1.5">Sugerencias para tu puesto (opcionales)</div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => add(s)}
                    className="rounded-full border border-dashed border-ink-300 text-ink-600 hover:border-primary-400 hover:text-primary-700 hover:bg-primary-50 text-xs px-2.5 py-1 transition"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
