import { useEffect, useRef, useState } from 'react';
import { ExternalLink, X, ArrowLeft, Maximize2, Minimize2, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';
import { previewUrl, openUrl, thumbnailUrl } from '@/lib/drive';
import { youtubeEmbedUrl, youtubeWatchUrl } from '@/lib/youtube';
import { resolveMedia, type Media } from '@/lib/media';
import {
  TYPE_LABEL, TYPE_ICON, LEVEL_LABEL, LEVEL_BADGE, fmtDuration, REASON_LABEL,
  type ContentType, type TrainingContent, type AccessRequest, type RequestReason,
} from '@/lib/trainingConfig';

// Printing the page hides the viewer.
const VIEWER_CSS = `@media print { .training-protect { display: none !important; } }`;

// ---------------------------------------------------------------------------
// The viewer. Video / guide in Drive's embedded player, image shown directly (falls back to the player).
// allowExternal = true is only for the administrator's preview; technicians never get a link out.
// ---------------------------------------------------------------------------
export function TrainingViewer({
  media, type, title, allowExternal = false, onRequestAccess,
}: {
  media: Media;
  type: ContentType;
  title: string;
  allowExternal?: boolean;
  onRequestAccess?: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const drive = media.source === 'DRIVE' ? media.drive : null;
  const yt = media.source === 'YOUTUBE' ? media.youtube : null;
  const showImage = type === 'IMAGE' && !!drive && drive.kind === 'file' && !imgFailed;
  const videoShaped = !!yt || type === 'VIDEO';

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [expanded]);

  return (
    <div>
      <style>{VIEWER_CSS}</style>

      <div
        className={cn(
          'training-protect select-none overflow-hidden',
          expanded
            ? 'fixed inset-0 z-[90] bg-black flex items-center justify-center'
            : cn(
                'relative rounded-lg border border-ink-200 bg-ink-100',
                showImage ? 'flex items-center justify-center' : videoShaped ? 'aspect-video' : 'h-[70vh]',
              ),
        )}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        {showImage && drive ? (
          <img
            src={thumbnailUrl(drive, 1600)}
            alt={title}
            draggable={false}
            referrerPolicy="no-referrer"
            className={cn('pointer-events-none select-none object-contain', expanded ? 'max-h-screen max-w-full' : 'max-h-[70vh] w-auto max-w-full')}
            onError={() => setImgFailed(true)}
          />
        ) : drive ? (
          <iframe
            src={previewUrl(drive)}
            title={title}
            className="w-full h-full"
            allow="autoplay"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : yt ? (
          <iframe
            src={youtubeEmbedUrl(yt)}
            title={title}
            className="w-full h-full"
            allow="autoplay"
            sandbox="allow-scripts allow-same-origin"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : null}

        {/* Shield over the corner / strip where the embedded player puts its own "open elsewhere" buttons. */}
        {!showImage && (
          <div className={cn('absolute top-0 z-20 h-14', yt ? 'inset-x-0' : cn('right-0', type === 'GUIDE' ? 'w-56' : 'w-16'))} />
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="absolute top-2 left-2 z-30 h-8 px-2.5 rounded-md bg-black/60 hover:bg-black/75 text-white text-xs font-medium flex items-center gap-1.5"
        >
          {expanded ? <><Minimize2 size={13} /> Cerrar ampliado</> : <><Maximize2 size={13} /> Ampliar</>}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
        <p className="text-xs text-ink-500 flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
          {yt
            ? 'Se reproduce dentro de Selecom y tu visualización queda registrada a tu nombre.'
            : 'Contenido de uso interno: se ve solo dentro de Selecom y queda registrado a tu nombre.'}
        </p>
        {allowExternal && (
          <a
            href={drive ? openUrl(drive) : youtubeWatchUrl(yt!)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary h-8 text-xs shrink-0"
          >
            <ExternalLink size={13} /> {drive ? 'Abrir en Google Drive (solo administrador)' : 'Abrir en YouTube (solo administrador)'}
          </a>
        )}
      </div>

      <p className="text-xs text-ink-400 mt-1.5">
        {yt
          ? '¿No carga? Puede que el autor del video no permita verlo fuera de YouTube. Avisa al administrador.'
          : '¿No carga? Si es un video recién subido, Drive puede tardar unos minutos en procesarlo.'}
        {onRequestAccess && (
          <> Si el problema sigue, <button type="button" className="underline text-ink-500 hover:text-ink-700" onClick={onRequestAccess}>solicita acceso externo</button>.</>
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Access request (last resort). Nothing leaves Selecom unless an administrator decides it.
// ---------------------------------------------------------------------------
function AccessRequestModal({ item, onClose, onSent }: { item: TrainingContent; onClose: () => void; onSent: (r: AccessRequest) => void }) {
  const { profile } = useAuth();
  const [reason, setReason] = useState<RequestReason>('NO_LOAD');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!profile) return;
    setSending(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('training_access_requests')
      .insert({ content_id: item.id, reason, note: note.trim() })
      .select('*')
      .single();
    setSending(false);

    if (err || !data) {
      setError(err?.code === '23505' ? 'Ya tienes una solicitud pendiente para este contenido.' : `No se pudo enviar: ${err?.message ?? 'error desconocido'}`);
      return;
    }

    // Tell the administrators (never blocks the request if it fails).
    try {
      const { data: adminIds } = await supabase.rpc('get_admin_ids');
      if (adminIds && adminIds.length > 0) {
        await supabase.from('notifications').insert(
          adminIds.map((id: string) => ({
            user_id: id,
            type: 'training_access_request',
            title: 'Solicitud de acceso externo a capacitación',
            body: `${profile.full_name} pide acceso externo a «${item.title}».`,
            color: 'bg-amber-500',
            unread: true,
            actor_id: profile.id,
          })),
        );
      }
      await logActivity({ actorName: profile.full_name, action: 'solicitó acceso externo a un contenido de capacitación', target: 'training', detail: item.title });
    } catch (e) {
      console.debug('Solicitud guardada, pero no se pudo avisar al administrador:', e);
    }
    onSent(data as AccessRequest);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-3 sm:px-4">
      <div className="absolute inset-0 bg-ink-900/60" onClick={() => !sending && onClose()} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-ink-900">Solicitar acceso externo</h3>
          <button onClick={onClose} disabled={sending} className="h-8 w-8 rounded-md hover:bg-ink-100 flex items-center justify-center text-ink-500"><X size={16} /></button>
        </div>
        <p className="text-sm text-ink-600 mb-4">
          Por seguridad, los contenidos se ven solo dentro de Selecom. Si de verdad lo necesitas fuera, el administrador revisará tu solicitud y,
          si la aprueba, te lo compartirá.
        </p>

        {error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

        <label className="label">¿Por qué lo necesitas?</label>
        <div className="space-y-2" role="radiogroup" aria-label="Motivo">
          {(Object.keys(REASON_LABEL) as RequestReason[]).map((r) => (
            <label
              key={r}
              className={cn(
                'flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer text-sm transition',
                reason === r ? 'border-primary-500 bg-primary-50 text-ink-900' : 'border-ink-200 text-ink-700 hover:bg-ink-50',
              )}
            >
              <input type="radio" name="training-reason" className="shrink-0" checked={reason === r} onChange={() => setReason(r)} />
              {REASON_LABEL[r]}
            </label>
          ))}
        </div>

        <label className="label mt-4">Detalle (opcional)</label>
        <textarea className="input" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cuéntanos qué pasa…" />

        <div className="flex gap-2 mt-4">
          <button className="btn-secondary flex-1" onClick={onClose} disabled={sending}>Cancelar</button>
          <button className="btn-primary flex-1" onClick={send} disabled={sending}>{sending ? 'Enviando…' : 'Enviar solicitud'}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full window used by the technician to watch / read a content. Opening it is recorded.
// ---------------------------------------------------------------------------
export function TrainingViewerModal({
  item, categoryName, onClose,
}: {
  item: TrainingContent;
  categoryName: string;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const media = resolveMedia(item.source, item.drive_url);
  const TypeIcon = TYPE_ICON[item.content_type];
  const [request, setRequest] = useState<AccessRequest | null>(null);
  const [requesting, setRequesting] = useState(false);
  const logged = useRef(false);

  // Record that this person opened the content (once per opening).
  useEffect(() => {
    if (!profile || logged.current) return;
    logged.current = true;
    supabase.from('training_views').insert({ content_id: item.id }).then(({ error }) => {
      if (error) console.debug('No se pudo registrar la visualización:', error.message);
    });
  }, [profile, item.id]);

  // The latest request this person made for this content, if any.
  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase
        .from('training_access_requests')
        .select('*')
        .eq('content_id', item.id)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setRequest((data as AccessRequest) ?? null);
    })();
  }, [profile, item.id]);

  const banner =
    request?.status === 'PENDING'
      ? { cls: 'bg-amber-50 border-amber-200 text-amber-800', text: `Enviaste una solicitud de acceso externo el ${new Date(request.created_at).toLocaleDateString('es-PE')}. Esperando la respuesta del administrador.` }
      : request?.status === 'GRANTED'
        ? { cls: 'bg-emerald-50 border-emerald-200 text-emerald-800', text: `El administrador aprobó tu solicitud. ${request.admin_note || 'Te lo compartirá por fuera de Selecom.'}` }
        : request?.status === 'DENIED'
          ? { cls: 'bg-ink-50 border-ink-200 text-ink-700', text: `El administrador no aprobó tu solicitud. ${request.admin_note || ''}` }
          : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3 sm:px-4">
      <div className="absolute inset-0 bg-ink-900/60" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-start gap-3 px-5 pt-4 pb-3 border-b border-ink-100">
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-ink-900">{item.title}</h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <Badge className="bg-primary-50 text-primary-700">{categoryName}</Badge>
              <Badge className="bg-ink-100 text-ink-600"><span className="inline-flex items-center gap-1"><TypeIcon size={11} /> {TYPE_LABEL[item.content_type]}</span></Badge>
              <Badge className={LEVEL_BADGE[item.level]}>{LEVEL_LABEL[item.level]}</Badge>
              {item.content_type === 'VIDEO' && item.duration_minutes ? (
                <Badge className="bg-ink-100 text-ink-600">{fmtDuration(item.duration_minutes)}</Badge>
              ) : null}
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-ink-100 flex items-center justify-center text-ink-500 shrink-0" title="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {banner && <div className={`mb-4 rounded-lg border px-3.5 py-2.5 text-sm ${banner.cls}`}>{banner.text}</div>}

          {media ? (
            <TrainingViewer
              media={media}
              type={item.content_type}
              title={item.title}
              onRequestAccess={media.source === 'DRIVE' && request?.status !== 'PENDING' ? () => setRequesting(true) : undefined}
            />
          ) : (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              Este contenido todavía no tiene un enlace válido. Avisa al administrador.
            </div>
          )}

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-ink-900 mb-1">Información complementaria</h3>
            {item.description ? (
              <p className="text-sm text-ink-700 leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>{item.description}</p>
            ) : (
              <p className="text-sm text-ink-400">Este contenido no tiene descripción.</p>
            )}
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
              <div><dt className="text-ink-400 uppercase tracking-wide text-[10px] font-semibold">Sistema</dt><dd className="text-ink-800 mt-0.5">{categoryName}</dd></div>
              <div><dt className="text-ink-400 uppercase tracking-wide text-[10px] font-semibold">Nivel</dt><dd className="text-ink-800 mt-0.5">{LEVEL_LABEL[item.level]}</dd></div>
              <div><dt className="text-ink-400 uppercase tracking-wide text-[10px] font-semibold">Tipo</dt><dd className="text-ink-800 mt-0.5">{TYPE_LABEL[item.content_type]}</dd></div>
              <div><dt className="text-ink-400 uppercase tracking-wide text-[10px] font-semibold">Actualizado</dt><dd className="text-ink-800 mt-0.5">{new Date(item.updated_at).toLocaleDateString('es-PE')}</dd></div>
            </dl>
          </div>
        </div>

        <div className="shrink-0 px-5 py-3 border-t border-ink-100">
          <button className="btn-secondary" onClick={onClose}><ArrowLeft size={15} /> Volver a la biblioteca</button>
        </div>
      </div>

      {requesting && (
        <AccessRequestModal
          item={item}
          onClose={() => setRequesting(false)}
          onSent={(r) => { setRequest(r); setRequesting(false); }}
        />
      )}
    </div>
  );
}
