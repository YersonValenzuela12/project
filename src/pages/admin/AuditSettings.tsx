import { useEffect, useMemo, useState } from 'react';
import { Shield, User, FileText, Settings, Database, Lock, Globe, ChevronDown, Check } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, SectionHeader, Avatar, Badge, Tabs } from '@/components/ui';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { generateAuditPdf } from '@/lib/auditReport';

type AuditLogRow = {
  id: string;
  actor_name: string;
  action: string;
  target: string | null;
  detail: string | null;
  ip_address: string | null;
  created_at: string;
};

const TAB_LABELS: Record<string, 'Activity' | 'Logins' | 'System' | 'Security'> = {
  'Actividad': 'Activity',
  'Inicios de Sesión': 'Logins',
  'Sistema': 'System',
  'Seguridad': 'Security',
};
const TABS_ES = ['Actividad', 'Inicios de Sesión', 'Sistema', 'Seguridad'];

function categorize(action: string): 'Activity' | 'Logins' | 'System' | 'Security' {
  const a = action.toUpperCase();
  if (a.includes('LOGIN')) return 'Logins';
  if (a.includes('BACKUP') || a.includes('SYSTEM')) return 'System';
  if (a.includes('ROLE') || a.includes('POLICY') || a.includes('PERMISSION') || a.includes('PASSWORD')) return 'Security';
  return 'Activity';
}

