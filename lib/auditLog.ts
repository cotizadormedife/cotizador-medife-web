import { createServiceClient } from "@/lib/supabase/service";

// T-A5: antes cada punto de llamada insertaba en audit_log sin revisar el
// resultado — si la escritura fallaba, la acción privilegiada se consumaba
// igual, sin dejar registro. Acá se lanza si falla, para que la Server
// Action que la usa aborte (y el usuario vea un error) en vez de perder la
// traza en silencio.
export async function logAction(params: {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("audit_log").insert({
    actor_id: params.actorId,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    meta: params.meta,
  });
  if (error) {
    throw new Error(`No se pudo registrar la auditoría de "${params.action}": ${error.message}`);
  }
}
