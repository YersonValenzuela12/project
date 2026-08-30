import { supabase } from './supabase';

type LogActivityInput = {
  actorName: string;
  action: string;
  target?: 'work_order' | 'form_submission' | 'document' | 'user';
  detail?: string;
};

export async function logActivity({ actorName, action, target, detail }: LogActivityInput) {
  const { error } = await supabase.from('audit_logs').insert({
    actor_name: actorName,
    action,
    target: target ?? null,
    detail: detail ?? null,
  });
  if (error) console.error('Error al registrar actividad:', error);
}
