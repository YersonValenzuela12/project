import { useEffect, useState } from 'react';
import { Search, Play } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { parseDriveUrl, thumbnailUrl } from '@/lib/drive';
import {
  categoryIcon, TYPE_LABEL, TYPE_ICON, LEVEL_LABEL, LEVEL_BADGE, fmtDuration,
  type TrainingCategory, type TrainingContent,
} from '@/lib/trainingConfig';
import { TrainingViewerModal } from '@/components/TrainingViewer';
import type { LucideIcon } from 'lucide-react';

// Cover image from Drive, with an automatic fallback (colored block + category icon) if it does not load.
function Cover({ url, Icon }: { url: string | null; Icon: LucideIcon }) {
  const [failed, setFailed] = useState(false);
  const parsed = url ? parseDriveUrl(url) : null;

  if (!parsed || failed) {
    return (
      <div className="aspect-video w-full bg-gradient-to-br from-primary-50 to-ink-100 flex items-center justify-center text-primary-500">
        <Icon size={36} />
      </div>
    );
  }
  return (
    <img
      src={thumbnailUrl(parsed, 640)}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className="aspect-video w-full object-cover bg-ink-100"
      onError={() => setFailed(true)}
    />
  );
}

export function TrainingPage() {
  const { profile } = useAuth();
  const [cats, setCats] = useState<TrainingCategory[]>([]);
  const [items, setItems] = useState<TrainingContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catId, setCatId] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<TrainingContent | null>(null);

  useEffect(() => {
    (async () => {
      // The database only returns published contents (and active categories) to technicians.
      const [catRes, itemRes] = await Promise.all([
        supabase.from('training_categories').select('*').eq('is_active', true).order('display_order'),
        supabase.from('training_contents').select('*').eq('status', 'PUBLISHED').order('display_order').order('created_at', { ascending: false }),
      ]);
      if (catRes.error || itemRes.error) {
        console.error('Capacitación:', catRes.error ?? itemRes.error);
        setError('No se pudo cargar la biblioteca. Inténtalo de nuevo en un momento.');
      } else {
        setCats(catRes.data ?? []);
        setItems(itemRes.data ?? []);
      }
      setLoading(false);
    })();
  }, []);

  if (!profile) return null;

  const catById = new Map(cats.map((c) => [c.id, c]));
  const visibleItems = items.filter((i) => catById.has(i.category_id)); // contents of a hidden category are not shown
  const countOf = (id: string) => visibleItems.filter((i) => i.category_id === id).length;

  const shown = visibleItems
    .filter((i) => catId === 'all' || i.category_id === catId)
    .filter((i) => !query.trim() || `${i.title} ${i.description}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Capacitación técnica"
        subtitle="Videos, infografías y guías visuales de los sistemas que trabajas"
        breadcrumbs={['Inicio', 'Técnico', 'Capacitación técnica']}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-ink-500">Cargando…</div></Card>
      ) : error ? (
        <Card><div className="p-8 text-center text-sm text-red-600">{error}</div></Card>
      ) : cats.length === 0 ? (
        <Card><div className="p-8 text-center text-sm text-ink-400">Todavía no hay categorías disponibles.</div></Card>
      ) : (
        <>
          {/* Categories */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {cats.map((c) => {
              const Icon = categoryIcon(c.name);
              const active = catId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCatId(active ? 'all' : c.id)}
                  className="block w-full h-full text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  <Card className={cn('h-full transition hover:shadow-card-md cursor-pointer', active && 'ring-2 ring-primary-500')}>
                    <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', active ? 'bg-primary-600 text-white' : 'bg-primary-50 text-primary-600')}>
                      <Icon size={18} />
                    </div>
                    <div className="mt-3 font-semibold text-ink-900">{c.name}</div>
                    <div className="text-xs text-ink-500">{countOf(c.id)} {countOf(c.id) === 1 ? 'contenido' : 'contenidos'}</div>
                  </Card>
                </button>
              );
            })}
          </div>

          {/* Search + active filter */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                className="input h-9 pl-8"
                placeholder="Buscar por título o descripción…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {catId !== 'all' && (
              <button className="btn-secondary h-9 text-xs" onClick={() => setCatId('all')}>
                Mostrando: {catById.get(catId)?.name} · Ver todo
              </button>
            )}
          </div>

          {/* Contents */}
          {shown.length === 0 ? (
            <Card>
              <div className="p-8 text-center text-sm text-ink-400">
                {visibleItems.length === 0 ? 'Aún no hay contenidos publicados.' : 'No hay contenidos que coincidan con tu búsqueda.'}
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {shown.map((i) => {
                const cat = catById.get(i.category_id)!;
                const Icon = categoryIcon(cat.name);
                const TypeIcon = TYPE_ICON[i.content_type];
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => setOpen(i)}
                    className="block w-full h-full text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  >
                    <Card pad={false} className="h-full overflow-hidden transition hover:shadow-card-md cursor-pointer">
                      <div className="relative">
                        <Cover url={i.thumbnail_url} Icon={Icon} />
                        {i.content_type === 'VIDEO' && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="h-11 w-11 rounded-full bg-black/55 text-white flex items-center justify-center"><Play size={18} /></div>
                          </div>
                        )}
                        {i.content_type === 'VIDEO' && i.duration_minutes ? (
                          <span className="absolute bottom-2 right-2 rounded bg-black/70 text-white text-[11px] font-medium px-1.5 py-0.5">{fmtDuration(i.duration_minutes)}</span>
                        ) : null}
                      </div>
                      <div className="p-4">
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          <Badge className="bg-primary-50 text-primary-700">{cat.name}</Badge>
                          <Badge className="bg-ink-100 text-ink-600"><span className="inline-flex items-center gap-1"><TypeIcon size={11} /> {TYPE_LABEL[i.content_type]}</span></Badge>
                          <Badge className={LEVEL_BADGE[i.level]}>{LEVEL_LABEL[i.level]}</Badge>
                        </div>
                        <div className="font-semibold text-ink-900 leading-snug">{i.title}</div>
                        {i.description && <p className="text-sm text-ink-500 mt-1 line-clamp-2">{i.description}</p>}
                        <div className="mt-3 text-sm font-medium text-primary-600">Ver contenido →</div>
                      </div>
                    </Card>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {open && (
        <TrainingViewerModal
          item={open}
          categoryName={catById.get(open.category_id)?.name ?? ''}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
