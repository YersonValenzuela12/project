import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Loads everyone's skills, but only if the administrator allowed the current role to see them.
// The permission is enforced by the database (policy on user_skills), not just by this screen.
export function useTeamSkills() {
  const [skills, setSkills] = useState<Map<string, string[]>>(new Map());
  const [canSee, setCanSee] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: allowed } = await supabase.rpc('can_view_team_skills');
      if (!alive) return;
      if (!allowed) { setCanSee(false); return; }
      const { data } = await supabase.from('user_skills').select('user_id, skills');
      if (!alive) return;
      setSkills(new Map((data ?? []).map((r: any) => [r.user_id, Array.isArray(r.skills) ? r.skills : []])));
      setCanSee(true);
    })();
    return () => { alive = false; };
  }, []);

  return { skills, canSee };
}

export function SkillChips({ skills, max = 3 }: { skills?: string[]; max?: number }) {
  if (!skills || skills.length === 0) {
    return <span className="text-[11px] text-ink-300">Sin habilidades registradas</span>;
  }
  const shown = skills.slice(0, max);
  const extra = skills.length - shown.length;
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((s) => (
        <span key={s} className="rounded-full bg-primary-50 text-primary-700 text-[10px] font-medium px-2 py-0.5 truncate max-w-[150px]">{s}</span>
      ))}
      {extra > 0 && (
        <span title={skills.slice(max).join(', ')} className="rounded-full bg-ink-100 text-ink-500 text-[10px] font-medium px-2 py-0.5">+{extra}</span>
      )}
    </span>
  );
}
