import { useEffect, useState } from 'react';
import { LifeBuoy, MessageCircle, Send, X, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';

const TOPICS = [
  'No puedo iniciar sesión',
  'Error en la plataforma',
  'Ayuda con un formulario',
  'Ayuda con una orden de trabajo',
  'Otro',
];

const ROLE_LABEL: Record<string, string> = {
  technician: 'Técnico', supervisor: 'Supervisor', coordinador: 'Coordinador', admin: 'Administrador',
};

// The administrator types the number in Configuración. Peruvian mobiles have 9 digits, so add the country code if missing.
const toWhatsappNumber = (raw: string | null | undefined) => {
  const digits = (raw ?? '').replace(/\D/g, '');
  return digits.length === 9 ? `51${digits}` : digits;
};

export function SupportCard() {
  const { profile } = useAuth();
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('system_settings').select('support_whatsapp').eq('id', 'global').maybeSingle();
      setWhatsapp(toWhatsappNumber(data?.support_whatsapp));
    })();
  }, []);

  // Administrators are the ones who answer support, so they do not need this card.
  if (!profile || profile.role === 'admin') return null;

  const role = ROLE_LABEL[profile.role] ?? profile.role;
  const waText = `Hola, soy ${profile.full_name} (${role}). Necesito soporte con la plataforma Selecom: `;
  const waLink = whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(waText)}` : null;

  const send = async () => {
    setError(null);
    if (message.trim().length < 10) { setError('Cuéntanos un poco más (al menos 10 letras) para poder ayudarte.'); return; }
    setSending(true);
    try {
      const { data: adminIds, error: rpcErr } = await supabase.rpc('get_admin_ids');
      if (rpcErr || !adminIds || adminIds.length === 0) throw new Error('No se pudo contactar a los administradores.');

      const { error: insErr } = await supabase.from('notifications').insert(
        adminIds.map((id: string) => ({
          user_id: id,
          type: 'support_request',
          title: `Solicitud de soporte: ${topic}`,
          body: `${profile.full_name} (${role}): ${message.trim().slice(0, 400)}`,
          color: 'bg-amber-500',
          unread: true,
          actor_id: profile.id,
        })),
      );
      if (insErr) throw insErr;

      await logActivity({ actorName: profile.full_name, action: 'solicitó soporte', target: 'support', detail: topic });
      setSent(true);
      setOpen(false);
      setMessage('');
      setTopic(TOPICS[0]);
    } catch (e: any) {
      console.error('Error al solicitar soporte:', e);
      setError(e?.message ? `No se pudo enviar: ${e.message}` : 'No se pudo enviar. Inténtalo nuevamente.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-ink-100">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
        <LifeBuoy size={15} className="text-primary-600" /> Soporte
      </div>
      <p className="text-xs text-ink-500 mt-1">¿Algo no funciona o tienes una duda? Escríbenos.</p>

      <div className="mt-3 space-y-2">
        {waLink ? (
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <MessageCircle size={15} /> Escribir por WhatsApp
          </a>
        ) : (
          <p className="text-[11px] text-ink-400">El WhatsApp de soporte aún no fue configurado por el administrador.</p>
        )}
        <button
          type="button"
          className="btn-secondary w-full h-9 text-xs"
          onClick={() => { setOpen(true); setSent(false); setError(null); }}
        >
          <Send size={14} /> Solicitar soporte al administrador
        </button>
      </div>

      {sent && (
        <p className="text-xs text-emerald-700 mt-2 flex items-start gap-1.5">
          <CheckCircle2 size={14} className="shrink-0 mt-px" /> Solicitud enviada. Un administrador la verá en sus notificaciones.
        </p>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-ink-900/50" onClick={() => !sending && setOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-ink-900">Solicitar soporte</h3>
              <button type="button" onClick={() => setOpen(false)} disabled={sending} className="text-ink-400 hover:text-ink-700"><X size={18} /></button>
            </div>

            {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3.5 py-3 text-sm text-red-700">{error}</div>}

            <label className="label">¿Con qué necesitas ayuda?</label>
            <select className="input" value={topic} onChange={(e) => setTopic(e.target.value)}>
              {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <label className="label mt-4">Cuéntanos qué pasa</label>
            <textarea
              className="input"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe el problema o la duda con el mayor detalle posible…"
              maxLength={400}
            />
            <p className="text-[11px] text-ink-400 mt-1 text-right">{message.length}/400</p>

            <div className="flex gap-2 mt-4">
              <button type="button" className="btn-secondary flex-1" onClick={() => setOpen(false)} disabled={sending}>Cancelar</button>
              <button type="button" className="btn-primary flex-1" onClick={send} disabled={sending}>{sending ? 'Enviando…' : 'Enviar solicitud'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