export function AuditPage() {
  const [tabEs, setTabEs] = useState<string>('Actividad');
  const tab = TAB_LABELS[tabEs];
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [profilesByName, setProfilesByName] = useState<Map<string, { initials: string; avatar_color: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: logData } = await supabase
        .from('audit_logs')
        .select('id, actor_name, action, target, detail, ip_address, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, initials, avatar_color');

      if (!cancelled) {
        setLogs(logData ?? []);
        setProfilesByName(new Map((profileData ?? []).map((p: any) => [p.full_name, p])));
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filteredLogs = useMemo(() => logs.filter((l) => categorize(l.action) === tab), [logs, tab]);

  async function handleExport(range: 'week' | 'month') {
    setExportOpen(false);
    setExporting(true);
    try {
      await generateAuditPdf(range, tab);
    } catch (err) {
      console.error('Error al exportar:', err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Registro de Auditoría"
        subtitle="Registro inmutable de todas las acciones del sistema para cumplimiento"
        breadcrumbs={['Inicio', 'Administrador', 'Registro de Auditoría']}
        actions={
          <div className="relative">
            <button className="btn-secondary" onClick={() => setExportOpen((v) => !v)} disabled={exporting}>
              <Database size={15} /> {exporting ? 'Generando…' : 'Exportar Registro'} <ChevronDown size={14} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white border border-ink-100 rounded-lg shadow-card-md z-10 overflow-hidden">
                <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-ink-50" onClick={() => handleExport('week')}>Última semana</button>
                <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-ink-50" onClick={() => handleExport('month')}>Este mes</button>
              </div>
            )}
          </div>
        }
      />
      <Card pad={false} className="overflow-hidden">
        <div className="px-5 pt-4"><Tabs tabs={TABS_ES} active={tabEs} onChange={(t: any) => setTabEs(t)} /></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="bg-ink-50/50 border-y border-ink-100">
              <tr>
                <th className="th">Actor</th><th className="th">Acción</th><th className="th">Objetivo</th>
                <th className="th">Detalle</th><th className="th">Dirección IP</th><th className="th">Fecha y hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {loading && <tr><td className="td text-ink-400" colSpan={6}>Cargando…</td></tr>}
              {!loading && filteredLogs.length === 0 && (
                <tr><td className="td text-ink-400" colSpan={6}>No hay registros en esta categoría</td></tr>
              )}
              {filteredLogs.map((l) => {
                const p = profilesByName.get(l.actor_name);
                return (
                  <tr key={l.id} className="hover:bg-ink-50/40">
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        {p ? <Avatar initials={p.initials} color={p.avatar_color} size="sm" /> : <span className="h-8 w-8 rounded-full bg-ink-200 flex items-center justify-center"><Shield size={14} className="text-ink-500" /></span>}
                        <span className="font-medium text-ink-900">{l.actor_name}</span>
                      </div>
                    </td>
                    <td className="td"><Badge className="bg-ink-100 text-ink-700 font-mono text-[11px]">{l.action}</Badge></td>
                    <td className="td text-ink-700">{l.target ?? '—'}</td>
                    <td className="td text-ink-500">{l.detail ?? '—'}</td>
                    <td className="td font-mono text-xs text-ink-500">{l.ip_address ?? '—'}</td>
                    <td className="td text-ink-500 whitespace-nowrap">{new Date(l.created_at).toLocaleString('es-PE')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function SettingsPage() {
  const [tab, setTab] = useState('General');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [orgName, setOrgName] = useState('');
  const [platformUrl, setPlatformUrl] = useState('');
  const [timezone, setTimezone] = useState('Lima - Perú');
  const [dateFormat, setDateFormat] = useState('DD/MM/AAAA');
  const [currency, setCurrency] = useState('Soles (S/.)');
  const [workingHours, setWorkingHours] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('system_settings').select('*').eq('id', 'global').single();
      if (data) {
        setOrgName(data.org_name ?? '');
        setPlatformUrl(data.platform_url ?? '');
        setTimezone(data.timezone ?? 'Lima - Perú');
        setDateFormat(data.date_format ?? 'DD/MM/AAAA');
        setCurrency(data.currency ?? 'Soles (S/.)');
        setWorkingHours(data.working_hours ?? '');
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    const { error } = await supabase
      .from('system_settings')
      .update({
        org_name: orgName,
        platform_url: platformUrl,
        timezone,
        date_format: dateFormat,
        currency,
        working_hours: workingHours,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'global');
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      <PageHeader title="Configuración del Sistema" subtitle="Configuración y preferencias de la plataforma" breadcrumbs={['Inicio', 'Administrador', 'Configuración del Sistema']} />
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
        <div className="space-y-1">
          {[
            { k: 'General', label: 'General', icon: Settings },
            { k: 'Security', label: 'Seguridad', icon: Lock },
            { k: 'Users', label: 'Usuarios', icon: User },
            { k: 'Integrations', label: 'Integraciones', icon: Globe },
            { k: 'Backups', label: 'Respaldos', icon: Database },
            { k: 'Documents', label: 'Documentos', icon: FileText },
          ].map((s) => (
            <button key={s.k} onClick={() => setTab(s.k)} className={cn('nav-item w-full', tab === s.k && 'nav-item-active')}>
              <s.icon size={16} /> {s.label}
            </button>
          ))}
        </div>
        <div className="space-y-4">
          <Card>
            <SectionHeader
              title="Configuración General"
              subtitle="Preferencias generales de la organización"
              action={
                <div className="flex items-center gap-2">
                  {saved && <span className="text-xs font-medium text-emerald-600 flex items-center gap-1"><Check size={13} /> Guardado</span>}
                  <button className="btn-primary h-8 text-xs" onClick={handleSave} disabled={saving || loading}>
                    {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              }
            />
            {saveError && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{saveError}</div>}
            {loading ? (
              <div className="py-6 text-center text-sm text-ink-500">Cargando…</div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Nombre de la organización</label><input className="input" value={orgName} onChange={(e) => setOrgName(e.target.value)} /></div>
                <div><label className="label">URL de la plataforma</label><input className="input" value={platformUrl} onChange={(e) => setPlatformUrl(e.target.value)} /></div>
                <div>
                  <label className="label">Zona horaria</label>
                  <select className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                    <option>Lima - Perú</option>
                  </select>
                </div>
                <div>
                  <label className="label">Formato de fecha</label>
                  <select className="input" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                    <option>DD/MM/AAAA</option>
                    <option>MMM D, AAAA</option>
                  </select>
                </div>
                <div>
                  <label className="label">Moneda</label>
                  <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option>Soles (S/.)</option>
                    <option>Dólares ($)</option>
                  </select>
                </div>
                <div><label className="label">Horario laboral</label><input className="input" value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} placeholder="08:00 – 18:00" /></div>
              </div>
            )}
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-4 right-4"><Badge className="bg-amber-50 text-amber-700">Próximamente</Badge></div>
            <SectionHeader title="Políticas de Seguridad" subtitle="Autenticación y controles de acceso" />
            <div className="opacity-50 pointer-events-none">
              <Toggle label="Exigir autenticación multifactor" desc="Requerir MFA para todos los usuarios" on />
              <Toggle label="Cierre de sesión tras 30 minutos" desc="Cierre automático por inactividad" on />
              <Toggle label="Lista blanca de IPs" desc="Restringir acceso a redes conocidas" />
              <Toggle label="Renovación de contraseña cada 90 días" desc="Forzar cambios periódicos de contraseña" on />
            </div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-4 right-4"><Badge className="bg-amber-50 text-amber-700">Próximamente</Badge></div>
            <SectionHeader title="Respaldos Automáticos" subtitle="Gestionados directamente por Supabase" action={<button className="btn-secondary" disabled>Ejecutar ahora</button>} />
            <div className="opacity-50 pointer-events-none">
              <Toggle label="Respaldo completo diario de la base de datos" desc="02:00, retenido 30 días" on />
              <Toggle label="Archivo semanal de documentos" desc="Domingos 03:00, retenido 90 días" on />
              <Toggle label="Replicación en tiempo real" desc="Transmisión continua a servidor de respaldo" on />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, desc, on }: { label: string; desc: string; on?: boolean }) {
  const [v, setV] = useState(!!on);
  return (
    <div className="flex items-center justify-between py-3 border-b border-ink-50 last:border-0">
      <div><div className="text-sm font-medium text-ink-900">{label}</div><div className="text-xs text-ink-500">{desc}</div></div>
      <button onClick={() => setV((x) => !x)} className={cn('h-6 w-11 rounded-full transition-colors relative', v ? 'bg-primary-600' : 'bg-ink-200')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', v ? 'translate-x-5' : 'translate-x-0.5')} />
      </button>
    </div>
  );
}
