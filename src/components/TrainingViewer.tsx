import { useState } from 'react';
import { ExternalLink, X, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { parseDriveUrl, previewUrl, openUrl, thumbnailUrl, type ParsedDrive } from '@/lib/drive';
import {
  TYPE_LABEL, TYPE_ICON, LEVEL_LABEL, LEVEL_BADGE, fmtDuration,
  type ContentType, type TrainingContent,
} from '@/lib/trainingConfig';

// The viewer itself: video / guide in Drive's embedded player, image shown directly (falls back to the player).
export function TrainingViewer({ drive, type, title }: { drive: ParsedDrive; type: ContentType; title: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = type === 'IMAGE' && drive.kind === 'file' && !imgFailed;

  return (
    <div>
      {showImage ? (
        <div className="rounded-lg overflow-hidden bg-ink-50 border border-ink-200 flex items-center justify-center">
          <img
            src={thumbnailUrl(drive, 1600)}
            alt={title}
            className="max-h-[70vh] w-auto max-w-full object-contain"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
          />
        </div>
      ) : (
        <div className={cn('w-full rounded-lg overflow-hidden bg-ink-100 border border-ink-200', type === 'VIDEO' ? 'aspect-video' : 'h-[70vh]')}>
          <iframe
            src={previewUrl(drive)}
            title={title}
            className="w-full h-full"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
        <p className="text-xs text-ink-500">
          ¿No carga? Puede que el archivo no esté compartido o que Drive aún lo esté procesando.
        </p>
        <a
          href={openUrl(drive)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary h-8 text-xs shrink-0"
        >
          <ExternalLink size={13} /> Abrir en Google Drive
        </a>
      </div>
    </div>
  );
}

// Full-screen window used by the technician to watch / read a content.
export function TrainingViewerModal({
  item, categoryName, onClose,
}: {
  item: TrainingContent;
  categoryName: string;
  onClose: () => void;
}) {
  const drive = item.drive_url ? parseDriveUrl(item.drive_url) : null;
  const TypeIcon = TYPE_ICON[item.content_type];

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
          {drive ? (
            <TrainingViewer drive={drive} type={item.content_type} title={item.title} />
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
    </div>
  );
}
