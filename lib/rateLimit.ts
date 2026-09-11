import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";

// T-A4: limitador simple basado en Postgres (sin infra nueva) — cuenta
// intentos por clave en una ventana deslizante y bloquea al superar el
// máximo. No reemplaza al API Gateway corporativo con Cloud Armor
// (Pilar 5.5); es un mínimo mientras no exista.
export async function checkRateLimit(key: string, opts: { max: number; windowMinutes: number }): Promise<boolean> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - opts.windowMinutes * 60_000).toISOString();
  await supabase.from("rate_limit_events").insert({ key });
  const { count } = await supabase
    .from("rate_limit_events")
    .select("*", { count: "exact", head: true })
    .eq("key", key)
    .gte("created_at", since);
  // Limpieza oportunista de eventos vencidos de esta clave — no bloqueante.
  void supabase.from("rate_limit_events").delete().eq("key", key).lt("created_at", since);
  return (count ?? 0) <= opts.max;
}

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}
