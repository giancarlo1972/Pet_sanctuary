import { supabase } from '@/lib/supabase';

export async function logAudit(opts: {
  actorId: string;
  actingAs?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  meta?: Record<string, unknown>;
}) {
  const row = {
    actor_id: opts.actorId,
    acting_as: opts.actingAs || null,
    action: opts.action,
    target_type: opts.targetType,
    target_id: opts.targetId || null,
    subject_type: opts.targetType,
    subject_id: opts.targetId || null,
    meta: opts.meta || {},
    detail: opts.meta || {},
  };
  const { error } = await supabase.from('audit_log').insert(row);
  if (error) {
    await supabase.from('audit_log').insert({
      actor_id: opts.actorId,
      action: opts.action,
      subject_type: opts.targetType,
      subject_id: opts.targetId || null,
    });
  }
}
